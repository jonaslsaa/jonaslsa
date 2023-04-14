import { type NextApiRequest, type NextApiResponse } from "next";

import { prisma } from "../../../server/db/client";

import type { Tweet} from "rettiwt-api";
import { Rettiwt, TweetFilter } from "rettiwt-api"
import { env } from "../../../env/server.mjs";
import { Configuration, OpenAIApi } from "openai";
import { usersToScrape } from "../../../server/common/usersToScrape";

const openai = new OpenAIApi(new Configuration({ apiKey: env.OPENAI_API_KEY }));

const AUTH_TOKEN = "perlerdarlig"; // temporary

const usersToScrapeList = Object.values(usersToScrape).flat();

const userToLocationBias = new Map([
  // Police
  ['politietsorost',  'point:59.2736681, 10.40305903'],
  ['oslopolitiops',   'point:59.9138688, 10.75224541'],
  ['politietost',     'point:59.7155459, 10.83161895'],
  ['politietsorvest', 'point:58.9636489, 5.735737659'],
  ['politiagder',     'point:58.1471410, 7.998652932'],
  ['politiinnlandet', 'point:60.7960557, 11.09422286'],
  ['politinordland',  'point:67.2886571, 14.39942244'],
  ['politifinnmark',  'point:69.7306470, 30.02526065'],
  ['PolitiTrondelag', 'point:63.4397447, 10.39951882'],
  ['PolitiMRpd',      'point:62.4767951, 6.143121702'],
  ['politivest',      'point:60.3929948, 5.329137019'],
  // Fire
  ['110Vest',         'point:60.3929948, 5.329137019'],
  ['110Bodo',         'point:67.2886571, 14.39942244'],
  ['110Innlandet',    'point:60.7960557, 11.09422286'],
  ['sorost110',       'point:59.2736681, 10.40305903'],
  ['Oslo110sentral',  'point:59.9138688, 10.75224541'],
]);

const startOfSearch = new Date();
startOfSearch.setDate(startOfSearch.getDate() - 1);

type MyTweet = {
  id: string;
  createdAt: Date;
  tweetHandle: string;
  content: string;
  replyTo: string | null;
};

type CategorizedTweet = MyTweet & {
  location: string;
  type: string;
  time: string;
  severity: 'LOW' | 'MED' | 'HIGH' | null;
  summary: string;
};

type LocatedTweet = CategorizedTweet & {
  lat: number;
  lng: number;
};

const MAX_PAGES = 48;
const getTodaysTweets = async (usernameMap: Map<string, string>) => {
  const rettiwt = Rettiwt();
  const tweetService = rettiwt.tweets;
  const tweetFilter = new TweetFilter({fromUsers: usersToScrapeList, startDate: startOfSearch.toISOString()});
  console.log('Fetching tweets from ' + startOfSearch.toISOString());
  const tweets: MyTweet[] = [];
  let nextCursor: string | undefined = undefined;
  let i = 0;
  do {
    const tweetBatch: {next: {value: string}, list: Tweet[]} = await tweetService.getTweets(tweetFilter, 18, nextCursor);
    let shouldStop = false;
    tweets.push(...tweetBatch.list.map(function (tweet) {
      // If we have a tweet from more than 24 hours ago, we can stop fetching
      if (new Date(tweet.createdAt).getTime() < startOfSearch.getTime()) {
        console.log('Tweet outside of search window: ' + tweet.createdAt, " - stopping");
        shouldStop = true;
      }
      return {
        id: tweet.id,
        createdAt: new Date(tweet.createdAt),
        tweetHandle: usernameMap.get(tweet.tweetBy) ?? 'unknown',
        content: tweet.fullText,
        replyTo: tweet.replyTo
      }
    }));
    nextCursor = tweetBatch.next.value;
    i++;
    if (shouldStop) {
      break;
    }
  } while (nextCursor && i < MAX_PAGES); // Max amount of pages to fetch
  console.log("Pages fetched: " + i);
  return tweets;
};

