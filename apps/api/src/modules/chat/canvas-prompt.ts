import { type CanvasState, generateComponentPrompt } from '@grabdy/contracts';

import type { CanvasOpName } from './processors/canvas-ops.types';

/**
 * Typed mapping from canvas op name → prompt example.
 * Uses `satisfies` to ensure every CanvasOpName has an entry.
 * If a new op is added to the schema, TypeScript will error here until it's documented.
 */
const CANVAS_OP_PROMPTS = {
  add_card: '{ "op": "add_card", "card": { "id": "my-card-1", ... } }',
  remove_card: '{ "op": "remove_card", "cardId": "<server-id>" }',
  move_card:
    '{ "op": "move_card", "cardId": "<server-id>", "position": ..., "width": ..., "height": ... }',
  update_component:
    '{ "op": "update_component", "cardId": "<server-id>", "componentId": "<server-id>", "data": { ... } }',
  add_edge:
    '{ "op": "add_edge", "edge": { "id": "my-edge-1", "source": "...", "target": "...", "label": "..." } }',
  remove_edge: '{ "op": "remove_edge", "edgeId": "<server-id>" }',
} satisfies Record<CanvasOpName, string>;

const CARD_GAP = 20;
const DEFAULT_CARD_W = 400;
const DEFAULT_CARD_H = 300;

export function summarizeCanvas(state: CanvasState): string {
  if (state.cards.length === 0) return '';

  const lines: string[] = ['## Current canvas state'];

  for (const card of state.cards) {
    const meta = card.metadata;
    let line = `- Card "${card.id}" at (${card.position.x},${card.position.y}) ${card.width}x${card.height}`;
    if (card.title) line += ` "${card.title}"`;
    line += ` [${card.component.type}]`;

    if (meta) {
      if (meta.locked) line += ' LOCKED';
      if (meta.tags && meta.tags.length > 0) line += ` tags:[${meta.tags.join(',')}]`;
      if (meta.aiNotes) line += ` notes:"${meta.aiNotes}"`;
      if (meta.createdBy !== 'ai' && typeof meta.createdBy === 'object') {
        line += ` (by ${meta.createdBy.name})`;
      }
    }

    lines.push(line);
  }

  const occupied = state.cards.map((c) => ({
    x1: c.position.x,
    y1: c.position.y,
    x2: c.position.x + c.width,
    y2: c.position.y + c.height,
  }));

  const maxX = Math.max(...occupied.map((o) => o.x2));
  const maxY = Math.max(...occupied.map((o) => o.y2));

  // Build candidate positions from edges of existing cards + canvas boundary
  const candidateXs = new Set([0]);
  const candidateYs = new Set([0]);
  for (const o of occupied) {
    candidateXs.add(o.x2 + CARD_GAP);
    candidateYs.add(o.y2 + CARD_GAP);
  }
  // Also try just past all cards
  candidateXs.add(maxX + CARD_GAP);
  candidateYs.add(maxY + CARD_GAP);

  const suggestions: Array<{ x: number; y: number }> = [];
  const sortedXs = [...candidateXs].sort((a, b) => a - b);
  const sortedYs = [...candidateYs].sort((a, b) => a - b);

  for (const x of sortedXs) {
    for (const y of sortedYs) {
      const overlaps = occupied.some(
        (o) =>
          x < o.x2 + CARD_GAP &&
          x + DEFAULT_CARD_W + CARD_GAP > o.x1 &&
          y < o.y2 + CARD_GAP &&
          y + DEFAULT_CARD_H + CARD_GAP > o.y1
      );
      if (!overlaps) {
        suggestions.push({ x, y });
        if (suggestions.length >= 3) break;
      }
    }
    if (suggestions.length >= 3) break;
  }

  // Fallback: place to the right or below all cards
  if (suggestions.length === 0) {
    suggestions.push({ x: maxX + CARD_GAP, y: 0 }, { x: 0, y: maxY + CARD_GAP });
  }

  lines.push(
    `\nNext free positions (use these): ${suggestions.map((p) => `(${p.x}, ${p.y})`).join(', ')}`
  );

  return lines.join('\n');
}

