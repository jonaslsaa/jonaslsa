import { type NextPage } from "next";
import Head from "next/head";
import { useState, useEffect, useCallback } from "react";
import { trpc } from "../../utils/trpc";
import LoginForm from "../../components/yt2article/LoginForm";
import UrlInput from "../../components/yt2article/UrlInput";
import ArticleView from "../../components/yt2article/ArticleView";
import RegenerateModal from "../../components/yt2article/RegenerateModal";

type AppState = "loading" | "login" | "input" | "preparing" | "streaming" | "done";

interface VideoData {
  videoId: string;
  title: string;
  channelName: string;
  transcript: string;
  modelId: string;
}

interface CachedData {
  videoId: string;
  title: string;
  channelName: string;
  article: string;
  modelUsed: string;
  transcript: string;
}

const Yt2Article: NextPage = () => {
  const [state, setState] = useState<AppState>("loading");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [cachedData, setCachedData] = useState<CachedData | null>(null);
  const [articleContent, setArticleContent] = useState<string>("");
  const [isCached, setIsCached] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // tRPC queries and mutations
  const checkAuth = trpc.yt2article.checkAuth.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const getModels = trpc.yt2article.getModels.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const loginMutation = trpc.yt2article.login.useMutation();
  const prepareVideoMutation = trpc.yt2article.prepareVideo.useMutation();
  const saveArticleMutation = trpc.yt2article.saveArticle.useMutation();
  const getTranscriptMutation = trpc.yt2article.getTranscript.useMutation();

  // Check auth status on load
  useEffect(() => {
    if (checkAuth.isLoading) return;
    if (checkAuth.data?.authenticated) {
      setState("input");
    } else {
      setState("login");
    }
  }, [checkAuth.isLoading, checkAuth.data]);

  // Handle login
  const handleLogin = async (password: string) => {
    setLoginError(null);
    try {
      const result = await loginMutation.mutateAsync({ password });

      // Set cookie via API route
      await fetch("/api/yt2article/set-cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: result.token }),
      });

      setState("input");
    } catch {
      setLoginError("Invalid password");
    }
  };

  // Handle URL submission
  const handleUrlSubmit = async (url: string, modelId: string) => {
    setPrepareError(null);
    setState("preparing");

    try {
      const data = await prepareVideoMutation.mutateAsync({ url, modelId });
      console.log("prepareVideo response:", data);

      if (data.cached === true) {
        // Article is already cached
        setCachedData({
          videoId: data.videoId,
          title: data.title,
          channelName: data.channelName,
          article: data.article,
          modelUsed: data.modelUsed,
          transcript: data.transcript,
        });
        setArticleContent(data.article);
        setIsCached(true);
        setState("done");
      } else {
        // Need to generate article - data.cached === false
        const streamData = {
          videoId: data.videoId,
          title: data.title,
          channelName: data.channelName,
          transcript: data.transcript,
          modelId: data.modelId,
        };
        console.log("Starting stream with:", streamData);
        setVideoData(streamData);
        setIsCached(false);
        startStreaming(streamData);
      }
    } catch (error) {
      setPrepareError(error instanceof Error ? error.message : "Failed to process video");
      setState("input");
    }
  };

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
          console.error("Stream response error:", response.status, errorText);
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
                  // Save to database
                  await saveArticleMutation.mutateAsync({
                    videoId: data.videoId,
                    videoTitle: data.title,
                    channelName: data.channelName,
                    transcript: data.transcript,
                    article: fullContent,
                    modelUsed: data.modelId,
                  });
                  setState("done");
                }
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
              } catch (e) {
                // Ignore JSON parse errors for incomplete chunks
                if (e instanceof SyntaxError) continue;
                throw e;
              }
            }
          }
        }

        setState("done");
      } catch (error) {
        console.error("Streaming error:", error);
        setPrepareError("Failed to generate article");
        setState("input");
      }
    },
    [saveArticleMutation]
  );

  // Reset to generate another
  const handleReset = () => {
    setVideoData(null);
    setCachedData(null);
    setArticleContent("");
    setPrepareError(null);
    setIsCached(false);
    setState("input");
  };

  // Open regenerate modal
  const handleOpenRegenerateModal = () => {
    setShowRegenerateModal(true);
  };

  // Handle regeneration with a different model
  const handleRegenerate = async (modelId: string) => {
    const videoId = cachedData?.videoId || videoData?.videoId;
    const title = cachedData?.title || videoData?.title;
    const channelName = cachedData?.channelName || videoData?.channelName;

    if (!videoId || !title || !channelName) {
      setPrepareError("Missing video data for regeneration.");
      setShowRegenerateModal(false);
      return;
    }

    setIsRegenerating(true);
    setShowRegenerateModal(false);

    try {
      // Get transcript - from state or fetch fresh
      let transcript = cachedData?.transcript || videoData?.transcript;

      if (!transcript) {
        console.log("Transcript missing, fetching from server...");
        const result = await getTranscriptMutation.mutateAsync({ videoId });
        transcript = result.transcript;
      }

      // Create video data for streaming
      const regenerateData: VideoData = {
        videoId,
        title,
        channelName,
        transcript,
        modelId,
      };

      setVideoData(regenerateData);
      setCachedData(null);
      setIsCached(false);
      await startStreaming(regenerateData);
    } catch (error) {
      console.error("Regeneration error:", error);
      setPrepareError(error instanceof Error ? error.message : "Failed to regenerate article");
    } finally {
      setIsRegenerating(false);
    }
  };

  // Get display data
  const displayVideoId = cachedData?.videoId || videoData?.videoId || "";
  const displayTitle = cachedData?.title || videoData?.title || "";
  const displayChannel = cachedData?.channelName || videoData?.channelName || "";
  const displayModel = cachedData?.modelUsed || videoData?.modelId || "";

  return (
    <>
      <Head>
        <title>YT2Article - YouTube to Article</title>
        <meta name="description" content="Convert YouTube videos to articles" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Show article view when streaming or done */}
      {(state === "streaming" || state === "done") && (videoData || cachedData) && (
        <>
          <ArticleView
            content={articleContent}
            videoTitle={displayTitle}
            channelName={displayChannel}
            videoId={displayVideoId}
            modelUsed={displayModel}
            isStreaming={state === "streaming"}
            isCached={isCached}
            showRegenerateButton={true}
            onRegenerateClick={handleOpenRegenerateModal}
          />
          {state === "done" && (
            <div className="fixed bottom-6 right-6">
              <button
                onClick={handleReset}
                className="rounded-full bg-sky-600 px-6 py-3 text-white shadow-lg transition-colors hover:bg-sky-700"
              >
                Generate Another
              </button>
            </div>
          )}
        </>
      )}

      {/* Show login/input forms */}
      {(state === "loading" ||
        state === "login" ||
        state === "input" ||
        state === "preparing") && (
        <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-6 text-white">
          <div className="flex w-full max-w-2xl flex-col items-center gap-8">
            <div className="text-center">
              <h1 className="mb-2 text-4xl font-bold">YT2Article</h1>
              <p className="text-gray-400">Convert YouTube videos into readable articles</p>
            </div>

            {state === "loading" && <p className="text-gray-400">Loading...</p>}

            {state === "login" && (
              <LoginForm
                onLogin={handleLogin}
                isLoading={loginMutation.isPending}
                error={loginError}
              />
            )}

            {(state === "input" || state === "preparing") && getModels.data && (
              <>
                <UrlInput
                  onSubmit={handleUrlSubmit}
                  isLoading={state === "preparing"}
                  models={getModels.data.models}
                  defaultModelId={getModels.data.defaultModelId}
                />
                {prepareError && <p className="text-sm text-red-400">{prepareError}</p>}
              </>
            )}
          </div>
        </main>
      )}

      {/* Regenerate modal */}
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
};

export default Yt2Article;
