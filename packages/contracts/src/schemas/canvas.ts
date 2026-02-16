import { dbIdSchema, nonDbIdSchema } from '@grabdy/common';
import { z } from 'zod';

import { chunkMetaTypeEnum } from './chunk-meta.js';

// ---------------------------------------------------------------------------
// Citations (shared across all components)
// ---------------------------------------------------------------------------

export const citationSchema = z.object({
  label: z.string(),
  url: z.string().optional(),
  dataSourceId: dbIdSchema('DataSource').optional(),
  chunkId: dbIdSchema('Chunk').optional(),
});

export type Citation = z.infer<typeof citationSchema>;

const citations = z.array(citationSchema).optional();

// ---------------------------------------------------------------------------
// Card sources — defined before COMPONENT_DEFINITIONS so source_link can use it
// ---------------------------------------------------------------------------

export const cardSourceSchema = z.object({
  name: z.string(),
  score: z.number().optional(),
  chunkId: dbIdSchema('Chunk').optional(),
  dataSourceId: dbIdSchema('DataSource').optional(),
  collectionId: dbIdSchema('Collection').optional(),
  sourceUrl: z.string().nullable().optional(),
  type: chunkMetaTypeEnum.optional(),
  // Location metadata — populated from chunk metadata when the AI creates the card
  pages: z.array(z.number()).optional(),
  sheet: z.string().optional(),
  rows: z.array(z.number()).optional(),
  columns: z.array(z.string()).optional(),
});

export type CardSource = z.infer<typeof cardSourceSchema>;

// ---------------------------------------------------------------------------
// Component Definitions — single source of truth
// ---------------------------------------------------------------------------

export const COMPONENT_TYPES = [
  'table',
  'chart',
  'summary',
  'source_link',
  'document_link',
  'search_filter',
  'topic_map',
  'bookmark',
  'text',
  'checklist',
  'progress',
  'alert',
  'code',
  'image',
  'quote',
  'kpi_row',
  'rating',
  'timeline',
  'comparison',
  'swot',
  'sticky_note',
  'embed',
  'json',
  'key_value',
  'pros_cons',
  'tag_cloud',
  'accordion',
  'header',
  'kanban',
  'matrix',
  'funnel',
  'status_list',
  'link_list',
  'number',
] as const;

export type ComponentType = (typeof COMPONENT_TYPES)[number];

const CATEGORY_LABELS = {
  data: 'Data & Numbers',
  analysis: 'Analysis & Strategy',
  content: 'Content',
  media: 'Media & Layout',
  reference: 'References (read-only)',
} as const;

type ComponentCategory = keyof typeof CATEGORY_LABELS;

interface ComponentDefinition {
  category: ComponentCategory;
  description: string;
  usage: string;
  dataSchema: z.ZodType;
}