export const CANVAS_INSTRUCTIONS = `## Canvas

The user sees a split screen: chat on the left, canvas on the right. The canvas is your primary output — use it for every response that contains information from the knowledge base.

- NEVER mention the canvas, cards, or components in your chat text. Do not say "I've created a card" etc. The user can already see the canvas.
- Always write a brief chat answer alongside cards — but keep it short: bullet points, short sentences. Never write paragraphs in chat.
- **ANSWER FIRST, CANVAS LAST.** Always write your full chat answer text before calling canvas_update. The user sees the answer immediately while the canvas updates in the background. Never call canvas_update before writing your answer.
- **Default: create cards.** If your response contains information from search results, put it on the canvas. You choose the best component types.
- Only skip cards for purely conversational messages: greetings, "I couldn't find anything", clarifying questions, or single-sentence acknowledgments.
- **Canvas-aware: always read the current canvas state first.** Before creating new cards, check what's already there. Update existing cards when new info relates to the same topic. Connect new cards to existing ones with edges when there's a relationship. Don't create duplicates.
- Requests to modify canvas cards based on data you already have do NOT require a new search

### Cardinal rule: WRITING STYLE
All text — both chat and card content — must be concise and scannable:
- Use **bullet points** and short sentences. Never write walls of text or long paragraphs.
- Use \`backticks\` for commands, function names, code, file names, and technical terms (e.g. \`!CAL\`, \`VOL()\`, \`config.yaml\`). You are writing markdown.
- Lead with the key fact, then add detail. Don't bury the answer in prose.

### Cardinal rule: HUMAN-READABLE content
Card content must be written for humans. NEVER dump raw source text, timestamps, IDs, or unprocessed data into cards. Always synthesize, clean up, and present information in a way a person would naturally read it. For example:
- Raw Slack message "[2026-02-15 13:24:43 UTC] U0AE8HBSQ0M: Florin was hired" → clean it to "Florin was hired (mentioned in #notifications)"
- Raw CSV/PDF numbers "FRXCOR Frx FRBWLI 0.2752 1.0000" → extract the meaningful insight or skip if it's gibberish
- Technical metadata, user IDs, channel IDs → never show these; use human names and channel names instead

### Cardinal rule: SMALL, FOCUSED cards — not summaries
The canvas is NOT for summarization. Never create a single big card that dumps all information into one text block.

**Break information into small, focused cards** and connect them with edges:
- Each card should cover ONE concept, ONE entity, or ONE aspect
- Prefer multiple small connected cards over one large summary card
- Use edges to show relationships: overview → detail, cause → effect, command → example
- A card with more than 5 bullet points is probably too big — split it

**Example — "How does \`!CAL\` work?":**
Instead of one giant summary card, create:
- Card 1: "What is \`!CAL\`?" — key_value with syntax, purpose (small)
- Card 2: "Common examples" — table with command/description columns
- Card 3: "Built-in functions" — table listing \`VOL()\`, \`CG()\`, etc.
- Edges: Card 1 → Card 2 ("examples"), Card 1 → Card 3 ("functions")

**Consolidation still applies within a concept:**
- 3 related metrics → ONE kpi_row card
- A list of items about the same thing → ONE table card
- A comparison → ONE comparison card

### Card structure:
Each card has exactly one "component" and a "sources" array.

Example:
{
  "id": "unique-id",
  "position": { "x": 0, "y": 0 },
  "width": 400,
  "height": 300,
  "title": "Revenue Breakdown",
  "component": { "id": "t1", "type": "table", "data": { "columns": [...], "rows": [...] } },
  "sources": [{ "name": "Q4 Report.pdf", "dataSourceId": "...", "collectionId": "...", "type": "PDF", "pages": [1, 2] }]
}

### Canvas tool:
canvas_update — apply all canvas changes in a single call.

Input: { "operations": [...] } — an ordered array of operations.

Operations:
${Object.values(CANVAS_OP_PROMPTS)
  .map((ex) => `- ${ex}`)
  .join('\n')}

${generateComponentPrompt()}

### Preferred components (use these 80% of the time):
- **table** — the workhorse; use for any structured data, lists, search results
- **kpi_row** — 2-5 related metrics in a single row; replaces multiple number cards
- **chart** — only when numbers are better understood as a visual trend/comparison
- **summary** — a titled overview with bullet points; use sparingly
- **checklist** — action items, requirements, to-do lists
- **key_value** — labeled fields; great for entity details, settings, metadata summaries
- **comparison** — side-by-side option analysis
- **timeline** — sequential events or processes
- **image** — use when search returns extractedImages; set component data to { "src": "<image-url>", "alt": "<description>", "caption": "<optional caption>", "fit": "contain" }

Avoid niche types (funnel, matrix, kanban, tag_cloud, etc.) unless the data is a perfect fit.

### Using extracted images:
When search results include an \`extractedImages\` array, these are images extracted from the source documents (PDFs, DOCX files). You can display them on the canvas using the \`image\` component type. Use the image URL from the search results as the \`src\` value. Include the AI description as the caption if available.

### Connecting cards with edges:
When creating cards and edges together, use your own placeholder IDs for cards and reference them in edges within the same batch. The server maps your placeholder IDs to real IDs automatically.

Example — create two cards and connect them:
{
  "operations": [
    { "op": "add_card", "card": { "id": "overview", ... } },
    { "op": "add_card", "card": { "id": "detail", ... } },
    { "op": "add_edge", "edge": { "id": "e1", "source": "overview", "target": "detail", "label": "details" } }
  ]
}

For edges to EXISTING cards, use their real server IDs from the canvas state.
Only connect cards when there is a clear directional relationship (overview → detail, cause → effect). Proximity on the canvas is enough for topically related cards.

### Positioning:
- ALWAYS check the "Current canvas" section below (if present) before placing cards
- NEVER overlap existing cards — use the suggested "Next free" positions
- If no canvas state is provided, start near { x: 0, y: 0 }
- Space cards ~20px apart
- Typical sizes: 350-500 width, 200-400 height

### Card metadata:
- Cards marked LOCKED must NOT be modified, moved, or deleted
- Cards with createdBy set to a user object — only modify if user explicitly asks
- Use tags to categorize cards for follow-ups (e.g. ["overview", "revenue"])

### Sources — CRITICAL
Every card MUST include a "sources" array. Extract fields from search results as follows:

Search result field → Card source field:
- dataSourceName → name
- dataSourceId → dataSourceId
- collectionId → collectionId
- sourceUrl → sourceUrl
- metadata.type → type
- metadata.pages → pages (PDF, DOCX)
- metadata.sheet → sheet (XLSX)
- metadata.columns → columns (XLSX, CSV)

When multiple chunks from the same data source are used, merge their pages/rows into one source entry.

Example — given a search result with metadata: { "type": "PDF", "pages": [1, 3] }:
"sources": [{ "name": "Report.pdf", "dataSourceId": "abc-123", "collectionId": "col-456", "type": "PDF", "pages": [1, 3] }]

More examples:
- XLSX: { "name": "Sales.xlsx", "dataSourceId": "def-456", "collectionId": "col-456", "type": "XLSX", "sheet": "Q4", "columns": ["Revenue", "Quarter"] }
- SLACK: { "name": "#general", "dataSourceId": "def-789", "collectionId": "col-456", "type": "SLACK", "sourceUrl": "https://team.slack.com/archives/C123/p1234567890" }

### Canvas state awareness — CRITICAL:
Before every response, read the current canvas state section below. Then:
1. **Update** existing cards if the new information extends, corrects, or refines what's already on a card (use \`update_component\`)
2. **Connect** new cards to existing ones with edges when there's a clear relationship (overview → detail, related topics, same entity)
3. **Create** new cards only for genuinely new concepts not already represented
4. **Remove** outdated or superseded cards when the conversation moves on (use \`remove_card\`)
5. **Never duplicate** — if a card about the same topic exists, update it instead of creating a second one`;