const fetchHandleIdMap = async () => {
  const rettiwt = Rettiwt();
  const userService = rettiwt.users;
  const handleIdMap = new Map();
  for (const username of usersToScrapeList) {
    const userDetail = await userService.getUserDetails(username);
    handleIdMap.set(userDetail.id, username);
  }
  return handleIdMap;
};

const filterToNewTweets = async (tweets: MyTweet[]) => {
  const existingIncidents = await prisma.incident.findMany({
    where: {
      tweetId: {
        in: tweets.map(tweet => tweet.id)
      }
    },
    select: {
      tweetId: true
    }
  });
  const existingTweetsIds = existingIncidents.map(incident => incident.tweetId);
  const news = tweets.filter(tweet => !existingTweetsIds.includes(tweet.id));
  return news;
}

const mergeReplyToTweets = async (tweets: MyTweet[]) => {
  const parentTweets = tweets.filter(tweet => !tweet.replyTo);
  const tweetsMap = new Map(parentTweets.map(tweet => [tweet.id, tweet]));
  for (const tweet of tweets) {
    if (tweet.replyTo) {
      const parentTweet = tweetsMap.get(tweet.replyTo);
      if (parentTweet) {
        parentTweet.content += `
${tweet.content}`;
      }
    }
  }
  return parentTweets;
}


async function callCompletionModel(prompt: string) {
  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      max_tokens: 512,
      temperature: 0.6,
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
    });
    if (!completion.data || !completion.data.choices || !completion.data.usage) {
      return null;
    }
    const tokens = completion.data.usage.total_tokens;
    const message = completion.data.choices[0]?.message?.content;
    return {tokens, message};
  } catch (e) {
    console.error(e);
    return null;
  }
}

async function categorizeTweetText(tweetText: string) {
  const prompt = `[INCIDENT FROM POLICE]
${tweetText}
Only answer N/A when unknown. Only answer in following in this exact format:
Location: PRIMARY, SECONDARY (no #)
Type: SHORT INCIDENT TYPE (english)
Severity: LOW/MED/HIGH (must be one of these)
Summary: SHORT SUMMARY (english, just "N/A" when not applicable)`
  return await callCompletionModel(prompt);
}

async function simplifyLocationText(locationText: string) {
  const prompt = `Simplify/strip this location place: ${locationText}
Format:
Location: SIMPLIFIED LOCATION`
  const completion = await callCompletionModel(prompt);
  if (!completion || !completion.message) {
    return null;
  }
  try {
    return completion.message.split(':')[1].trim();
  } catch (e) {
    console.error(e);
    return null;
  }
}


function parseCompletion(tweet: MyTweet, completion: string) {
  try {
    const lines = completion.split('\n');
    if (lines.length < 4) {
      return null;
    }
    const location = lines[0].split(':')[1].trim();
    const time = tweet.createdAt.toISOString();
    const type = lines[1].split(':')[1].trim()
    let severity = lines[2].split(':')[1].trim().toUpperCase() as 'LOW' | 'MED' | 'HIGH' | 'N/A' | null;
    if (severity !== 'LOW' && severity !== 'MED' && severity !== 'HIGH') {
      if (severity !== 'N/A') console.log('Invalid severity - Setting to LOW:', severity);
      severity = 'LOW'; // Default
    }
    const summary = lines[3].split(':')[1].trim();
    if (type === 'N/A' || location === 'N/A') {
      console.log('Marking tweet as invalid:', tweet.id, "-", type, location);
      severity = null; // Mark as invalid
    }
    return {location, time, type, severity, summary};
  } catch (e) {
    console.error('Error parsing completion', e);
    return null;
  }
}

const catogorizeTweets = async (tweets: MyTweet[]) => {
  const categorizedTweets: CategorizedTweet[] = [];
  let total_tokens = 0;
  for (const tweet of tweets) {
    if (tweet.content.length < 10) {
      console.log('Skipping tweet with short content', tweet);
      continue;
    }
    const completion = await categorizeTweetText(tweet.content);
    
    if (!completion?.message) continue;
    total_tokens += completion.tokens;
    const parsedCompletion = parseCompletion(tweet, completion.message);
    if (parsedCompletion) {
      categorizedTweets.push({
        ...tweet,
        ...parsedCompletion
      });
    }
  }
  return {categorizedTweets, tokens: total_tokens};
}

