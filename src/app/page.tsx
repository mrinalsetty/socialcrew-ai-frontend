"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type Post = {
  hook?: string;
  body?: string;
  cta?: string;
  hashtags?: string[] | string;
};

type PostsData = {
  x?: Post[];
  instagram?: Post[];
  linkedin?: Post[];
  youtube?: Post[];
  [key: string]: Post[] | undefined;
};

type ChatMessage = {
  role: "agent" | "system";
  agent?: "Content Creator" | "Social Analyst";
  content: string;
  parsedPosts?: PostsData;
};

const BACKEND_URL = "https://socialcrew-ai.onrender.com";

const PLATFORM_CONFIG: Record<string, { label: string; icon: string }> = {
  x: { label: "𝕏 Twitter", icon: "𝕏" },
  instagram: { label: "Instagram", icon: "📸" },
  linkedin: { label: "LinkedIn", icon: "💼" },
  youtube: { label: "YouTube", icon: "▶️" },
};

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState<string>("");
  const [showLogs, setShowLogs] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState<string>("");
  const [activePlatform, setActivePlatform] = useState<string>("x");
  const [serverStatus, setServerStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");
  const esRef = useRef<EventSource | null>(null);
  const completedRef = useRef(false);

  // Check server status
  const checkServerStatus = useCallback(async () => {
    setServerStatus("checking");
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${BACKEND_URL}/health`, {
        signal: controller.signal,
        mode: "cors",
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        setServerStatus("online");
      } else {
        setServerStatus("offline");
      }
    } catch {
      setServerStatus("offline");
    }
  }, []);

  useEffect(() => {
    checkServerStatus();
    const interval = setInterval(checkServerStatus, 30000);
    return () => clearInterval(interval);
  }, [checkServerStatus]);

  function appendLog(line: string) {
    setLogs((prev) => (prev ? prev + "\n" + line : line));
  }

  function parsePostsJson(raw: string): PostsData | null {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.raw && parsed.error) return null;

      const normalizeKeys = (obj: Record<string, Post[]>): PostsData => {
        const result: PostsData = {};
        Object.keys(obj).forEach((k) => {
          if (Array.isArray(obj[k])) {
            result[k.toLowerCase()] = obj[k];
          }
        });
        return result;
      };

      // Structure 1: { platforms: [{ name: "X", posts: [...] }, ...] }
      if (parsed.platforms && Array.isArray(parsed.platforms)) {
        const result: PostsData = {};
        parsed.platforms.forEach(
          (platform: { name: string; posts: Post[] }) => {
            const key = platform.name.toLowerCase();
            result[key] = platform.posts || [];
          }
        );
        return result;
      }

      // Structure 2: { Platforms: { X: [...], LinkedIn: [...] } }
      const platformsKey = Object.keys(parsed).find(
        (k) => k.toLowerCase() === "platforms"
      );
      if (
        platformsKey &&
        typeof parsed[platformsKey] === "object" &&
        !Array.isArray(parsed[platformsKey])
      ) {
        return normalizeKeys(parsed[platformsKey]);
      }

      // Structure 3: { "x": [...], "linkedin": [...] } - direct platform keys
      const keys = Object.keys(parsed);
      const hasPlatformArrays = keys.some((k) => Array.isArray(parsed[k]));
      if (hasPlatformArrays) {
        return normalizeKeys(parsed);
      }

      // Structure 4: { posts: { x: [...], linkedin: [...] } }
      if (
        parsed.posts &&
        typeof parsed.posts === "object" &&
        !Array.isArray(parsed.posts)
      ) {
        return normalizeKeys(parsed.posts);
      }

      // Structure 5: Array of posts with platform field
      if (Array.isArray(parsed)) {
        const grouped: PostsData = {};
        parsed.forEach((post: Post & { platform?: string }) => {
          const platform = (post.platform || "general").toLowerCase();
          if (!grouped[platform]) grouped[platform] = [];
          grouped[platform]!.push(post);
        });
        return grouped;
      }

      return null;
    } catch {
      return null;
    }
  }

  async function runFlow() {
    if (serverStatus === "offline") {
      setError("Server is offline. Click 'Wake Server' to start it.");
      return;
    }

    // Reset state
    setRunning(true);
    setError(null);
    setLogs("");
    setMessages([]);
    completedRef.current = false;

    // Close existing EventSource
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    try {
      const qp = topic ? `?topic=${encodeURIComponent(topic)}` : "";
      const es = new EventSource(`/api/run-backend/stream${qp}`);
      esRef.current = es;

      es.onmessage = async (evt) => {
        appendLog(evt.data);

        try {
          const data = JSON.parse(evt.data);

          if (data.status === "completed") {
            completedRef.current = true;
            es.close();
            esRef.current = null;

            const newMessages: ChatMessage[] = [];

            // Fetch social_posts.json
            try {
              const contentJsonResp = await fetch(
                "/api/file/social_posts.json"
              );
              if (contentJsonResp.ok) {
                const raw = await contentJsonResp.text();
                const parsedPosts = parsePostsJson(raw);
                newMessages.push({
                  role: "agent",
                  agent: "Content Creator",
                  content: raw,
                  parsedPosts: parsedPosts || undefined,
                });
                // Set active platform to first available
                if (parsedPosts) {
                  const availablePlatforms = Object.keys(parsedPosts).filter(
                    (k) =>
                      Array.isArray(parsedPosts[k]) &&
                      parsedPosts[k]!.length > 0
                  );
                  if (
                    availablePlatforms.length > 0 &&
                    !availablePlatforms.includes(activePlatform)
                  ) {
                    setActivePlatform(availablePlatforms[0]);
                  }
                }
              } else {
                newMessages.push({
                  role: "agent",
                  agent: "Content Creator",
                  content: "",
                });
              }
            } catch (err) {
              appendLog(`social_posts.json fetch failed: ${err}`);
              newMessages.push({
                role: "agent",
                agent: "Content Creator",
                content: "",
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
                newMessages.push({
                  role: "agent",
                  agent: "Social Analyst",
                  content: "",
                });
              }
            } catch (err) {
              appendLog(`analytics_summary.md fetch failed: ${err}`);
              newMessages.push({
                role: "agent",
                agent: "Social Analyst",
                content: "",
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
          // Not JSON, just a log message
        }
      };

      es.onerror = () => {
        if (!completedRef.current) {
          setError(
            "Connection error. The server might be waking up. Please try again."
          );
          checkServerStatus();
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

  const contentCreatorMsg = messages.find((m) => m.agent === "Content Creator");
  const socialAnalystMsg = messages.find((m) => m.agent === "Social Analyst");
  const posts = contentCreatorMsg?.parsedPosts;
  const platforms = posts
    ? Object.keys(posts).filter(
        (k) => Array.isArray(posts[k]) && posts[k]!.length > 0
      )
    : [];
  const effectivePlatform = platforms.includes(activePlatform)
    ? activePlatform
    : platforms[0] || "x";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#0f0f0f] text-[#E5E7EB] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#2a2a2a]/50 bg-[#0f0f0f]/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              SocialCrew AI
            </h1>
          </div>

          {/* Server Status */}
          <div className="flex items-center gap-2">
            {serverStatus === "checking" ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                Checking server...
              </div>
            ) : serverStatus === "online" ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Powered by CrewAI
              </div>
            ) : (
              <a
                href={BACKEND_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setTimeout(checkServerStatus, 5000)}
                className="flex items-center gap-2 text-xs bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/20 transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                Wake Server
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 py-8">
        <div className="max-w-6xl mx-auto px-6">
          {/* Input Section */}
          <div className="mb-8">
            <label className="block text-sm text-gray-400 mb-2 ml-1">
              What topic should we create content for?
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !running && runFlow()}
                  placeholder="e.g., AI productivity tools, sustainable fashion, crypto trends..."
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder-gray-500 rounded-xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                />
              </div>
              <button
                onClick={runFlow}
                disabled={running || serverStatus === "checking"}
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-medium hover:from-cyan-500 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40"
              >
                {running ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Generating...
                  </span>
                ) : (
                  "Generate"
                )}
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
              <svg
                className="w-5 h-5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {error}
            </div>
          )}

          {/* Results Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Content Creator Panel */}
            <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#2a2a2a] flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center text-white font-semibold text-sm">
                  CC
                </div>
                <div>
                  <h2 className="font-medium text-white">Content Creator</h2>
                  <p className="text-xs text-gray-500">Social media posts</p>
                </div>
              </div>

              <div className="p-5">
                {!contentCreatorMsg ? (
                  <EmptyState
                    icon="edit"
                    text="Generated posts will appear here"
                  />
                ) : posts && platforms.length > 0 ? (
                  <div>
                    {/* Platform Tabs */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {platforms.map((platform) => (
                        <button
                          key={platform}
                          onClick={() => setActivePlatform(platform)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            effectivePlatform === platform
                              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                              : "bg-[#2a2a2a]/50 text-gray-400 border border-transparent hover:bg-[#2a2a2a]"
                          }`}
                        >
                          <span>{PLATFORM_CONFIG[platform]?.icon || "📱"}</span>
                          {PLATFORM_CONFIG[platform]?.label ||
                            platform.charAt(0).toUpperCase() +
                              platform.slice(1)}
                        </button>
                      ))}
                    </div>

                    {/* Posts */}
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                      {(posts[effectivePlatform] || []).map((post, i) => (
                        <PostCard key={i} post={post} index={i} />
                      ))}
                    </div>
                  </div>
                ) : contentCreatorMsg.content ? (
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono bg-[#0f0f0f] rounded-xl p-4 max-h-[500px] overflow-auto">
                    {contentCreatorMsg.content}
                  </pre>
                ) : (
                  <EmptyState icon="edit" text="No content generated" />
                )}
              </div>
            </div>

            {/* Social Analyst Panel */}
            <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#2a2a2a] flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-cyan-500 flex items-center justify-center text-white font-semibold text-sm">
                  SA
                </div>
                <div>
                  <h2 className="font-medium text-white">Social Analyst</h2>
                  <p className="text-xs text-gray-500">Performance insights</p>
                </div>
              </div>

              <div className="p-5">
                {!socialAnalystMsg ? (
                  <EmptyState icon="chart" text="Analytics will appear here" />
                ) : socialAnalystMsg.content ? (
                  <div className="prose prose-invert prose-sm max-w-none max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    <MarkdownRenderer content={socialAnalystMsg.content} />
                  </div>
                ) : (
                  <EmptyState icon="chart" text="No analytics generated" />
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Logs Toggle */}
      <div className="fixed bottom-4 left-4 z-20">
        <button
          onClick={() => setShowLogs((s) => !s)}
          className="px-4 py-2 rounded-lg bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a] text-xs hover:bg-[#2a2a2a] transition-all flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
          {showLogs ? "Hide logs" : "Show logs"}
        </button>
      </div>

      {/* Logs Panel */}
      {showLogs && (
        <div className="fixed bottom-16 left-4 right-4 max-w-2xl max-h-64 overflow-auto rounded-xl bg-[#0a0a0a] border border-[#2a2a2a] p-4 text-xs font-mono z-20 shadow-2xl">
          <div className="flex items-center justify-between mb-2 text-gray-500">
            <span>System Logs</span>
            <button
              onClick={() => setLogs("")}
              className="hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>
          <pre className="text-cyan-400/80 whitespace-pre-wrap">
            {logs || "No logs yet..."}
          </pre>
        </div>
      )}
    </div>
  );
}

