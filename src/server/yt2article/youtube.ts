import { env } from "../../env/server.mjs";

export interface VideoMetadata {
  videoId: string;
  title: string;
  channelName: string;
}

export interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

interface TranscriptApiResponse {
  video_id: string;
  language: string;
  transcript: Array<{
    text: string;
    start: number;
    duration: number;
  }>;
}

/**
 * Extract video ID from various YouTube URL formats
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Fetch transcript using transcriptapi.com
 */
export async function fetchTranscript(videoId: string): Promise<TranscriptSegment[]> {
  try {
    console.log(`Fetching transcript for video: ${videoId}`);

    const response = await fetch(
      `https://transcriptapi.com/api/v2/youtube/transcript?video_url=${videoId}&format=json`,
      {
        headers: {
          Authorization: `Bearer ${env.TRANSCRIPT_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Transcript API error: ${response.status} - ${errorText}`);
      throw new Error(`Transcript API returned ${response.status}`);
    }

    const data = (await response.json()) as TranscriptApiResponse;
    console.log(`Transcript result: ${data.transcript?.length ?? 0} segments`);

    if (!data.transcript || data.transcript.length === 0) {
      console.log("No transcript found for video");
      return [];
    }

    return data.transcript.map((item) => ({
      text: item.text,
      offset: item.start,
      duration: item.duration,
    }));
  } catch (error) {
    console.error("Transcript fetch error:", error);
    throw new Error(
      `Failed to fetch transcript: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Fetch video metadata using YouTube oEmbed API (no API key required)
 */
export async function fetchVideoMetadata(videoId: string): Promise<VideoMetadata> {
  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;

  const response = await fetch(oembedUrl);
  if (!response.ok) {
    throw new Error("Failed to fetch video metadata");
  }

  const data = (await response.json()) as { title?: string; author_name?: string };
  return {
    videoId,
    title: data.title || "Untitled Video",
    channelName: data.author_name || "Unknown Channel",
  };
}

/**
 * Format transcript segments into plain text
 */
export function formatTranscriptAsText(segments: TranscriptSegment[]): string {
  return segments.map((s) => s.text).join(" ");
}