export const COMPONENT_DEFINITIONS = {
  table: {
    category: 'data',
    description: '{ columns: [{key, label}], rows: [{...}] }',
    usage: 'use for ANY structured data',
    dataSchema: z.object({
      columns: z.array(z.object({ key: z.string(), label: z.string() })),
      rows: z.array(z.record(z.string(), z.unknown())),
    }),
  },
  chart: {
    category: 'data',
    description:
      '{ chartType: "bar"|"line"|"pie", labels: [...], datasets: [{label, data, color?}] }',
    usage: 'use for ANY numbers that can be compared',
    dataSchema: z.object({
      chartType: z.enum(['bar', 'line', 'pie']),
      labels: z.array(z.string()),
      datasets: z.array(
        z.object({
          label: z.string(),
          data: z.array(z.number()),
          color: z.string().optional(),
        })
      ),
    }),
  },
  kpi_row: {
    category: 'data',
    description: '{ metrics: [{value, label, unit?, color?, trend?}] }',
    usage: 'row of 2-5 KPIs side by side, great for dashboards',
    dataSchema: z.object({
      metrics: z.array(
        z.object({
          value: z.union([z.string(), z.number()]),
          label: z.string(),
          unit: z.string().optional(),
          color: z.string().optional(),
          trend: z
            .object({
              direction: z.enum(['up', 'down', 'flat']),
              value: z.string(),
            })
            .optional(),
        })
      ),
    }),
  },
  progress: {
    category: 'data',
    description: '{ value, max, label, sublabel?, color?, showPercent, size: "sm"|"md"|"lg" }',
    usage: 'progress/completion bar',
    dataSchema: z.object({
      value: z.number(),
      max: z.number().default(100),
      label: z.string(),
      sublabel: z.string().optional(),
      color: z.string().optional(),
      showPercent: z.boolean().default(true),
      size: z.enum(['sm', 'md', 'lg']).default('md'),
    }),
  },
  comparison: {
    category: 'data',
    description: '{ items: ["A","B"], attributes: [{name, values: [...]}], highlightBest }',
    usage: 'side-by-side comparison table',
    dataSchema: z.object({
      items: z.array(z.string()),
      attributes: z.array(
        z.object({
          name: z.string(),
          values: z.array(z.string()),
        })
      ),
      highlightBest: z.boolean().default(false),
    }),
  },
  number: {
    category: 'data',
    description: '{ value, prefix?, suffix?, color?, size: "sm"|"md"|"lg" }',
    usage: 'single big number display',
    dataSchema: z.object({
      value: z.union([z.number(), z.string()]),
      prefix: z.string().optional(),
      suffix: z.string().optional(),
      color: z.string().optional(),
      size: z.enum(['sm', 'md', 'lg']).default('md'),
    }),
  },
  rating: {
    category: 'data',
    description: '{ items: [{label, value, max?, color?}], variant: "stars"|"bars"|"dots" }',
    usage: 'rating display with multiple variants',
    dataSchema: z.object({
      items: z.array(
        z.object({
          label: z.string(),
          value: z.number(),
          max: z.number().default(5),
          color: z.string().optional(),
        })
      ),
      variant: z.enum(['stars', 'bars', 'dots']).default('bars'),
    }),
  },
  funnel: {
    category: 'data',
    description: '{ steps: [{label, value, color?}] }',
    usage: 'funnel/conversion visualization',
    dataSchema: z.object({
      steps: z.array(
        z.object({
          label: z.string(),
          value: z.number(),
          color: z.string().optional(),
        })
      ),
    }),
  },
  swot: {
    category: 'analysis',
    description: '{ strengths: [...], weaknesses: [...], opportunities: [...], threats: [...] }',
    usage: '2x2 SWOT grid',
    dataSchema: z.object({
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
      opportunities: z.array(z.string()),
      threats: z.array(z.string()),
    }),
  },
  topic_map: {
    category: 'analysis',
    description: '{ centralTopic, branches: [{label, children?}] }',
    usage: 'mind map for topic overviews',
    dataSchema: z.object({
      centralTopic: z.string(),
      branches: z.array(
        z.object({
          label: z.string(),
          children: z.array(z.string()).optional(),
        })
      ),
    }),
  },
  timeline: {
    category: 'analysis',
    description:
      '{ events: [{title, description?, date?, status: "completed"|"in_progress"|"pending", color?}] }',
    usage: 'event/process timeline',
    dataSchema: z.object({
      events: z.array(
        z.object({
          title: z.string(),
          description: z.string().optional(),
          date: z.string().optional(),
          status: z.enum(['completed', 'in_progress', 'pending']).default('pending'),
          color: z.string().optional(),
        })
      ),
    }),
  },
  checklist: {
    category: 'analysis',
    description: '{ title?, items: [{label, checked, indent?}], color? }',
    usage: 'actionable checklist with progress',
    dataSchema: z.object({
      title: z.string().optional(),
      items: z.array(
        z.object({
          label: z.string(),
          checked: z.boolean().default(false),
          indent: z.number().optional(),
        })
      ),
      color: z.string().optional(),
    }),
  },
  matrix: {
    category: 'analysis',
    description:
      '{ labels: {topLeft, topRight, bottomLeft, bottomRight}, quadrants: {topLeft: [...], ...} }',
    usage: '2x2 matrix/quadrant analysis',
    dataSchema: z.object({
      labels: z.object({
        topLeft: z.string(),
        topRight: z.string(),
        bottomLeft: z.string(),
        bottomRight: z.string(),
      }),
      quadrants: z.object({
        topLeft: z.array(z.string()),
        topRight: z.array(z.string()),
        bottomLeft: z.array(z.string()),
        bottomRight: z.array(z.string()),
      }),
    }),
  },
  kanban: {
    category: 'analysis',
    description: '{ columns: [{title, items: [...]}] }',
    usage: 'kanban board for workflow/task tracking',
    dataSchema: z.object({
      columns: z.array(z.object({ title: z.string(), items: z.array(z.string()) })),
    }),
  },
  pros_cons: {
    category: 'analysis',
    description: '{ pros: [...], cons: [...] }',
    usage: 'pros and cons list',
    dataSchema: z.object({
      pros: z.array(z.string()),
      cons: z.array(z.string()),
    }),
  },
  status_list: {
    category: 'analysis',
    description:
      '{ items: [{label, status: "success"|"warning"|"error"|"info"|"neutral", description?}] }',
    usage: 'status overview list',
    dataSchema: z.object({
      items: z.array(
        z.object({
          label: z.string(),
          status: z.enum(['success', 'warning', 'error', 'info', 'neutral']),
          description: z.string().optional(),
        })
      ),
    }),
  },
  text: {
    category: 'content',
    description: '{ content (markdown), fontSize?, color?, align? }',
    usage: 'text block with formatting options',
    dataSchema: z.object({
      content: z.string(),
      fontSize: z.number().optional(),
      color: z.string().optional(),
      align: z.enum(['left', 'center', 'right']).optional(),
    }),
  },
  summary: {
    category: 'content',
    description: '{ content (markdown), icon? }',
    usage: 'key takeaways with optional emoji icon',
    dataSchema: z.object({
      content: z.string(),
      icon: z.string().optional(),
    }),
  },
  quote: {
    category: 'content',
    description: '{ text, source?, color? }',
    usage: 'highlighted quote with attribution',
    dataSchema: z.object({
      text: z.string(),
      source: z.string().optional(),
      color: z.string().optional(),
    }),
  },
  alert: {
    category: 'content',
    description: '{ variant: "info"|"success"|"warning"|"error", title?, message, icon? }',
    usage: 'alert/notice box',
    dataSchema: z.object({
      variant: z.enum(['info', 'success', 'warning', 'error']).default('info'),
      title: z.string().optional(),
      message: z.string(),
      icon: z.string().optional(),
    }),
  },
  code: {
    category: 'content',
    description: '{ code, language?, title?, showLineNumbers }',
    usage: 'code block with copy button',
    dataSchema: z.object({
      code: z.string(),
      language: z.string().optional(),
      title: z.string().optional(),
      showLineNumbers: z.boolean().default(false),
    }),
  },
  bookmark: {
    category: 'content',
    description: '{ label, note? }',
    usage: 'key points to remember',
    dataSchema: z.object({
      label: z.string(),
      note: z.string().optional(),
    }),
  },
  sticky_note: {
    category: 'content',
    description: '{ content, color: "yellow"|"pink"|"blue"|"green"|"purple"|"orange" }',
    usage: 'quick note card',
    dataSchema: z.object({
      content: z.string(),
      color: z.enum(['yellow', 'pink', 'blue', 'green', 'purple', 'orange']).default('yellow'),
    }),
  },
  header: {
    category: 'content',
    description: '{ title, subtitle?, align? }',
    usage: 'section header',
    dataSchema: z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      align: z.enum(['left', 'center', 'right']).optional(),
    }),
  },
  accordion: {
    category: 'content',
    description: '{ sections: [{title, content, defaultOpen?}] }',
    usage: 'collapsible sections',
    dataSchema: z.object({
      sections: z.array(
        z.object({
          title: z.string(),
          content: z.string(),
          defaultOpen: z.boolean().optional(),
        })
      ),
    }),
  },
  json: {
    category: 'content',
    description: '{ content }',
    usage: 'raw JSON viewer',
    dataSchema: z.object({
      content: z.string(),
    }),
  },
  key_value: {
    category: 'content',
    description: '{ pairs: [{key, value}] }',
    usage: 'key-value pair display',
    dataSchema: z.object({
      pairs: z.array(z.object({ key: z.string(), value: z.string() })),
    }),
  },
  tag_cloud: {
    category: 'content',
    description: '{ tags: [{label, color?}] }',
    usage: 'tag/keyword cloud',
    dataSchema: z.object({
      tags: z.array(z.object({ label: z.string(), color: z.string().optional() })),
    }),
  },
  link_list: {
    category: 'content',
    description: '{ links: [{label, url, description?}] }',
    usage: 'list of clickable links',
    dataSchema: z.object({
      links: z.array(
        z.object({
          label: z.string(),
          url: z.string(),
          description: z.string().optional(),
        })
      ),
    }),
  },
  image: {
    category: 'media',
    description: '{ src, alt?, caption?, fit: "contain"|"cover"|"fill", height?, borderRadius? }',
    usage: 'image display',
    dataSchema: z.object({
      src: z.string(),
      alt: z.string().optional(),
      caption: z.string().optional(),
      fit: z.enum(['contain', 'cover', 'fill']).default('contain'),
      height: z.number().optional(),
      borderRadius: z.number().optional(),
    }),
  },
  embed: {
    category: 'media',
    description: '{ url, height? }',
    usage: 'embedded iframe content',
    dataSchema: z.object({
      url: z.string(),
      height: z.number().default(300),
    }),
  },
  source_link: {
    category: 'reference',
    description: '{ sources: CardSource[] }',
    usage: 'document source references — added automatically to cards via the sources field',
    dataSchema: z.object({
      sources: z.array(cardSourceSchema),
    }),
  },
  document_link: {
    category: 'reference',
    description: '{ documents: [{name, dataSourceId?}] }',
    usage: 'document references',
    dataSchema: z.object({
      documents: z.array(
        z.object({
          name: z.string(),
          dataSourceId: dbIdSchema('DataSource').optional(),
        })
      ),
    }),
  },
  search_filter: {
    category: 'reference',
    description: '{ query, filters: [{label, value}] }',
    usage: 'show what was searched',
    dataSchema: z.object({
      query: z.string(),
      filters: z.array(z.object({ label: z.string(), value: z.string() })),
    }),
  },
} satisfies Record<ComponentType, ComponentDefinition>;

