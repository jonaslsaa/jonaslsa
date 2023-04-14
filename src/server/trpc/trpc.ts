import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import { type Context } from "./context";
import type { NextApiRequest } from "next";
import { createTRPCUpstashLimiter } from "@trpc-limiter/upstash";

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
  return ip || "127.0.0.1"
}

export const rateLimiter = createTRPCUpstashLimiter({
  root: t,
  fingerprint: (ctx, _input) => getFingerprint(ctx.req),
  windowMs: 10000,
  message: (hitInfo) =>
    `Too many requests, please try again later. ${Math.ceil(
      (hitInfo.reset - Date.now()) / 1000
    )}`,
  max: 16,
})

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
