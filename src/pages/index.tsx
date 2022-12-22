import { type NextPage } from "next";
import Head from "next/head";
import ProjectLink from "../components/home/ProjectLink";

const Home: NextPage = () => {
  return (
    <>
      <Head>
        <title>Create T3 App</title>
        <meta name="description" content="Jonas Silva personal website" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white">
        <div className="container flex flex-row items-center justify-center gap-12 px-4 py-16 ">
         <div>
            <h1 className="text-4xl font-bold">jonaslsa</h1>
            <h2 className="text-sky-300">Jonas Lien Sampaio da Silva</h2>
         </div>
         <div style={{ borderLeft: "1px solid white", height: "12rem" }}></div>
         <div>
            <ProjectLink link="https://github.com/TheVoxcraft/" title="Github" />
            <ProjectLink link="https://www.linkedin.com/in/jonas-silva-b1a628ba/" title="Linkedin" />
            <ProjectLink link="http://tracker.jonaslsa.com" title="Tracker" />
         </div>
        </div>
      </main>
    </>
  );
};

export default Home;
