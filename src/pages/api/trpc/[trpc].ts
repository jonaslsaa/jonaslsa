import { createNextApiHandler } from "@trpc/server/adapters/next";

import { env } from "../../../env/server.mjs";
import { createContext } from "../../../server/trpc/context";
import { appRouter } from "../../../server/trpc/router/_app";

import {Ratelimit} from "@upstash/ratelimit";
import {Redis} from "@upstash/redis";

const ratelimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.tokenBucket(5, "10 s", 10),
  analytics: true,
});

// export API handler
export default createNextApiHandler({
  router: appRouter,
  createContext,
  onError:
    env.NODE_ENV === "development"
      ? ({ path, error }) => {
          console.error(`❌ tRPC failed on ${path}: ${error}`);
        }
      : undefined,
});
