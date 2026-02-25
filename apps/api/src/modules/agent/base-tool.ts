export type StreamChunk =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'sources'; sources: unknown[] };

/** A tool that can emit structured chunks into the stream on tool-call and/or tool-result. */
export interface Tool {
  /** Markdown section injected into agent instructions automatically. */
  systemPrompt?: string;
  /** Called when the model invokes this tool. Return a chunk to emit, or null. */
  onToolCall?(input: unknown): StreamChunk | null;
  /** Called when the tool execution completes. Return a chunk to emit, or null. */
  onToolResult?(input: unknown, output: unknown): StreamChunk | null;
}
