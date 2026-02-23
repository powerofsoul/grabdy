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
  usage: string;
  dataSchema: z.ZodType;
}

export const COMPONENT_DEFINITIONS = {
  table: {
    category: 'data',
    usage: 'use for ANY structured data',
    dataSchema: z
      .object({
        columns: z.array(z.object({ key: z.string(), label: z.string() })),
        rows: z.array(z.record(z.string(), z.unknown())),
      })
      .describe('Table with columns and rows. Row keys must match column keys.'),
  },
  chart: {
    category: 'data',
    usage: 'use for ANY numbers that can be compared',
    dataSchema: z
      .object({
        chartType: z.enum(['bar', 'line', 'pie']),
        labels: z.array(z.string()),
        datasets: z.array(
          z.object({
            label: z.string(),
            data: z.array(z.number()),
            color: z.string().optional(),
          })
        ),
      })
      .describe('Chart with labeled datasets'),
  },
  kpi_row: {
    category: 'data',
    usage: 'row of 2-5 KPIs side by side, great for dashboards',
    dataSchema: z
      .object({
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
      })
      .describe('Row of KPI metrics'),
  },
  progress: {
    category: 'data',
    usage: 'progress/completion bar',
    dataSchema: z
      .object({
        value: z.number(),
        max: z.number().default(100),
        label: z.string(),
        sublabel: z.string().optional(),
        color: z.string().optional(),
        showPercent: z.boolean().default(true),
        size: z.enum(['sm', 'md', 'lg']).default('md'),
      })
      .describe('Progress bar'),
  },
  comparison: {
    category: 'data',
    usage: 'side-by-side comparison table',
    dataSchema: z
      .object({
        items: z.array(z.string()),
        attributes: z.array(
          z.object({
            name: z.string(),
            values: z.array(z.string()),
          })
        ),
        highlightBest: z.boolean().default(false),
      })
      .describe('Side-by-side comparison of items across attributes'),
  },
  number: {
    category: 'data',
    usage: 'single big number display',
    dataSchema: z
      .object({
        value: z.union([z.number(), z.string()]),
        prefix: z.string().optional(),
        suffix: z.string().optional(),
        color: z.string().optional(),
        size: z.enum(['sm', 'md', 'lg']).default('md'),
      })
      .describe('Single number display'),
  },
  rating: {
    category: 'data',
    usage: 'rating display with multiple variants',
    dataSchema: z
      .object({
        items: z.array(
          z.object({
            label: z.string(),
            value: z.number(),
            max: z.number().default(5),
            color: z.string().optional(),
          })
        ),
        variant: z.enum(['stars', 'bars', 'dots']).default('bars'),
      })
      .describe('Rating display'),
  },
  funnel: {
    category: 'data',
    usage: 'funnel/conversion visualization',
    dataSchema: z
      .object({
        steps: z.array(
          z.object({
            label: z.string(),
            value: z.number(),
            color: z.string().optional(),
          })
        ),
      })
      .describe('Funnel visualization'),
  },
  swot: {
    category: 'analysis',
    usage: '2x2 SWOT grid',
    dataSchema: z
      .object({
        strengths: z.array(z.string()),
        weaknesses: z.array(z.string()),
        opportunities: z.array(z.string()),
        threats: z.array(z.string()),
      })
      .describe('SWOT analysis grid'),
  },
  topic_map: {
    category: 'analysis',
    usage: 'mind map for topic overviews',
    dataSchema: z
      .object({
        centralTopic: z.string(),
        branches: z.array(
          z.object({
            label: z.string(),
            children: z.array(z.string()).optional(),
          })
        ),
      })
      .describe('Mind map with central topic and branches'),
  },
  timeline: {
    category: 'analysis',
    usage: 'event/process timeline',
    dataSchema: z
      .object({
        events: z.array(
          z.object({
            title: z.string(),
            description: z.string().optional(),
            date: z.string().optional(),
            status: z.enum(['completed', 'in_progress', 'pending']).default('pending'),
            color: z.string().optional(),
          })
        ),
      })
      .describe('Timeline of events'),
  },
  checklist: {
    category: 'analysis',
    usage: 'actionable checklist with progress',
    dataSchema: z
      .object({
        title: z.string().optional(),
        items: z.array(
          z.object({
            label: z.string(),
            checked: z.boolean().default(false),
            indent: z.number().optional(),
          })
        ),
        color: z.string().optional(),
      })
      .describe('Checklist with items'),
  },
  matrix: {
    category: 'analysis',
    usage: '2x2 matrix/quadrant analysis',
    dataSchema: z
      .object({
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
      })
      .describe('2x2 matrix analysis'),
  },
  kanban: {
    category: 'analysis',
    usage: 'kanban board for workflow/task tracking',
    dataSchema: z
      .object({
        columns: z.array(z.object({ title: z.string(), items: z.array(z.string()) })),
      })
      .describe('Kanban board'),
  },
  pros_cons: {
    category: 'analysis',
    usage: 'pros and cons list',
    dataSchema: z
      .object({
        pros: z.array(z.string()),
        cons: z.array(z.string()),
      })
      .describe('Pros and cons list'),
  },
  status_list: {
    category: 'analysis',
    usage: 'status overview list',
    dataSchema: z
      .object({
        items: z.array(
          z.object({
            label: z.string(),
            status: z.enum(['success', 'warning', 'error', 'info', 'neutral']),
            description: z.string().optional(),
          })
        ),
      })
      .describe('Status list'),
  },
  text: {
    category: 'content',
    usage: 'text block with formatting options',
    dataSchema: z
      .object({
        content: z.string(),
        fontSize: z.number().optional(),
        color: z.string().optional(),
        align: z.enum(['left', 'center', 'right']).optional(),
      })
      .describe('Text block (content is markdown)'),
  },
  summary: {
    category: 'content',
    usage: 'key takeaways with optional emoji icon',
    dataSchema: z
      .object({
        content: z.string(),
        icon: z.string().optional(),
      })
      .describe('Summary (content is markdown)'),
  },
  quote: {
    category: 'content',
    usage: 'highlighted quote with attribution',
    dataSchema: z
      .object({
        text: z.string(),
        source: z.string().optional(),
        color: z.string().optional(),
      })
      .describe('Quote with attribution'),
  },
  alert: {
    category: 'content',
    usage: 'alert/notice box',
    dataSchema: z
      .object({
        variant: z.enum(['info', 'success', 'warning', 'error']).default('info'),
        title: z.string().optional(),
        message: z.string(),
        icon: z.string().optional(),
      })
      .describe('Alert box'),
  },
  code: {
    category: 'content',
    usage: 'code block with copy button',
    dataSchema: z
      .object({
        code: z.string(),
        language: z.string().optional(),
        title: z.string().optional(),
        showLineNumbers: z.boolean().default(false),
      })
      .describe('Code block'),
  },
  bookmark: {
    category: 'content',
    usage: 'key points to remember',
    dataSchema: z
      .object({
        label: z.string(),
        note: z.string().optional(),
      })
      .describe('Bookmark'),
  },
  sticky_note: {
    category: 'content',
    usage: 'quick note card',
    dataSchema: z
      .object({
        content: z.string(),
        color: z.enum(['yellow', 'pink', 'blue', 'green', 'purple', 'orange']).default('yellow'),
      })
      .describe('Sticky note'),
  },
  header: {
    category: 'content',
    usage: 'section header',
    dataSchema: z
      .object({
        title: z.string(),
        subtitle: z.string().optional(),
        align: z.enum(['left', 'center', 'right']).optional(),
      })
      .describe('Section header'),
  },
  accordion: {
    category: 'content',
    usage: 'collapsible sections',
    dataSchema: z
      .object({
        sections: z.array(
          z.object({
            title: z.string(),
            content: z.string(),
            defaultOpen: z.boolean().optional(),
          })
        ),
      })
      .describe('Collapsible accordion sections'),
  },
  json: {
    category: 'content',
    usage: 'raw JSON viewer',
    dataSchema: z
      .object({
        content: z.string(),
      })
      .describe('JSON viewer'),
  },
  key_value: {
    category: 'content',
    usage: 'key-value pair display',
    dataSchema: z
      .object({
        pairs: z.array(z.object({ key: z.string(), value: z.string() })),
      })
      .describe('Key-value pairs'),
  },
  tag_cloud: {
    category: 'content',
    usage: 'tag/keyword cloud',
    dataSchema: z
      .object({
        tags: z.array(z.object({ label: z.string(), color: z.string().optional() })),
      })
      .describe('Tag cloud'),
  },
  link_list: {
    category: 'content',
    usage: 'list of clickable links',
    dataSchema: z
      .object({
        links: z.array(
          z.object({
            label: z.string(),
            url: z.string(),
            description: z.string().optional(),
          })
        ),
      })
      .describe('Link list'),
  },
  image: {
    category: 'media',
    usage: 'image display',
    dataSchema: z
      .object({
        src: z.string(),
        alt: z.string().optional(),
        caption: z.string().optional(),
        fit: z.enum(['contain', 'cover', 'fill']).default('contain'),
        height: z.number().optional(),
        borderRadius: z.number().optional(),
      })
      .describe('Image display'),
  },
  embed: {
    category: 'media',
    usage: 'embedded iframe content',
    dataSchema: z
      .object({
        url: z.string(),
        height: z.number().default(300),
      })
      .describe('Embedded iframe'),
  },
  source_link: {
    category: 'reference',
    usage: 'document source references — added automatically to cards via the sources field',
    dataSchema: z
      .object({
        sources: z.array(cardSourceSchema),
      })
      .describe('Source references'),
  },
  document_link: {
    category: 'reference',
    usage: 'document references',
    dataSchema: z
      .object({
        documents: z.array(
          z.object({
            name: z.string(),
            dataSourceId: dbIdSchema('DataSource').optional(),
          })
        ),
      })
      .describe('Document references'),
  },
  search_filter: {
    category: 'reference',
    usage: 'show what was searched',
    dataSchema: z
      .object({
        query: z.string(),
        filters: z.array(z.object({ label: z.string(), value: z.string() })),
      })
      .describe('Search filter display'),
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

function schemaToCompactJson(schema: z.ZodType): string {
  try {
    const jsonSchema = z.toJSONSchema(schema);
    // Remove $schema key to save tokens
    const { $schema: _, ...rest } = jsonSchema;
    return JSON.stringify(rest, null, 0);
  } catch {
    // Some schemas contain transforms (e.g. dbIdSchema) that can't be serialized
    return schema.description ?? '(see usage)';
  }
}

export function generateComponentPrompt(): string {
  const grouped = new Map<ComponentCategory, string[]>();

  for (const [type, def] of Object.entries(COMPONENT_DEFINITIONS)) {
    const typedDef = def satisfies ComponentDefinition;
    const lines = grouped.get(typedDef.category) ?? [];
    const schemaStr = schemaToCompactJson(typedDef.dataSchema);
    lines.push(`- **${type}** — ${typedDef.usage}\n  data schema: \`${schemaStr}\``);
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
  return `### Component types — ONLY use these (STRICT):
Allowed types: ${allTypes}
Using ANY type not in this list will fail. NEVER invent custom component types.
**The \`data\` object must EXACTLY match the JSON schema shown below. Use the exact field names — wrong field names cause validation errors.**

${sections.join('\n\n')}`;
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
