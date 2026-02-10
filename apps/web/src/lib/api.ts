import { ApiFetcherArgs, initClient } from '@ts-rest/core';

import { contract } from '@grabdy/contracts';

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const DEFAULT_TIMEOUT_MS = 30000;

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { error?: string; message?: string; success?: boolean }
  ) {
    super(body.error || body.message || `Request failed with status ${status}`);
    this.name = 'ApiError';
  }
}

const customFetcher = async (args: ApiFetcherArgs) => {
  const { path, method, headers, body } = args;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(path, {
      method,
      headers,
      credentials: 'include',
      body,
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ApiError(response.status, data || {});
    }

    return {
      status: response.status,
      body: data,
      headers: response.headers,
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

export const api = initClient(contract, {
  baseUrl,
  baseHeaders: {},
  credentials: 'include',
  api: customFetcher,
});

export { baseUrl };