// ---------------------------------------------------------------------------
// Component Node schema (built from COMPONENT_DEFINITIONS)
// ---------------------------------------------------------------------------

const componentId = nonDbIdSchema('CanvasComponent');

export const componentNodeSchema = z.discriminatedUnion('type', [
  z.object({
    id: componentId,
    type: z.literal('table'),
    data: COMPONENT_DEFINITIONS.table.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('chart'),
    data: COMPONENT_DEFINITIONS.chart.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('kpi_row'),
    data: COMPONENT_DEFINITIONS.kpi_row.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('progress'),
    data: COMPONENT_DEFINITIONS.progress.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('comparison'),
    data: COMPONENT_DEFINITIONS.comparison.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('number'),
    data: COMPONENT_DEFINITIONS.number.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('rating'),
    data: COMPONENT_DEFINITIONS.rating.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('funnel'),
    data: COMPONENT_DEFINITIONS.funnel.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('swot'),
    data: COMPONENT_DEFINITIONS.swot.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('topic_map'),
    data: COMPONENT_DEFINITIONS.topic_map.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('timeline'),
    data: COMPONENT_DEFINITIONS.timeline.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('checklist'),
    data: COMPONENT_DEFINITIONS.checklist.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('matrix'),
    data: COMPONENT_DEFINITIONS.matrix.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('kanban'),
    data: COMPONENT_DEFINITIONS.kanban.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('pros_cons'),
    data: COMPONENT_DEFINITIONS.pros_cons.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('status_list'),
    data: COMPONENT_DEFINITIONS.status_list.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('text'),
    data: COMPONENT_DEFINITIONS.text.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('summary'),
    data: COMPONENT_DEFINITIONS.summary.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('quote'),
    data: COMPONENT_DEFINITIONS.quote.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('alert'),
    data: COMPONENT_DEFINITIONS.alert.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('code'),
    data: COMPONENT_DEFINITIONS.code.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('bookmark'),
    data: COMPONENT_DEFINITIONS.bookmark.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('sticky_note'),
    data: COMPONENT_DEFINITIONS.sticky_note.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('header'),
    data: COMPONENT_DEFINITIONS.header.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('accordion'),
    data: COMPONENT_DEFINITIONS.accordion.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('json'),
    data: COMPONENT_DEFINITIONS.json.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('key_value'),
    data: COMPONENT_DEFINITIONS.key_value.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('tag_cloud'),
    data: COMPONENT_DEFINITIONS.tag_cloud.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('link_list'),
    data: COMPONENT_DEFINITIONS.link_list.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('image'),
    data: COMPONENT_DEFINITIONS.image.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('embed'),
    data: COMPONENT_DEFINITIONS.embed.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('source_link'),
    data: COMPONENT_DEFINITIONS.source_link.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('document_link'),
    data: COMPONENT_DEFINITIONS.document_link.dataSchema,
    citations,
  }),
  z.object({
    id: componentId,
    type: z.literal('search_filter'),
    data: COMPONENT_DEFINITIONS.search_filter.dataSchema,
    citations,
  }),
]);

