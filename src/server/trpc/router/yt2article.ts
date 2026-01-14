import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc";
import {
  verifyPassword,
  createJwt,
  verifyJwt,
  getJwtFromRequest,
} from "../../yt2article/auth";
import {
  extractVideoId,
  fetchTranscript,
  fetchVideoMetadata,
  formatTranscriptAsText,
} from "../../yt2article/youtube";
import { AVAILABLE_MODELS, isValidModelId, DEFAULT_MODEL_ID } from "../../yt2article/models";

export const yt2articleRouter = router({
  /**
   * Login with password, returns JWT token
   */
  login: publicProcedure
    .input(z.object({ password: z.string() }))
    .mutation(async ({ input }) => {
      if (!verifyPassword(input.password)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid password",
        });
      }

      const token = createJwt();
      return { success: true, token };
    }),

  /**
   * Check if current session is authenticated
   */
  checkAuth: publicProcedure.query(async ({ ctx }) => {
    const token = getJwtFromRequest(ctx.req);
    if (!token) {
      return { authenticated: false };
    }

    const payload = verifyJwt(token);
    return { authenticated: payload !== null };
  }),

  /**
   * Get available models for selection
   */
  getModels: publicProcedure.query(() => {
    return { models: AVAILABLE_MODELS, defaultModelId: DEFAULT_MODEL_ID };
  }),

  /**
   * Check if a cached article exists for a video
   */
  getCached: publicProcedure
    .input(z.object({ videoId: z.string() }))
    .query(async ({ input, ctx }) => {
      // Verify auth
      const token = getJwtFromRequest(ctx.req);
      if (!token || !verifyJwt(token)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Please log in first",
        });
      }

      const cached = await ctx.prisma.yt2Article.findUnique({
        where: { videoId: input.videoId },
      });

      if (!cached) {
        return { found: false as const };
      }

      return {
        found: true as const,
        article: cached.article,
        videoTitle: cached.videoTitle,
        channelName: cached.channelName,
        modelUsed: cached.modelUsed,
        createdAt: cached.createdAt,
      };
    }),

  /**
   * Prepare video data: extract transcript and metadata
   * Returns data needed for article generation
   */
  prepareVideo: publicProcedure
    .input(
      z.object({
        url: z.string(),
        modelId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify auth
      const token = getJwtFromRequest(ctx.req);
      if (!token || !verifyJwt(token)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Please log in first",
        });
      }

      // Validate model ID
      const modelId = input.modelId || DEFAULT_MODEL_ID;
      if (!isValidModelId(modelId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid model selected",
        });
      }

      // Extract video ID
      const videoId = extractVideoId(input.url);
      if (!videoId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid YouTube URL",
        });
      }

      // Check cache first
      const cached = await ctx.prisma.yt2Article.findUnique({
        where: { videoId },
      });

      if (cached) {
        return {
          cached: true as const,
          videoId,
          title: cached.videoTitle,
          channelName: cached.channelName,
          article: cached.article,
          modelUsed: cached.modelUsed,
        };
      }

      // Fetch metadata and transcript in parallel
      const [metadata, transcriptSegments] = await Promise.all([
        fetchVideoMetadata(videoId),
        fetchTranscript(videoId),
      ]);

      const transcriptText = formatTranscriptAsText(transcriptSegments);

      if (!transcriptText || transcriptText.trim().length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This video doesn't have captions/subtitles available. Please try a different video.",
        });
      }

      return {
        cached: false as const,
        videoId,
        title: metadata.title,
        channelName: metadata.channelName,
        transcript: transcriptText,
        transcriptLength: transcriptText.length,
        modelId,
      };
    }),

  /**
   * Save generated article to database
   */
  saveArticle: publicProcedure
    .input(
      z.object({
        videoId: z.string(),
        videoTitle: z.string(),
        channelName: z.string(),
        transcript: z.string(),
        article: z.string(),
        modelUsed: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify auth
      const token = getJwtFromRequest(ctx.req);
      if (!token || !verifyJwt(token)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Please log in first",
        });
      }

      // Upsert to handle race conditions
      const saved = await ctx.prisma.yt2Article.upsert({
        where: { videoId: input.videoId },
        create: {
          videoId: input.videoId,
          videoTitle: input.videoTitle,
          channelName: input.channelName,
          transcript: input.transcript,
          article: input.article,
          modelUsed: input.modelUsed,
        },
        update: {
          article: input.article,
          modelUsed: input.modelUsed,
        },
      });

      return { success: true, id: saved.id };
    }),
});
