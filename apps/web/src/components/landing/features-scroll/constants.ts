export const FEATURE_TABS = [
  {
    number: '01',
    title: 'Search',
    heading: 'Ask anything, get answers',
    description:
      'Ask questions in plain English. Grabdy finds the answer across all your data with cited sources.',
  },
  {
    number: '02',
    title: 'Interface',
    heading: 'Search from anywhere',
    description:
      'Use the web dashboard or ask directly in Slack. Grabdy meets your team where they already work.',
  },
  {
    number: '03',
    title: 'Integrations',
    heading: 'Connect your tools and files',
    description:
      'Upload PDFs, Excel, Word, and text files. Sync Slack, GitHub, Notion, and more. All your data in one place.',
  },
  {
    number: '04',
    title: 'Chat widget',
    heading: 'Embed on your site',
    description:
      'Add an AI chatbot to your website in minutes. It answers from your data, styled to your brand.',
  },
  {
    number: '05',
    title: 'REST API',
    heading: 'Build with code',
    description:
      'Query your knowledge base programmatically. Simple REST endpoint, powerful vector search.',
  },
  {
    number: '06',
    title: 'MCP',
    heading: 'Works with AI tools',
    description: 'Connect Grabdy to Claude, Cursor, and any MCP-compatible AI tool.',
  },
] as const;

export const TAB_COUNT = FEATURE_TABS.length;
