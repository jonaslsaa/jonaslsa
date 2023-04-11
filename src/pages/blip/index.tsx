import { type NextPage } from "next";
import dynamic from 'next/dynamic'
import Head from "next/head";
import { useRef, useState } from "react";
import React from "react";
import type { MarkerData } from "../../components/blip/Map";

import { prisma } from "../../server/db/client";

const Map = dynamic(() => import('../../components/blip/Map'), { ssr: false })

export async function getServerSideProps() {
  const incidents = await prisma.incident.findMany({
    where: {
      time: { // last 72 hours
        gte: new Date(Date.now() - 72 * 60 * 60 * 1000)
      }
    }
  })
  
  const markerData: MarkerData[] = incidents.map(incident => {
    return {
      id: incident.id,
      tweetUrl: 'https://twitter.com/' + incident.fromTwitterHandle + '/status/' + incident.tweetId,
      lat: incident.lat,
      lng: incident.lng,
      location: incident.location,
      time: incident.time.toISOString(),
      type: incident.type,
      severity: incident.severity as ("LOW" | "MED" | "HIGH") | null,
      summary: incident.summary
    }
  })

  return {
    props: {
      markerData
    }
  }
}

const Home: NextPage<{ markerData: MarkerData[] }> = ({ markerData }) => {

  return ( 
    <>
      <Head>
        <title>Blip - Real-time incident mapping</title>
        <meta name="description" content="Jonas Silva personal website" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        <Map markerData={markerData} />
      </main>
    </>
  );
};

export default Home;
