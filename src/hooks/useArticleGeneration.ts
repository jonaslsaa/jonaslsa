import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import { trpc } from "../utils/trpc";

export type PageState = "loading" | "streaming" | "done" | "error";

export interface VideoData {
  videoId: string;
  title: string;
  channelName: string;
  transcript: string;
  modelId: string;
}

export interface UsageData {
  inputTokens: number | null;
  outputTokens: number | null;
  cost: number | null;
}

export function useArticleGeneration(videoId: string | undefined, queryModelId: string | undefined) {
  const router = useRouter();

  const [state, setState] = useState<PageState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [articleContent, setArticleContent] = useState<string>("");
  const [isCached, setIsCached] = useState(false);
  const [displayModel, setDisplayModel] = useState<string>("");
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Track if we've processed the video data to prevent duplicate streaming
  const hasProcessedData = useRef(false);

  const saveArticleMutation = trpc.yt2article.saveArticle.useMutation();
  const getTranscriptMutation = trpc.yt2article.getTranscript.useMutation();

  const getModels = trpc.yt2article.getModels.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const checkAuth = trpc.yt2article.checkAuth.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const getVideoData = trpc.yt2article.getVideoData.useQuery(
    { videoId: videoId as string },
    {
      enabled: !!videoId && checkAuth.data?.authenticated === true,
      refetchOnWindowFocus: false,
    }
  );

  const startStreaming = useCallback(
    async (data: VideoData) => {
      setState("streaming");
      setArticleContent("");
      setUsageData(null);

      let fullContent = "";

      try {
        const response = await fetch("/api/yt2article/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: data.title,
            channel: data.channelName,
            transcript: data.transcript,
            modelId: data.modelId,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Stream request failed: ${response.status} - ${errorText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No reader available");
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(line.slice(6)) as {
                  content?: string;
                  done?: boolean;
                  error?: string;
                  usage?: UsageData;
                };
                if (parsed.content) {
                  fullContent += parsed.content;
                  setArticleContent(fullContent);
                }
                if (parsed.done) {
                  const usage = parsed.usage;
                  if (usage) {
                    setUsageData(usage);
                  }
                  await saveArticleMutation.mutateAsync({
                    videoId: data.videoId,
                    videoTitle: data.title,
                    channelName: data.channelName,
                    transcript: data.transcript,
                    article: fullContent,
                    modelUsed: data.modelId,
                    inputTokens: usage?.inputTokens,
                    outputTokens: usage?.outputTokens,
                    cost: usage?.cost,
                  });
                  void router.replace(`/yt2article/gen/${data.videoId}`, undefined, { shallow: true });
                  setState("done");
                }
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
              } catch (e) {
                if (e instanceof SyntaxError) continue;
                throw e;
              }
            }
          }
        }

        setState("done");
      } catch (err) {
        console.error("Streaming error:", err);
        setError(err instanceof Error ? err.message : "Failed to generate article");
        setState("error");
      }
    },
    [saveArticleMutation, router]
  );

  // Handle auth redirect - derived from query state
  const isAuthenticated = checkAuth.data?.authenticated === true;
  const shouldRedirectToAuth = !checkAuth.isLoading && !isAuthenticated;

  // Single effect: process video data once when it arrives
  // This is the minimal side effect needed - streaming must be triggered imperatively
  useEffect(() => {
    if (shouldRedirectToAuth) {
      void router.push("/yt2article");
      return;
    }

    if (!getVideoData.data || hasProcessedData.current) return;
    hasProcessedData.current = true;

    const data = getVideoData.data;
    const modelId = queryModelId || getModels.data?.defaultModelId || "";

    if (data.cached) {
      setVideoData({
        videoId: data.videoId,
        title: data.title,
        channelName: data.channelName,
        transcript: data.transcript,
        modelId: data.modelUsed,
      });
      setArticleContent(data.article);
      setDisplayModel(data.modelUsed);
      setIsCached(true);
      setUsageData({
        inputTokens: data.inputTokens ?? null,
        outputTokens: data.outputTokens ?? null,
        cost: data.cost ?? null,
      });
      setState("done");
    } else {
      const streamData: VideoData = {
        videoId: data.videoId,
        title: data.title,
        channelName: data.channelName,
        transcript: data.transcript,
        modelId,
      };
      setVideoData(streamData);
      setDisplayModel(modelId);
      setIsCached(false);
      void startStreaming(streamData);
    }
  }, [getVideoData.data, queryModelId, getModels.data?.defaultModelId, startStreaming, shouldRedirectToAuth, router]);

  // Derive error state from query
  const queryError = getVideoData.error?.message;
  const effectiveError = error || queryError;
  const effectiveState: PageState = queryError ? "error" : state;

  const regenerate = useCallback(
    async (newModelId: string) => {
      if (!videoData) return;

      setIsRegenerating(true);

      try {
        let transcript = videoData.transcript;

        if (!transcript) {
          const result = await getTranscriptMutation.mutateAsync({ videoId: videoData.videoId });
          transcript = result.transcript;
        }

        const regenerateData: VideoData = {
          ...videoData,
          transcript,
          modelId: newModelId,
        };

        setVideoData(regenerateData);
        setDisplayModel(newModelId);
        setIsCached(false);
        await startStreaming(regenerateData);
      } catch (err) {
        console.error("Regeneration error:", err);
        setError(err instanceof Error ? err.message : "Failed to regenerate article");
        setState("error");
      } finally {
        setIsRegenerating(false);
      }
    },
    [videoData, getTranscriptMutation, startStreaming]
  );

  return {
    state: effectiveState,
    error: effectiveError,
    videoData,
    articleContent,
    isCached,
    displayModel,
    usageData,
    isRegenerating,
    models: getModels.data?.models || [],
    isAuthLoading: checkAuth.isLoading,
    isVideoDataLoading: getVideoData.isLoading,
    regenerate,
  };
}
