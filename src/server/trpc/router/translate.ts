import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export const translateRouter = router({
  registerDocument: publicProcedure
    .input(z.object({
      filename: z.string(),
      apiKey: z.string(),
      apiType: z.string(),
      documentId: z.string(),
      documentKey: z.string(),
      sourceLanguage: z.string(),
      targetLanguage: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.documentTranslation.create({
        data: {
          filename: input.filename,
          key: input.apiKey,
          keyType: input.apiType,
          documentId: input.documentId,
          documentKey: input.documentKey,
          sourceLanguage: input.sourceLanguage,
          targetLanguage: input.targetLanguage,
        },
      });
      return doc.id;
    }),
  getDocumentsByKey: publicProcedure
    .input(z.object({
      apiKey: z.string(),
      apiType: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const doc = await ctx.prisma.documentTranslation.findMany({
        where: {
          key: input.apiKey,
          keyType: input.apiType,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
      return doc;
    }),
  setDocumentToStatus: publicProcedure
    .input(z.object({
      documentId: z.string(),
      status: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.status != "completed" && input.status != "failed" && input.status != "pending" && input.status != "downloaded") {
        throw new Error("Invalid status");
      }
      const doc = await ctx.prisma.documentTranslation.update({
        where: {
          documentId: input.documentId,
        },
        data: {
          status: input.status,
        },
      });
      return doc.id;
    }),
});
