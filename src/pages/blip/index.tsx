import { type NextPage } from "next";
import dynamic from 'next/dynamic'
import Head from "next/head";
import { useRef, useState } from "react";
import React from "react";
import type { MarkerData } from "../../components/blip/Map";

import { prisma } from "../../server/db/client";
import Link from "next/link";

const Map = dynamic(() => import('../../components/blip/Map'), { ssr: false })

export async function getServerSideProps() {
  const incidents = await prisma.incident.findMany({
    where: {
      time: { // last 72 hours
        gte: new Date(Date.now() - 72 * 60 * 60 * 1000)
      },
      severity: { // only show incidents with severity
        not: null
      }
    }
  })
  
  const markerData: MarkerData[] = incidents.map(incident => {
    return {
      id: incident.id,
      tweetUrl: 'https://twitter.com/' + incident.fromTwitterHandle + '/status/' + incident.tweetId,
      tweetHandle: incident.fromTwitterHandle,
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

  const [findMe, setFindMe] = useState(false)

  return ( 
    <>
      <Head>
        <title>Blip - Real-time incident mapping</title>
        <meta name="description" content="Jonas Silva personal website" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
      <nav className="fixed top-0 left-0 w-full z-[2000] pl-10">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-12">
            <div className="flex-shrink-0 flex items-center">
              <Link legacyBehavior href="/">
                <a className="text-white font-bold text-lg">Blip - Real-time incident mapping</a>
              </Link>
            </div>
            <div className="flex items-center">
              <button onClick={() => setFindMe(true)} className="bg-gray-800 text-white px-3 py-2 rounded-sm text-sm font-medium" id="user-menu" aria-haspopup="true">
                Find me
              </button>
            </div>
          </div>
        </div>
      </nav>
        <Map markerData={markerData} findMe={findMe} />
      </main>
    </>
  );
};

export default Home;
