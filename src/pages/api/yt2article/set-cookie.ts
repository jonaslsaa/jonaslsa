import type { NextApiRequest, NextApiResponse } from "next";
import { setAuthCookie, verifyJwt } from "../../../server/yt2article/auth";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token } = req.body as { token?: string };
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Token required" });
  }

  // Verify token is valid before setting cookie
  if (!verifyJwt(token)) {
    return res.status(401).json({ error: "Invalid token" });
  }

  setAuthCookie(res, token);
  return res.status(200).json({ success: true });
}