const findCoordinatesFromText = async (tweetHandle: string, text: string) => {
  const locationBias = userToLocationBias.get(tweetHandle) ?? '';
  const PlaceFromTextEndpoint = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json?inputtype=textquery&fields=geometry&language=no&locationbias=" + locationBias;
  const PlaceFromTextKey = env.GOOGLE_PLACES_API_KEY;
  const PlaceFromTextUrl = `${PlaceFromTextEndpoint}&key=${PlaceFromTextKey}&input=${text}`;
  const response = await fetch(PlaceFromTextUrl);
  const data = await response.json();
  if (data.status === "OK") {
    const location = data.candidates[0].geometry.location;
    return {lat: location.lat, lng: location.lng};
  } else {
    console.log("error getting place", data, text);
  }
  return null;
}

function cleanUpTweetLocationText(text: string) {
  text = text.replace('N/A', '').trim(); // Remove N/A
  text = text.replace('n/a', '').trim(); // Remove n/a
  text = text.replace('(no #)', '').trim(); // Remove (no #)
  if (text.endsWith(',')) text = text.slice(0, -1); // Remove trailing comma
  if (text.startsWith(',')) text = text.slice(1); // Remove leading comma
  return text.trim();
}

const localizeTweets = async (tweets: CategorizedTweet[]) => {
  const localizedTweets: LocatedTweet[] = [];
  for (const tweet of tweets) {
    let coordinates: {lat: 0, lng: 0} | null = {lat: 0, lng: 0};
    if (tweet.severity !== null) { // Only localize valid tweets
      tweet.location = cleanUpTweetLocationText(tweet.location);
      if (tweet.location.length <= 1) continue; // Skip tweets with next to no location text
      coordinates = await findCoordinatesFromText(tweet.tweetHandle, tweet.location);
      if (coordinates === null) {
        console.log("Could not find coordinates for", tweet.location, "trying to simplify...");
        const simplifiedLocation = await simplifyLocationText(tweet.location);
        if (simplifiedLocation) {
          coordinates = await findCoordinatesFromText(tweet.tweetHandle, simplifiedLocation);
        }
        if (coordinates === null) {
          console.log("Could not find coordinates for", simplifiedLocation, "giving up");
        }
      }
    }
    if (coordinates !== null) {
      localizedTweets.push({
        ...tweet,
        lat: coordinates.lat,
        lng: coordinates.lng
      });
    }
  }
  return localizedTweets;
}


const GetNewTweets = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    res.status(400).json({ error: 'Bad request' });
    return;
  }
  if (req.query.token !== AUTH_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const startTimer = Date.now();
  const usernameMap = await fetchHandleIdMap();

  const tweets = await getTodaysTweets(usernameMap);
  console.log(`Got ${tweets.length} tweets, took ${Date.now() - startTimer}ms`);
  const newTweets = await filterToNewTweets(tweets);
  console.log(`Got ${newTweets.length} new tweets`);
  const parentTweets = await mergeReplyToTweets(newTweets);
  console.log(`Got ${parentTweets.length} parent tweets`);
  const { categorizedTweets, tokens } = await catogorizeTweets(parentTweets);
  console.log(`Got ${categorizedTweets.length} categorized tweets`);
  const localizedTweets = await localizeTweets(categorizedTweets);
  console.log(`Got ${localizedTweets.length} localized tweets`);

  // Save to database
  const saved = await prisma.incident.createMany({
    data: localizedTweets.map(tweet => ({
      fromTwitterHandle: tweet.tweetHandle,
      tweetId: tweet.id,
      content: tweet.content,
      lat: tweet.lat,
      lng: tweet.lng,
      location: tweet.location,
      time: tweet.time,
      type: tweet.type,
      severity: tweet.severity,
      summary: tweet.summary
    })),
    skipDuplicates: true
  });

  console.log(`Saved ${saved.count} new tweets`);

  const tookTime = Date.now() - startTimer;
  
  res.status(200).json({ tweets: localizedTweets, saved: saved.count, tookTime, tokens });
};

export default GetNewTweets;
