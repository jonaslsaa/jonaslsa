import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { env } from "../../../../env/server.mjs";
import { PrismaClient } from '@prisma/client';
import type { MessageThread } from '../../../../lib/politiet-api-client';
import { PolitietApiClient } from '../../../../lib/politiet-api-client';
import { districtToLocationBias } from '../../../../lib/districts';
import { type NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

// --- OpenAI ---
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// --- Zod Schemas ---
const IncidentSchema = z.object({
  location: z.string(),
  type: z.string(),
  severity: z.enum(['LOW', 'MED', 'HIGH']),
  summary: z.string(),
});

/* ------------------------------------------------------------------
  Helper: Build prompt string from a MessageThread
------------------------------------------------------------------ */
function parseMessageThread(thread: MessageThread) {
  const { district, municipality, category, messages, area } = thread;

  let sb = "Here is the police report:\n";
  sb += `For ${district}, in municipality ${municipality}`;
  if (area) sb += `, in area ${area}`;
  sb += `\nMajor category: ${category}\n`;
  sb += "\nChronological order of events/messages:\n";
  for (const msg of messages) {
    sb += ` > ${msg.text}\n`;
  }
  return sb;
}

/* ------------------------------------------------------------------
  Helper: GPT parse
------------------------------------------------------------------ */
async function parseIncident(thread: MessageThread) {
  const textForGPT = parseMessageThread(thread);

  const systemPrompt = `
Extract information from this police incident report/messages. MUST be written in English.
Infer from the report the following:
- Location: The location of the incident in a clear and disambiguated way (will be feed to Google Maps, so try to infer the best location to present). Format: "Primary, secondary, [tertiary]". Example: "Trafikkontroll på Spongdalsvegen ved Berg (Trondheim municipality)" -> "Berg, Spongdalsvegen, Trondheim"
- Type: The type of incident (short phrase, e.g. "Traffic obstruction", "Fire", etc.)
- Severity: The severity (LOW/MED/HIGH)
- Summary: A short summary, or "N/A" if not applicable.
`.trim();

  // Note: model name "gpt-4o-mini" is a placeholder from your sample
  const completion = await openai.beta.chat.completions.parse({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: textForGPT },
    ],
    response_format: zodResponseFormat(IncidentSchema, "incident"),
  });

  return completion.choices[0].message.parsed; // { location, type, severity, summary }
}

/* ------------------------------------------------------------------
  Helper: Google Places => findCoordinatesFromText
------------------------------------------------------------------ */
async function findCoordinatesFromText(district: string, text: string) {
  const locationBias = districtToLocationBias.get(district) ?? '';
  if (locationBias === '') console.warn('Location bias for district', district, 'is empty, using no bias');
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
    console.log("Google Places API gave an unexpected response:", data, "for", text, `(${locationBias})`);
  } catch (err) {
    console.error("Error fetching place from text:", err);
  }
  return null;
}

/* ------------------------------------------------------------------
  Helper: Convert date to naive Oslo time (just +1 hour)
------------------------------------------------------------------ */
function toOsloTime(date: Date): Date {
  const OSLO_OFFSET = 1; // +1 hour from UTC
  return new Date(date.getTime() + OSLO_OFFSET * 3600_000);
}

/* ------------------------------------------------------------------
  Helper: upsertThread
------------------------------------------------------------------ */
async function upsertThread(thread: MessageThread) {
  // 1. Parse with GPT
  const parsed = await parseIncident(thread);
  if (!parsed) {
    console.log(`Skipping thread ${thread.id}, GPT had no valid response.`);
    return;
  }
  if (!parsed.location) {
    console.log(`Skipping thread ${thread.id}, GPT gave no location field.`);
    return;
  }

  // 2. Find coordinates
  const coords = await findCoordinatesFromText(thread.district, parsed.location);
  if (!coords) {
    console.log(`Skipping thread ${thread.id}, coordinate lookup failed.`);
    return;
  }

  // 3. Build up fields
  const updatesCount = thread.messages.length;
  const incidentTimeOslo = toOsloTime(thread.lastMessageOn);
  const entireContent = parseMessageThread(thread);

  // 4. Upsert
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
  Task #1: Fetch last 12 hours, insert only *new* threads
------------------------------------------------------------------ */
async function upsertRecentIncidents(client: PolitietApiClient) {
  const twelveHoursAgoUtc = new Date();
  twelveHoursAgoUtc.setHours(twelveHoursAgoUtc.getHours() - 12);

  const recentData = await client.getTimeRangedData(twelveHoursAgoUtc, new Date());
  const { messageThreads } = recentData;
  console.log(`upsertRecentIncidents: got ${messageThreads.length} threads`);

  // Gather the "tweetId" from each fetched thread
  const fetchedIds = messageThreads.map(t => t.id);

  // Find any that already exist in DB
  const existingIncidents = await prisma.incident.findMany({
    where: { tweetId: { in: fetchedIds } },
    select: { tweetId: true },
  });
  const existingIds = new Set(existingIncidents.map(e => e.tweetId));

  let countUpserted = 0;
  for (const thread of messageThreads) {
    // Skip if we already have this thread in DB
    if (existingIds.has(thread.id)) {
      continue;
    }
    // It's new => upsert
    await upsertThread(thread);
    countUpserted++;
  }

  return {
    countUpserted,
    totalFetched: messageThreads.length,
  };
}

/* ------------------------------------------------------------------
  Task #2: Refresh still-active incidents
------------------------------------------------------------------ */
async function refreshActiveIncidents(client: PolitietApiClient) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // Fetch all active incidents from DB
  const activeIncidents = await prisma.incident.findMany({
    where: { isActive: true },
  });
  console.log(`refreshActiveIncidents: found ${activeIncidents.length} active incidents`);

  let countDisabled = 0;
  let countUpdated = 0;

  for (const incident of activeIncidents) {
    // If older than a week, mark inactive
    if (incident.tweetUpdatedAt < oneWeekAgo) {
      await prisma.incident.update({
        where: { id: incident.id },
        data: { isActive: false },
      });
      countDisabled++;
      continue;
    }

    // If still active, fetch updated thread
    try {
      const thread = await client.getThreadById(incident.tweetId);

      // Compare new messages count to stored updates
      const newUpdatesCount = thread.messages.length;
      if (newUpdatesCount > incident.updates) {
        // There are new messages => upsert
        await upsertThread(thread);
        countUpdated++;
      }
    } catch (err) {
      console.error(`Could not refresh thread ${incident.tweetId}:`, err);
    }
  }

  return { countDisabled, countUpdated };
}

/* ------------------------------------------------------------------
  Main GET function: run every 30 min by cron
------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  // 1) Authorization check
  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const client = new PolitietApiClient();

  try {
    // A) Insert new/incidents from the past 12 hours
    const { countUpserted, totalFetched } = await upsertRecentIncidents(client);

    // B) Refresh active incidents
    const { countDisabled, countUpdated } = await refreshActiveIncidents(client);

    const stats = {
      totalFetched,
      countUpserted,
      countDisabled,
      countUpdated,
    };
    console.log("GET /api/fetch:", stats);

    return NextResponse.json({
      success: true,
      message: "Incident data updated successfully.",
      stats: stats,
    });
  } catch (error) {
    console.error("Error in GET /api/fetch:", error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
    });
  }
}