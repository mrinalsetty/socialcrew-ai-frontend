"use client";

import { useState } from "react";

type GeneratedPost = {
  id: number;
  title: string;
  content: string;
  hashtags: string[];
};

type AnalystResponse = {
  bestPost: number;
  reason: string;
  suggestions: string[];
};

type GenerateResponse = {
  contentCreator: GeneratedPost[];
  socialAnalyst: AnalystResponse;
};

export default function HomePage() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<GenerateResponse | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("Please enter a topic.");
      return;
    }

    setLoading(true);
    setError("");
    setData(null);

    try {
      const response = await fetch("http://localhost:4000/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topic }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate content");
      }

      const result: GenerateResponse = await response.json();
      setData(result);
    } catch (err) {
      setError("Could not connect to backend. Make sure backend is running.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex items-center justify-between border-b border-white/10 pb-4">
          <h1 className="text-3xl font-bold text-cyan-400">SocialCrew AI</h1>
          <p className="text-sm text-white/50">V1.0 • Two-agent demo</p>
        </div>

        <div className="mb-8">
          <label className="mb-3 block text-sm text-white/70">
            What topic should we create content for?
          </label>

          <div className="flex gap-3">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., AI productivity tools, startup growth, creator economy..."
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none placeholder:text-white/30 focus:border-cyan-400"
            />
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="rounded-xl bg-cyan-400 px-6 py-3 font-semibold text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Generating..." : "Generate"}
            </button>
          </div>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-cyan-300">
                Content Creator
              </h2>
              <p className="text-sm text-white/50">Generated social posts</p>
            </div>

            {!data && !loading && (
              <div className="flex min-h-[320px] items-center justify-center text-white/30">
                Generated posts will appear here
              </div>
            )}

            {loading && (
              <div className="flex min-h-[320px] items-center justify-center text-white/50">
                Creating posts...
              </div>
            )}

            {data && (
              <div className="space-y-4">
                {data.contentCreator.map((post) => (
                  <div
                    key={post.id}
                    className="rounded-xl border border-white/10 bg-black/30 p-4"
                  >
                    <h3 className="mb-2 font-semibold text-white">
                      {post.title}
                    </h3>
                    <p className="mb-3 whitespace-pre-line text-sm text-white/80">
                      {post.content}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {post.hashtags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-cyan-400/10 px-2 py-1 text-xs text-cyan-300"
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

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-cyan-300">
                Social Analyst
              </h2>
              <p className="text-sm text-white/50">Performance insights</p>
            </div>

            {!data && !loading && (
              <div className="flex min-h-[320px] items-center justify-center text-white/30">
                Analytics will appear here
              </div>
            )}

            {loading && (
              <div className="flex min-h-[320px] items-center justify-center text-white/50">
                Analyzing posts...
              </div>
            )}

            {data && (
              <div className="space-y-4 rounded-xl border border-white/10 bg-black/30 p-4">
                <div>
                  <p className="text-sm text-white/50">Best Post</p>
                  <p className="text-lg font-semibold text-white">
                    Option {data.socialAnalyst.bestPost}
                  </p>
                </div>

                <div>
                  <p className="mb-1 text-sm text-white/50">Why it works</p>
                  <p className="text-sm text-white/80">
                    {data.socialAnalyst.reason}
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-sm text-white/50">Suggestions</p>
                  <ul className="list-disc space-y-2 pl-5 text-sm text-white/80">
                    {data.socialAnalyst.suggestions.map((suggestion, index) => (
                      <li key={index}>{suggestion}</li>
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
