"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateContent, getBackendHealth, sendFollowUp } from "@/lib/api";
import type {
  BackendHealth,
  ConversationMessage,
  FollowUpRequest,
  GenerateRequest,
  GenerateResponse,
  HistoryItem,
  SocialPlatform,
  TeamAgentId,
} from "@/types";

const platforms: { label: string; value: SocialPlatform; icon: string }[] = [
  { label: "LinkedIn", value: "LINKEDIN", icon: "💼" },
  { label: "YouTube", value: "YOUTUBE", icon: "🎬" },
  { label: "Facebook", value: "FACEBOOK", icon: "👥" },
  { label: "X", value: "X", icon: "⚡" },
  { label: "Instagram", value: "INSTAGRAM", icon: "📸" },
  { label: "Threads", value: "THREADS", icon: "🧵" },
];

function isTeamAgentId(
  agentId: ConversationMessage["agentId"],
): agentId is TeamAgentId {
  return (
    agentId === "strategy" || agentId === "creator" || agentId === "analyst"
  );
}

export default function HomePage() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<SocialPlatform>("LINKEDIN");
  const [loading, setLoading] = useState(false);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<GenerateResponse | null>(null);
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([
    {
      id: "system-welcome",
      agentId: "user",
      agentName: "SocialCrew Room",
      text: "Welcome — give the team one idea and they’ll turn it into a polished campaign conversation.",
      timestamp: new Date().toISOString(),
    },
  ]);

  const [followUpMessage, setFollowUpMessage] = useState("");
  const [targetAgents, setTargetAgents] = useState<TeamAgentId[]>([
    "strategy",
    "creator",
    "analyst",
  ]);

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voicesReady, setVoicesReady] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const utterancesRef = useRef<SpeechSynthesisUtterance[]>([]);
  const continueSpeakingRef = useRef(false);

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

  useEffect(() => {
    const synth = window.speechSynthesis;

    const loadVoices = () => {
      const voices = synth.getVoices();
      if (voices.length > 0) {
        setVoicesReady(true);
      }
    };

    loadVoices();
    synth.onvoiceschanged = loadVoices;

    return () => {
      synth.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const statusLabel = useMemo(() => {
    return backendOnline ? "Backend online" : "Backend sleeping";
  }, [backendOnline]);

  const saveHistory = (item: HistoryItem) => {
    const updated = [item, ...history].slice(0, 12);
    setHistory(updated);
    window.localStorage.setItem("socialcrew-history", JSON.stringify(updated));
  };

  const stopSpeaking = useCallback(() => {
    continueSpeakingRef.current = false;
    utterancesRef.current = [];
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const getPreferredVoice = useCallback(
    (agentId: TeamAgentId): SpeechSynthesisVoice | null => {
      const voices = window.speechSynthesis.getVoices();

      const gbVoices = voices.filter((voice) =>
        voice.lang.toLowerCase().startsWith("en-gb"),
      );
      const englishVoices = voices.filter((voice) =>
        voice.lang.toLowerCase().startsWith("en"),
      );
      const pool =
        gbVoices.length > 0
          ? gbVoices
          : englishVoices.length > 0
            ? englishVoices
            : voices;

      if (pool.length === 0) return null;

      const byName = (keywords: string[]) =>
        pool.find((voice) =>
          keywords.some((keyword) =>
            voice.name.toLowerCase().includes(keyword.toLowerCase()),
          ),
        );

      if (agentId === "strategy") {
        return (
          byName(["libby", "susan", "serena", "hazel", "samantha", "kate"]) ||
          pool[0] ||
          null
        );
      }

      if (agentId === "creator") {
        return (
          byName(["sonia", "alice", "fiona", "moira", "victoria", "lily"]) ||
          pool[1] ||
          pool[0] ||
          null
        );
      }

      return (
        byName(["tessa", "rachel", "zira", "karen", "serena", "grace"]) ||
        pool[2] ||
        pool[0] ||
        null
      );
    },
    [],
  );

  const getVoiceStyle = useCallback((agentId: TeamAgentId) => {
    if (agentId === "strategy") {
      return { rate: 0.94, pitch: 1.04 };
    }

    if (agentId === "creator") {
      return { rate: 0.98, pitch: 1.1 };
    }

    return { rate: 0.93, pitch: 1.0 };
  }, []);

  const speakConversation = useCallback(
    (items: ConversationMessage[]) => {
      if (!voiceEnabled || !voicesReady) return;

      stopSpeaking();
      continueSpeakingRef.current = true;

      const speakNext = () => {
        if (!continueSpeakingRef.current) {
          setIsSpeaking(false);
          return;
        }

        const next = utterancesRef.current.shift();

        if (!next) {
          setIsSpeaking(false);
          return;
        }

        setIsSpeaking(true);

        next.onend = () => speakNext();
        next.onerror = () => speakNext();

        window.speechSynthesis.speak(next);
      };

      utterancesRef.current = items
        .filter(
          (
            message,
          ): message is ConversationMessage & { agentId: TeamAgentId } =>
            isTeamAgentId(message.agentId),
        )
        .map((message) => {
          const utterance = new SpeechSynthesisUtterance(
            `${message.agentName}. ${message.text}`,
          );

          const voice = getPreferredVoice(message.agentId);
          const style = getVoiceStyle(message.agentId);

          utterance.lang = voice?.lang || "en-GB";
          if (voice) {
            utterance.voice = voice;
          }
          utterance.rate = style.rate;
          utterance.pitch = style.pitch;
          utterance.volume = 1;

          return utterance;
        });

      speakNext();
    },
    [getPreferredVoice, getVoiceStyle, stopSpeaking, voiceEnabled, voicesReady],
  );

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("Please enter a topic.");
      return;
    }

    setLoading(true);
    setError("");
    stopSpeaking();

    const userMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      agentId: "user",
      agentName: "You",
      text: topic.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages([userMessage]);

    try {
      const payload: GenerateRequest = {
        topic: topic.trim(),
        platform,
        brandName: "Personal Brand",
        audience: "Founders, creators, small business operators",
        tone: "Warm, polished, stylish",
        ctaStyle: "Soft CTA",
      };

      const result = await generateContent(payload);
      setData(result);
      setBackendOnline(true);

      const nextMessages = [userMessage, ...result.conversation];
      setMessages(nextMessages);

      saveHistory({
        id: crypto.randomUUID(),
        topic: payload.topic,
        platform: payload.platform,
        createdAt: new Date().toISOString(),
      });

      if (voiceEnabled) {
        speakConversation(nextMessages);
      }
    } catch (err) {
      console.error(err);
      setBackendOnline(false);
      setError("Could not connect to backend. Make sure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUp = async () => {
    if (!data) return;

    if (!followUpMessage.trim()) {
      setError("Please type a follow-up message.");
      return;
    }

    if (targetAgents.length === 0) {
      setError("Select at least one agent.");
      return;
    }

    setFollowUpLoading(true);
    setError("");
    stopSpeaking();

    const userMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      agentId: "user",
      agentName: "You",
      text: followUpMessage.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      const payload: FollowUpRequest = {
        topic: topic.trim(),
        platform,
        team: data.team,
        userMessage: followUpMessage.trim(),
        targetAgents,
        strategySummary: data.strategy.fullResponse,
        creatorSummary: data.creator.overview,
        analystSummary: data.analyst.fullResponse,
        postTitles: data.creator.posts.map((post) => post.title),
        bestPost: data.analyst.bestPost,
      };

      const result = await sendFollowUp(payload);
      setMessages((prev) => [...prev, ...result.messages]);
      setFollowUpMessage("");

      if (voiceEnabled) {
        speakConversation(result.messages);
      }
    } catch (err) {
      console.error(err);
      setError("Could not send follow-up right now.");
    } finally {
      setFollowUpLoading(false);
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

  const toggleVoice = () => {
    if (voiceEnabled) {
      stopSpeaking();
      setVoiceEnabled(false);
      return;
    }

    setVoiceEnabled(true);
  };

  const toggleTargetAgent = (agent: TeamAgentId) => {
    setTargetAgents((prev) =>
      prev.includes(agent)
        ? prev.filter((item) => item !== agent)
        : [...prev, agent],
    );
  };

  const replayAgents = () => {
    speakConversation(messages);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.10),transparent_28%),#020617] text-white">
      <div className="flex min-h-screen flex-col xl:flex-row">
        <aside className="hidden w-[290px] shrink-0 border-r border-white/10 bg-black/30 xl:flex xl:flex-col">
          <div className="border-b border-white/10 p-5">
            <div>
              <h1 className="text-xl font-bold text-cyan-400">SocialCrew AI</h1>
              <p className="mt-1 text-xs text-white/45">
                Human-first AI content studio
              </p>
            </div>

            <button
              onClick={() => {
                stopSpeaking();
                setTopic("");
                setData(null);
                setError("");
                setMessages([
                  {
                    id: "system-reset",
                    agentId: "user",
                    agentName: "SocialCrew Room",
                    text: "Fresh room opened. Give the team a new idea whenever you’re ready.",
                    timestamp: new Date().toISOString(),
                  },
                ]);
              }}
              className="mt-4 w-full rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-left text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/15"
            >
              + New campaign room
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.18em] text-cyan-300/70">
              Campaign Library
            </p>

            <div className="space-y-2">
              {history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-white/30">
                  No campaign history yet
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

        <section className="flex-1 px-4 py-5 sm:px-5 md:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-cyan-400 sm:text-3xl">
                  SocialCrew AI Studio
                </h2>
                <p className="mt-2 text-sm text-white/50">
                  A polished team conversation that plans, writes, and reviews
                  your campaign
                </p>
              </div>

              <Link
                href="/backend"
                className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
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

            <div className="mb-5 xl:hidden">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/70">
                  Recent campaigns
                </p>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2">
                {history.length === 0 ? (
                  <div className="min-w-[220px] rounded-2xl border border-dashed border-white/10 p-4 text-sm text-white/30">
                    No campaign history yet
                  </div>
                ) : (
                  history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleHistoryClick(item)}
                      className="min-w-[220px] rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left"
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

            <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_0_40px_rgba(34,211,238,0.05)] sm:p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
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
                    {item.icon} {item.label}
                  </button>
                ))}

                <button
                  onClick={toggleVoice}
                  className={`ml-auto rounded-full px-4 py-2 text-sm font-medium transition ${
                    voiceEnabled
                      ? "border border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                      : "border border-white/10 bg-black/30 text-white/70 hover:border-cyan-400/20 hover:text-cyan-200"
                  }`}
                >
                  {voiceEnabled ? "Voice On" : "Voice Off"}
                </button>

                <button
                  onClick={replayAgents}
                  disabled={!voiceEnabled || !voicesReady}
                  className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-white/70 transition hover:border-cyan-400/20 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Replay
                </button>

                <button
                  onClick={stopSpeaking}
                  disabled={!isSpeaking}
                  className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-white/70 transition hover:border-cyan-400/20 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Stop
                </button>
              </div>

              <div className="mb-3 text-xs text-white/45">
                Voice is on by default and prefers British English where
                available. Device/browser voice availability can vary.
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Give the team one idea… e.g. Announce an AI consulting offer for startup founders"
                  className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none placeholder:text-white/25 focus:border-cyan-400"
                />
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="rounded-2xl bg-cyan-400 px-6 py-4 font-semibold text-black shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Building conversation…" : "Start Conversation"}
                </button>
              </div>

              {error && <p className="mt-3 text-sm text-orange-300">{error}</p>}
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-cyan-300">
                    Team Chat
                  </h3>
                  <p className="text-sm text-white/45">
                    Feels like a real group conversation between you and the
                    team
                  </p>
                </div>

                <div className="space-y-4">
                  {messages.map((message) => (
                    <ChatBubble
                      key={message.id}
                      message={message}
                      alignRight={message.agentId !== "user"}
                    />
                  ))}

                  {loading && (
                    <TypingBubble text="The team is thinking this through…" />
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {data && (
                  <div className="mt-6 rounded-3xl border border-white/10 bg-black/25 p-4">
                    <p className="mb-3 text-xs uppercase tracking-[0.18em] text-cyan-300/80">
                      Ask specific teammates to follow up
                    </p>

                    <div className="mb-3 flex flex-wrap gap-2">
                      {(
                        [
                          { id: "strategy", label: data.team.strategyName },
                          { id: "creator", label: data.team.creatorName },
                          { id: "analyst", label: data.team.analystName },
                        ] as const
                      ).map((agent) => (
                        <button
                          key={agent.id}
                          onClick={() => toggleTargetAgent(agent.id)}
                          className={`rounded-full px-3 py-1.5 text-sm transition ${
                            targetAgents.includes(agent.id)
                              ? "border border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
                              : "border border-white/10 bg-black/35 text-white/60"
                          }`}
                        >
                          {agent.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-col gap-3 md:flex-row">
                      <input
                        type="text"
                        value={followUpMessage}
                        onChange={(e) => setFollowUpMessage(e.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void handleFollowUp();
                          }
                        }}
                        placeholder="Ask the team a follow-up question…"
                        className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none placeholder:text-white/25 focus:border-cyan-400"
                      />
                      <button
                        onClick={handleFollowUp}
                        disabled={followUpLoading}
                        className="rounded-2xl bg-white px-5 py-3 font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {followUpLoading ? "Sending…" : "Send"}
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-6">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <h3 className="mb-4 text-xl font-semibold text-cyan-300">
                    Suggestions
                  </h3>

                  {!data ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-5 text-white/30">
                      Once the team finishes, the suggestions will appear here.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">
                          Shared hashtags
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {data.creator.commonHashtags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {data.creator.posts.map((post) => (
                        <PostPreviewCard
                          key={post.id}
                          platform={platform}
                          post={post}
                          isBest={post.id === data.analyst.bestPost}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {data && (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                    <h3 className="mb-4 text-xl font-semibold text-cyan-300">
                      Analyst Snapshot
                    </h3>

                    <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-emerald-300/80">
                        Best post
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        Option {data.analyst.bestPost}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {data.analyst.comparison.map((item, index) => (
                        <div
                          key={`${index}-${item}`}
                          className="rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white/80"
                        >
                          {item}
                        </div>
                      ))}
                    </div>
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

function ChatBubble({
  message,
  alignRight,
}: {
  message: ConversationMessage;
  alignRight: boolean;
}) {
  const tone = getTone(message.agentId);

  return (
    <div className={`flex ${alignRight ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[92%] sm:max-w-[82%] rounded-3xl border px-4 py-3 shadow-sm ${
          tone.container
        }`}
      >
        <div className="mb-2 flex items-center gap-2">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${tone.avatar}`}
          >
            {getAgentBadge(message.agentId)}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              {message.agentName}
            </p>
            <p className="text-[11px] text-white/45">
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        <p className="whitespace-pre-line text-sm leading-7 text-white/85">
          {message.text}
        </p>
      </div>
    </div>
  );
}

function TypingBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] rounded-3xl border border-white/10 bg-black/25 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.2s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.1s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300" />
          </div>
          <p className="text-sm text-white/60">{text}</p>
        </div>
      </div>
    </div>
  );
}

function PostPreviewCard({
  platform,
  post,
  isBest,
}: {
  platform: SocialPlatform;
  post: { id: number; title: string; description: string };
  isBest: boolean;
}) {
  const theme = getPlatformTheme(platform);

  return (
    <div
      className={`overflow-hidden rounded-3xl border ${
        isBest ? "border-emerald-400/30" : "border-white/10"
      } bg-white/[0.03]`}
    >
      <div className={`px-4 py-3 ${theme.header}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{theme.icon}</span>
            <span className="text-sm font-semibold text-white">
              {theme.label} Preview
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isBest && (
              <span className="rounded-full bg-emerald-400/20 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-200">
                Best pick
              </span>
            )}
            <span className="rounded-full bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/80">
              Option {post.id}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4">
        <h4 className="mb-2 text-lg font-semibold text-white">{post.title}</h4>
        <p className="whitespace-pre-line text-sm leading-7 text-white/80">
          {post.description}
        </p>
      </div>
    </div>
  );
}

function getTone(agentId: ConversationMessage["agentId"]) {
  if (agentId === "strategy") {
    return {
      container: "border-cyan-400/20 bg-cyan-400/5",
      avatar: "bg-cyan-400/15 text-cyan-200",
    };
  }

  if (agentId === "creator") {
    return {
      container: "border-fuchsia-400/20 bg-fuchsia-400/5",
      avatar: "bg-fuchsia-400/15 text-fuchsia-200",
    };
  }

  if (agentId === "analyst") {
    return {
      container: "border-emerald-400/20 bg-emerald-400/5",
      avatar: "bg-emerald-400/15 text-emerald-200",
    };
  }

  return {
    container: "border-white/10 bg-white/[0.04]",
    avatar: "bg-white/10 text-white",
  };
}

function getAgentBadge(agentId: ConversationMessage["agentId"]) {
  if (agentId === "strategy") return "ST";
  if (agentId === "creator") return "CR";
  if (agentId === "analyst") return "AN";
  return "YU";
}

function getPlatformTheme(platform: SocialPlatform) {
  switch (platform) {
    case "INSTAGRAM":
      return {
        label: "Instagram",
        icon: "📸",
        header:
          "bg-gradient-to-r from-fuchsia-500/80 via-pink-500/80 to-orange-400/80",
      };
    case "LINKEDIN":
      return {
        label: "LinkedIn",
        icon: "💼",
        header: "bg-gradient-to-r from-sky-600/80 to-cyan-500/80",
      };
    case "YOUTUBE":
      return {
        label: "YouTube",
        icon: "🎬",
        header: "bg-gradient-to-r from-red-600/80 to-rose-500/80",
      };
    case "FACEBOOK":
      return {
        label: "Facebook",
        icon: "👥",
        header: "bg-gradient-to-r from-blue-600/80 to-indigo-500/80",
      };
    case "X":
      return {
        label: "X",
        icon: "⚡",
        header: "bg-gradient-to-r from-slate-700/80 to-slate-500/80",
      };
    case "THREADS":
      return {
        label: "Threads",
        icon: "🧵",
        header: "bg-gradient-to-r from-purple-600/80 to-fuchsia-500/80",
      };
    default:
      return {
        label: "Suggestions",
        icon: "✨",
        header: "bg-gradient-to-r from-cyan-600/80 to-blue-500/80",
      };
  }
}
