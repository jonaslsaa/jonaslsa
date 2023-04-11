import "../../styles/leaflet.css"

import { type AppType } from "next/app";

export const MyApp: AppType = ({Component, pageProps}) => {
  return (
    <Component {...pageProps} />
  );
};
