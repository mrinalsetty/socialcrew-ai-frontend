export type SocialPlatform =
  | 'LINKEDIN'
  | 'YOUTUBE'
  | 'FACEBOOK'
  | 'X'
  | 'INSTAGRAM'
  | 'THREADS';

export type TeamAgentId = 'strategy' | 'creator' | 'analyst';

export type TeamInfo = {
  strategyName: string;
  creatorName: string;
  analystName: string;
};

export type GenerateRequest = {
  topic: string;
  platform: SocialPlatform;
  brandName?: string;
  audience?: string;
  tone?: string;
  ctaStyle?: string;
};

export type ConversationMessage = {
  id: string;
  agentId: TeamAgentId | 'user';
  agentName: string;
  text: string;
  timestamp: string;
};

export type GeneratedPost = {
  id: number;
  title: string;
  description: string;
};

export type GenerateResponse = {
  platform: SocialPlatform;
  team: TeamInfo;
  conversation: ConversationMessage[];
  strategy: {
    agentName: string;
    intro: string;
    fullResponse: string;
    recommendedAngles: string[];
    audienceSegments: string[];
  };
  creator: {
    agentName: string;
    intro: string;
    overview: string;
    posts: GeneratedPost[];
    commonHashtags: string[];
  };
  analyst: {
    agentName: string;
    intro: string;
    fullResponse: string;
    bestPost: number;
    comparison: string[];
    audienceFitNotes: string[];
  };
};

export type FollowUpRequest = {
  topic: string;
  platform: SocialPlatform;
  team: TeamInfo;
  userMessage: string;
  targetAgents: TeamAgentId[];
  strategySummary: string;
  creatorSummary: string;
  analystSummary: string;
  postTitles: string[];
  bestPost: number;
};

export type FollowUpResponse = {
  messages: ConversationMessage[];
};

export type BackendHealth = {
  status: string;
  service: string;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
  llmProvider: string;
  graphRuntime: string;
  creatorModel: string;
  analystModel: string;
};

export type BackendMeta = {
  name: string;
  version: string;
  statusPage: string;
  architecture: string[];
  stack: {
    runtime: string[];
    ai: string[];
    models: string[];
    deployment: string[];
  };
  endpoints: { method: string; path: string }[];
  notes: string[];
};

export type HistoryItem = {
  id: string;
  topic: string;
  platform: SocialPlatform;
  createdAt: string;
};