import { Injectable, Logger } from '@nestjs/common';

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const SLACK_API_URL = 'https://slack.com/api';

interface SlackPostResponse {
  ok: boolean;
  ts?: string;
  error?: string;
}

@Injectable()
export class SlackReplyTool {
  private readonly logger = new Logger(SlackReplyTool.name);

  create(opts: { accessToken: string; channel: string; threadTs: string }) {
    const logger = this.logger;
    let messageTs: string | null = null;

    const postOrUpdate = async (text: string) => {
      if (!messageTs) {
        const res = await fetch(`${SLACK_API_URL}/chat.postMessage`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${opts.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: opts.channel,
            text,
            thread_ts: opts.threadTs,
          }),
        });
        const data: SlackPostResponse = await res.json();
        if (data.ok && data.ts) {
          messageTs = data.ts;
          return { success: true, action: 'posted' as const };
        }
        logger.warn(`Slack chat.postMessage failed: ${data.error ?? 'Unknown error'}`);
        return { success: false, action: 'posted' as const, error: data.error ?? 'Unknown error' };
      }

      const res = await fetch(`${SLACK_API_URL}/chat.update`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: opts.channel,
          ts: messageTs,
          text,
        }),
      });
      const data: SlackPostResponse = await res.json();
      if (!data.ok) {
        logger.warn(`Slack chat.update failed: ${data.error ?? 'Unknown error'}`);
      }
      return { success: data.ok, action: 'updated' as const, error: data.error };
    };

    const tool = createTool({
      id: 'slack_reply',
      description: `Post a progress update in Slack so the user knows you're working. The system posts your final answer automatically — use this tool only for status updates during search.

Call this BEFORE each search to show the user what you're doing:
- Before first search: ":mag: Looking that up..."
- Before additional searches: ":mag: Searching for more details..."

Uses Slack mrkdwn formatting.`,
      inputSchema: z.object({
        text: z.string().describe('The message text to post/update in Slack mrkdwn format'),
      }),
      execute: async ({ text }) => postOrUpdate(text),
    });

    return {
      tool,
      /** Always post/update the final text — guarantees the user sees the answer. */
      postFinal: (text: string) => postOrUpdate(text),
    };
  }
}
