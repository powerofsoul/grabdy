# Search Pipeline

End-to-end documentation of how data gets ingested, chunked, embedded, and searched.

## Ingestion

When a data source is uploaded (or synced from an integration), a BullMQ job runs through the `DataSourceProcessor`:

```
Upload / Integration Sync
  -> Extract text (varies by format)
  -> Generate document summary (gpt-4o-mini, ~2-3 sentences)
  -> Chunk text (recursive splitter or message grouping)
  -> Embed chunks (text-embedding-3-small, batches of 100)
  -> Store chunks + embeddings in PostgreSQL
```

### Text Extraction

| Format | Strategy |
|--------|----------|
| PDF, DOCX | Page-based extraction, tracks page numbers |
| XLSX | Sheet-based extraction, tracks sheet + row numbers |
| CSV | Row-based extraction, tracks row ranges |
| Images | AI vision extraction (gpt-4o-mini) |
| Text, JSON, Markdown | Direct text |
| Slack, Linear, etc. | Pre-extracted content from integration sync |

### Chunking

Two chunking strategies depending on the content type:

**Recursive text splitter** (documents):

Splits text using a hierarchy of separators, trying coarser boundaries first:

1. `\n\n` (paragraphs)
2. `\n` (lines)
3. `. ` / `? ` / `! ` / `; ` (sentences)
4. ` ` (words)
5. Hard token split (fallback)

All size measurements use **token counts** (`cl100k_base` tokenizer, matching `text-embedding-3-small`) instead of character counts. This ensures consistent embedding density regardless of content type — code, prose, and structured data all produce chunks with similar token counts.

Small segments are merged together. Overlap is applied between adjacent chunks (token-aware slicing) so context isn't lost at boundaries.

| Constant | Value |
|----------|-------|
| `CHUNK_SIZE_TOKENS` | 400 tokens |
| `CHUNK_OVERLAP_TOKENS` | 80 tokens |
| `MIN_CHUNK_SIZE_TOKENS` | 40 tokens |

**Message grouping** (Slack, Linear, etc.):

Consecutive messages from the same context (e.g., same Slack channel) are grouped into chunks up to `CHUNK_SIZE_TOKENS`. Each message retains its own metadata (author, timestamp, source URL). Unique authors across grouped messages are collected into the chunk's metadata. When a single message exceeds `CHUNK_SIZE_TOKENS`, it is split using the recursive text splitter.

### Contextual Embeddings

Before embedding, each chunk is prefixed with the document summary:

```
<document summary>
---
<chunk content>
```

