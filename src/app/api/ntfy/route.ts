export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { ProxyAgent, fetch as undiciFetch } from "undici";
import { type NextRequest, NextResponse } from "next/server";

interface NtfyRelayBody {
  message?: string;
  title?: string;
  click?: string;
  priority?: string;
  tags?: string;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!process.env.NTFY_RELAY_SECRET || authHeader !== `Bearer ${process.env.NTFY_RELAY_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const topic = process.env.NTFY_TOPIC;
  const token = process.env.NTFY_TOKEN;
  const proxyUrl = process.env.NTFY_PROXY_URL;
  if (!topic || !token || !proxyUrl) {
    return NextResponse.json({ error: "Relay not configured" }, { status: 500 });
  }

  let body: NtfyRelayBody;
  try {
    body = (await req.json()) as NtfyRelayBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Title: body.title ?? "Fotballfesten ticket watch",
    Priority: body.priority ?? "high",
    Tags: body.tags ?? "soccer,rotating_light",
  };
  if (body.click) headers.Click = body.click;

  try {
    const response = await undiciFetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers,
      body: body.message,
      dispatcher: new ProxyAgent(proxyUrl),
    });
    if (!response.ok) {
      return NextResponse.json(
        { ok: false, status: response.status, detail: await response.text() },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, status: response.status });
  } catch (error) {
    console.error("ntfy relay error:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 502 });
  }
}
