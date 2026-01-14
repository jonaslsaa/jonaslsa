import { type NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import { trpc } from "../../../utils/trpc";
import ArticleView from "../../../components/yt2article/ArticleView";
import RegenerateModal from "../../../components/yt2article/RegenerateModal";

type PageState = "loading" | "fetching" | "streaming" | "done" | "error";

interface VideoData {
  videoId: string;
  title: string;
  channelName: string;
  transcript: string;
  modelId: string;
}

const GeneratePage: NextPage = () => {
  const router = useRouter();
  const { videoId, modelId: queryModelId } = router.query;

  const [state, setState] = useState<PageState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [articleContent, setArticleContent] = useState<string>("");
  const [isCached, setIsCached] = useState(false);
  const [displayModel, setDisplayModel] = useState<string>("");
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // tRPC queries and mutations
  const checkAuth = trpc.yt2article.checkAuth.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const getModels = trpc.yt2article.getModels.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const getVideoData = trpc.yt2article.getVideoData.useQuery(
    { videoId: videoId as string },
    {
      enabled: !!videoId && checkAuth.data?.authenticated === true,
      refetchOnWindowFocus: false,
    }
  );
  const saveArticleMutation = trpc.yt2article.saveArticle.useMutation();
  const getTranscriptMutation = trpc.yt2article.getTranscript.useMutation();

  // Stream article generation
  const startStreaming = useCallback(
    async (data: VideoData) => {
      setState("streaming");
      setArticleContent("");

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
                };
                if (parsed.content) {
                  fullContent += parsed.content;
                  setArticleContent(fullContent);
                }
                if (parsed.done) {
                  await saveArticleMutation.mutateAsync({
                    videoId: data.videoId,
                    videoTitle: data.title,
                    channelName: data.channelName,
                    transcript: data.transcript,
                    article: fullContent,
                    modelUsed: data.modelId,
                  });
                  // Clean up URL by removing query params
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
    [saveArticleMutation]
  );

  // Handle auth check and redirect
  useEffect(() => {
    if (checkAuth.isLoading) return;
    if (!checkAuth.data?.authenticated) {
      void router.push("/yt2article");
    }
  }, [checkAuth.isLoading, checkAuth.data, router]);

  // Handle video data response
  useEffect(() => {
    if (!getVideoData.data || state !== "loading") return;

    const data = getVideoData.data;
    const modelId = (queryModelId as string) || getModels.data?.defaultModelId || "";

    if (data.cached) {
      // Article exists, display it
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
      setState("done");
    } else {
      // Need to generate
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
  }, [getVideoData.data, queryModelId, getModels.data, state, startStreaming]);

  // Handle getVideoData errors
  useEffect(() => {
    if (getVideoData.error) {
      setError(getVideoData.error.message);
      setState("error");
    }
  }, [getVideoData.error]);

  // Handle regeneration with a different model
  const handleRegenerate = async (newModelId: string) => {
    if (!videoData) return;

    setIsRegenerating(true);
    setShowRegenerateModal(false);

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
  };

  // Handle back to input
  const handleBackToInput = () => {
    void router.push("/yt2article");
  };

  // Loading states
  if (checkAuth.isLoading || !videoId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white">
        <p className="text-gray-400">Loading...</p>
      </main>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <>
        <Head>
          <title>Error - YT2Article</title>
        </Head>
        <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-6 text-white">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold text-red-400">Error</h1>
            <p className="mb-6 text-gray-400">{error}</p>
            <button
              onClick={handleBackToInput}
              className="rounded-lg bg-sky-600 px-6 py-3 text-white transition-colors hover:bg-sky-700"
            >
              Back to YT2Article
            </button>
          </div>
        </main>
      </>
    );
  }

  // Fetching state (loading video data)
  if (getVideoData.isLoading || state === "loading") {
    return (
      <>
        <Head>
          <title>Loading - YT2Article</title>
        </Head>
        <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
            <p className="text-gray-400">Preparing video data...</p>
          </div>
        </main>
      </>
    );
  }

  // Streaming or done state - show ArticleView
  if ((state === "streaming" || state === "done") && videoData) {
    return (
      <>
        <Head>
          <title>{videoData.title} - YT2Article</title>
        </Head>
        <ArticleView
          content={articleContent}
          videoTitle={videoData.title}
          channelName={videoData.channelName}
          videoId={videoData.videoId}
          modelUsed={displayModel}
          isStreaming={state === "streaming"}
          isCached={isCached}
          showRegenerateButton={true}
          onRegenerateClick={() => setShowRegenerateModal(true)}
        />
        {state === "done" && (
          <div className="fixed bottom-6 right-6">
            <button
              onClick={handleBackToInput}
              className="rounded-full bg-sky-600 px-6 py-3 text-white shadow-lg transition-colors hover:bg-sky-700"
            >
              Generate Another
            </button>
          </div>
        )}
        <RegenerateModal
          isOpen={showRegenerateModal}
          onClose={() => setShowRegenerateModal(false)}
          onRegenerate={handleRegenerate}
          models={getModels.data?.models || []}
          currentModelId={displayModel}
          isLoading={isRegenerating}
        />
      </>
    );
  }

  // Fallback
  return null;
};

export default GeneratePage;
