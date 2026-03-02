import type { GenerateRequest } from "@/types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

async function fetchWithTimeout(
  input: string,
  init?: RequestInit,
  timeoutMs = 6000,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getBackendHealth() {
  const response = await fetchWithTimeout(`${API_URL}/health`);
  return response.json();
}

export async function getBackendMeta() {
  const response = await fetchWithTimeout(`${API_URL}/system/meta`);
  return response.json();
}

export async function generateContent(input: GenerateRequest) {
  const response = await fetchWithTimeout(
    `${API_URL}/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    20000,
  );

  return response.json();
}
