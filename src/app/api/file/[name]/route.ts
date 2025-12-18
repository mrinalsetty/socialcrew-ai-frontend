export const runtime = "nodejs";

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await ctx.params;
    // Allow only simple filenames and specific extensions
    if (!/^[A-Za-z0-9._-]+\.(md|json|txt)$/.test(name)) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }
    const backendHttp =
      process.env.BACKEND_URL && String(process.env.BACKEND_URL).trim();
    const base = backendHttp ? backendHttp.replace(/\/$/, "") : null;
    if (base) {
      const target = `${base}/file/${encodeURIComponent(name)}`;
      const res = await fetch(target);
      const headers = new Headers();
      res.headers.forEach((v, k) => headers.set(k, v));
      return new NextResponse(res.body, { status: res.status, headers });
    }
    // If BACKEND_URL is not set, return 404 (no local file access in Vercel)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
