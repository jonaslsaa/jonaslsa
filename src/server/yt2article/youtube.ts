import { getSubtitles } from "youtube-caption-extractor";

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
 * Fetch transcript using youtube-caption-extractor package
 */
export async function fetchTranscript(videoId: string): Promise<TranscriptSegment[]> {
  try {
    console.log("Fetching transcript for video:", videoId);

    // Try English first, then auto-detect
    let subtitles = await getSubtitles({ videoID: videoId, lang: "en" });

    if (!subtitles || subtitles.length === 0) {
      // Try without language specification (auto-detect)
      subtitles = await getSubtitles({ videoID: videoId });
    }

    console.log("Subtitles count:", subtitles?.length ?? 0);

    if (!subtitles || subtitles.length === 0) {
      return [];
    }

    return subtitles.map((item) => ({
      text: item.text,
      offset: parseFloat(item.start),
      duration: parseFloat(item.dur),
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
