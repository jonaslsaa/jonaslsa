import { z } from "zod";

import { router, publicProcedure } from "../trpc";
import { generateSlug } from "../../../utils/utils";

export const shortenRouter = router({
  shortenLink: publicProcedure
    .input(z.string())
    .mutation(async ({ ctx, input: link }) => {
        const slug = generateSlug(3);
        const shortenedLink = await ctx.prisma.shortenedLink.create({
            data: {
                url: link,
                slug: slug,
            },
        });
        return "/s/"+shortenedLink.slug;
    }),
});
