import { type NextPage } from "next";
import dynamic from 'next/dynamic'
import Head from "next/head";
import { useRef, useState } from "react";
import React from "react";
import { trpc } from "../../utils/trpc";

import type { MarkerData, markerFilterType, markerSeverityType } from "../../components/blip/Map";
import Link from "next/link";
import TimeSelect from "../../components/blip/TimeSelect";
import DropdownPanel from "../../components/blip/DropdownPanel";
import { usersToScrape } from "../../server/common/usersToScrape";

const Map = dynamic(() => import('../../components/blip/Map'), { ssr: false })

const timeSelectOptions = [
  {pretty: '1 h', hours: 1},
  {pretty: '3 h', hours: 3},
  {pretty: '6 h', hours: 6},
  {pretty: '12 h', hours: 12},
  {pretty: '24 h', hours: 24},
  {pretty: '2 d', hours: 48},
  {pretty: '3 d', hours: 72},
  {pretty: '5 d', hours: 120},
  {pretty: '1 w', hours: 168},
];
const defaultTimeSelectIndex = 5;

const _LAST_DATA_AVAILABLE = "2023-04-26T19:20:56.571Z";

const defaultFromDate = new Date(_LAST_DATA_AVAILABLE);
defaultFromDate.setHours(defaultFromDate.getHours() - timeSelectOptions[defaultTimeSelectIndex].hours);

const defaultFilters: Record<markerFilterType, boolean> = {
  default: true,
  traffic: true,
  fire: true,
  speed: true,
  missing: true,
}

const defaultSeverityFilters: Record<markerSeverityType, boolean> = {
  HIGH: true,
  MED: true,
  LOW: true,
}

export type TwitterHandleFilters = Record<string, Record<string, boolean>>
const defaultTwitterHandleFilters: TwitterHandleFilters = Object.fromEntries(Object.entries(usersToScrape).map(([key, value]) => [key, Object.fromEntries(Object.entries(value).map(([key2, value2]) => [value2, true]))]))

const Home: NextPage = () => {
  const [findMe, setFindMe] = useState(0)
  const [markerData, setMarkerData] = useState<MarkerData[]>([])
  const [dateFrom, setDateFrom] = useState<Date>(defaultFromDate)
  const [filters, setFilters] = useState(defaultFilters)
  const [severityFilters, setSeverityFilters] = useState(defaultSeverityFilters)
  const [twitterHandleFilters, setTwitterHandleFilters] = useState(defaultTwitterHandleFilters)
  const [showWarningBanner, setShowWarningBanner] = useState(true)
  const tGetMarkerData = trpc.blip.getMarkerData.useQuery({fromDate: dateFrom.toISOString()}, {
    onSuccess: (data) => {
      if (data) {
        console.log("Got data, with fromDate: ", data.fromDate)
        setMarkerData(data.markerData)
      }
    },
    onError: (error) => {
      if (error.data?.httpStatus === 429) {
        alert("Too many requests, please wait a bit before trying again")
      }
      console.log(error)
    },
  })


  const setHours = (hours: number) => {
    const newDate = new Date(_LAST_DATA_AVAILABLE);
    newDate.setHours(newDate.getHours() - hours);
    console.log("Setting hours to: ", hours, " with new date: ", newDate)
    setDateFrom(newDate);
  }

  return ( 
    <>
      <Head>
        <title>Blip - Real-time incident mapping</title>
        <meta name="description" content="Jonas Silva personal website" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        <nav className="fixed top-0 left-0 w-full z-[2000] pt-1 pr-1 md:pl-10">
          <div className="mx-auto md:pl-3">
            <div className="flex justify-between h-12">
              <div className="mt-2">
                <span className="text-md text-gray-200 hidden md:block mb-1"><b>Blip</b> - Real-time incident mapping</span>
                <DropdownPanel filters={filters} setFilters={setFilters} severityFilters={severityFilters} setSeverityFilters={setSeverityFilters} twitterHandleFilters={twitterHandleFilters} setTwitterHandleFilters={setTwitterHandleFilters} />
              </div>
              <div className="flex gap-1 flex-col md:items-start md:gap-2 md:flex-row">
                <TimeSelect options={timeSelectOptions} defaultIndex={defaultTimeSelectIndex} setHours={setHours} />
                <div className="flex justify-end">
                  <button onClick={() => setFindMe(findMe + 1)} className="bg-gray-800 max-w-[5rem] text-white px-3 py-2 rounded-sm text-sm font-medium hover:bg-gray-700" id="user-menu" aria-haspopup="true">
                    Find me
                  </button>
                </div>
              </div>
            </div>
          </div>
        </nav>
        <Map markerData={markerData} findMe={findMe} filters={filters} severityFilters={severityFilters} twitterHandleFilters={twitterHandleFilters} />
        <div className="fixed bottom-0 left-0 p-2 bg-black text-gray-400 text-sm z-[2000]">
          by <span className="text-gray-200"><Link href="/">@jonaslsa</Link></span>
          {showWarningBanner && (<>
            <span className=" mx-4">-</span>
            <span>This is no longer real-time, as the <a target="_blank" className="underline" href="https://www.theverge.com/2023/3/30/23662832/twitter-api-tiers-free-bot-novelty-accounts-basic-enterprice-monthly-price" rel="noreferrer">price of the Twitter API is too high</a> for me to afford for this hobby project. Showing from April 2023.</span>
            <button onClick={() => setShowWarningBanner(false)} className="ml-2 text-gray-200">X</button>
          </>)}
        </div>
      </main>
    </>
  );
};

export default Home;
