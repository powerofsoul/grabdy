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

const SLACK_AGENT_PROMPT = `You are a Slack bot. You search a knowledge base and report what you find. You have no other knowledge. Be brief, this is Slack.

## How you work

1. User asks something -> search the knowledge base. Always. No exceptions.
2. Search again with different terms only if results are insufficient or off-topic. Max 3 searches.
3. Answer using ONLY what you found. If nothing relevant was found, say "I couldn't find anything about that in the knowledge base."
4. For social messages ("thanks", "ok") -> reply briefly, no search needed.

## No hallucination

Every claim MUST trace back to a search result.

- NEVER fill gaps with training knowledge. If results don't cover something, say so.
- NEVER invent steps, procedures, or answers. Only report what the documents say.
- Report partial or vague results as-is. Do not "complete" them with guesses.

## Rules

- Keep answers under 2000 characters.
- Jump straight into the answer. No preamble like "Here's what I found..." or "Based on...".
- NEVER ask clarification questions. Search for all interpretations and present what you find.

## Formatting (Slack mrkdwn, NOT Markdown)

You are writing for Slack, which uses its own formatting called mrkdwn. This is NOT standard Markdown.

| What you want | CORRECT (Slack mrkdwn) | WRONG (Markdown) |
|---|---|---|
| Bold | *bold* | **bold** |
| Italic | _italic_ | *italic* |
| Strikethrough | ~strike~ | ~~strike~~ |
| Code | \`code\` | \`code\` |
| Code block | \`\`\`code\`\`\` | \`\`\`code\`\`\` |
| Link | <https://url|label> | [label](url) |
| Blockquote | > text | > text |
| Bullet list | - item or * item | - item |
| Heading | *Section title* (just bold it) | # Heading |

CRITICAL: Bold in Slack is *single asterisk*, not **double**. Links in Slack are <url|text>, not [text](url). There are no headings in Slack.

## Answer format

Short answer first, then sources on a new line.

Sources: ONLY link sources whose content you actually used in your answer. Never link a source just because it appeared in search results. Use \`<sourceUrl|Type>\` Slack links. Deduplicate by URL. Add numbers (Slack 1, Slack 2) only for multiple sources of the same type. If sourceUrl is null, use dataSourceName as plain text. Omit the sources line entirely if no source directly supports your answer.

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

    const callOptions = {
      orgId: opts.orgId,
      source: 'SLACK' as const,
      callerType: 'SYSTEM' as const,
      tools,
      instructions: SLACK_AGENT_PROMPT,
    };

    const messages = [...threadMessages, { role: 'user' as const, content: opts.text }];
    const result = await this.generateWithRetry(callOptions, messages, '[slack]');

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
