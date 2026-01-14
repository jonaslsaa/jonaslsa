import type { NextApiRequest, NextApiResponse } from "next";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText } from "ai";
import { getJwtFromRequest, verifyJwt } from "../../../server/yt2article/auth";
import { isValidModelId, DEFAULT_MODEL_ID } from "../../../server/yt2article/models";
import { env } from "../../../env/server.mjs";

const ARTICLE_PROMPT = `Following is a transcript of a video from YouTube. The video title is {title} and the channel is {channel}. The transcript is as follows:
<Transcript>
{transcript}
</Transcript>
Transcription note: this automated transcript might not be 100% correct, you can correct it where it makes sense.

Can you provide a comprehensive article/summary of the given text? The article should cover all the key points and main ideas presented in the original text, while also condensing the information into a concise and easy-to-understand format. Please ensure that the summary includes relevant details and examples that support the main ideas, while avoiding any unnecessary information or repetition. The length of the summary should be appropriate for the length and complexity of the original text, providing a clear and accurate overview without omitting any important information.
Format it as an personal article (as it were written by the author), take inspiration from the transcript. If it makes sense, format it as a "story" to be captivating (dont call it a story tho). Use bold and italics where it makes sense.
Make it VERY long to make sure EVERYTHING is covered. You can skip irrelevant stuff (like sponsor or repetitive parts)

At the end add a "TLDR" part (objective on what the video was about, must naturally integrate the key parts which makes this video interesting - do NOT use markdown lists, DO **enbolden** keywords, use a markdown section).`;

interface StreamRequestBody {
  title: string;
  channel: string;
  transcript: string;
  modelId?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify authentication
  const token = getJwtFromRequest(req);
  if (!token || !verifyJwt(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { title, channel, transcript, modelId } = req.body as StreamRequestBody;

  console.log("Stream request body:", { title, channel, transcriptLength: transcript?.length, modelId });

  if (!title || !transcript) {
    return res.status(400).json({
      error: "Missing required fields",
      received: {
        hasTitle: !!title,
        hasChannel: !!channel,
        hasTranscript: !!transcript,
        transcriptLength: transcript?.length,
        modelId
      }
    });
  }

  // Validate and get model
  const selectedModelId = modelId && isValidModelId(modelId) ? modelId : DEFAULT_MODEL_ID;

  // Truncate transcript if too long (OpenRouter models have context limits)
  const maxTranscriptLength = 100000;
  const truncatedTranscript =
    transcript.length > maxTranscriptLength
      ? transcript.slice(0, maxTranscriptLength) + "\n\n[Transcript truncated due to length...]"
      : transcript;

  const prompt = ARTICLE_PROMPT.replace("{title}", title)
    .replace("{channel}", channel)
    .replace("{transcript}", truncatedTranscript);

  try {
    const openrouter = createOpenRouter({
      apiKey: env.OPENROUTER_API_KEY,
    });

    const result = streamText({
      model: openrouter(selectedModelId),
      prompt,
    });

    // Set up SSE headers only after we've started successfully
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    for await (const chunk of result.textStream) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Streaming error:", error);
    // If headers haven't been sent yet, we can return a proper error response
    if (!res.headersSent) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Generation failed",
        details: error instanceof Error ? error.stack : undefined
      });
    }
    // If headers were already sent, try to send error via SSE
    res.write(
      `data: ${JSON.stringify({ error: error instanceof Error ? error.message : "Generation failed" })}\n\n`
    );
    res.end();
  }
}
