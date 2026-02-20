# Chunking Pipeline

How uploaded documents are split into chunks for embedding and retrieval.

## Constants

| Constant | Value | Purpose |
|---|---|---|
| `CHUNK_SIZE_TOKENS` | 400 | Max tokens per chunk |
| `CHUNK_OVERLAP_TOKENS` | 80 | Tokens prepended from the previous chunk |
| `MIN_CHUNK_SIZE_TOKENS` | 40 | Minimum chunk size (smaller segments get merged) |
| `EMBEDDING_BATCH_SIZE` | 100 | Chunks embedded per API call |

Token counts use `cl100k_base` (the tokenizer for `text-embedding-3-small`).

## Recursive Text Splitter

Core algorithm in `recursive-text-splitter.ts`. Used by all file types.

### Separator hierarchy

Splits text using progressively finer boundaries:

```
\n\n  (paragraphs)
\n    (lines)
.     (sentences)
?     (questions)
!     (exclamations)
;     (clauses)
      (words)
```

If a segment still exceeds `CHUNK_SIZE_TOKENS` after exhausting all separators, it hard-splits by token count.

### Three-phase process

1. **Split** — recursively break text at the coarsest separator that produces sub-`maxSize` segments. If a part is still too large, recurse with the next finer separator.

2. **Merge** — adjacent undersized segments are merged back together up to `maxSizeTokens`. Segments smaller than `minSizeTokens` are appended to their neighbor rather than standing alone.

3. **Overlap** — the last `overlapTokens` tokens of each chunk are prepended to the next chunk. This gives the embedding model context across chunk boundaries, improving retrieval for queries that span a split point.

## Chunking Strategies

Different file types use different chunking strategies, each producing chunks with type-specific metadata.

### Plain text / JSON (`chunkText`)

Simple recursive split. Metadata: `{ type: 'TXT' }` or `{ type: 'JSON' }`.

### PDF and DOCX (`chunkPagesText`)

Page-aware chunking that tracks which pages each chunk spans:

1. Concatenate all page texts into a flat string, recording character offsets for each page boundary.
2. Split without overlap first (to get accurate positions).
3. Apply overlap by prepending tokens from the previous segment.
4. For each chunk, compute which pages it spans by checking the character range against page boundaries.

Metadata: `{ type: 'PDF', pages: [1, 2] }` — the `pages` array lists every page the chunk touches.

### XLSX (`chunkSheets`)

Row-based chunking, one sheet at a time:

1. Iterate rows within each sheet.
2. Accumulate rows into a buffer until adding the next row would exceed `CHUNK_SIZE_TOKENS`.
3. Flush the buffer as a chunk.

Metadata: `{ type: 'XLSX', sheet: 'Sheet1', row: 5, columns: ['A', 'B', 'C'] }` — `row` is the first row number in the chunk.

### CSV (`chunkCsvRows`)

Same as XLSX but without the per-sheet grouping. Metadata: `{ type: 'CSV', row: 1, columns: [...] }`.

### Integration messages (`groupMessages`)

For Slack, Linear, GitHub, Notion — messages arrive pre-structured with per-message metadata.

1. Group consecutive messages from the same context (e.g., same Slack channel) into a buffer.
2. Flush when the buffer exceeds `CHUNK_SIZE_TOKENS` or the context changes (different channel, different integration).
3. For Slack, unique authors are collected across all messages in a chunk.
4. Oversized single messages fall back to the recursive text splitter.
5. An undersized tail is appended to the previous chunk rather than creating a tiny final chunk.

Metadata varies by source type (e.g., `{ type: 'SLACK', slackChannelId: '...', slackAuthors: ['alice', 'bob'] }`).

### Images (`chunkText` via `ImageExtractor`)

Uploaded image files are processed by AI vision to produce a text description, then chunked as plain text. Metadata: `{ type: 'IMAGE' }`.

## Embedding

After chunking, embeddings are generated in batches of `EMBEDDING_BATCH_SIZE` using `text-embedding-3-small` (1536 dimensions). Each chunk is embedded as-is — no prefix or context is added.

Chunks are stored in `data.chunks` with their embedding vector, content, metadata, and a `chunk_index` for ordering.

## Retry Safety

Before embedding begins, all existing chunks for the data source are deleted (unless the job is append-only). This makes retries idempotent — no duplicate or orphaned chunks from partial previous runs.
