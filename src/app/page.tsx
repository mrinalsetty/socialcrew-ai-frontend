"use client";

import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  role: "agent" | "system";
  agent?: "Content Creator" | "Social Analyst";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState<string>("");
  const [showLogs, setShowLogs] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState<string>("");
  const esRef = useRef<EventSource | null>(null);
  const completedRef = useRef(false);

  function appendLog(line: string) {
    setLogs((prev) => (prev ? prev + "\n" + line : line));
  }

  async function runFlow() {
    try {
      setRunning(true);
      setError(null);
      setLogs("");
      setMessages([]);
      completedRef.current = false;

      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      const qp = topic ? `?topic=${encodeURIComponent(topic)}` : "";
      const es = new EventSource(`/api/run-backend/stream${qp}`);
      esRef.current = es;

      es.onmessage = async (evt) => {
        appendLog(evt.data);

        try {
          const data = JSON.parse(evt.data);

          if (data.status === "completed") {
            // Mark completed FIRST to prevent onerror from showing error
            completedRef.current = true;
            es.close();
            esRef.current = null;

            // Fetch outputs separately to handle individual failures
            const newMessages: ChatMessage[] = [];

            // Fetch social_posts.json
            try {
              const contentJsonResp = await fetch(
                "/api/file/social_posts.json"
              );
              if (contentJsonResp.ok) {
                const raw = await contentJsonResp.text();
                let pretty = raw;
                try {
                  const parsed = JSON.parse(raw);
                  if (parsed.raw && parsed.error) {
                    pretty = parsed.raw;
                  } else {
                    pretty = JSON.stringify(parsed, null, 2);
                  }
                } catch {}
                newMessages.push({
                  role: "agent",
                  agent: "Content Creator",
                  content: pretty,
                });
              } else {
                const errText = await contentJsonResp
                  .text()
                  .catch(() => "Unknown error");
                appendLog(
                  `social_posts.json: ${contentJsonResp.status} - ${errText}`
                );
                newMessages.push({
                  role: "agent",
                  agent: "Content Creator",
                  content: `Error: ${contentJsonResp.status}`,
                });
              }
            } catch (err) {
              appendLog(`social_posts.json fetch failed: ${err}`);
              newMessages.push({
                role: "agent",
                agent: "Content Creator",
                content: "Failed to load",
              });
            }

            // Fetch analytics_summary.md
            try {
              const analyticsMdResp = await fetch(
                "/api/file/analytics_summary.md"
              );
              if (analyticsMdResp.ok) {
                const md = await analyticsMdResp.text();
                newMessages.push({
                  role: "agent",
                  agent: "Social Analyst",
                  content: md,
                });
              } else {
                appendLog(`analytics_summary.md: ${analyticsMdResp.status}`);
                newMessages.push({
                  role: "agent",
                  agent: "Social Analyst",
                  content: `Error: ${analyticsMdResp.status}`,
                });
              }
            } catch (err) {
              appendLog(`analytics_summary.md fetch failed: ${err}`);
              newMessages.push({
                role: "agent",
                agent: "Social Analyst",
                content: "Failed to load",
              });
            }

            setMessages(newMessages);

            setRunning(false);
          } else if (data.status === "failed") {
            completedRef.current = true;
            setError(data.message || "Backend error");
            setRunning(false);
            es.close();
            esRef.current = null;
          }
        } catch {
          // Not JSON, just a log message - ignore
        }
      };

      es.onerror = () => {
        // Only show error if we haven't completed successfully
        if (!completedRef.current) {
          setError("Stream error. Check backend and .env.");
        }
        es.close();
        esRef.current = null;
        setRunning(false);
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRunning(false);
    }
  }

  useEffect(() => {
    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#121212] text-[#E5E7EB] flex flex-col">
      <header className="border-b border-[#2a2a2a] bg-[#1a1a1a] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-center text-2xl font-semibold text-[#D1D5DB]">
            SocialCrew AI
          </h1>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-5">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter topic for Content Creator..."
              className="flex-1 bg-[#0f0f0f] border border-[#2a2a2a] text-[#E5E7EB] placeholder-[#6B7280] rounded-md px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#6B7280]"
            />
            <button
              onClick={runFlow}
              disabled={running}
              className="px-5 py-3 rounded-md bg-[#3F3F46] text-[#E5E7EB] hover:bg-[#52525B] disabled:opacity-50 border border-[#4B5563]"
            >
              {running ? "Running…" : "Run"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-md bg-[#3F3F46] text-white flex items-center justify-center text-xs font-semibold">
                  CC
                </div>
                <div className="text-sm font-medium text-[#D1D5DB]">
                  Content Creator
                </div>
              </div>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[#D1D5DB] opacity-90 max-h-96 overflow-auto">
                {messages.find((m) => m.agent === "Content Creator")?.content ||
                  "—"}
              </pre>
            </div>

            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-md bg-[#3F3F46] text-white flex items-center justify-center text-xs font-semibold">
                  SA
                </div>
                <div className="text-sm font-medium text-[#D1D5DB]">
                  Social Analyst
                </div>
              </div>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[#D1D5DB] opacity-90 max-h-96 overflow-auto">
                {messages.find((m) => m.agent === "Social Analyst")?.content ||
                  "—"}
              </pre>
            </div>
          </div>

          {error && <div className="mt-4 text-[#FCA5A5] text-sm">{error}</div>}
        </div>
      </main>

      <div className="fixed bottom-4 left-4">
        <button
          onClick={() => setShowLogs((s) => !s)}
          className="px-3 py-2 rounded-md bg-[#2A2A2A] text-[#D1D5DB] border border-[#3a3a3a] text-xs"
        >
          {showLogs ? "Hide logs" : "Show logs"}
        </button>
      </div>

      {showLogs && (
        <div className="fixed bottom-16 left-4 right-4 max-h-48 overflow-auto rounded-md bg-black text-[#9AE6B4] p-3 text-xs border border-[#2a2a2a]">
          {logs || "—"}
        </div>
      )}
    </div>
  );
}
