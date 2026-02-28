import type { StreamChunk } from '@grabdy/contracts';

export interface PreviousToolCall {
  toolName: string;
  toolCallKey: string;
}

export interface ToolCallContext<TInput> {
  toolCallKey: string;
  input: TInput;
  previousCalls: PreviousToolCall[];
}

export interface ToolResultContext<TInput, TOutput> extends ToolCallContext<TInput> {
  output: TOutput;
}

export interface Tool<TInput = object, TOutput = object> {
  readonly toolName: string;
  systemPrompt?: string;
  onToolCall?(ctx: ToolCallContext<TInput>): StreamChunk | null;
  onToolResult?(ctx: ToolResultContext<TInput, TOutput>): StreamChunk | null;
}
