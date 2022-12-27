import { z } from "zod";

import { router, publicProcedure } from "../trpc";
import { generateSlug } from "../../../utils/utils";

export const pasteRouter = router({
  createPastebin: publicProcedure
    .input(z.object({
        title: z.string(),
        content: z.string(),
        language: z.string(),
    }))
    .mutation(async ({ ctx, input: { title, content, language } }) => {
        const slug = generateSlug(5);
        console.log(title, content, language, slug);
        const bin = await ctx.prisma.pastebin.create({
            data: {
                title: title,
                content: content,
                language: language,
                slug: slug,
            },
        });
        return bin.slug;
    }),
});
