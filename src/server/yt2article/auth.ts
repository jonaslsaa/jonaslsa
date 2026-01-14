import jwt from "jsonwebtoken";
import { env } from "../../env/server.mjs";
import type { NextApiRequest, NextApiResponse } from "next";

const COOKIE_NAME = "yt2article-auth";
const JWT_TTL = "30d";

export interface Yt2ArticleJwtPayload {
  authenticated: true;
  iat: number;
  exp: number;
}

export function verifyPassword(password: string): boolean {
  return password === env.YT2ARTICLE_PASSWORD;
}

export function createJwt(): string {
  return jwt.sign(
    { authenticated: true },
    env.YT2ARTICLE_JWT_SECRET,
    { expiresIn: JWT_TTL }
  );
}

export function verifyJwt(token: string): Yt2ArticleJwtPayload | null {
  try {
    return jwt.verify(token, env.YT2ARTICLE_JWT_SECRET) as Yt2ArticleJwtPayload;
  } catch {
    return null;
  }
}

export function getJwtFromRequest(req: NextApiRequest | undefined): string | null {
  if (!req) return null;
  const cookies = req.cookies;
  return cookies[COOKIE_NAME] || null;
}

export function setAuthCookie(res: NextApiResponse, token: string): void {
  const maxAge = 30 * 24 * 60 * 60; // 30 days in seconds
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`
  );
}

export function clearAuthCookie(res: NextApiResponse): void {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`
  );
}
