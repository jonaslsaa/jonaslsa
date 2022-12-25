import { z } from "zod";

import { router, publicProcedure } from "../trpc";

const generateSlug = (length : number) => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

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
