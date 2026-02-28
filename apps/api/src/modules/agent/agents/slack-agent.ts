import { Injectable } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import type { ToolSet } from 'ai';
import { z } from 'zod';

import { AiUsageService } from '../../ai/ai-usage.service';
import { BaseAgent } from '../base-agent';
import type { CoreMessage } from '../services/memory.service';
import { AgentMemoryService } from '../services/memory.service';
import { RagSearchTool } from '../tools/rag-search.tool';
import { SlackReplyTool } from '../tools/slack-reply.tool';

const SLACK_API_URL = 'https://slack.com/api';

const SLACK_AGENT_PROMPT = `You are a Slack bot. Search the knowledge base and answer. Be brief, this is Slack.

## Rules

- Keep answers under 2000 characters.
- Use Slack mrkdwn only: *bold*, _italic_, \`code\`, > quotes, bullets. Do NOT use markdown **bold**, # headings, or [links](url).
- Jump straight into the answer. No preamble like "Here's what I found..." or "Based on...".
- NEVER ask clarification questions. Search for all interpretations and present what you find.
- Every claim MUST trace back to a search result. NEVER use training knowledge.
- Search again only if results are insufficient. Max 3 searches.

## Answer format

Short answer first, then sources on a new line.

Sources: use \`<sourceUrl|Type>\` Slack links. Deduplicate by URL. Add numbers (Slack 1, Slack 2) only for multiple sources of the same type. If sourceUrl is null, use dataSourceName as plain text.

Example:
Users can't access chat. Typing /doctor fixes it for 10 minutes.

<https://team.slack.com/archives/C123/p456|Slack>
<https://linear.app/team/GRA-7|Linear>

## Progress updates

Call \`slack_reply\` with a brief status (e.g. ":mag: Looking that up...") BEFORE your first search. The system posts your final answer automatically.`;

const slackThreadMessageSchema = z.object({
  user: z.string().optional(),
  bot_id: z.string().optional(),
  text: z.string().optional(),
  ts: z.string().optional(),
});

const slackRepliesResponseSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  messages: z.array(slackThreadMessageSchema).optional(),
});

@Injectable()
export class SlackAgent extends BaseAgent {
  protected readonly agentId = 'slack-bot';
  protected readonly defaultMaxSteps = 15;

  constructor(
    aiUsageService: AiUsageService,
    agentMemory: AgentMemoryService,
    private ragSearchTool: RagSearchTool,
    private slackReplyTool: SlackReplyTool
  ) {
    super(aiUsageService, agentMemory);
  }

  async run(opts: {
    orgId: DbId<'Org'>;
    accessToken: string;
    channel: string;
    threadTs: string;
    text: string;
    slackBotUserId?: string;
  }): Promise<string> {
    const threadMessages = await this.buildMessagesFromThread(
      opts.accessToken,
      opts.channel,
      opts.threadTs,
      opts.slackBotUserId
    );

    // Slack always searches everything in the org
    const ragTool = this.ragSearchTool.create(opts.orgId, { type: 'all' });

    const slackReply = this.slackReplyTool.create({
      accessToken: opts.accessToken,
      channel: opts.channel,
      threadTs: opts.threadTs,
    });

    const tools: ToolSet = {
      [this.ragSearchTool.toolName]: ragTool,
      slack_reply: slackReply.tool,
    };

    const agent = this.buildAgent({
      orgId: opts.orgId,
      source: 'SLACK',
      callerType: 'SYSTEM',
      tools,
      instructions: SLACK_AGENT_PROMPT,
    });

    const result = await agent.generate({
      messages: [...threadMessages, { role: 'user' as const, content: opts.text }],
    });

    // Post final answer to Slack (updates existing progress message or posts new)
    if (result.text.trim()) {
      await slackReply.postFinal(result.text);
    }

    return result.text;
  }

  private async buildMessagesFromThread(
    accessToken: string,
    channel: string,
    threadTs: string,
    slackBotUserId?: string
  ): Promise<CoreMessage[]> {
    const params = new URLSearchParams({
      channel,
      ts: threadTs,
      limit: '50',
    });

    const response = await fetch(`${SLACK_API_URL}/conversations.replies?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const parsed = slackRepliesResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      this.logger.warn(`Failed to parse Slack replies: ${parsed.error.message}`);
      return [];
    }

    const data = parsed.data;
    if (!data.ok || !data.messages || data.messages.length <= 1) {
      return [];
    }

    // Exclude the latest message (the current question), it's passed as `text`
    const history = data.messages.slice(0, -1);

    return history
      .filter((msg): msg is z.infer<typeof slackThreadMessageSchema> & { text: string } =>
        Boolean(msg.text)
      )
      .map((msg) => {
        const isBot = (slackBotUserId && msg.user === slackBotUserId) || Boolean(msg.bot_id);
        const role = isBot ? ('assistant' as const) : ('user' as const);
        const content = msg.text.replace(/<@[A-Z0-9]+>/g, '').trim();
        return { role, content };
      })
      .filter((msg) => msg.content.length > 0);
  }
}
