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

    return createTool({
      id: 'slack_reply',
      description: `Post or update your reply in Slack. Call this tool to show the user what you're doing and to deliver your final answer.

Usage pattern:
1. FIRST call: Post a brief status like "Searching the knowledge base..." BEFORE you search
2. AFTER searching: Call again with your complete, final answer — this updates the same message

You MUST call this tool at least twice: once before searching (status), once after (answer).
The message uses Slack mrkdwn formatting.`,
      inputSchema: z.object({
        text: z.string().describe('The message text to post/update in Slack mrkdwn format'),
      }),
      execute: async ({ text }) => {
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
            return { success: true, action: 'posted' };
          }
          logger.warn(`Slack chat.postMessage failed: ${data.error ?? 'Unknown error'}`);
          return { success: false, error: data.error ?? 'Unknown error' };
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
        return { success: data.ok, action: 'updated', error: data.error };
      },
    });
  }
}
