import { type NextPage } from "next";
import dynamic from 'next/dynamic'
import Head from "next/head";
import { useRef, useState } from "react";
import React from "react";
import { MarkerData } from "../../components/blip/Map";

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
      lat: incident.lat,
      lng: incident.lng,
      location: incident.location,
      time: incident.time.toISOString(),
      type: incident.type,
      summary: incident.summary
    }
  })

  return {
    props: {
      markerData
    }
  }
}

const dummyData: MarkerData[] = [
  {
    id: 1,
    lat: 59.94015,
    lng: 10.72185,
    location: 'Blindern, UiO',
    time: '12:00',
    type: 'Public disturbance',
    summary: 'A man was reported throwing objects and hitting house walls with a golf club. The police have detained the man.'
  },
  {
    id: 2,
    lat: 59.95015,
    lng: 10.62185,
    location: 'Some other place',
    time: '13:00',
    type: 'Car crash',
    summary: 'A car crashed into a tree. The driver was not injured.'
  }
]

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