The raw chunk text is stored in the database (for display). Only the embedding captures the document-level context. This dramatically improves retrieval for chunks that lack standalone meaning (e.g., "The threshold is 500ms" becomes meaningful when the embedding knows it's from a rate-limiting document).

Integration messages (Slack, Linear) skip summary generation since messages are already self-contained.

### Page Number Tracking

For page-based documents (PDF, DOCX), each chunk's metadata records which pages it spans. When a chunk crosses a page boundary (due to overlap), it records all pages it touches. This enables accurate page citations in search results.

---

## Search

All search goes through `SearchService.search()`. The pipeline:

```
Query
  -> [HyDE] Generate hypothetical answer, blend with query
  -> Embed query text
  -> Run 3 search strategies in parallel
  -> Merge results via Reciprocal Rank Fusion
  -> [Rerank] Cohere semantic reranking
  -> [Expand Context] Fetch adjacent chunks
  -> Return top K results
```

### Step 1: HyDE (optional)

**Hypothetical Document Embeddings.** For question-style queries, the embedding of the question is far from the embedding of the answer in vector space. HyDE bridges this gap:

1. Generate a ~100-word hypothetical answer using gpt-4o-mini
2. Concatenate: `original query + "\n\n" + hypothetical answer`
3. Embed the blended text instead of the raw query

The original query is still used for full-text and trigram search (those benefit from exact terms, not hypothetical answers).

Falls back gracefully if generation fails.

### Step 2: Parallel Search

Three search strategies run concurrently, each returning a ranked list:

**Vector search** (pgvector):
- Cosine distance between query embedding and chunk embeddings
- Score: `1 - cosine_distance`
- Best for: semantic similarity, paraphrased content

**Full-text search** (PostgreSQL tsvector):
- Uses `websearch_to_tsquery('english', query)` for matching
- Supports quoted phrases (`"exact match"`), boolean operators (`cats OR dogs`), exclusion (`cats -dogs`)
- Scored by `ts_rank_cd` (cover density ranking)
- Best for: exact keyword matches, technical terms, proper nouns

**Trigram search** (pg_trgm):
- Uses `word_similarity(content, query)` for fuzzy matching
- Threshold: `word_similarity_threshold = 0.3`
- Best for: typos, partial matches, non-English words, short queries

### Step 3: Reciprocal Rank Fusion

Merges the three ranked lists into one using the RRF formula:

```
score(item) = sum over each list: weight_i / (K + rank_i)
```

Where `K = 60` (standard RRF constant) and weights are `[0.5, 0.3, 0.2]` for vector, full-text, and trigram respectively.

Items that rank highly in multiple lists get boosted. Items that only appear in one list still contribute.

### Step 4: Rerank (optional)

After RRF, the top candidates are reranked using **Cohere Rerank v3.5** via AWS Bedrock:

1. Send query + candidate texts to Cohere (documents truncated to 4000 chars)
2. Cohere returns a semantic relevance score for each candidate
3. Final score combines three signals:
   - 50% semantic relevance (from Cohere)
   - 30% hybrid score (from RRF)
   - 20% position bonus (rank decay)

Timeout: 2 seconds. Falls back to RRF ordering on any failure.

### Step 5: Context Window Expansion (optional)

For each matched chunk, fetch the chunks immediately before and after it (by `chunk_index`). These are returned as `contextBefore` and `contextAfter` (truncated to 500 chars each).

This gives the AI a wider view without retrieving entire documents. A single efficient batch query fetches all neighbors at once.

### Over-fetching

The search pipeline over-fetches candidates to give reranking enough material:
- With reranking: fetches `limit * 3` candidates
- Without reranking: fetches `limit * 2` candidates

After reranking (or RRF if no rerank), results are trimmed to the requested `limit`.

---

## Search Options

| Option | Description | Default |
|--------|-------------|---------|
| `limit` | Number of results to return | 10 |
| `collectionIds` | Restrict search to specific collections | All collections |
| `filters` | Metadata filters (source type, Slack author, channel, etc.) | None |
| `rerank` | Enable Cohere semantic reranking | `false` |
| `hyde` | Enable HyDE query expansion | `false` |
| `expandContext` | Attach adjacent chunk content | `false` |

### Defaults by Caller

| Caller | rerank | hyde | expandContext |
|--------|--------|------|---------------|
| AI Agent (chat, Slack bot) | on | on | on |
| `/v1/search` (public API) | off | off | off |
| `/v1/query` (public API, agent) | on | on | on |
| MCP tool | off | off | off |

The AI agent always uses the full pipeline for highest quality. The direct search API keeps everything off by default for speed and cost, with opt-in via request body.

---

## Metadata Filters

Filters narrow search results by chunk metadata. Available internally (agent, MCP):

| Field | Operator | Description |
|-------|----------|-------------|
| `type` | `eq`, `in` | Source type: `PDF`, `DOCX`, `SLACK`, `NOTION`, `LINEAR`, `GITHUB`, etc. |
| `slackChannelId` | `eq` | Specific Slack channel |
| `slackAuthor` | `eq` | Specific Slack message author |
| `notionPageId` | `eq` | Specific Notion page |
| `linearIssueId` | `eq` | Specific Linear issue |

Filters are applied as SQL WHERE clauses on the chunk metadata JSONB column, scoped to each search strategy (vector, full-text, trigram).

---

## Append-Only Sync (Integrations)

For integration sources like Slack, the first sync fetches everything and creates all chunks. Subsequent syncs only fetch new content since the last cursor and append new chunks without deleting existing ones.

This avoids:
- Temporary search gaps during re-indexing
- Unnecessary re-embedding of unchanged content
- Wasted API calls to the integration provider

New chunks get `chunk_index` values starting after the highest existing index for that data source, ensuring no collisions.

---

## Models Used

| Stage | Model | Purpose |
|-------|-------|---------|
| Embedding | `text-embedding-3-small` | Query and chunk embeddings |
| HyDE | `gpt-4o-mini` | Generate hypothetical answers |
| Reranking | `cohere.rerank-v3-5:0` (Bedrock) | Semantic relevance scoring |
| Document summary | `gpt-4o-mini` | Contextual embedding prefix |
| Image extraction | `gpt-4o-mini` | Describe extracted images |

---

## Key Files

| File | Purpose |
|------|---------|
| `apps/api/src/modules/retrieval/search.service.ts` | Search orchestrator |
| `apps/api/src/modules/retrieval/rerank.service.ts` | Cohere reranking |
| `apps/api/src/modules/retrieval/hybrid-search.ts` | Reciprocal Rank Fusion |
| `apps/api/src/modules/retrieval/retrieval.module.ts` | NestJS module |
| `apps/api/src/modules/agent/tools/rag-search.tool.ts` | Agent search tool |
| `apps/api/src/modules/agent/providers/bedrock.provider.ts` | AWS Bedrock client |
| `apps/api/src/modules/data-sources/data-source.processor.ts` | Ingestion pipeline |
| `apps/api/src/modules/data-sources/chunking/recursive-text-splitter.ts` | Text chunking |
| `apps/api/src/modules/data-sources/chunking/tokenizer.ts` | Token counting (cl100k_base) |
| `apps/api/src/config/constants.ts` | Chunk size constants |
| `packages/contracts/src/schemas/metadata-filter.ts` | Filter schemas |
