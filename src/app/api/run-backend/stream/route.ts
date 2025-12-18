export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import path from "path";
import fs from "fs";

export async function GET(req: Request) {
  // Determine backend address. Use BACKEND_URL in production; otherwise local.
  const configured =
    process.env.BACKEND_URL && String(process.env.BACKEND_URL).trim();
  const backendHttp = configured
    ? configured.replace(/\/$/, "")
    : "http://localhost:8000";

  // If remote BACKEND_URL is set, proxy the SSE stream
  if (configured) {
    const inUrl = new URL(req.url);
    const topic = (inUrl.searchParams.get("topic") || "").trim();
    const base = backendHttp;
    const target = `${base}/run${
      topic ? `?topic=${encodeURIComponent(topic)}` : ""
    }`;
    const res = await fetch(target, {
      headers: { accept: "text/event-stream" },
    });
    const headers = new Headers();
    headers.set("Content-Type", "text/event-stream; charset=utf-8");
    headers.set("Cache-Control", "no-cache, no-transform");
    headers.set("Connection", "keep-alive");
    return new Response(res.body, { status: res.status, headers });
  }

  const encoder = new TextEncoder();
  const backendDir = path.join(process.cwd(), "..", "backend");
  const env: NodeJS.ProcessEnv = { ...process.env, PYTHONPATH: "src" };
  try {
    const dotenvPath = path.join(backendDir, ".env");
    if (fs.existsSync(dotenvPath)) {
      const raw = fs.readFileSync(dotenvPath, "utf8");
      raw.split(/\r?\n/).forEach((line) => {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m) return;
        const key = m[1];
        let val = m[2];
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      });
    }
  } catch {
    // ignore
  }

  const url = new URL(req.url);
  const topic = (url.searchParams.get("topic") || "").trim();
  if (topic) env.TOPIC = topic;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      function writeSse(line: string) {
        controller.enqueue(encoder.encode(`data: ${line}\n\n`));
      }
      function writeEvent(event: string, data: string) {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      if (topic) {
        writeSse(`Topic received: ${topic}`);
      } else {
        writeSse("No topic provided. Backend will use default.");
      }
      writeSse(`PYTHON_BIN: ${env.PYTHON_BIN || "not set"}`);
      writeSse(`PYTHONPATH: ${env.PYTHONPATH || "not set"}`);

      const detectedKeys = Object.keys(env).filter((k) => /_API_KEY$/.test(k));
      if (detectedKeys.length === 0) {
        writeSse(
          "No provider API key detected in environment. Proceeding anyway."
        );
        writeSse("Set your key(s) in backend/.env (e.g., GROQ_API_KEY=...)");
      } else {
        writeSse(`Detected provider keys: ${detectedKeys.join(", ")}`);
      }

      // Call the local FastAPI /run endpoint and stream diagnostic messages
      (async () => {
        try {
          writeSse(`Calling backend: ${backendHttp}/run`);
          const resp = await fetch(`${backendHttp}/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic: topic || undefined }),
          });
          const code = resp.status;
          let payload: unknown = null;
          try {
            payload = await resp.json();
          } catch (e) {
            payload = await resp.text();
          }
          writeSse(`Backend response status: ${String(code)}`);
          writeSse(`Backend response: ${JSON.stringify(payload)}`);

          const outJson = path.join(backendDir, "social_posts.json");
          const outMd = path.join(backendDir, "analytics_summary.md");
          const logFile = path.join(backendDir, "run.log");
          writeSse(
            `Check output: social_posts.json exists? ${fs.existsSync(outJson)}`
          );
          writeSse(
            `Check output: analytics_summary.md exists? ${fs.existsSync(outMd)}`
          );
          writeSse(`Check log: run.log exists? ${fs.existsSync(logFile)}`);
          writeEvent("done", String(code));
        } catch (err) {
          writeEvent("error", String(err instanceof Error ? err.message : err));
        } finally {
          controller.close();
        }
      })();
    },
    cancel() {
      // client disconnected; nothing special to do
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
