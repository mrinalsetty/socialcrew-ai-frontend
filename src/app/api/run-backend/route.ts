export const runtime = "nodejs";

import { NextResponse } from "next/server";
import path from "path";

// This route now calls the FastAPI backend /run endpoint instead of
// spawning a local Python process. For production, set BACKEND_URL.

export async function POST() {
  try {
    const backendHttp = process.env.BACKEND_URL
      ? String(process.env.BACKEND_URL).replace(/\/$/, "")
      : "http://localhost:8000";

    // Accept optional topic via query param forwarded from client
    const url = new URL(process.env.REQUEST_URL || "http://localhost");
    const topic = url.searchParams.get("topic") || undefined;

    const payload: Record<string, unknown> = {};
    if (topic) payload.topic = topic;

    const res = await fetch(`${backendHttp}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({ status: "unknown" }));
    return NextResponse.json(
      { ok: res.ok, status: res.status, data },
      { status: res.status }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
