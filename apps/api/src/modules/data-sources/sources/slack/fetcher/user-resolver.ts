import { Injectable } from '@nestjs/common';

import { RedisService } from '../../../../../redis/redis.module';
import type { SlackMessage, SlackUserInfoResponse } from '../types';
import { SLACK_API_URL, SLACK_USER_CACHE_TTL, throttledSlackFetch } from '../utils';

@Injectable()
export class SlackUserResolver {
  constructor(private readonly redis: RedisService) {}

  /**
   * Resolve Slack user IDs to display names. Uses Redis cache with 10h TTL.
   */
  async resolveUserNames(
    accessToken: string,
    messages: SlackMessage[]
  ): Promise<Map<string, string>> {
    const userIds = new Set<string>();
    for (const msg of messages) {
      if (msg.user) userIds.add(msg.user);
    }

    const result = new Map<string, string>();
    const uncached: string[] = [];

    // Check Redis cache first
    for (const userId of userIds) {
      const cached = await this.redis.get(`slack:user:${userId}`);
      if (cached) {
        result.set(userId, cached);
      } else {
        uncached.push(userId);
      }
    }

    // Fetch uncached users from Slack API
    for (const userId of uncached) {
      try {
        const params = new URLSearchParams({ user: userId });
        const response = await throttledSlackFetch(
          `${SLACK_API_URL}/users.info?${params.toString()}`,
          accessToken
        );
        const data: SlackUserInfoResponse = await response.json();

        if (data.ok && data.user) {
          const displayName =
            data.user.profile?.display_name ||
            data.user.profile?.real_name ||
            data.user.real_name ||
            userId;
          result.set(userId, displayName);
          await this.redis.set(`slack:user:${userId}`, displayName, 'EX', SLACK_USER_CACHE_TTL);
        } else {
          result.set(userId, userId);
        }
      } catch {
        result.set(userId, userId);
      }
    }

    return result;
  }
}
