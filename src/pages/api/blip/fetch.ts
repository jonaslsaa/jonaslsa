import type { NextRequest } from 'next/server';
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { env } from "../../../env/server.mjs";
import { PrismaClient } from '@prisma/client';
import type { MessageThread } from '../../lib/politiet-api-client';
import { PolitietApiClient } from '../../lib/politiet-api-client';
import { NextApiRequest, NextApiResponse } from 'next/types';

const prisma = new PrismaClient();

// --- OpenAI ---
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// --- Location Bias Mapping ---
const districtToLocationBias = new Map([
  ['Sør-Øst Politidistrikt', 'point:59.2736681, 10.40305903'],
  ['Oslo Politidistrikt', 'point:59.9138688, 10.75224541'],
  ['Øst Politidistrikt', 'point:59.7155459, 10.83161895'],
  ['Sør-Vest Politidistrikt', 'point:58.9636489, 5.735737659'],
  ['Agder Politidistrikt', 'point:58.1471410, 7.998652932'],
  ['Innlandet Politidistrikt', 'point:60.7960557, 11.09422286'],
  ['Nordland Politidistrikt', 'point:67.2886571, 14.39942244'],
  ['Finnmark Politidistrikt', 'point:69.7306470, 30.02526065'],
  ['Trøndelag Politidistrikt', 'point:63.4397447, 10.39951882'],
  ['Møre og Romsdal Politidistrikt', 'point:62.4767951, 6.143121702'],
  ['Vest Politidistrikt', 'point:60.3929948, 5.329137019'],
  ['Troms Politidistrikt', 'point:69.6598271, 18.96782164'],
]);

// --- Zod Schemas ---
const IncidentSchema = z.object({
  location: z.string(),
  type: z.string(),
  severity: z.enum(['LOW', 'MED', 'HIGH']),
  summary: z.string(),
});

/* ------------------------------------------------------------------
  Helper: Build a prompt string from a MessageThread
------------------------------------------------------------------ */
function parseMessageThread(messageThread: MessageThread) {
  const { district, municipality, category, messages } = messageThread;

  let sb = "Here is the police report:\n";
  sb += `For ${district}, in municipality ${municipality}\n`;
  sb += `Major category: ${category}\n`;
  sb += `\nChronological order of events/messages:\n`;
  for (const message of messages) {
    sb += ` > ${message.text}\n`;
  }

  return sb;
}

/* ------------------------------------------------------------------
  Helper: GPT parse
------------------------------------------------------------------ */
async function parseIncident(messageThread: MessageThread) {
  const incidentString = parseMessageThread(messageThread);

  const systemPrompt = `
Extract information from this police incident report/messages.
Infer from the report the following:
- Location: The location of the incident in a clear and disambiguated way, format: PRIMARY, SECONDARY
- Type: The type of incident (short phrase, e.g. "Traffic obstruction", "Fire", etc.)
- Severity: The severity (LOW/MED/HIGH)
- Summary: A short summary, or "N/A" if not applicable.
`.trim();

  const completion = await openai.beta.chat.completions.parse({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: incidentString },
    ],
    response_format: zodResponseFormat(IncidentSchema, "incident"),
  });

  return completion.choices[0].message.parsed; // { location, type, severity, summary }
}

/* ------------------------------------------------------------------
  xHelper: Google Places - findCoordinatesFromText
------------------------------------------------------------------ */
async function findCoordinatesFromText(district: string, text: string) {
  const locationBias = districtToLocationBias.get(district) ?? '';
  const placeEndpoint =
    "https://maps.googleapis.com/maps/api/place/findplacefromtext/json" +
    `?inputtype=textquery&fields=geometry&language=no&locationbias=${locationBias}` +
    `&key=${env.GOOGLE_PLACES_API_KEY}&input=${encodeURIComponent(text)}`;

  try {
    const response = await fetch(placeEndpoint);
    const data = await response.json();
    if (data.status === "OK" && data.candidates?.[0]?.geometry?.location) {
      const { lat, lng } = data.candidates[0].geometry.location;
      return { lat, lng };
    }
    console.log("Google Places API gave an unexpected response:", data);
  } catch (err) {
    console.error("Error fetching place from text:", err);
  }
  return null;
}

