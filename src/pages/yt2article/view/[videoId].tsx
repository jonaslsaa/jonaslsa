import { type NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { trpc } from "../../../utils/trpc";
import ArticleView from "../../../components/yt2article/ArticleView";

const ViewArticle: NextPage = () => {
  const router = useRouter();
  const { videoId } = router.query;

  const { data, isLoading, error } = trpc.yt2article.getPublicArticle.useQuery(
    { videoId: videoId as string },
    { enabled: !!videoId }
  );

  if (isLoading || !videoId) {
    return (
      <>
        <Head>
          <title>Loading... | YT2Article</title>
        </Head>
        <main className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
          <p className="text-gray-400">Loading article...</p>
        </main>
      </>
    );
  }

  if (error || !data?.found) {
    return (
      <>
        <Head>
          <title>Article Not Found | YT2Article</title>
        </Head>
        <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white">
          <h1 className="mb-4 text-2xl font-bold">Article Not Found</h1>
          <p className="mb-6 text-gray-400">
            This article hasn&apos;t been generated yet or doesn&apos;t exist.
          </p>
          <a
            href="/yt2article"
            className="rounded-md bg-sky-600 px-6 py-3 text-white transition-colors hover:bg-sky-700"
          >
            Generate an Article
          </a>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{data.videoTitle} | YT2Article</title>
        <meta name="description" content={`Article generated from: ${data.videoTitle}`} />
      </Head>
      <ArticleView
        content={data.article}
        videoTitle={data.videoTitle}
        channelName={data.channelName}
        videoId={data.videoId}
        modelUsed={data.modelUsed}
        isStreaming={false}
        isCached={true}
        showShareButton={true}
        inputTokens={data.inputTokens}
        outputTokens={data.outputTokens}
        cost={data.cost}
      />
    </>
  );
};

export default ViewArticle;
