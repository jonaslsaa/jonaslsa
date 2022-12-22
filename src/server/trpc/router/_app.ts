import { router } from "../trpc";
import { authRouter } from "./auth";
import { bypassRouter } from "./bypass";

export const appRouter = router({
  bypass: bypassRouter,
  auth: authRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
