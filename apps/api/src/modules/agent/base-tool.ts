/** A tool that can emit text into the stream on tool-call and/or tool-result. */
export interface Tool {
  /** Called when the model invokes this tool. Return text to emit, or null. */
  onToolCall?(input: unknown): string | null;
  /** Called when the tool execution completes. Return text to emit, or null. */
  onToolResult?(input: unknown, output: unknown): string | null;
}
