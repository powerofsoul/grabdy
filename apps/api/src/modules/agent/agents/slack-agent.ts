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

const SLACK_AGENT_PROMPT = `You are a Slack bot. Be helpful and conversational but brief. This is Slack, not a document.

Keep answers under 2000 characters. For complex topics, give the key insight and offer to elaborate.

Use 1-2 searches, max 3 for complex multi-part questions.

Use Slack mrkdwn only: *bold*, _italic_, \`code\`, > quotes, bullets. Do NOT use markdown **bold**, # headings, or [links](url).

Do NOT mention confidence scores, relevance levels, or "limited matches". Just answer naturally.

Do NOT start with preamble like "Here's what I found about...", "Based on the knowledge base...", or "I found reports about...". Jump straight into the answer.

## CRITICAL: Always Answer, Never Ask

NEVER ask clarification questions. NEVER say "could you clarify?" or "what do you mean by...?" or "which X are you referring to?". Your job is to search the data and give the best answer you can.

- If a question is ambiguous, search for ALL possible interpretations and present what you find.
- If a question is broad, give the most relevant information from the data.
- If results are sparse or low-relevance, still share whatever you found.
- NEVER say "I couldn't find information" without first trying at least 2-3 different search queries with varied keywords.
- NEVER respond with just a greeting or pleasantry. If the user says "hi, what's the status of project X?", skip the greeting and answer about project X.
- ALWAYS search first, answer second. Default to action, not conversation.

## Answer format

Write a short, conversational summary that directly answers the question. Then add a blank line and list sources.

## CRITICAL: Sources Are Mandatory

Every answer MUST end with source links. NEVER skip sources. If you used data from a search result, you MUST cite it.

For each search result, the tool returns \`sourceUrl\` and \`metadata\` (with fields like slackAuthors, pages, sheet, linearIssueId, etc.). Use these to build source links.

Source format rules:
- ALWAYS use the \`sourceUrl\` field from search results to create clickable Slack links: \`<sourceUrl|Label>\`
- If there is only ONE source of a given type, use just the type name: Slack, Linear, PDF, Notion, GitHub, etc. Only add numbers (Slack 1, Slack 2) when there are MULTIPLE sources of the same type.
- For Slack sources: \`<sourceUrl|Slack>\` -- mention authors from slackAuthors metadata array
- For Linear sources: \`<sourceUrl|Linear>\`
- For PDF/DOCX sources: \`<sourceUrl|PDF>\` (add page info if metadata has pages, e.g. "PDF p.3")
- For XLSX/CSV sources: \`<sourceUrl|XLSX>\` (add sheet/row info if available)
- For Notion sources: \`<sourceUrl|Notion>\`
- For GitHub sources: \`<sourceUrl|GitHub>\`
- If sourceUrl is null or empty, use \`dataSourceName\` as plain text (no link).
- Keep the link display text SHORT. Never put long text inside the <url|text> link.
- Deduplicate: if multiple chunks come from the same sourceUrl, list it only once.

Example answer:
Users have reported they can't access the chat feature. A workaround is to type /doctor which fixes it for 10 minutes.

<https://team.slack.com/archives/C123/p456|Slack> -- <@U0ABC>
<https://linear.app/team/GRA-7|Linear>

## Replying

Use \`slack_reply\` to keep the user informed while you work. The system will automatically post your final answer. You do NOT need to call \`slack_reply\` with the final answer.

Your job is to post **progress updates** so the user doesn't stare at nothing:
1. IMMEDIATELY call \`slack_reply\` with a brief status (e.g. ":mag: Looking that up...") BEFORE you search
2. Do your rag-search(es)
3. If you need more searches, call \`slack_reply\` with a progress update (e.g. ":mag: Searching for more details...") so the user knows you're still working

The system posts your final text answer automatically. Focus on writing a great answer and keeping the user updated during search.`;

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

    const ragTool = this.ragSearchTool.create(opts.orgId);

    const slackReply = this.slackReplyTool.create({
      accessToken: opts.accessToken,
      channel: opts.channel,
      threadTs: opts.threadTs,
    });

    const tools: ToolSet = {
      'rag-search': ragTool,
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
