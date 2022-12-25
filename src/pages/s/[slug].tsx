import { type NextPage } from "next";
import Head from "next/head";

export async function getServerSideProps(context : any) {
  // Get shortned link
  console.log(context.query.slug)
  const shortenedLink = await prisma!.shortenedLink.findUnique({
    where: {
      slug: context.query.slug
    }
  })
  if (!shortenedLink) {
    return { props: { } }
  }
  return { redirect: { destination: shortenedLink.url, permanent: false } }
}

type ServerProps = {
  notFound: boolean
};

const ShortRedirect: NextPage<ServerProps> = () => {
  return <>
    <Head>
      <title>Link shortner</title>
      <meta name="description" content="Jonas Silva personal website" />
      <link rel="icon" href="/favicon.ico" />
    </Head>
    <main className="bg-gray-900 min-h-screen text-white flex flex-col items-center justify-center w-full flex-1 px-12 text-center">
      <div className="flex flex-col gap-3 w-96">
        <h1 className="text-2xl font-bold">Could not find the link.</h1>
      </div>
    </main>
  </>
}

export default ShortRedirect