/* ------------------------------------------------------------------
  Helper: Convert date to naive Oslo time by adding +1 hour
------------------------------------------------------------------ */
function toOsloTime(date: Date): Date {
  const OSLO_OFFSET = 1; // for CET; DST might need +2
  return new Date(date.getTime() + OSLO_OFFSET * 3600_000);
}

/* ------------------------------------------------------------------
  Helper: upsertThread
------------------------------------------------------------------ */
async function upsertThread(thread: MessageThread) {
  const parsed = await parseIncident(thread);
  if (parsed === null) {
    console.log(`Skipping thread ${thread.id}, GPT gave no valid response.`);
    return;
  }

  if (!parsed.location) {
    console.log(`Skipping thread ${thread.id}, GPT gave no location field.`);
    return;
  }

  const coords = await findCoordinatesFromText(thread.district, parsed.location);
  if (!coords) {
    console.log(`Skipping thread ${thread.id}, coordinate lookup failed.`);
    return;
  }

  const updatesCount = thread.messages.length;
  const incidentTimeOslo = toOsloTime(thread.lastMessageOn);
  const entireContent = parseMessageThread(thread);

  // Upsert into Prisma
  await prisma.incident.upsert({
    where: { tweetId: thread.id },
    update: {
      isActive: thread.isActive,
      fromTwitterHandle: thread.district,
      tweetUpdatedAt: thread.updatedOn,
      updates: updatesCount,
      content: entireContent,
      lat: coords.lat,
      lng: coords.lng,
      location: parsed.location,
      time: incidentTimeOslo,
      type: parsed.type,
      severity: parsed.severity,
      summary: parsed.summary,
    },
    create: {
      isActive: thread.isActive,
      tweetId: thread.id,
      fromTwitterHandle: thread.district,
      updates: updatesCount,
      content: entireContent,
      lat: coords.lat,
      lng: coords.lng,
      location: parsed.location,
      time: incidentTimeOslo,
      type: parsed.type,
      severity: parsed.severity,
      summary: parsed.summary,
    },
  });
}

/* ------------------------------------------------------------------
  Task #1: Fetch the last 12 hours of data and upsert
------------------------------------------------------------------ */
async function upsertRecentIncidents(client: PolitietApiClient) {
  const twelveHoursAgoUtc = new Date();
  twelveHoursAgoUtc.setHours(twelveHoursAgoUtc.getHours() - 12);

  // If the API expects local time, adjust. Otherwise pass as is.
  const recentData = await client.getTimeRangedData(twelveHoursAgoUtc, new Date());
  const { messageThreads } = recentData;
  console.log(`upsertRecentIncidents: got ${messageThreads.length} threads`);
  for (const thread of messageThreads) {
    await upsertThread(thread);
  }
  return { countUpserted: messageThreads.length, };
}

/* ------------------------------------------------------------------
  Task #2: Refresh all still-active incidents
------------------------------------------------------------------ */
async function refreshActiveIncidents(client: PolitietApiClient) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const activeIncidents = await prisma.incident.findMany({
    where: { isActive: true },
  });

  let countDisabled = 0;
  let countUpdated = 0;
  for (const incident of activeIncidents) {
    if (incident.tweetUpdatedAt < oneWeekAgo) {
      // Mark as inactive
      await prisma.incident.update({
        where: { id: incident.id },
        data: { isActive: false },
      });
      countDisabled++;
      continue;
    }

    // Else, fetch updated data
    try {
      const thread = await client.getThreadById(incident.tweetId);
      countUpdated++;
      await upsertThread(thread);
    } catch (err) {
      console.error(`Could not refresh thread ${incident.tweetId}:`, err);
    }
  }

  return { countDisabled, countUpdated };
}

/* ------------------------------------------------------------------
  The main GET function (run every 30 minutes by cron)
------------------------------------------------------------------ */
export async function GET(request: NextApiRequest) {
  // 1) Authorization
  /*const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }*/

  // 2) Perform tasks
  const client = new PolitietApiClient();

  try {
    // Step A: Upsert new/incidents from the past 12 hours
    const { countUpserted } = await upsertRecentIncidents(client);

    // Step B: Refresh active incidents
    const { countDisabled, countUpdated } = await refreshActiveIncidents(client);

    return Response.json({ success: true, message: "Incident data updated successfully.", stats: { countUpserted, countDisabled, countUpdated } });
  } catch (error) {
    console.error("Error in GET /api/fetch:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500 }
    );
  }
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const response = await GET(req);
  res.status(response.status).json(response.body);
}

export default handler;