export type ComponentNode = z.infer<typeof componentNodeSchema>;

// ---------------------------------------------------------------------------
// Generate AI prompt from COMPONENT_DEFINITIONS
// ---------------------------------------------------------------------------

export function generateComponentPrompt(): string {
  const grouped = new Map<ComponentCategory, string[]>();

  for (const [type, def] of Object.entries(COMPONENT_DEFINITIONS)) {
    const typedDef = def satisfies ComponentDefinition;
    const lines = grouped.get(typedDef.category) ?? [];
    lines.push(`- ${type}: ${typedDef.description} — ${typedDef.usage}`);
    grouped.set(typedDef.category, lines);
  }

  const categories: ComponentCategory[] = ['data', 'analysis', 'content', 'media', 'reference'];
  const sections: string[] = [];
  for (const cat of categories) {
    const lines = grouped.get(cat);
    if (lines) {
      sections.push(`**${CATEGORY_LABELS[cat]}:**\n${lines.join('\n')}`);
    }
  }

  const allTypes = Object.keys(COMPONENT_DEFINITIONS).join(', ');
  return `### Component types — ONLY use these (STRICT):\nAllowed types: ${allTypes}\nUsing ANY type not in this list will fail. NEVER invent custom component types.\n\n${sections.join('\n\n')}`;
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export const cardStyleSchema = z.object({
  backgroundColor: z.string().optional(),
  borderColor: z.string().optional(),
});

export const cardCreatorSchema = z.union([
  z.literal('ai'),
  z.object({ userId: z.string(), name: z.string() }),
]);

export type CardCreator = z.infer<typeof cardCreatorSchema>;

export const cardMetadataSchema = z.object({
  createdBy: cardCreatorSchema.default('ai'),
  locked: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  aiNotes: z.string().optional(),
});

export type CardMetadata = z.infer<typeof cardMetadataSchema>;

export const cardSchema = z.object({
  id: nonDbIdSchema('CanvasCard'),
  position: z.object({ x: z.number(), y: z.number() }),
  width: z.number(),
  height: z.number(),
  title: z.string().optional(),
  component: componentNodeSchema,
  sources: z.array(cardSourceSchema).default([]),
  style: cardStyleSchema.optional(),
  metadata: cardMetadataSchema.default({ createdBy: 'ai', locked: false, tags: [] }),
  zIndex: z.number().optional(),
});

export type Card = z.infer<typeof cardSchema>;

// ---------------------------------------------------------------------------
// Edge
// ---------------------------------------------------------------------------

export const canvasEdgeSchema = z.object({
  id: nonDbIdSchema('CanvasEdge'),
  source: nonDbIdSchema('CanvasCard'),
  target: nonDbIdSchema('CanvasCard'),
  label: z.string().optional(),
  strokeWidth: z.number().default(2),
});

export type CanvasEdge = z.infer<typeof canvasEdgeSchema>;

// ---------------------------------------------------------------------------
// Canvas State (root)
// ---------------------------------------------------------------------------

export const canvasStateSchema = z.object({
  version: z.literal(1),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }),
  cards: z.array(cardSchema),
  edges: z.array(canvasEdgeSchema).default([]),
});

export type CanvasState = z.infer<typeof canvasStateSchema>;
