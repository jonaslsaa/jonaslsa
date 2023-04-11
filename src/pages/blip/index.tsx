import { type NextPage } from "next";
import dynamic from 'next/dynamic'
import Head from "next/head";
import { useRef, useState } from "react";
import { trpc } from "../../utils/trpc";

const Map = dynamic(() => import('../../components/blip/Map'), { ssr: false })


const Home: NextPage = () => {

  return ( 
    <>
      <Head>
        <title>Blip - Real-time incident mapping</title>
        <meta name="description" content="Jonas Silva personal website" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        <Map />
      </main>
    </>
  );
};

export default Home;
