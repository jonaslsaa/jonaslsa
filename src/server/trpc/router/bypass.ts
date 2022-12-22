import { z } from "zod";

import { router, publicProcedure } from "../trpc";

const bypassAPI = "https://bypass.pm/bypass2?url=";

const doBypass = async (link: string) => {
  const res = await fetch(bypassAPI + link);
  const data = await res.json();
  return data.destination;
};

const extractLinkvertise = (page: string): string|undefined => {
  const valid_links = ["linkvertise.com", "up-to-down.net", "link-center.net", "link-to.net", "direct-link.net", "file-link.net", "link-hub.net", "link-target.net"];
  // find all links in the page
  const rlinks = page.match(/https?:\/\/[^\s]+/g)
  if (!rlinks) return undefined;
  // filter out links with < and > (html tags)
  let links = rlinks.filter((link) => {
    return !link.includes("<") && !link.includes(">");
  });
  links = links.map((link) => {
    if (link.endsWith("\"") || link.endsWith("'")) {
      return link.slice(0, -1);
    }
    return link;
  });

  // find the linkvertise link
  const linkvertise = links.find((link) => {
    return valid_links.some((valid_link) => link.includes(valid_link));
  });
  return linkvertise;
};

const doubleBypass = async (link: string) => {
  const newLink = await doBypass(link);
  // find new linkvertise link inside the bypassed page
  const newPage = await (await fetch(newLink)).text();
  const newLinkvertise = extractLinkvertise(newPage);
  if (newLinkvertise === null || newLinkvertise === undefined) { return newLink; }
  // bypass the new linkvertise link
  const finalLink = await doBypass(newLinkvertise);
  return finalLink;
};

export const bypassRouter = router({
  bypassLink: publicProcedure
    .input(z.string())
    .mutation(async ({ input: link }) => {
      return await doubleBypass(link);
    }),
});
