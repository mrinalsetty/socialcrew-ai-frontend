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
  { label: "Facebook Pages", value: "FACEBOOK" },
  { label: "X", value: "X" },
  { label: "Instagram", value: "INSTAGRAM" },
  { label: "Threads", value: "THREADS" },
];

export default function HomePage() {
  const [form, setForm] = useState<GenerateRequest>({
    topic: "",
    platform: "LINKEDIN",
    brandName: "",
    audience: "",
    tone: "",
    ctaStyle: "",
  });

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

    checkBackend();
    const interval = setInterval(checkBackend, 15000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const statusLabel = useMemo(() => {
    if (backendOnline) return "V2.0 • Backend online";
    return "V2.0 • Backend sleeping";
  }, [backendOnline]);

  const updateField = (field: keyof GenerateRequest, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const saveHistory = (item: HistoryItem) => {
    const updated = [item, ...history].slice(0, 6);
    setHistory(updated);
    window.localStorage.setItem("socialcrew-history", JSON.stringify(updated));
  };

  const handleGenerate = async () => {
    if (!form.topic.trim()) {
      setError("Please enter a topic.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload: GenerateRequest = {
        ...form,
        topic: form.topic.trim(),
      };

      const result = await generateContent(payload);
      setData(result);
      setBackendOnline(true);

      saveHistory({
        id: crypto.randomUUID(),
        topic: payload.topic,
        platform: payload.platform,
        brandName: payload.brandName || "No brand",
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

  const loadFromHistory = (item: HistoryItem) => {
    setForm((prev) => ({
      ...prev,
      topic: item.topic,
      platform: item.platform,
      brandName: item.brandName === "No brand" ? "" : item.brandName,
    }));
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.10),transparent_28%),#020617] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-cyan-400">
              SocialCrew AI
            </h1>
            <p className="mt-2 text-sm text-white/50">
              Platform-aware multi-agent social content generation
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

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_0_40px_rgba(34,211,238,0.05)]">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-300">
                Creator agent
              </span>
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-300">
                Analyst agent
              </span>
              {health && (
                <span className="text-xs text-white/45">
                  {health.creatorModel} + {health.analystModel}
                </span>
              )}
            </div>

            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-sm text-white/70">
                  Topic
                </label>
                <input
                  type="text"
                  value={form.topic}
                  onChange={(e) => updateField("topic", e.target.value)}
                  placeholder="e.g. AI productivity for founders"
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none placeholder:text-white/25 focus:border-cyan-400"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-white/70">
                    Platform
                  </label>
                  <select
                    value={form.platform}
                    onChange={(e) =>
                      updateField("platform", e.target.value as SocialPlatform)
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-cyan-400"
                  >
                    {platforms.map((platform) => (
                      <option
                        key={platform.value}
                        value={platform.value}
                        className="bg-slate-950"
                      >
                        {platform.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-white/70">
                    Brand Name
                  </label>
                  <input
                    type="text"
                    value={form.brandName}
                    onChange={(e) => updateField("brandName", e.target.value)}
                    placeholder="e.g. SocialCrew AI"
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none placeholder:text-white/25 focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm text-white/70">
                    Audience
                  </label>
                  <input
                    type="text"
                    value={form.audience}
                    onChange={(e) => updateField("audience", e.target.value)}
                    placeholder="founders, creators..."
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none placeholder:text-white/25 focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-white/70">
                    Tone
                  </label>
                  <input
                    type="text"
                    value={form.tone}
                    onChange={(e) => updateField("tone", e.target.value)}
                    placeholder="smart, bold, warm..."
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none placeholder:text-white/25 focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-white/70">
                    CTA Style
                  </label>
                  <input
                    type="text"
                    value={form.ctaStyle}
                    onChange={(e) => updateField("ctaStyle", e.target.value)}
                    placeholder="soft, direct, community..."
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none placeholder:text-white/25 focus:border-cyan-400"
                  />
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="mt-2 rounded-2xl bg-cyan-400 px-6 py-3 font-semibold text-black shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Generating…" : "Generate Platform-Aware Content"}
              </button>

              {error && <p className="text-sm text-orange-300">{error}</p>}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-cyan-300">
                  Generation History
                </h2>
                <p className="text-sm text-white/50">
                  Last 6 local runs on this device
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-white/30">
                  No history yet.
                </div>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => loadFromHistory(item)}
                    className="w-full rounded-2xl border border-white/10 bg-black/35 p-4 text-left transition hover:border-cyan-400/30"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-300">
                        {item.platform}
                      </span>
                      <span className="text-xs text-white/40">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="font-medium text-white">{item.topic}</p>
                    <p className="mt-1 text-sm text-white/50">
                      {item.brandName}
                    </p>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-cyan-300">
                  Content Creator
                </h2>
                <p className="text-sm text-white/50">
                  Platform-aware generated variants
                </p>
              </div>
            </div>

            {!data && !loading && (
              <div className="flex min-h-[380px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-white/25">
                Generated posts will appear here
              </div>
            )}

            {loading && (
              <div className="flex min-h-[380px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-white/40">
                Creator agent is drafting posts…
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
                      <h3 className="font-semibold text-white">{post.title}</h3>
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

          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-cyan-300">
                  Social Analyst
                </h2>
                <p className="text-sm text-white/50">
                  Platform and audience-aware evaluation
                </p>
              </div>
            </div>

            {!data && !loading && (
              <div className="flex min-h-[380px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-white/25">
                Analysis will appear here
              </div>
            )}

            {loading && (
              <div className="flex min-h-[380px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-white/40">
                Analyst agent is reviewing drafts…
              </div>
            )}

            {data && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-emerald-300/80">
                    Best pick
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    Option {data.socialAnalyst.bestPost}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                  <p className="mb-2 text-xs uppercase tracking-[0.18em] text-cyan-300/80">
                    Why it wins
                  </p>
                  <p className="text-sm leading-6 text-white/80">
                    {data.socialAnalyst.reason}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                  <p className="mb-2 text-xs uppercase tracking-[0.18em] text-cyan-300/80">
                    Positioning
                  </p>
                  <p className="text-sm leading-6 text-white/80">
                    {data.socialAnalyst.positioning}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                  <p className="mb-3 text-xs uppercase tracking-[0.18em] text-cyan-300/80">
                    Suggestions
                  </p>
                  <ul className="space-y-2 text-sm text-white/80">
                    {data.socialAnalyst.suggestions.map((suggestion, index) => (
                      <li
                        key={index}
                        className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2"
                      >
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
