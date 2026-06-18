export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
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

const batchSize = 12;

type Coordinates = {
  lat: number;
  lng: number;
};

type MapboxFeature = {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    name?: string;
    full_address?: string;
    place_formatted?: string;
    feature_type?: string;
  };
};

type NominatimResult = {
  lat: string;
  lon: string;
  display_name?: string;
};

// --- Zod Schemas ---
const IncidentSchema = z.object({
  location: z.string(),
  type: z.string(),
  severity: z.enum(['LOW', 'MED', 'HIGH']),
  summary: z.string(),
});

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

// ------------------------------------------------------------------
// Single-thread GPT call
// ------------------------------------------------------------------
async function parseIncident(thread: MessageThread) {
  const textForGPT = parseMessageThread(thread);

  const systemPrompt = `
Extract information from this police incident report/messages. MUST be written in English.
Infer from the report the following:
- Location: The location of the incident in a clear and disambiguated way (will be feed to Google Maps, so try to infer the best location to present). Format: "Primary, secondary, [tertiary]". Example: "Trafikkontroll på Spongdalsvegen ved Berg (Trondheim municipality)" -> "Berg, Spongdalsvegen, Trondheim"
  Prefer the police-provided area and municipality when they are available. Keep road numbers, named roads, neighborhoods, landmarks, and municipality names, but do not add police district names, county names, or "Norway" unless the report itself needs that to avoid ambiguity.
- Type: The type of incident (short phrase, e.g. "Traffic obstruction", "Fire", etc.)
- Severity: The severity (LOW/MED/HIGH)
- Summary: A short summary, or "N/A" if not applicable.
`.trim();

  const response = await openai.responses.parse({
    model: "gpt-4o-mini",
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: textForGPT },
    ],
    text: {
      format: zodTextFormat(IncidentSchema, "incident"),
    },
  });

  return response.output_parsed; // { location, type, severity, summary }
}

// ------------------------------------------------------------------
// Batch multiple parseIncident calls, chunk size = batchSize
// ------------------------------------------------------------------
async function parseIncidentsInBatches(
  threads: MessageThread[],
  batchSize
): Promise<Record<string, Awaited<ReturnType<typeof parseIncident>>>> {
  const result: Record<string, Awaited<ReturnType<typeof parseIncident>>> = {};
  
  // Simple chunking
  for (let i = 0; i < threads.length; i += batchSize) {
    const chunk = threads.slice(i, i + batchSize);

    // Run parseIncident in parallel for this chunk
    const promises = chunk.map(async (thread) => {
      const parsed = await parseIncident(thread);
      return { id: thread.id, parsed };
    });

    // Wait for the chunk
    const chunkResults = await Promise.all(promises);

    // Store in the result dictionary, keyed by thread ID
    for (const { id, parsed } of chunkResults) {
      result[id] = parsed;
    }
  }

  return result;
}

// ------------------------------------------------------------------
function districtToMapboxProximity(district: string) {
  const locationBias = districtToLocationBias.get(district);
  const match = locationBias?.match(/^point:([\d.-]+),\s*([\d.-]+)$/);
  if (!match) return null;

  const [, lat, lng] = match;
  return `${lng},${lat}`;
}

