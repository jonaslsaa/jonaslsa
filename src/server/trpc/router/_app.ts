import { router } from "../trpc";
import { authRouter } from "./auth";
import { bypassRouter } from "./bypass";
import { pasteRouter } from "./pastebin";
import { shortenRouter } from "./shorten";
import { blipRouter } from "./blip";
import { translateRouter } from "./translate";

export const appRouter = router({
  bypass: bypassRouter,
  shorten: shortenRouter,
  paste: pasteRouter,
  auth: authRouter,
  blip: blipRouter,
  translate: translateRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
