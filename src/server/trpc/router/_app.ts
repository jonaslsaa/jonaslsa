import { router } from "../trpc";
import { authRouter } from "./auth";
import { bypassRouter } from "./bypass";
import { pasteRouter } from "./pastebin";
import { shortenRouter } from "./shorten";
import { blipRouter } from "./blip";
import { translateRouter } from "./translate";
import { yt2articleRouter } from "./yt2article";

export const appRouter = router({
  bypass: bypassRouter,
  shorten: shortenRouter,
  paste: pasteRouter,
  auth: authRouter,
  blip: blipRouter,
  translate: translateRouter,
  yt2article: yt2articleRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