function normalizeLocationText(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqueNonEmpty(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function buildGeocodeQueries(thread: MessageThread, location: string) {
  const areaQuery = thread.area
    ? `${thread.area}, ${thread.municipality}, Norway`
    : "";
  return uniqueNonEmpty([
    [location, thread.area, thread.municipality, "Norway"].filter(Boolean).join(", "),
    [location, thread.municipality, "Norway"].filter(Boolean).join(", "),
    location,
    areaQuery,
    `${thread.municipality}, Norway`,
  ]);
}

function getMapboxFeatureText(feature: MapboxFeature) {
  return normalizeLocationText(
    [
      feature.properties?.name,
      feature.properties?.full_address,
      feature.properties?.place_formatted,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function isRoadLikeLocation(text: string) {
  return /\b(e|rv|fv|fylkesvei|riksvei)\s*\d+\b/i.test(text) || /\bvegen\b|\bveien\b|\bgata\b|\bgaten\b/i.test(text);
}

function hasLocationPhrase(haystack: string, needle: string) {
  if (!needle) return false;
  return new RegExp(`(^| )${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(haystack);
}

function isConfidentMapboxMatch(feature: MapboxFeature, query: string, thread: MessageThread) {
  const featureText = getMapboxFeatureText(feature);
  const featureName = normalizeLocationText(feature.properties?.name ?? "");
  const area = normalizeLocationText(thread.area);
  const municipality = normalizeLocationText(thread.municipality);
  const primary = normalizeLocationText(query.split(",")[0] ?? "");
  const featureType = feature.properties?.feature_type ?? "";
  const hasArea = hasLocationPhrase(featureText, area);
  const hasMunicipality = hasLocationPhrase(featureText, municipality);
  const hasPrimary = hasLocationPhrase(featureText, primary);
  const isStreetOrAddress = featureType === "street" || featureType === "address";

  if (!featureText || !primary) return false;

  if (isStreetOrAddress) {
    return hasMunicipality && (hasArea || hasPrimary || featureName === primary || primary === municipality);
  }

  if (hasArea) return true;
  if (hasPrimary && primary !== municipality) return true;
  if (primary === municipality && hasMunicipality) return true;

  if (isRoadLikeLocation(query) && hasMunicipality && featureName === primary) {
    return true;
  }

  return false;
}

async function findCoordinatesWithMapbox(thread: MessageThread, location: string): Promise<Coordinates | null> {
  if (!env.MAPBOX_ACCESS_TOKEN) return null;

  const proximity = districtToMapboxProximity(thread.district);

  for (const query of buildGeocodeQueries(thread, location)) {
    if (query === `${thread.municipality}, Norway`) continue;

    const endpoint = new URL("https://api.mapbox.com/search/geocode/v6/forward");
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("country", "no");
    endpoint.searchParams.set("language", "no");
    endpoint.searchParams.set("limit", "5");
    endpoint.searchParams.set("access_token", env.MAPBOX_ACCESS_TOKEN);

    if (proximity) {
      endpoint.searchParams.set("proximity", proximity);
    }

    try {
      const response = await fetch(endpoint);
      const data = await response.json();
      if (!response.ok) {
        console.log("Mapbox API gave an unexpected response:", data, "for", query, `(${proximity ?? 'no proximity'})`);
        continue;
      }

      const feature = (data.features as MapboxFeature[] | undefined)?.find((candidate) =>
        isConfidentMapboxMatch(candidate, query, thread),
      );
      const coordinates = feature?.geometry?.coordinates;
      if (coordinates) {
        const [lng, lat] = coordinates;
        return { lat, lng };
      }
    } catch (err) {
      console.error("Error fetching place from Mapbox:", err);
    }
  }

  console.log("Mapbox did not find a confident coordinate match for", location, `(${thread.area}, ${thread.municipality})`);
  return null;
}

let lastNominatimRequestAt = 0;

async function waitForNominatimSlot() {
  const elapsed = Date.now() - lastNominatimRequestAt;
  if (elapsed < 1100) {
    await new Promise((resolve) => setTimeout(resolve, 1100 - elapsed));
  }
  lastNominatimRequestAt = Date.now();
}

async function findCoordinatesWithNominatim(thread: MessageThread, location: string): Promise<Coordinates | null> {
  for (const query of buildGeocodeQueries(thread, location)) {
    const endpoint = new URL("https://nominatim.openstreetmap.org/search");
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("countrycodes", "no");
    endpoint.searchParams.set("format", "jsonv2");
    endpoint.searchParams.set("limit", "1");
    endpoint.searchParams.set("accept-language", "no");

    try {
      await waitForNominatimSlot();
      const response = await fetch(endpoint, {
        headers: {
          "user-agent": "jonaslsa-blip/1.0",
        },
      });
      const data = await response.json();
      const result = (data as NominatimResult[] | undefined)?.[0];
      if (response.ok && result) {
        const lat = Number(result.lat);
        const lng = Number(result.lon);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return { lat, lng };
        }
      }
    } catch (err) {
      console.error("Error fetching place from Nominatim:", err);
    }
  }

  return null;
}

// Helper: Mapbox/Nominatim/Google Places => findCoordinatesFromText
// ------------------------------------------------------------------
async function findCoordinatesFromText(thread: MessageThread, text: string) {
  const mapboxCoords = await findCoordinatesWithMapbox(thread, text);
  if (mapboxCoords) {
    return mapboxCoords;
  }

  const nominatimCoords = await findCoordinatesWithNominatim(thread, text);
  if (nominatimCoords) {
    return nominatimCoords;
  }

  const locationBias = districtToLocationBias.get(thread.district) ?? '';
  if (locationBias === '') {
    console.warn('Location bias for district', thread.district, 'is empty, using no bias');
  }
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

// ------------------------------------------------------------------
// Helper: Convert date to naive Oslo time (just +1 hour)
// ------------------------------------------------------------------
function toOsloTime(date: Date): Date {
  const OSLO_OFFSET = 1; // +1 hour from UTC
  return new Date(date.getTime() + OSLO_OFFSET * 3600_000);
}

// ------------------------------------------------------------------
// Helper: Upsert a single thread (with a parse result)
// ------------------------------------------------------------------
async function upsertThreadInDb(thread: MessageThread, parsed: Awaited<ReturnType<typeof parseIncident>>) {
  if (!parsed || !parsed.location) {
    console.log(`Skipping thread ${thread.id}, parse result is missing or has no location.`);
    return;
  }

  // 1. Find coordinates
  const coords = await findCoordinatesFromText(thread, parsed.location);
  if (!coords) {
    console.log(`Skipping thread ${thread.id}, coordinate lookup failed.`);
    return;
  }

  // 2. Build up fields
  const updatesCount = thread.messages.length;
  const incidentCreated = toOsloTime(thread.createdOn);
  const lastMessageOn = toOsloTime(thread.lastMessageOn);
  const entireContent = parseMessageThread(thread);

  // 3. Upsert
  await prisma.incident.upsert({
    where: { tweetId: thread.id },
    update: {
      isActive: thread.isActive,
      fromTwitterHandle: thread.district,
      tweetUpdatedAt: lastMessageOn,
      updates: updatesCount,
      content: "",
      lat: coords.lat,
      lng: coords.lng,
      location: parsed.location,
      time: incidentCreated,
      type: parsed.type,
      severity: parsed.severity,
      summary: parsed.summary,
    },
    create: {
      isActive: thread.isActive,
      tweetId: thread.id,
      fromTwitterHandle: thread.district,
      tweetUpdatedAt: lastMessageOn,
      updates: updatesCount,
      content: "",
      lat: coords.lat,
      lng: coords.lng,
      location: parsed.location,
      time: incidentCreated,
      type: parsed.type,
      severity: parsed.severity,
      summary: parsed.summary,
    },
  });
}

// ------------------------------------------------------------------
// Task #1: Fetch last 12 hours, insert only *new* threads
//    Batches GPT calls in parseIncidentsInBatches
// ------------------------------------------------------------------
async function upsertRecentIncidents(client: PolitietApiClient) {
  const POLL_LAST_N_HOURS = 12;
  const twelveHoursAgoUtc = new Date();
  twelveHoursAgoUtc.setHours(twelveHoursAgoUtc.getHours() - POLL_LAST_N_HOURS);

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

  // Filter out threads we already have
  const newThreads = messageThreads.filter(t => !existingIds.has(t.id));

  if (newThreads.length === 0) {
    return {
      countUpserted: 0,
      totalFetched: messageThreads.length,
    };
  }

  // Parse all new threads in batches (OpenAI calls)
  const parseResults = await parseIncidentsInBatches(newThreads, batchSize);

  // Then upsert the DB
  let countUpserted = 0;
  for (const thread of newThreads) {
    const parsed = parseResults[thread.id];
    if (!parsed) {
      continue;
    }
    await upsertThreadInDb(thread, parsed);
    countUpserted++;
  }

  return {
    countUpserted,
    totalFetched: messageThreads.length,
  };
}

// ------------------------------------------------------------------
// Task #2: Refresh still-active incidents
//    Also uses batching for new updates
// ------------------------------------------------------------------
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

  // We'll hold these threads for parsing in one pass
  const threadsToUpdate: MessageThread[] = [];

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
      const newUpdatesCount = thread.messages.length;

      // If we have new messages, we will parse in batch
      if (newUpdatesCount > incident.updates) {
        threadsToUpdate.push(thread);
      }
    } catch (err) {
      console.error(`Could not refresh thread ${incident.tweetId}:`, err);
    }
  }

  // Now parse them all in a single or chunked batch
  if (threadsToUpdate.length > 0) {
    const parseResults = await parseIncidentsInBatches(threadsToUpdate, batchSize);

    // Upsert each
    for (const thread of threadsToUpdate) {
      const parsed = parseResults[thread.id];
      if (!parsed) {
        continue;
      }
      await upsertThreadInDb(thread, parsed);
      countUpdated++;
    }
  }

  return { countDisabled, countUpdated };
}

// ------------------------------------------------------------------
// Main GET function: run every 30 min by cron
// ------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // 1) Authorization check
  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const timestampStart = new Date();

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
    console.log("POST /api/blip/fetch:", stats);

    return NextResponse.json({
      success: true,
      message: "Incident data updated successfully.",
      stats: stats,
      startedAt: timestampStart.toISOString(),
      finishedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in POST /api/blip/fetch:", error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
    });
  }
}
