import type { NextRequest } from 'next/server';
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { env } from "../../../env/server.mjs";
import type { MessageThread } from '../../lib/politiet-api-client';

const openai = new OpenAI({apiKey: env.OPENAI_API_KEY});

const districtToLocationBias = new Map([
  // Police
  ['Sør-Øst Politidistrikt',  'point:59.2736681, 10.40305903'],
  ['Oslo Politidistrikt',   'point:59.9138688, 10.75224541'],
  ['Øst Politidistrikt',     'point:59.7155459, 10.83161895'],
  ['Sør-Vest Politidistrikt', 'point:58.9636489, 5.735737659'],
  ['Agder Politidistrikt',     'point:58.1471410, 7.998652932'],
  ['Innlandet Politidistrikt', 'point:60.7960557, 11.09422286'],
  ['Nordland Politidistrikt',  'point:67.2886571, 14.39942244'],
  ['Finnmark Politidistrikt',  'point:69.7306470, 30.02526065'],
  ['Trøndelag Politidistrikt', 'point:63.4397447, 10.39951882'],
  ['Møre og Romsdal Politidistrikt', 'point:62.4767951, 6.143121702'],
  ['Vest Politidistrikt',      'point:60.3929948, 5.329137019'],
  ['Troms Politidistrikt',     'point:69.6598271, 18.96782164'],
]);

const IncidentSchema = z.object({
  location: z.string(),
  type: z.string(),
  severity: z.enum(['LOW', 'MED', 'HIGH']),
  summary: z.string(),
});

function parseMessageThread(messageThread: MessageThread) {
  const district = messageThread.district;
  const municipality = messageThread.municipality;
  const majorCategory = messageThread.category;
  const thread = messageThread.messages;
  
  let sb = "Here is the police report:\n";
  sb += `For ${district}, in municipality ${municipality}\n`;
  sb += `Major category: ${majorCategory}\n`;
  sb += `\nChronological order of events/messages:\n`;
  for (const message of thread) {
    sb += ` > ${message.text}\n`;
  }

  return sb;
}

const findCoordinatesFromText = async (district: string, text: string) => {
  const locationBias = districtToLocationBias.get(district) ?? '';
  console.log('Location bias for district', district, ': ', locationBias);
  const PlaceFromTextEndpoint = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json?inputtype=textquery&fields=geometry&language=no&locationbias=" + locationBias;
  const response = await fetch(`${PlaceFromTextEndpoint}&key=${env.GOOGLE_PLACES_API_KEY}&input=${text}`);
  const data = await response.json();
  if (data.status === "OK") {
    const location = data.candidates[0].geometry.location;
    return {lat: location.lat, lng: location.lng};
  } else {
    console.log("error getting place", data, text);
  }
  return null;
}

async function parseIncident(messageThread: MessageThread) {

  const incidentString = parseMessageThread(messageThread);

  const systemPrompt = `
Extract information this police incident report/messages.
Infer from the report the following:
- Location: The location of the incident in a clear and disambiguated way, format: PRIMARY, SECONDARY (used to look up coordinates on Google Maps)
- Type: The type of incident (very short description, e.g. Traffic obstruction, Fire, Pedestrian hit by tram, etc.)
- Severity: The severity of the incident (LOW/MED/HIGH)
- Summary: A short summary of the incident (short description, just "N/A" when not applicable)
`.trim();
  const completion = await openai.beta.chat.completions.parse({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: incidentString },
    ],
    response_format: zodResponseFormat(IncidentSchema, "incident"),
  });

  const incident = completion.choices[0].message.parsed;
  return incident;
}

export function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', {
      status: 401,
    });
  }

  // TODO

  return Response.json({ success: true });
}