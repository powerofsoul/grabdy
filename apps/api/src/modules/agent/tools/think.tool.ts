import { Injectable } from '@nestjs/common';

import { tool } from 'ai';
import { z } from 'zod';

import type { StreamChunk, Tool } from '../base-tool';

/**
 * A "think" tool that lets the model express its reasoning as a tool call.
 * Reasoning must go through this tool, never as raw text or XML tags.
 */
@Injectable()
export class ThinkTool implements Tool {
  systemPrompt = `## Think tool rules

The \`think\` tool is your internal scratchpad. The user sees your thoughts as a live progress indicator while you work, so be thorough and informative. Think out loud like a subject matter expert explaining their reasoning to a colleague.

**Call \`think\` constantly.** Before every tool call. After every tool result. Before your final answer. When you change strategy. When you notice something interesting. When you are unsure. There is no limit. More thinking = better answers. You can call \`think\` in parallel with other tool calls.

### What to include in each thought

**Before searching:**
- Restate what the user is asking in your own words. What is the core question?
- What specific terms, concepts, or keywords should you search for?
- What alternative phrasings or synonyms might yield better results?
- What kind of document or source might contain this information?

**After results come back:**
- How many results came back? Are they relevant or off-topic?
- Quote or paraphrase the most useful pieces of information you found.
- What does each source actually say? Summarize the key facts.
- What is still missing? What gaps remain in your understanding?
- What new terms or concepts appeared in the results that you should search for next?
- Why are you choosing your next search terms?

**Before your final answer:**
- Summarize all the facts you gathered across all searches.
- How do the sources agree or contradict each other?
- What is your confidence level? Is the answer well-supported or partial?
- Are there any caveats or nuances the user should know about?

### Quality standards

- Write 3-6 sentences per thought. Be specific, detailed, and analytical.
- BAD: "I will search for more information." (too vague)
- BAD: "The results look relevant." (says nothing useful)
- GOOD: "The user wants to know about the refund policy. I found that the company offers 30-day refunds for unused products and 14-day refunds for digital purchases. The Employee Handbook on page 12 also mentions manager approval is required for amounts over $500. Let me search for 'refund exceptions' to see if there are special cases."
- GOOD: "The search for 'API rate limits' returned 3 results. The most relevant one is from the Developer Guide, which states a limit of 1000 requests per minute per API key. I also see mention of burst limits and retry headers. Let me search for 'rate limit exceeded error handling' to get the full picture for the user."

NEVER put reasoning in your text output. Text output = final answer only.`;

  create() {
    return tool({
      description:
        'MANDATORY at every step. The user sees a blank loading screen until you call think. ' +
        'Call before and after every tool call, and before your final answer. ' +
        'Be detailed: explain what you found, what it means, what is missing, and what you will do next.',
      inputSchema: z.object({
        thought: z
          .string()
          .describe(
            'Detailed reasoning: restate the question, what you plan to search and why, what you found and what it means, which sources were relevant, what gaps remain, what to search next.'
          ),
      }),
      execute: async () => {
        return { ok: true };
      },
    });
  }

  onToolCall(input: unknown): StreamChunk | null {
    if (input && typeof input === 'object' && 'thought' in input) {
      const thought = String(input.thought);
      if (thought) {
        return { type: 'thinking', text: thought };
      }
    }
    return null;
  }
}
