import { type NextPage } from "next";
import Head from "next/head";
import ProjectLink from "../components/home/ProjectLink";

const Home: NextPage = () => {
  return (
    <>
      <Head>
        <title>Jonas Lien Sampaio da Silva</title>
        <meta name="description" content="Jonas Silva personal website" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16 sm:flex-row">
          <div>
            <h1 className="text-4xl font-bold">jonaslsa</h1>
            <h2 className="text-sky-300">Jonas Lien Sampaio da Silva</h2>
          </div>
          <div style={{ borderLeft: "1px solid white", height: "12rem" }} className="hidden sm:block opacity-60"></div>
          <div style={{ borderTop: "1px solid white", width: "14rem" }} className="block sm:hidden opacity-60"></div>
          <div>
            <ProjectLink link="https://github.com/jonaslsaa/" title="Github" />
            <ProjectLink link="https://www.linkedin.com/in/jonas-silva-b1a628ba/" title="Linkedin" />

            <hr className="border-gray-700 my-2" />
            <ProjectLink bold link="/blip/" title="Blip - Real-time police incidents" />
            <ProjectLink link="s/" title="URL Shortener" />
            <ProjectLink link="paste/" title="Pastebin" />
            <ProjectLink link="https://github.com/jonaslsaa/multure-cms/" title="Multure - AI managed News CMS" />
          </div>
        </div>
      </main>
    </>
  );
};

export default Home;
