import { type NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import ArticleView from "../../../components/yt2article/ArticleView";
import RegenerateModal from "../../../components/yt2article/RegenerateModal";
import { useArticleGeneration } from "../../../hooks/useArticleGeneration";

const GeneratePage: NextPage = () => {
  const router = useRouter();
  const { videoId, modelId } = router.query;

  const [showRegenerateModal, setShowRegenerateModal] = useState(false);

  const {
    state,
    error,
    videoData,
    articleContent,
    isCached,
    displayModel,
    usageData,
    isRegenerating,
    models,
    isAuthLoading,
    isVideoDataLoading,
    regenerate,
  } = useArticleGeneration(videoId as string | undefined, modelId as string | undefined);

  const handleRegenerate = async (newModelId: string) => {
    setShowRegenerateModal(false);
    await regenerate(newModelId);
  };

  const handleBackToInput = () => {
    void router.push("/yt2article");
  };

  // Loading states
  if (isAuthLoading || !videoId) {
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
  if (isVideoDataLoading || state === "loading") {
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
          <title>{`${videoData.title} - YT2Article`}</title>
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
          inputTokens={usageData?.inputTokens}
          outputTokens={usageData?.outputTokens}
          cost={usageData?.cost}
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
          models={models}
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
