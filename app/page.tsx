"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { generateContent, getBackendHealth } from "@/lib/api";
import type {
  BackendHealth,
  GenerateRequest,
  GenerateResponse,
  HistoryItem,
  SocialPlatform,
} from "@/types";

const platforms: { label: string; value: SocialPlatform }[] = [
  { label: "LinkedIn", value: "LINKEDIN" },
  { label: "YouTube", value: "YOUTUBE" },
  { label: "Facebook", value: "FACEBOOK" },
  { label: "X", value: "X" },
  { label: "Instagram", value: "INSTAGRAM" },
  { label: "Threads", value: "THREADS" },
];

export default function HomePage() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<SocialPlatform>("LINKEDIN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<GenerateResponse | null>(null);
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const stored = window.localStorage.getItem("socialcrew-history");
    if (stored) {
      try {
        setHistory(JSON.parse(stored) as HistoryItem[]);
      } catch {
        setHistory([]);
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const checkBackend = async () => {
      try {
        const result = await getBackendHealth();
        if (!mounted) return;
        setHealth(result);
        setBackendOnline(true);
      } catch {
        if (!mounted) return;
        setBackendOnline(false);
      }
    };

    void checkBackend();
    const interval = setInterval(() => {
      void checkBackend();
    }, 15000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const statusLabel = useMemo(() => {
    if (backendOnline) return "Backend online";
    return "Backend sleeping";
  }, [backendOnline]);

  const saveHistory = (item: HistoryItem) => {
    const updated = [item, ...history].slice(0, 12);
    setHistory(updated);
    window.localStorage.setItem("socialcrew-history", JSON.stringify(updated));
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("Please enter a topic.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload: GenerateRequest = {
        topic: topic.trim(),
        platform,
        brandName: "Personal Brand",
        audience: "Founders, creators, small business operators",
        tone: "Smart, practical, human",
        ctaStyle: "Soft CTA",
      };

      const result = await generateContent(payload);
      setData(result);
      setBackendOnline(true);

      saveHistory({
        id: crypto.randomUUID(),
        topic: payload.topic,
        platform: payload.platform,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(err);
      setBackendOnline(false);
      setError("Could not connect to backend. Make sure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleHistoryClick = (item: HistoryItem) => {
    setTopic(item.topic);
    setPlatform(item.platform);
  };

  const handleComposerKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleGenerate();
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.10),transparent_28%),#020617] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-[290px] shrink-0 border-r border-white/10 bg-black/30 xl:flex xl:flex-col">
          <div className="border-b border-white/10 p-5">
            <div>
              <h1 className="text-xl font-bold text-cyan-400">SocialCrew AI</h1>
              <p className="mt-1 text-xs text-white/45">
                Agentic social content workspace
              </p>
            </div>

            <button
              onClick={() => {
                setTopic("");
                setData(null);
                setError("");
              }}
              className="mt-4 w-full rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-left text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/15"
            >
              + New generation
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.18em] text-cyan-300/70">
              History
            </p>

            <div className="space-y-2">
              {history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-white/30">
                  No generations yet
                </div>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleHistoryClick(item)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-cyan-400/25"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[10px] text-cyan-300">
                        {item.platform}
                      </span>
                      <span className="text-[10px] text-white/35">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm text-white/80">
                      {item.topic}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>

        <section className="flex-1 px-5 py-6 md:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-cyan-400">
                  SocialCrew AI
                </h2>
                <p className="mt-2 text-sm text-white/50">
                  Multi-agent social content generation for founders and
                  personal brands
                </p>
              </div>

              <Link
                href="/backend"
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  backendOnline
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-orange-500/40 bg-orange-500/10 text-orange-300"
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    backendOnline
                      ? "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.85)]"
                      : "bg-orange-400 shadow-[0_0_14px_rgba(251,146,60,0.85)]"
                  }`}
                />
                {statusLabel}
              </Link>
            </div>

            <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_0_40px_rgba(34,211,238,0.05)]">
              <div className="mb-4 flex flex-wrap gap-2">
                {platforms.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setPlatform(item.value)}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      platform === item.value
                        ? "border border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
                        : "border border-white/10 bg-black/30 text-white/60 hover:border-cyan-400/20 hover:text-cyan-200"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Ask the agents to create content… e.g. 3 post ideas on AI productivity for founders"
                  className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none placeholder:text-white/25 focus:border-cyan-400"
                />
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="rounded-2xl bg-cyan-400 px-6 py-4 font-semibold text-black shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Running agents…" : "Generate"}
                </button>
              </div>

              {error && <p className="mt-3 text-sm text-orange-300">{error}</p>}
            </section>

            <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-cyan-300">
                    Agent Workflow
                  </h3>
                  <p className="text-sm text-white/45">
                    This should feel like a team, not a chatbot
                  </p>
                </div>

                {health && (
                  <span className="text-xs text-white/40">
                    {health.creatorModel} + {health.analystModel}
                  </span>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {(
                  data?.agentFlow ?? [
                    {
                      name: "Strategy Agent",
                      summary: "Plans the strongest angle for the platform.",
                    },
                    {
                      name: "Creator Agent",
                      summary: "Generates multiple content variations.",
                    },
                    {
                      name: "Analyst Agent",
                      summary: "Evaluates which variant is strongest.",
                    },
                  ]
                ).map((agent, index) => (
                  <div
                    key={agent.name}
                    className="rounded-2xl border border-white/10 bg-black/35 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[10px] text-cyan-300">
                        Agent {index + 1}
                      </span>
                      <span className="text-xs text-white/35">
                        {loading ? "Running…" : "Ready"}
                      </span>
                    </div>
                    <h4 className="font-semibold text-white">{agent.name}</h4>
                    <p className="mt-2 text-sm leading-6 text-white/70">
                      {agent.summary}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <section className="space-y-6">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <h3 className="mb-4 text-xl font-semibold text-cyan-300">
                    Strategy Agent
                  </h3>

                  {!data ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-5 text-white/30">
                      Strategy brief will appear here
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <InfoBlock label="Angle" value={data.strategy.angle} />
                      <InfoBlock
                        label="Audience Fit"
                        value={data.strategy.audienceFit}
                      />
                      <InfoBlock
                        label="Hook Style"
                        value={data.strategy.hookStyle}
                      />
                      <InfoBlock
                        label="CTA Approach"
                        value={data.strategy.ctaApproach}
                      />
                      <InfoBlock label="Brief" value={data.strategy.brief} />
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <h3 className="mb-4 text-xl font-semibold text-cyan-300">
                    Social Analyst
                  </h3>

                  {!data ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-5 text-white/30">
                      Analysis will appear here
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-emerald-300/80">
                          Best pick
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-white">
                          Option {data.socialAnalyst.bestPost}
                        </p>
                      </div>

                      <InfoBlock
                        label="Why it wins"
                        value={data.socialAnalyst.reason}
                      />
                      <InfoBlock
                        label="Positioning"
                        value={data.socialAnalyst.positioning}
                      />

                      <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                        <p className="mb-3 text-xs uppercase tracking-[0.18em] text-cyan-300/80">
                          Suggestions
                        </p>
                        <ul className="space-y-2 text-sm text-white/80">
                          {data.socialAnalyst.suggestions.map(
                            (suggestion, index) => (
                              <li
                                key={index}
                                className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2"
                              >
                                {suggestion}
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="mb-4 text-xl font-semibold text-cyan-300">
                  Creator Agent Output
                </h3>

                {!data && !loading && (
                  <div className="flex min-h-[600px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-white/25">
                    Generated posts will appear here
                  </div>
                )}

                {loading && (
                  <div className="flex min-h-[600px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-white/40">
                    Creator agent is drafting variants…
                  </div>
                )}

                {data && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4 text-sm text-cyan-100/90">
                      <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-cyan-300/80">
                        Creator summary
                      </span>
                      {data.contentSummary}
                    </div>

                    {data.contentCreator.map((post) => (
                      <div
                        key={post.id}
                        className="rounded-2xl border border-white/10 bg-black/35 p-4 transition hover:border-cyan-400/30"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <h4 className="font-semibold text-white">
                            {post.title}
                          </h4>
                          <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/45">
                            Option {post.id}
                          </span>
                        </div>

                        <p className="mb-3 whitespace-pre-line text-sm leading-6 text-white/80">
                          {post.content}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {post.hashtags.map((tag) => (
                            <span
                              key={`${post.id}-${tag}`}
                              className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-300"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-cyan-300/80">
        {label}
      </p>
      <p className="text-sm leading-6 text-white/80">{value}</p>
    </div>
  );
}
