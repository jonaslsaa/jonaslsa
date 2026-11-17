export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, jsonSchema, Output } from "ai";
import { z } from "zod";
import { env } from "../../../../env/server.mjs";
import { PrismaClient } from '@prisma/client';
import type { MessageThread } from '../../../../lib/politiet-api-client';
import { PolitietApiClient } from '../../../../lib/politiet-api-client';
import { districtToLocationBias } from '../../../../lib/districts';
import { withDbRetry } from '../../../../server/db/retry';
import { type NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
const incidentModel = openrouter("deepseek/deepseek-v4-flash-0731", {
  extraBody: {
    reasoning: {
      enabled: false,
      exclude: true,
    },
  },
});

const batchSize = 12;
// Stop starting new chunks after this, so the function returns before the
// 300s maxDuration instead of being killed. Unfinished threads are picked up
// by the next run (stored threads are skipped).
const TIME_BUDGET_MS = 230_000;

function isOverBudget(startedAt: number) {
  return Date.now() - startedAt > TIME_BUDGET_MS;
}

// Geocode and store a chunk of parsed threads concurrently; returns how many
// were stored.
async function upsertChunk(
  chunk: MessageThread[],
  parseResults: Record<string, Awaited<ReturnType<typeof parseIncident>>>,
) {
  const stored = await Promise.all(chunk.map(async (thread) => {
    const parsed = parseResults[thread.id];
    if (!parsed) return false;
    try {
      return await upsertThreadInDb(thread, parsed);
    } catch (err) {
      console.error(`Could not store thread ${thread.id}:`, err);
      return false;
    }
  }));
  return stored.filter(Boolean).length;
}

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

type Incident = z.infer<typeof IncidentSchema>;

const IncidentOutputSchema = jsonSchema<Incident>(
  {
    type: "object",
    properties: {
      location: { type: "string" },
      type: { type: "string" },
      severity: { type: "string", enum: ["LOW", "MED", "HIGH"] },
      summary: { type: "string" },
    },
    required: ["location", "type", "severity", "summary"],
    additionalProperties: false,
  },
  {
    validate(value) {
      const result = IncidentSchema.safeParse(value);
      return result.success
        ? { success: true, value: result.data }
        : { success: false, error: result.error };
    },
  },
);

const INCIDENT_SYSTEM_PROMPT = `
You extract one map incident from chronological Norwegian police-log messages. Return only the required structured fields.

Language
- Write type and summary in English. This is mandatory even when every source message is Norwegian.
- Keep Norwegian place names unchanged in location. Never translate a road, landmark, neighborhood, area, or municipality name.
- Translate Norwegian police terminology idiomatically. In this context, "rabiat" means aggressive or highly agitated, never rabid.

Accuracy
- Use only facts in the report. Do not infer an arrest, injury, cause, or exact address that is not stated.
- "Anmeldt" means reported or that a case was filed; it does not mean arrested. "Innbrakt" means brought in or detained; use "arrested" only when the report says "pågrepet" or "arrestert".
- Later messages update earlier ones. Report the latest known outcome while retaining important confirmed facts such as a critical injury.

Fields
- location: A comma-separated geocoding query ordered from the most precise named place or road to area and municipality. Include useful road numbers, roads, landmarks, area, and municipality. Exclude police district, county, and Norway.
- type: A short, specific English noun phrase. Prioritize the most safety-relevant explicit event: for example "Vehicle fire", "Dangerous driving", "Assault on police", "Speed enforcement", or "Single-vehicle accident".
- severity:
  - HIGH: death, critical or life-threatening injury, an uncontrolled major fire, or another major immediate threat to life.
  - MED: meaningful active safety risk or disruption, non-critical injury, violence, dangerous driving, a fire or road closure, a vulnerable missing person, or speed enforcement involving licence seizures.
  - LOW: routine enforcement, a minor or resolved event with no injury and no meaningful remaining danger, or a false alarm.
  Resolution may reduce severity, but never reduce confirmed death or critical/life-threatening injury.
- summary: One English sentence of at most 35 words. Include the latest outcome and, when relevant, injuries, traffic impact, or whether the danger was resolved. Preserve important numbers.
`.trim();

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
// Single-thread model call
// ------------------------------------------------------------------
async function parseIncident(thread: MessageThread): Promise<Incident> {
  const { output } = await generateText({
    model: incidentModel,
    system: INCIDENT_SYSTEM_PROMPT,
    prompt: parseMessageThread(thread),
    output: Output.object({
      schema: IncidentOutputSchema,
      name: "incident",
    }),
  });

  return output;
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

    // Run parseIncident in parallel for this chunk. One failed model call
    // must not abort the whole run, so failures are logged and skipped.
    const promises = chunk.map(async (thread) => {
      try {
        const parsed = await parseIncident(thread);
        return { id: thread.id, parsed };
      } catch (err) {
        console.error(`Could not parse thread ${thread.id}:`, err);
        return { id: thread.id, parsed: null };
      }
    });

    // Wait for the chunk
    const chunkResults = await Promise.all(promises);

    // Store in the result dictionary, keyed by thread ID
    for (const { id, parsed } of chunkResults) {
      if (parsed) result[id] = parsed;
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
let nominatimQueue: Promise<void> = Promise.resolve();

// Nominatim allows 1 request/second. Threads are geocoded concurrently, so
// callers queue up here and are released one at a time.
function waitForNominatimSlot() {
  const slot = nominatimQueue.then(async () => {
    const elapsed = Date.now() - lastNominatimRequestAt;
    if (elapsed < 1100) {
      await new Promise((resolve) => setTimeout(resolve, 1100 - elapsed));
    }
    lastNominatimRequestAt = Date.now();
  });
  nominatimQueue = slot.catch(() => undefined);
  return slot;
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
async function upsertThreadInDb(thread: MessageThread, parsed: Awaited<ReturnType<typeof parseIncident>>): Promise<boolean> {
  if (!parsed || !parsed.location) {
    console.log(`Skipping thread ${thread.id}, parse result is missing or has no location.`);
    return false;
  }

  // 1. Find coordinates
  const coords = await findCoordinatesFromText(thread, parsed.location);
  if (!coords) {
    console.log(`Skipping thread ${thread.id}, coordinate lookup failed.`);
    return false;
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
  return true;
}

// ------------------------------------------------------------------
// Task #1: Fetch the last `hours` hours, insert only *new* threads
//    The cron runs daily, so the default 48h window overlaps the previous
//    run by a full day: threads a time-budgeted (partial) run left behind
//    are picked up the next day. Threads already in the DB are skipped
//    before any model call, and upserts key on tweetId.
// ------------------------------------------------------------------
const DEFAULT_POLL_HOURS = 48;
const MAX_POLL_HOURS = 72;

async function upsertRecentIncidents(client: PolitietApiClient, pollHours: number, startedAt: number) {
  const fromUtc = new Date(Date.now() - pollHours * 3600_000);

  const recentData = await client.getTimeRangedData(fromUtc, new Date());
  const { messageThreads } = recentData;
  console.log(`upsertRecentIncidents: got ${messageThreads.length} threads`);

  // Gather the "tweetId" from each fetched thread
  const fetchedIds = messageThreads.map(t => t.id);

  // Find any that already exist in DB (first query of the run: retry while
  // Railway MySQL wakes from sleep)
  const existingIncidents = await withDbRetry(() => prisma.incident.findMany({
    where: { tweetId: { in: fetchedIds } },
    select: { tweetId: true },
  }), "blip fetch: existing incidents");
  const existingIds = new Set(existingIncidents.map(e => e.tweetId));

  // Filter out threads we already have. Process oldest first, so if the time
  // budget cuts the run short, the threads left over are the newest ones and
  // stay inside the next day's window.
  const newThreads = messageThreads
    .filter(t => !existingIds.has(t.id))
    .sort((a, b) => a.createdOn.getTime() - b.createdOn.getTime());

  if (newThreads.length === 0) {
    return {
      countUpserted: 0,
      totalFetched: messageThreads.length,
      countNew: 0,
      partial: false,
    };
  }

  // Parse and store chunk by chunk, so progress is kept if the function
  // runs out of time on a large window.
  let countUpserted = 0;
  let partial = false;
  for (let i = 0; i < newThreads.length; i += batchSize) {
    if (isOverBudget(startedAt)) {
      partial = true;
      console.warn(`upsertRecentIncidents: time budget reached, ${newThreads.length - i} new threads left for the next run`);
      break;
    }
    const chunk = newThreads.slice(i, i + batchSize);
    const parseResults = await parseIncidentsInBatches(chunk, batchSize);
    countUpserted += await upsertChunk(chunk, parseResults);
  }

  return {
    countUpserted,
    totalFetched: messageThreads.length,
    countNew: newThreads.length,
    partial,
  };
}

// ------------------------------------------------------------------
// Task #2: Refresh still-active incidents
//    Also uses batching for new updates
// ------------------------------------------------------------------
async function refreshActiveIncidents(client: PolitietApiClient, startedAt: number) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // Mark incidents without updates for a week inactive in one query
  const { count: countDisabled } = await withDbRetry(() => prisma.incident.updateMany({
    where: { isActive: true, tweetUpdatedAt: { lt: oneWeekAgo } },
    data: { isActive: false },
  }), "blip fetch: disable stale incidents");

  const activeIncidents = await withDbRetry(() => prisma.incident.findMany({
    where: { isActive: true },
    select: { tweetId: true, updates: true },
  }), "blip fetch: active incidents");
  console.log(`refreshActiveIncidents: disabled ${countDisabled}, ${activeIncidents.length} still active`);

  let countUpdated = 0;
  let partial = false;

  // Fetch the latest version of each active thread, a few at a time
  const threadsToUpdate: MessageThread[] = [];
  const fetchConcurrency = 4;
  for (let i = 0; i < activeIncidents.length; i += fetchConcurrency) {
    if (isOverBudget(startedAt)) {
      partial = true;
      break;
    }
    const slice = activeIncidents.slice(i, i + fetchConcurrency);
    await Promise.all(slice.map(async (incident) => {
      try {
        const thread = await client.getThreadById(incident.tweetId);
        if (thread.messages.length > incident.updates) {
          threadsToUpdate.push(thread);
        }
      } catch (err) {
        console.error(`Could not refresh thread ${incident.tweetId}:`, err);
      }
    }));
  }

  // Parse and store updated threads chunk by chunk
  for (let i = 0; i < threadsToUpdate.length; i += batchSize) {
    if (isOverBudget(startedAt)) {
      partial = true;
      break;
    }
    const chunk = threadsToUpdate.slice(i, i + batchSize);
    const parseResults = await parseIncidentsInBatches(chunk, batchSize);
    countUpdated += await upsertChunk(chunk, parseResults);
  }

  if (partial) {
    console.warn("refreshActiveIncidents: time budget reached, remaining refreshes left for the next run");
  }

  return { countDisabled, countUpdated, partial };
}

// ------------------------------------------------------------------
// Handler: Vercel Cron calls GET daily with `Authorization: Bearer $CRON_SECRET`.
// POST is kept for manual runs. `?hours=N` (max 72) widens the window for a
// one-off backfill.
// ------------------------------------------------------------------
async function handleFetch(req: NextRequest) {
  // 1) Authorization check
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization') ?? '';
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const hoursParam = Number(req.nextUrl.searchParams.get('hours'));
  const pollHours = Number.isFinite(hoursParam) && hoursParam > 0
    ? Math.min(hoursParam, MAX_POLL_HOURS)
    : DEFAULT_POLL_HOURS;

  const timestampStart = new Date();

  const client = new PolitietApiClient();

  try {
    // A) Insert new incidents from the poll window
    const startedAt = timestampStart.getTime();
    const recent = await upsertRecentIncidents(client, pollHours, startedAt);
    const { countUpserted, totalFetched, countNew } = recent;

    // B) Refresh active incidents
    const refresh = await refreshActiveIncidents(client, startedAt);
    const { countDisabled, countUpdated } = refresh;

    const stats = {
      pollHours,
      partial: recent.partial || refresh.partial,
      totalFetched,
      countNew,
      countUpserted,
      countDisabled,
      countUpdated,
    };
    console.log("/api/blip/fetch:", stats);

    return NextResponse.json({
      success: true,
      message: "Incident data updated successfully.",
      stats: stats,
      startedAt: timestampStart.toISOString(),
      finishedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in /api/blip/fetch:", error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
    });
  }
}

export const GET = handleFetch;
export const POST = handleFetch;
