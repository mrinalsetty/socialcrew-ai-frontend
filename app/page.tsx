'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { generateContent, getBackendHealth } from '@/lib/api';
import type {
  BackendHealth,
  GenerateRequest,
  GenerateResponse,
  HistoryItem,
  SocialPlatform,
} from '@/types';

type AgentName = 'Strategy Agent' | 'Creator Agent' | 'Analyst Agent' | 'System';

type AgentChatMessage = {
  id: string;
  agent: AgentName;
  text: string;
  tone: 'system' | 'strategy' | 'creator' | 'analyst';
};

const platforms: { label: string; value: SocialPlatform }[] = [
  { label: 'LinkedIn', value: 'LINKEDIN' },
  { label: 'YouTube', value: 'YOUTUBE' },
  { label: 'Facebook', value: 'FACEBOOK' },
  { label: 'X', value: 'X' },
  { label: 'Instagram', value: 'INSTAGRAM' },
  { label: 'Threads', value: 'THREADS' },
];

export default function HomePage() {
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState<SocialPlatform>('LINKEDIN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<GenerateResponse | null>(null);
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voicesReady, setVoicesReady] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [agentMessages, setAgentMessages] = useState<AgentChatMessage[]>([
    {
      id: 'welcome-1',
      agent: 'System',
      tone: 'system',
      text:
        'Welcome to SocialCrew AI Team Room. Pick a platform, enter a topic, and the agents will collaborate in this conversation.',
    },
  ]);

  const speechQueueRef = useRef<SpeechSynthesisUtterance[]>([]);
  const shouldContinueSpeakingRef = useRef<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem('socialcrew-history');
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentMessages]);

  const statusLabel = useMemo(() => {
    if (backendOnline) return 'Backend online';
    return 'Backend sleeping';
  }, [backendOnline]);

  const saveHistory = (item: HistoryItem) => {
    const updated = [item, ...history].slice(0, 12);
    setHistory(updated);
    window.localStorage.setItem('socialcrew-history', JSON.stringify(updated));
  };

  const stopSpeaking = useCallback(() => {
    shouldContinueSpeakingRef.current = false;
    speechQueueRef.current = [];
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const getVoiceForAgent = useCallback((agent: AgentName): SpeechSynthesisVoice | null => {
    const allVoices = window.speechSynthesis.getVoices();
    const englishVoices = allVoices.filter((voice) =>
      voice.lang.toLowerCase().startsWith('en'),
    );

    const usableVoices = englishVoices.length > 0 ? englishVoices : allVoices;

    if (usableVoices.length === 0) {
      return null;
    }

    const findByKeywords = (keywords: string[]) =>
      usableVoices.find((voice) =>
        keywords.some((keyword) =>
          voice.name.toLowerCase().includes(keyword.toLowerCase()),
        ),
      );

    if (agent === 'Strategy Agent') {
      return (
        findByKeywords(['samantha', 'zira', 'victoria', 'serena']) ||
        usableVoices[0] ||
        null
      );
    }

    if (agent === 'Creator Agent') {
      return (
        findByKeywords(['daniel', 'alex', 'google us english', 'fred']) ||
        usableVoices[1] ||
        usableVoices[0] ||
        null
      );
    }

    if (agent === 'Analyst Agent') {
      return (
        findByKeywords(['karen', 'moira', 'tessa', 'veena']) ||
        usableVoices[2] ||
        usableVoices[0] ||
        null
      );
    }

    return usableVoices[0] || null;
  }, []);

  const getVoiceStyle = useCallback((agent: AgentName) => {
    if (agent === 'Strategy Agent') {
      return { rate: 0.95, pitch: 0.95 };
    }

    if (agent === 'Creator Agent') {
      return { rate: 1.02, pitch: 1.08 };
    }

    if (agent === 'Analyst Agent') {
      return { rate: 0.96, pitch: 0.9 };
    }

    return { rate: 1, pitch: 1 };
  }, []);

  const speakMessages = useCallback(
    (messages: AgentChatMessage[]) => {
      if (!voiceEnabled) return;
      if (!voicesReady) return;
      if (messages.length === 0) return;

      stopSpeaking();
      shouldContinueSpeakingRef.current = true;

      const speakNext = () => {
        if (!shouldContinueSpeakingRef.current) {
          setIsSpeaking(false);
          return;
        }

        const nextUtterance = speechQueueRef.current.shift();

        if (!nextUtterance) {
          setIsSpeaking(false);
          return;
        }

        setIsSpeaking(true);

        nextUtterance.onend = () => {
          speakNext();
        };

        nextUtterance.onerror = () => {
          speakNext();
        };

        window.speechSynthesis.speak(nextUtterance);
      };

      speechQueueRef.current = messages
        .filter((message) => message.agent !== 'System')
        .map((message) => {
          const utterance = new SpeechSynthesisUtterance(
            `${message.agent}. ${message.text}`,
          );

          const selectedVoice = getVoiceForAgent(message.agent);
          const style = getVoiceStyle(message.agent);

          if (selectedVoice) {
            utterance.voice = selectedVoice;
            utterance.lang = selectedVoice.lang;
          } else {
            utterance.lang = 'en-US';
          }

          utterance.rate = style.rate;
          utterance.pitch = style.pitch;
          utterance.volume = 1;

          return utterance;
        });

      speakNext();
    },
    [getVoiceForAgent, getVoiceStyle, stopSpeaking, voiceEnabled, voicesReady],
  );

  const convertResponseToMessages = useCallback(
    (result: GenerateResponse): AgentChatMessage[] => {
      const creatorPostsText =
        result.contentCreator.length === 0
          ? 'I could not produce any draft options.'
          : result.contentCreator
              .map(
                (post) =>
                  `Option ${post.id}: ${post.title}\n${post.content}\nHashtags: ${post.hashtags.join(' ')}`,
              )
              .join('\n\n');

      return [
        {
          id: crypto.randomUUID(),
          agent: 'Strategy Agent',
          tone: 'strategy',
          text:
            `Here is the strongest strategy for this ${platform} campaign.\n\n` +
            `Angle: ${result.strategy.angle}\n` +
            `Audience Fit: ${result.strategy.audienceFit}\n` +
            `Hook Style: ${result.strategy.hookStyle}\n` +
            `CTA Approach: ${result.strategy.ctaApproach}\n\n` +
            `Brief: ${result.strategy.brief}`,
        },
        {
          id: crypto.randomUUID(),
          agent: 'Creator Agent',
          tone: 'creator',
          text:
            `I created multiple platform-aware draft options.\n\n` +
            `${result.contentSummary}\n\n` +
            creatorPostsText,
        },
        {
          id: crypto.randomUUID(),
          agent: 'Analyst Agent',
          tone: 'analyst',
          text:
            `I reviewed all options and Option ${result.socialAnalyst.bestPost} is strongest.\n\n` +
            `Why it wins: ${result.socialAnalyst.reason}\n\n` +
            `Positioning: ${result.socialAnalyst.positioning}\n\n` +
            `Suggestions:\n- ${result.socialAnalyst.suggestions.join('\n- ')}`,
        },
      ];
    },
    [platform],
  );

  const replayConversation = () => {
    speakMessages(agentMessages);
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic.');
      return;
    }

    setLoading(true);
    setError('');

    const systemMessage: AgentChatMessage = {
      id: crypto.randomUUID(),
      agent: 'System',
      tone: 'system',
      text: `Starting a ${platform} team discussion for: "${topic.trim()}"`,
    };

    setAgentMessages([systemMessage]);

    try {
      const payload: GenerateRequest = {
        topic: topic.trim(),
        platform,
        brandName: 'Personal Brand',
        audience: 'Founders, creators, small business operators',
        tone: 'Smart, practical, human',
        ctaStyle: 'Soft CTA',
      };

      const result = await generateContent(payload);
      setData(result);
      setBackendOnline(true);

      const conversationMessages = [
        systemMessage,
        ...convertResponseToMessages(result),
      ];

      setAgentMessages(conversationMessages);

      saveHistory({
        id: crypto.randomUUID(),
        topic: payload.topic,
        platform: payload.platform,
        createdAt: new Date().toISOString(),
      });

      if (voiceEnabled) {
        speakMessages(conversationMessages);
      }
    } catch (err) {
      console.error(err);
      stopSpeaking();
      setBackendOnline(false);
      setError('Could not connect to backend. Make sure backend is running.');

      setAgentMessages([
        systemMessage,
        {
          id: crypto.randomUUID(),
          agent: 'System',
          tone: 'system',
          text:
            'The team could not complete this run because the backend is unavailable right now.',
        },
      ]);
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
    if (event.key === 'Enter' && !event.shiftKey) {
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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.10),transparent_28%),#020617] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-[290px] shrink-0 border-r border-white/10 bg-black/30 xl:flex xl:flex-col">
          <div className="border-b border-white/10 p-5">
            <div>
              <h1 className="text-xl font-bold text-cyan-400">SocialCrew AI</h1>
              <p className="mt-1 text-xs text-white/45">
                Team room for AI social campaigns
              </p>
            </div>

            <button
              onClick={() => {
                stopSpeaking();
                setTopic('');
                setData(null);
                setError('');
                setAgentMessages([
                  {
                    id: 'welcome-reset',
                    agent: 'System',
                    tone: 'system',
                    text:
                      'New room started. Give the team an idea and they’ll collaborate here.',
                  },
                ]);
              }}
              className="mt-4 w-full rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-left text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/15"
            >
              + New room
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.18em] text-cyan-300/70">
              Campaign History
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

        <section className="flex-1 px-5 py-6 md:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-cyan-400">
                  SocialCrew AI Team Room
                </h2>
                <p className="mt-2 text-sm text-white/50">
                  Watch your AI team plan, write, and review content together
                </p>
              </div>

              <Link
                href="/backend"
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  backendOnline
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-orange-500/40 bg-orange-500/10 text-orange-300'
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    backendOnline
                      ? 'bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.85)]'
                      : 'bg-orange-400 shadow-[0_0_14px_rgba(251,146,60,0.85)]'
                  }`}
                />
                {statusLabel}
              </Link>
            </div>

            <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_0_40px_rgba(34,211,238,0.05)]">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {platforms.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setPlatform(item.value)}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      platform === item.value
                        ? 'border border-cyan-400/30 bg-cyan-400/10 text-cyan-300'
                        : 'border border-white/10 bg-black/30 text-white/60 hover:border-cyan-400/20 hover:text-cyan-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}

                <button
                  onClick={toggleVoice}
                  className={`ml-auto rounded-full px-4 py-2 text-sm font-medium transition ${
                    voiceEnabled
                      ? 'border border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                      : 'border border-white/10 bg-black/30 text-white/70 hover:border-cyan-400/20 hover:text-cyan-200'
                  }`}
                >
                  {voiceEnabled ? 'Voice On' : 'Voice Off'}
                </button>

                <button
                  onClick={replayConversation}
                  disabled={!voiceEnabled || agentMessages.length <= 1 || !voicesReady}
                  className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-white/70 transition hover:border-cyan-400/20 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Replay Conversation
                </button>

                <button
                  onClick={stopSpeaking}
                  disabled={!isSpeaking}
                  className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-white/70 transition hover:border-cyan-400/20 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Stop Voice
                </button>
              </div>

              <div className="mb-3 flex items-center gap-3 text-xs text-white/45">
                <span>
                  Voice engine: {voicesReady ? 'Ready' : 'Loading voices…'}
                </span>
                <span>•</span>
                <span>
                  {voiceEnabled
                    ? 'Agents will speak after each run'
                    : 'Voice is currently muted'}
                </span>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Give the team an idea… e.g. Announce an AI consulting offer for startup founders"
                  className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-5 py-4 outline-none placeholder:text-white/25 focus:border-cyan-400"
                />
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="rounded-2xl bg-cyan-400 px-6 py-4 font-semibold text-black shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Team is collaborating…' : 'Start Team Chat'}
                </button>
              </div>

              {error && <p className="mt-3 text-sm text-orange-300">{error}</p>}
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-cyan-300">
                    Live Team Conversation
                  </h3>
                  <p className="text-sm text-white/45">
                    Strategy, Creator, and Analyst speak here like a working team
                  </p>
                </div>

                {health && (
                  <span className="text-xs text-white/40">
                    {health.creatorModel} + {health.analystModel}
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {agentMessages.map((message) => (
                  <ChatBubble key={message.id} message={message} />
                ))}

                {loading && (
                  <>
                    <TypingBubble
                      agent="Strategy Agent"
                      tone="strategy"
                      text="Thinking through the best angle..."
                    />
                    <TypingBubble
                      agent="Creator Agent"
                      tone="creator"
                      text="Drafting variants..."
                    />
                    <TypingBubble
                      agent="Analyst Agent"
                      tone="analyst"
                      text="Preparing a recommendation..."
                    />
                  </>
                )}

                <div ref={messagesEndRef} />
              </div>
            </section>

            {data && (
              <section className="mt-6 grid gap-6 lg:grid-cols-3">
                <MiniPanel
                  title="Best Post"
                  value={`Option ${data.socialAnalyst.bestPost}`}
                  subtitle="Chosen by Analyst Agent"
                />
                <MiniPanel
                  title="Hook Style"
                  value={data.strategy.hookStyle}
                  subtitle="Planned by Strategy Agent"
                />
                <MiniPanel
                  title="Creator Summary"
                  value={data.contentSummary}
                  subtitle="Generated by Creator Agent"
                />
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function ChatBubble({ message }: { message: AgentChatMessage }) {
  const styleMap: Record<
    AgentChatMessage['tone'],
    {
      border: string;
      bg: string;
      badge: string;
      text: string;
      label: string;
    }
  > = {
    system: {
      border: 'border-white/10',
      bg: 'bg-white/[0.03]',
      badge: 'bg-white/10 text-white/70 border-white/10',
      text: 'text-white/75',
      label: 'System',
    },
    strategy: {
      border: 'border-cyan-400/20',
      bg: 'bg-cyan-400/5',
      badge: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/20',
      text: 'text-white/85',
      label: 'Strategy',
    },
    creator: {
      border: 'border-fuchsia-400/20',
      bg: 'bg-fuchsia-400/5',
      badge: 'bg-fuchsia-400/10 text-fuchsia-300 border-fuchsia-400/20',
      text: 'text-white/85',
      label: 'Creator',
    },
    analyst: {
      border: 'border-emerald-400/20',
      bg: 'bg-emerald-400/5',
      badge: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
      text: 'text-white/85',
      label: 'Analyst',
    },
  };

  const style = styleMap[message.tone];

  return (
    <div className={`rounded-3xl border ${style.border} ${style.bg} p-4`}>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/30 text-sm font-semibold text-white/80">
          {getAgentAvatar(message.agent)}
        </div>
        <div className="flex items-center gap-2">
          <p className="font-semibold text-white">{message.agent}</p>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${style.badge}`}
          >
            {style.label}
          </span>
        </div>
      </div>

      <p className={`whitespace-pre-line text-sm leading-7 ${style.text}`}>
        {message.text}
      </p>
    </div>
  );
}

function TypingBubble({
  agent,
  tone,
  text,
}: {
  agent: AgentName;
  tone: AgentChatMessage['tone'];
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 p-4 opacity-80">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/30 text-sm font-semibold text-white/80">
          {getAgentAvatar(agent)}
        </div>
        <p className="font-semibold text-white">{agent}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.2s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.1s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300" />
        </div>
        <p className="text-sm text-white/60">{text}</p>
      </div>
    </div>
  );
}

function MiniPanel({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">
        {title}
      </p>
      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-white/45">{subtitle}</p>
    </div>
  );
}

function getAgentAvatar(agent: AgentName): string {
  if (agent === 'Strategy Agent') return 'SA';
  if (agent === 'Creator Agent') return 'CA';
  if (agent === 'Analyst Agent') return 'AA';
  return 'SC';
}