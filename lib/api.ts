import type {
  BackendHealth,
  BackendMeta,
  FollowUpRequest,
  FollowUpResponse,
  GenerateRequest,
  GenerateResponse,
} from '@/types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

async function fetchWithTimeout(
  input: string,
  init?: RequestInit,
  timeoutMs = 12000,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getBackendHealth(): Promise<BackendHealth> {
  const response = await fetchWithTimeout(`${API_URL}/health`);
  return (await response.json()) as BackendHealth;
}

export async function getBackendMeta(): Promise<BackendMeta> {
  const response = await fetchWithTimeout(`${API_URL}/system/meta`);
  return (await response.json()) as BackendMeta;
}

export async function generateContent(
  input: GenerateRequest,
): Promise<GenerateResponse> {
  const response = await fetchWithTimeout(
    `${API_URL}/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    30000,
  );

  return (await response.json()) as GenerateResponse;
}

export async function sendFollowUp(
  input: FollowUpRequest,
): Promise<FollowUpResponse> {
  const response = await fetchWithTimeout(
    `${API_URL}/chat/followup`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    30000,
  );

  return (await response.json()) as FollowUpResponse;
}