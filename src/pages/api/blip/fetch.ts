import { type NextApiRequest, type NextApiResponse } from "next";

import { prisma } from "../../../server/db/client";

import type { Tweet} from "rettiwt-api";
import { Rettiwt, TweetFilter } from "rettiwt-api"
import { env } from "../../../env/server.mjs";
import { Configuration, OpenAIApi } from "openai";

const openai = new OpenAIApi(new Configuration({ apiKey: env.OPENAI_API_KEY }));

const AUTH_TOKEN = "perlerdarlig"; // temporary

const usersToScrape = [
  'politietsorost',
  'oslopolitiops',
  'politietost',
  'politietsorvest',
  'politiagder',
  'politiinnlandet',
  'politinordland',
  'politifinnmark',
  'PolitiTrondelag'
]
const userToLocationBias = new Map([
  ['politietsorost',  'point:59.2736681, 10.40305903'],
  ['oslopolitiops',   'point:59.9138688, 10.75224541'],
  ['politietost',     'point:59.7155459, 10.83161895'],
  ['politietsorvest', 'point:58.9636489, 5.735737659'],
  ['politiagder',     'point:58.1471410, 7.998652932'],
  ['politiinnlandet', 'point:60.7960557, 11.09422286'],
  ['politinordland',  'point:67.2886571, 14.39942244'],
  ['politifinnmark',  'point:69.7306470, 30.02526065'],
  ['PolitiTrondelag', 'point:63.4397447, 10.39951882']
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
  severity: 'LOW' | 'MED' | 'HIGH';
  summary: string;
};

type LocatedTweet = CategorizedTweet & {
  lat: number;
  lng: number;
};


const getTodaysTweets = async (usernameMap: Map<string, string>) => {
  const rettiwt = Rettiwt();
  const tweetService = rettiwt.tweets;
  const tweetFilter = new TweetFilter({fromUsers: usersToScrape, startDate: startOfSearch.toISOString()});
  const tweets: MyTweet[] = [];
  let nextCursor = undefined;
  let i = 0;
  do {
    const tweetBatch: {next: {value: string}, list: Tweet[]} = await tweetService.getTweets(tweetFilter, 18, nextCursor);
    let shouldStop = false;
    tweets.push(...tweetBatch.list.map(function (tweet) {
      // If we have a tweet from more than 24 hours ago, we can stop fetching
      if (new Date(tweet.createdAt).getTime() < startOfSearch.getTime()) {
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
  } while (nextCursor && i < 6); // Max amount of pages to fetch
  return tweets;
};

const fetchHandleIdMap = async () => {
  const rettiwt = Rettiwt();
  const userService = rettiwt.users;
  const handleIdMap = new Map();
  for (const username of usersToScrape) {
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


async function callCompletionModel(tweetText: string) {
  const prompt = `Tweet from Norwegiean police (norsk):
${tweetText}
Give direct answers, on each line, answer N/A if not applicable. Primary location or secondary (road) may be in hashtag (no #).

Please give me the location, incident type (or crime), severity and one sentance summary in english.
Format (only english):
Location: PRIMARY, SECONDARY
When: TIME (answer N/A if not specified)
Type: SHORT INCIDENT TYPE
Severity: LOW / MED / HIGH (must be one of these, crimes should be MED or HIGH)
Summary: SHORT SUMMARY`
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
}


function parseCompletion(tweetCreated: Date, completion: string) {
  const lines = completion.split('\n');
  if (lines.length < 4) {
    return null;
  }
  const location = lines[0].split(':')[1].trim();
  let time = lines[1].split(':')[1].trim();
  /*try {
    if (time === 'N/A') throw new Error('N/A');
    time = new Date(time).toISOString();
  } catch (e) {
    time = tweetCreated.toISOString();
  }*/
  time = tweetCreated.toISOString();
  const type = lines[2].split(':')[1].trim()
  let severity = lines[3].split(':')[1].trim().toUpperCase() as 'LOW' | 'MED' | 'HIGH';
  if (severity !== 'LOW' && severity !== 'MED' && severity !== 'HIGH') {
    severity = 'LOW'; // Default
  }
  const summary = lines[4].split(':')[1].trim();
  if (type === 'N/A' || summary === 'N/A') {
    return null;
  }
  return {location, time, type, severity, summary};
}

const catogorizeTweets = async (tweets: MyTweet[]) => {
  const categorizedTweets: CategorizedTweet[] = [];
  let total_tokens = 0;
  for (const tweet of tweets) {
    const completion = await callCompletionModel(tweet.content);
    if (!completion?.message) continue;
    total_tokens += completion.tokens;
    const parsedCompletion = parseCompletion(tweet.createdAt, completion.message);
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
    console.log("error getting place", data);
  }
  return null;
}

const localizeTweets = async (tweets: CategorizedTweet[]) => {
  const localizedTweets: LocatedTweet[] = [];
  for (const tweet of tweets) {
    const coordinates = await findCoordinatesFromText(tweet.tweetHandle, tweet.location);
    if (coordinates?.lat && coordinates?.lng) {
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
  const newTweets = await filterToNewTweets(tweets);
  const mergedTweets = await mergeReplyToTweets(newTweets);
  const { categorizedTweets, tokens } = await catogorizeTweets(mergedTweets);
  const localizedTweets = await localizeTweets(categorizedTweets);

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
