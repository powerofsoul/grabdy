import { Logger } from '@nestjs/common';

import type { SlackMessage } from '../types';

const slackLogger = new Logger('SlackThrottle');

export const SLACK_API_URL = 'https://slack.com/api';

/** Max retries when Slack returns rate_limited. */
const MAX_RATE_LIMIT_RETRIES = 25;

/** Minimum gap between consecutive Slack API calls. Tier 3 allows ~50 req/min (1200ms). */
const MIN_REQUEST_GAP_MS = 1300;

/** Tracks when the last Slack API call was made per access token (per workspace). Max 50 entries to prevent leaks. */
const MAX_THROTTLE_ENTRIES = 50;
const lastRequestTimeByToken = new Map<string, number>();

export async function throttledSlackFetch(url: string, accessToken: string): Promise<Response> {
  // Enforce minimum gap between requests for this specific workspace token
  const now = Date.now();
  const lastTime = lastRequestTimeByToken.get(accessToken) ?? 0;

  // Evict stale entries to prevent unbounded growth
  if (lastRequestTimeByToken.size > MAX_THROTTLE_ENTRIES) {
    const staleThreshold = now - 60_000;
    for (const [token, time] of lastRequestTimeByToken) {
      if (time < staleThreshold) lastRequestTimeByToken.delete(token);
    }
  }
  const timeSinceLast = now - lastTime;
  if (timeSinceLast < MIN_REQUEST_GAP_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_GAP_MS - timeSinceLast));
  }

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    lastRequestTimeByToken.set(accessToken, Date.now());
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      const retryAfter = parseInt(response.headers.get('Retry-After') ?? '5', 10);
      const method = new URL(url).pathname.split('/').pop() ?? url;
      slackLogger.warn(
        `Rate limited on ${method}, retry after ${retryAfter}s (attempt ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES})`
      );
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      continue;
    }

    return response;
  }

  throw new Error('Exceeded max rate limit retries for Slack API');
}

export function formatSlackTs(ts: string | undefined): string {
  if (!ts) return '';
  const date = new Date(parseFloat(ts) * 1000);
  return date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, ' UTC');
}

export function formatSlackMessage(msg: SlackMessage, userNames: Map<string, string>): string {
  const time = formatSlackTs(msg.ts);
  const userId = msg.user ?? 'unknown';
  const user = userNames.get(userId) ?? userId;
  const text = msg.text ?? '';
  return `[${time}] ${user}: ${text}`;
}

export const SLACK_USER_CACHE_TTL = 10 * 60 * 60; // 10 hours in seconds
