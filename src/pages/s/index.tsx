import { type NextPage } from "next";
import Head from "next/head";
import { useState } from "react";
import { trpc } from "../../utils/trpc";
import InputField from "../../components/short/InputField";
import ShowShorten from "../../components/short/ShowShorten";


const Home: NextPage = () => {

  const [shortLink, setShortLink] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const tShortenLink = trpc.shorten.shortenLink.useMutation();

  function handleLink (link: string) {
    setIsLoading(true);
    tShortenLink.mutate(link, {
      onSuccess: (data) => {
        setShortLink(data);
        setIsLoading(false);
      },
      onError: (err) => {
        console.log(err);
      }
    });
  }

  function handleOneMore() {
    setShortLink(null);
  }

  return ( 
    <>
      <Head>
        <title>Link shortner</title>
        <meta name="description" content="Jonas Silva personal website" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="bg-gray-900 min-h-screen text-white flex flex-col items-center justify-center w-full flex-1 px-12 text-center">
        <div className="flex flex-col gap-3 w-96">
          <h1 className="text-2xl font-bold">Shorten a link</h1>
          {isLoading && <p>Loading...</p>}
          {shortLink ? <ShowShorten link={shortLink} /> : <InputField handleLink={handleLink} />}
          {shortLink && <button onClick={handleOneMore} className="border font-medium relative text-md px-6 py-3 rounded-md text-white border-gray-700 bg-gray-800 hover:bg-gray-700 hover:text-gray-100 shadow-sm">One more!</button>}
        </div>
      </main>
    </>
  );
};

export default Home;
