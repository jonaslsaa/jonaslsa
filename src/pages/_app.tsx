import { type AppType } from "next/app";
import { Analytics } from '@vercel/analytics/react' ;

import { trpc } from "../utils/trpc";

import "../styles/globals.css";
import "../styles/leaflet.css"

const MyApp: AppType = ({Component, pageProps}) => {
  return (
    <>
      <Component {...pageProps} />
      <Analytics />
    </>
  );
};

export default trpc.withTRPC(MyApp);
