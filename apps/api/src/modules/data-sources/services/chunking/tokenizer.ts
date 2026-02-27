import { encodingForModel } from 'js-tiktoken';

let encoder: ReturnType<typeof encodingForModel> | null = null;

function getEncoder(): ReturnType<typeof encodingForModel> {
  if (!encoder) {
    encoder = encodingForModel('text-embedding-3-small');
  }
  return encoder;
}

export function countTokens(text: string): number {
  return getEncoder().encode(text).length;
}

export function encodeTokens(text: string): number[] {
  return getEncoder().encode(text);
}

export function decodeTokens(tokens: number[]): string {
  return getEncoder().decode(tokens);
}
