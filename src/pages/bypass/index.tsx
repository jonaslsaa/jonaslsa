import { type NextPage } from "next";
import Head from "next/head";
import { useRef, useState } from "react";
import { trpc } from "../../utils/trpc";


const BypassPage: NextPage = () => {
  const bypassLinkRef = useRef<HTMLInputElement>(null);
  const resultLinkRef = useRef<HTMLAnchorElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  const tBypassLink = trpc.bypass.bypassLink.useMutation();

  const validBypassLinks = ["linkvertise.com", "up-to-down.net", "link-center.net", "link-to.net", "direct-link.net", "file-link.net", "link-hub.net", "link-target.net"];

  const bypassLink = (link: string) => {
    tBypassLink.mutate(link, {
      onSuccess: (data) => {
        if (data && resultLinkRef.current) {
          resultLinkRef.current.setAttribute("href", data);
          resultLinkRef.current.innerText = data;
          setIsLoading(false);
        }
      },
      onError: (error) => {
        console.log(error);
      }
    });
  };

  function handleBypass(link: string) {
    if (bypassLinkRef.current === null || resultLinkRef.current === null) { return; }
    if (validBypassLinks.some((l) => link.includes(l))) {
      bypassLinkRef.current.setAttribute("placeholder", link);
      resultLinkRef.current.innerText = "";
      setIsLoading(true);
      bypassLink(link);
    } else {
      alert("Invalid linkvertise link: " + link);
    }
  }
  

  const handleFromClipboard = () => {
    navigator.clipboard.readText()
      .then(text => {
        handleBypass(text);
      })
      .catch(err => {
        console.error('Failed to read clipboard contents: ', err);
      });
  };

  const handleSubmit = () => {
    const link = bypassLinkRef.current?.value;
    if (link) {
      handleBypass(link);
    }
  };


  return ( 
    <>
      <Head>
        <title>Doublepass</title>
        <meta name="description" content="Jonas Silva personal website" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="bg-gray-900 min-h-screen text-white flex flex-col items-center justify-center w-full flex-1 px-7 text-center">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold">Doublepass</h1>
          <input ref={bypassLinkRef} type="text" className="bg-gray-300 px-2 py-2 my-2 rounded-sm w-full max-w-md text-gray-700" placeholder="Paste your link here..."></input>
          <div className="flex flex-row gap-2">
            <button onClick={handleFromClipboard} className="bg-gray-800 text-white px-4 py-2 rounded-md">From clipboard</button>
            <button onClick={handleSubmit} className="bg-sky-600 text-white px-4 py-2 rounded-md">Do damage</button>
          </div>

          <p className="text-gray-400">
            {isLoading && "Loading..."}
          </p>
          <a className="text-lg text-cyan-300 underline" href="#" ref={resultLinkRef}></a>
        </div>
      </main>
    </>
  );
};

export default BypassPage;
