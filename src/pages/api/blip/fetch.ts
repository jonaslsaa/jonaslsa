import { type NextApiRequest, type NextApiResponse } from "next";

import { prisma } from "../../../server/db/client";

import { Rettiwt, TweetFilter } from "rettiwt-api"
import { env } from "../../../env/server.mjs";
import { Configuration, OpenAIApi } from "openai";

const openai = new OpenAIApi(new Configuration({ apiKey: env.OPENAI_API_KEY }));

const usersToScrape = ['politietsorost', 'oslopolitiops']
const userToLocationBias = new Map([
  ['politietsorost', 'point:59.2736681, 10.403059034'],
  ['oslopolitiops', 'point:59.9138688,10.7522454']
]);

const startOfToday = new Date();
startOfToday.setHours(0, 0, 0, 0);

type Tweet = {
  id: string;
  createdAt: Date;
  tweetHandle: string;
  text: string;
  replyTo: string | null;
};

type CategorizedTweet = Tweet & {
  location: string;
  type: string;
  time: string;
  summary: string;
};

type LocatedTweet = CategorizedTweet & {
  lat: number;
  lng: number;
};


const getTodaysTweets = async (usernameMap: Map<string, string>) => {
  const rettiwt = Rettiwt();
  const tweetService = rettiwt.tweets;
  const tweetFilter = new TweetFilter({fromUsers: usersToScrape, startDate: startOfToday.toISOString()});
  const tweets: Tweet[] = [];
  let nextCursor = undefined;
  let i = 0;
  do {
    const tweetBatch = await tweetService.getTweets(tweetFilter, 18, nextCursor);
    let hasSomeFromYesterday = false;
    tweets.push(...tweetBatch.list.map(function (tweet) {
      if (new Date(tweet.createdAt).getDate() < startOfToday.getDate()) {
        hasSomeFromYesterday = true;
      }
      return {
        id: tweet.id,
        createdAt: new Date(tweet.createdAt),
        tweetHandle: usernameMap.get(tweet.tweetBy) ?? 'unknown',
        text: tweet.fullText,
        replyTo: tweet.replyTo
      }
    }));
    nextCursor = tweetBatch.next.value;
    i++;
    if (hasSomeFromYesterday) {
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

const filterToNewTweets = async (tweets: Tweet[]) => {
  const existingTweets = await prisma.incident.findMany({
    where: {
      tweetId: {
        in: tweets.map(tweet => tweet.id)
      }
    }
  });
  const existingTweetIds = new Set(existingTweets.map(tweet => tweet.id));
  return tweets.filter(tweet => !existingTweetIds.has(tweet.id));
}

async function callCompletionModel(tweetText: string) {
  const prompt = `Tweet from Norwegiean police (norsk):
${tweetText}
Give direct answers, on each line, answer N/A if not applicable. Primary location or secondary (road) may be in hashtag (no #).

Please give me the location, incident type (or crime) and short summary.
Format:
Location: PRIMARY, SECONDARY
When: TIME (answer N/A if not specified)
Type: SHORT INCIDENT TYPE
Summary: SHORT SUMMARY`
  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    max_tokens: 512,
    temperature: 0.5,
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: prompt },
    ],
  });
  console.log(completion);
  return completion.data.choices[0]?.message?.content;
}


function parseCompletion(completion: string) {
  const lines = completion.split('\n');
  if (lines.length < 4) {
    return null;
  }
  const location = lines[0].split(':')[1].trim();
  const time = lines[1].split(':')[1].trim();
  const type = lines[2].split(':')[1].trim();
  const summary = lines[3].split(':')[1].trim();
  return {location, time, type, summary};
}

const catogorizeTweets = async (tweets: Tweet[]) => {
  const categorizedTweets: CategorizedTweet[] = [];
  for (const tweet of tweets) {
    const completion = await callCompletionModel(tweet.text);
    const parsedCompletion = parseCompletion(completion);
    if (parsedCompletion) {
      categorizedTweets.push({
        ...tweet,
        ...parsedCompletion
      });
    }
  }
  return categorizedTweets;
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


const GetNewTweets = async (req: NextApiRequest, res: NextApiResponse) => {
  //const usernameMap = await fetchHandleIdMap();
  //const tweets = await getTodaysTweets(usernameMap);
  //const newTweets = await filterToNewTweets(tweets);
  const dummyTweets = [
    {
      id: '123',
      createdAt: new Date(),
      tweetHandle: 'politietsorost',
      text: 'Hei, dette er en dummy tweet',
      replyTo: null
    },
  ];
  const categorizedTweets = await catogorizeTweets(dummyTweets);
  const dummyCoordinates = await findCoordinatesFromText('politietsorost', dummyLocation);
  
  res.status(200).json(dummyCoordinates);
};

export default GetNewTweets;
