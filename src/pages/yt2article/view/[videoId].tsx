import { type NextPage } from "next";
import Head from "next/head";
import ArticleView from "../../../components/yt2article/ArticleView";
import { prisma } from "../../../server/db/client";

type ServerProps = {
  videoId: string;
  videoTitle: string;
  channelName: string;
  article: string;
  modelUsed: string;
  createdAt: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
};

const ViewArticle: NextPage<ServerProps> = ({
  videoId,
  videoTitle,
  channelName,
  article,
  modelUsed,
  inputTokens,
  outputTokens,
  cost,
}) => {
  return (
    <>
      <Head>
        <title>{videoTitle} | YT2Article</title>
        <meta name="description" content={`Article generated from: ${videoTitle}`} />
      </Head>
      <ArticleView
        content={article}
        videoTitle={videoTitle}
        channelName={channelName}
        videoId={videoId}
        modelUsed={modelUsed}
        isStreaming={false}
        isCached={true}
        showShareButton={true}
        inputTokens={inputTokens}
        outputTokens={outputTokens}
        cost={cost}
      />
    </>
  );
};

export async function getServerSideProps(context: { query: { videoId: string } }) {
  const article = await prisma.yt2Article.findUnique({
    where: { videoId: context.query.videoId }
  });

  if (!article) {
    return { notFound: true };
  }

  return {
    props: {
      videoId: article.videoId,
      videoTitle: article.videoTitle,
      channelName: article.channelName,
      article: article.article,
      modelUsed: article.modelUsed,
      createdAt: article.createdAt.toISOString(),
      inputTokens: article.inputTokens,
      outputTokens: article.outputTokens,
      cost: article.cost,
    }
  };
}

export default ViewArticle;