function PostCard({ post, index }: { post: Post; index: number }) {
  const [copied, setCopied] = useState(false);

  const hook =
    post.hook ||
    (post as Record<string, unknown>).title ||
    (post as Record<string, unknown>).headline ||
    "";
  const body =
    post.body ||
    (post as Record<string, unknown>).content ||
    (post as Record<string, unknown>).text ||
    (post as Record<string, unknown>).description ||
    "";
  const cta =
    post.cta || (post as Record<string, unknown>).call_to_action || "";

  let hashtags: string[] = [];
  const rawTags = post.hashtags || (post as Record<string, unknown>).tags;
  if (Array.isArray(rawTags)) {
    hashtags = rawTags;
  } else if (typeof rawTags === "string") {
    hashtags = rawTags.split(/\s+/).filter(Boolean);
  }

  const fullText = [
    hook,
    body,
    cta,
    hashtags.map((h: string) => (h.startsWith("#") ? h : `#${h}`)).join(" "),
  ]
    .filter(Boolean)
    .join("\n\n");

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!hook && !body && !cta) {
    return (
      <div className="bg-[#0f0f0f] rounded-xl p-4 border border-[#2a2a2a]/50">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs text-gray-500 bg-[#2a2a2a] px-2 py-1 rounded-md">
            Post {index + 1}
          </span>
        </div>
        <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
          {JSON.stringify(post, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="bg-[#0f0f0f] rounded-xl p-4 border border-[#2a2a2a]/50 hover:border-[#3a3a3a] transition-all group">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-gray-500 bg-[#2a2a2a] px-2 py-1 rounded-md">
          Post {index + 1}
        </span>
        <button
          onClick={copyToClipboard}
          className="text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
          title="Copy to clipboard"
        >
          {copied ? (
            <svg
              className="w-4 h-4 text-cyan-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          )}
        </button>
      </div>

      {hook && (
        <p className="text-white font-medium mb-2 leading-relaxed">
          {String(hook)}
        </p>
      )}
      {body && (
        <p className="text-gray-300 text-sm mb-3 leading-relaxed">
          {String(body)}
        </p>
      )}
      {cta && <p className="text-cyan-400 text-sm mb-3">{String(cta)}</p>}
      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {hashtags.map((tag: string, i: number) => (
            <span
              key={i}
              className="text-xs text-cyan-400/70 bg-cyan-400/10 px-2 py-1 rounded-md"
            >
              {String(tag).startsWith("#") ? tag : `#${tag}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-3">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;

        if (trimmed.startsWith("####")) {
          return (
            <h4 key={i} className="text-sm font-semibold text-gray-300 mt-4">
              {trimmed.replace(/^#+\s*/, "")}
            </h4>
          );
        }
        if (trimmed.startsWith("###")) {
          return (
            <h3 key={i} className="text-base font-semibold text-white mt-4">
              {trimmed.replace(/^#+\s*/, "")}
            </h3>
          );
        }
        if (trimmed.startsWith("##")) {
          return (
            <h2 key={i} className="text-lg font-semibold text-white mt-5">
              {trimmed.replace(/^#+\s*/, "")}
            </h2>
          );
        }
        if (trimmed.startsWith("#")) {
          return (
            <h1 key={i} className="text-xl font-bold text-white mt-5">
              {trimmed.replace(/^#+\s*/, "")}
            </h1>
          );
        }

        if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
          return (
            <p key={i} className="font-semibold text-white">
              {trimmed.slice(2, -2)}
            </p>
          );
        }

        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div
              key={i}
              className="flex items-start gap-2 text-gray-300 text-sm"
            >
              <span className="text-cyan-400 mt-1">•</span>
              <span>{trimmed.slice(2)}</span>
            </div>
          );
        }

        if (/^\d+\.\s/.test(trimmed)) {
          const num = trimmed.match(/^(\d+)\./)?.[1];
          return (
            <div
              key={i}
              className="flex items-start gap-2 text-gray-300 text-sm"
            >
              <span className="text-cyan-400 font-medium min-w-[1.5rem]">
                {num}.
              </span>
              <span>{trimmed.replace(/^\d+\.\s*/, "")}</span>
            </div>
          );
        }

        if (trimmed === "---" || trimmed === "***") {
          return <hr key={i} className="border-[#2a2a2a] my-4" />;
        }

        if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
          const cells = trimmed
            .split("|")
            .filter(Boolean)
            .map((c) => c.trim());
          if (cells.every((c) => /^[-:]+$/.test(c))) {
            return null;
          }
          return (
            <div
              key={i}
              className="flex gap-4 text-sm py-1 border-b border-[#2a2a2a]/50"
            >
              {cells.map((cell, ci) => (
                <span key={ci} className="flex-1 text-gray-300">
                  {cell}
                </span>
              ))}
            </div>
          );
        }

        return (
          <p key={i} className="text-gray-300 text-sm leading-relaxed">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: "edit" | "chart"; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
      {icon === "edit" ? (
        <svg
          className="w-12 h-12 mb-3 opacity-30"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      ) : (
        <svg
          className="w-12 h-12 mb-3 opacity-30"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      )}
      <span className="text-sm">{text}</span>
    </div>
  );
}
