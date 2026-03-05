export interface MockSource {
  name: string;
  excerpt: string;
  location: string;
}

export interface MockMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: ReadonlyArray<MockSource>;
}
