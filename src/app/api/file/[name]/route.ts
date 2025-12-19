export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await ctx.params;

    // Allow only specific filenames
    if (!/^[A-Za-z0-9._-]+\.(md|json|txt)$/.test(name)) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const backendUrl = process.env.BACKEND_URL?.trim()?.replace(/\/$/, "");

    if (!backendUrl) {
      return NextResponse.json(
        { error: "BACKEND_URL not configured" },
        { status: 500 }
      );
    }

    const target = `${backendUrl}/file/${encodeURIComponent(name)}`;

    // Fetch from backend - don't accept compressed response to avoid issues
    const res = await fetch(target, {
      headers: {
        "Accept-Encoding": "identity", // Request uncompressed response
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown error");
      return NextResponse.json({ error: errText }, { status: res.status });
    }

    // Read the full response body instead of streaming
    const contentType =
      res.headers.get("content-type") || "application/octet-stream";

    if (contentType.includes("application/json")) {
      const data = await res.json();
      return NextResponse.json(data);
    } else {
      const text = await res.text();
      return new NextResponse(text, {
        status: 200,
        headers: {
          "Content-Type": contentType,
        },
      });
    }
  } catch (err) {
    console.error("File proxy error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch file" },
      { status: 500 }
    );
  }
}
