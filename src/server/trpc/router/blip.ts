import { z } from "zod";

import { router, publicProcedure } from "../trpc";
import type { MarkerData } from "../../../components/blip/Map";


export const blipRouter = router({
  getMarkerData: publicProcedure
    .input(z.object({
      fromDate: z.string(),
    }))
    .query(async ({ ctx, input: { fromDate } }) => {
      const fromDateObj = new Date(fromDate);
      const incidents = await ctx.prisma.incident.findMany({
        where: {
          time: {
            gte: fromDateObj,
          },
          severity: {
            not: null,
          },
        },
      });
      const markerData: MarkerData[] = incidents.map(incident => {
        return {
          id: incident.id,
          tweetUrl: 'https://twitter.com/' + incident.fromTwitterHandle + '/status/' + incident.tweetId,
          tweetHandle: incident.fromTwitterHandle,
          lat: incident.lat,
          lng: incident.lng,
          location: incident.location,
          time: incident.time.toISOString(),
          type: incident.type,
          severity: incident.severity as ("LOW" | "MED" | "HIGH") | null,
          summary: incident.summary,
          updates: incident.updates,
          tweetUpdatedAt: incident.tweetUpdatedAt.toISOString(),
        }
      });
      return {fromDate, markerData}
    }),
});
