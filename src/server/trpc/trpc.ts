import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { type Context } from "./context";
import type { NextApiRequest } from "next";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;

const getFingerprint = (req: NextApiRequest | undefined) => {
  if (!req) return "no-req"
  const forwarded = req.headers["x-forwarded-for"]
  const ip = forwarded
    ? (typeof forwarded === "string" ? forwarded : forwarded[0])?.split(/, /)[0]
    : req.socket.remoteAddress
  const localhost = ip?.replace(/^.*:/, "")
  if (!localhost || localhost === "1") return "127.0.0.1" // is localhost
  return ip || "no-ip_" + Math.random().toString(36).substr(2, 6)
}

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(16, "10 s"),
  analytics: true,
});

export const rateLimiter = t.middleware(async ({ ctx, next }) => {
  const fingerprint = getFingerprint(ctx.req);
  const { success, reset } = await ratelimit.limit(fingerprint);

  if (!success) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Too many requests, please try again later. ${Math.ceil((reset - Date.now()) / 1000)}s`,
    });
  }

  return next();
});

/**
 * Unprotected procedure
 **/
export const publicProcedure = t.procedure.use(rateLimiter);

/**
 * Reusable middleware to ensure
 * users are logged in
 */
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      // infers the `session` as non-nullable
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

/**
 * Protected procedure
 **/
export const protectedProcedure = t.procedure.use(isAuthed);
