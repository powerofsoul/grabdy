import { useCallback, useState } from 'react';

import { packNonDbId } from '@grabdy/common';
import type { Card } from '@grabdy/contracts';
import { alpha, Box, IconButton, Popover, Tooltip, Typography, useTheme } from '@mui/material';
import {
  ArrowsInSimpleIcon,
  BookmarkSimpleIcon,
  ChartBarIcon,
  CheckSquareIcon,
  ClockIcon,
  CodeSimpleIcon,
  ColumnsIcon,
  CrosshairIcon,
  FileJsIcon,
  FunnelIcon,
  GaugeIcon,
  GridNineIcon,
  HashIcon,
  ImageSquareIcon,
  LinkSimpleIcon,
  ListChecksIcon,
  NoteIcon,
  PaletteIcon,
  QuotesIcon,
  SquaresFourIcon,
  StarIcon,
  TableIcon,
  TagIcon,
  TextHOneIcon,
  TextTIcon,
  ThumbsUpIcon,
  WarningIcon,
} from '@phosphor-icons/react';
import { Panel } from '@xyflow/react';

import { useAuth } from '../../context/AuthContext';

const COMPONENT_TEMPLATES = {
  table: {
    type: 'table' as const,
    data: {
      columns: [
        { key: 'col1', label: 'Column 1' },
        { key: 'col2', label: 'Column 2' },
      ],
      rows: [{ col1: 'Value 1', col2: 'Value 2' }],
    },
  },
  chart: {
    type: 'chart' as const,
    data: {
      chartType: 'bar' as const,
      labels: ['A', 'B', 'C'],
      datasets: [{ label: 'Series 1', data: [10, 20, 30] }],
    },
  },
  text: {
    type: 'text' as const,
    data: { content: 'Click to edit...' },
  },
  summary: {
    type: 'summary' as const,
    data: { content: 'Summary content here...' },
  },
  bookmark: {
    type: 'bookmark' as const,
    data: { label: 'New Bookmark' },
  },
  topic_map: {
    type: 'topic_map' as const,
    data: {
      centralTopic: 'New Topic',
      branches: [{ label: 'Branch 1', children: ['Item 1'] }],
    },
  },
  checklist: {
    type: 'checklist' as const,
    data: {
      items: [
        { label: 'First item', checked: false },
        { label: 'Second item', checked: false },
        { label: 'Third item', checked: false },
      ],
    },
  },
  progress: {
    type: 'progress' as const,
    data: {
      value: 65,
      max: 100,
      label: 'Progress',
      showPercent: true,
      size: 'md' as const,
    },
  },
  alert: {
    type: 'alert' as const,
    data: {
      variant: 'info' as const,
      title: 'Note',
      message: 'Important information here...',
    },
  },
  code: {
    type: 'code' as const,
    data: {
      code: '// Your code here\nconsole.log("Hello");',
      language: 'javascript',
      showLineNumbers: true,
    },
  },
  image: {
    type: 'image' as const,
    data: {
      src: '',
      alt: 'Image',
      fit: 'contain' as const,
      height: 200,
    },
  },
  quote: {
    type: 'quote' as const,
    data: {
      text: 'Add your quote here...',
      source: 'Source',
    },
  },
  kpi_row: {
    type: 'kpi_row' as const,
    data: {
      metrics: [
        { value: '0', label: 'KPI 1' },
        { value: '0', label: 'KPI 2' },
        { value: '0', label: 'KPI 3' },
      ],
    },
  },
  rating: {
    type: 'rating' as const,
    data: {
      items: [
        { label: 'Quality', value: 4, max: 5 },
        { label: 'Speed', value: 3, max: 5 },
      ],
      variant: 'bars' as const,
    },
  },
  timeline: {
    type: 'timeline' as const,
    data: {
      events: [
        { title: 'Step 1', status: 'completed' as const },
        { title: 'Step 2', status: 'in_progress' as const },
        { title: 'Step 3', status: 'pending' as const },
      ],
    },
  },
  comparison: {
    type: 'comparison' as const,
    data: {
      items: ['Option A', 'Option B'],
      attributes: [
        { name: 'Price', values: ['$10', '$20'] },
        { name: 'Rating', values: ['4.5', '3.8'] },
      ],
      highlightBest: true,
    },
  },
  swot: {
    type: 'swot' as const,
    data: {
      strengths: ['Strength 1'],
      weaknesses: ['Weakness 1'],
      opportunities: ['Opportunity 1'],
      threats: ['Threat 1'],
    },
  },
  sticky_note: {
    type: 'sticky_note' as const,
    data: { content: 'Type here...', color: 'yellow' as const },
  },
  json: {
    type: 'json' as const,
    data: { content: '{\n  "key": "value",\n  "count": 42\n}' },
  },
  key_value: {
    type: 'key_value' as const,
    data: {
      pairs: [
        { key: 'KeyIcon 1', value: 'Value 1' },
        { key: 'KeyIcon 2', value: 'Value 2' },
      ],
    },
  },
  pros_cons: {
    type: 'pros_cons' as const,
    data: {
      pros: ['Pro 1', 'Pro 2'],
      cons: ['Con 1', 'Con 2'],
    },
  },
  tag_cloud: {
    type: 'tag_cloud' as const,
    data: {
      tags: [
        { label: 'TagIcon 1' },
        { label: 'TagIcon 2' },
        { label: 'TagIcon 3' },
      ],
    },
  },
  accordion: {
    type: 'accordion' as const,
    data: {
      sections: [
        { title: 'Section 1', content: 'Content here...', defaultOpen: true },
        { title: 'Section 2', content: 'More content...' },
      ],
    },
  },
  header: {
    type: 'header' as const,
    data: { title: 'Section Title', subtitle: 'Optional subtitle', align: 'left' as const },
  },
  kanban: {
    type: 'kanban' as const,
    data: {
      columns: [
        { title: 'To Do', items: ['Task 1', 'Task 2'] },
        { title: 'In Progress', items: ['Task 3'] },
        { title: 'Done', items: ['Task 4'] },
      ],
    },
  },
  matrix: {
    type: 'matrix' as const,
    data: {
      labels: { topLeft: 'Q1', topRight: 'Q2', bottomLeft: 'Q3', bottomRight: 'Q4' },
      quadrants: {
        topLeft: ['Item 1'],
        topRight: ['Item 2'],
        bottomLeft: ['Item 3'],
        bottomRight: ['Item 4'],
      },
    },
  },
  funnel: {
    type: 'funnel' as const,
    data: {
      steps: [
        { label: 'Visitors', value: 1000 },
        { label: 'Leads', value: 500 },
        { label: 'Customers', value: 100 },
      ],
    },
  },
  status_list: {
    type: 'status_list' as const,
    data: {
      items: [
        { label: 'Service A', status: 'success' as const },
        { label: 'Service B', status: 'warning' as const },
        { label: 'Service C', status: 'error' as const },
      ],
    },
  },
  link_list: {
    type: 'link_list' as const,
    data: {
      links: [
        { label: 'Documentation', url: 'https://example.com', description: 'Project docs' },
        { label: 'Repository', url: 'https://github.com' },
      ],
    },
  },
  number: {
    type: 'number' as const,
    data: { value: 42, size: 'md' as const },
  },
};

type ComponentType = keyof typeof COMPONENT_TEMPLATES;

type ToolbarItem = { type: ComponentType; icon: typeof TableIcon; label: string };

const PRIMARY_ITEMS: ToolbarItem[] = [
  { type: 'text', icon: TextTIcon, label: 'Text' },
  { type: 'sticky_note', icon: NoteIcon, label: 'Sticky Note' },
  { type: 'table', icon: TableIcon, label: 'Table' },
  { type: 'chart', icon: ChartBarIcon, label: 'Chart' },
  { type: 'checklist', icon: CheckSquareIcon, label: 'Checklist' },
  { type: 'code', icon: CodeSimpleIcon, label: 'Code' },
  { type: 'alert', icon: WarningIcon, label: 'Alert' },
];

const SECONDARY_ITEMS: ToolbarItem[] = [
  // Row 1: Numbers & metrics
  { type: 'kpi_row', icon: ColumnsIcon, label: 'KPI Row' },
  { type: 'number', icon: HashIcon, label: 'Number' },
  { type: 'progress', icon: GaugeIcon, label: 'Progress' },
  { type: 'funnel', icon: FunnelIcon, label: 'Funnel' },
  // Row 2: Lists & data
  { type: 'summary', icon: ListChecksIcon, label: 'Summary' },
  { type: 'key_value', icon: ListChecksIcon, label: 'Key-Value' },
  { type: 'status_list', icon: PaletteIcon, label: 'Status List' },
  { type: 'link_list', icon: LinkSimpleIcon, label: 'Links' },
  { type: 'tag_cloud', icon: TagIcon, label: 'Tags' },
  // Row 3: Boards & comparisons
  { type: 'timeline', icon: ClockIcon, label: 'Timeline' },
  { type: 'kanban', icon: SquaresFourIcon, label: 'Kanban' },
  { type: 'comparison', icon: ColumnsIcon, label: 'Compare' },
  { type: 'matrix', icon: GridNineIcon, label: 'Matrix' },
  { type: 'swot', icon: CrosshairIcon, label: 'SWOT' },
  // Row 4: Content blocks
  { type: 'header', icon: TextHOneIcon, label: 'Header' },
  { type: 'accordion', icon: ArrowsInSimpleIcon, label: 'Accordion' },
  { type: 'pros_cons', icon: ThumbsUpIcon, label: 'Pros/Cons' },
  { type: 'json', icon: FileJsIcon, label: 'JSON' },
  // Row 5: Misc
  { type: 'quote', icon: QuotesIcon, label: 'Quote' },
  { type: 'rating', icon: StarIcon, label: 'Rating' },
  { type: 'image', icon: ImageSquareIcon, label: 'Image' },
  { type: 'bookmark', icon: BookmarkSimpleIcon, label: 'Bookmark' },
];

const SMALL_TYPES = new Set<string>(['progress', 'number', 'header']);
const WIDE_TYPES = new Set<string>(['kpi_row', 'comparison', 'swot', 'table', 'kanban', 'matrix']);

interface CanvasToolbarProps {
  onStartPlacement: (card: Card) => void;
}

export function CanvasToolbar({ onStartPlacement }: CanvasToolbarProps) {
  const theme = useTheme();
  const { user, selectedOrgId } = useAuth();
  const [moreAnchor, setMoreAnchor] = useState<HTMLButtonElement | null>(null);

  const handleAdd = useCallback(
    (type: ComponentType) => {
      if (!selectedOrgId) return;
      const template = COMPONENT_TEMPLATES[type];

      const cardId = packNonDbId('CanvasCard', selectedOrgId);
      const componentId = packNonDbId('CanvasComponent', selectedOrgId);

      const width = SMALL_TYPES.has(type) ? 200 : WIDE_TYPES.has(type) ? 500 : 400;
      const height = SMALL_TYPES.has(type) ? 120 : 300;

      const card: Card = {
        id: cardId,
        position: { x: 0, y: 0 },
        width,
        height,
        title: undefined,
        component: { id: componentId, ...template },
        sources: [],
        metadata: {
          createdBy: user ? { userId: user.id, name: user.name } : 'ai',
          locked: false,
          tags: [],
        },
      };

      onStartPlacement(card);
    },
    [onStartPlacement, user, selectedOrgId],
  );

  const handleSecondaryAdd = useCallback(
    (type: ComponentType) => {
      setMoreAnchor(null);
      handleAdd(type);
    },
    [handleAdd],
  );

  return (
    <Panel position="bottom-center">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.25,
          px: 1,
          py: 0.5,
          borderRadius: 3,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: alpha(theme.palette.text.primary, 0.12),
          boxShadow: `0 2px 8px ${alpha(theme.palette.text.primary, 0.1)}`,
        }}
      >
        {PRIMARY_ITEMS.map(({ type, icon: Icon, label }) => (
          <Tooltip key={type} title={label}>
            <IconButton
              size="small"
              onClick={() => handleAdd(type)}
              sx={{
                width: 30,
                height: 30,
                color: alpha(theme.palette.text.primary, 0.5),
                '&:hover': {
                  color: 'primary.main',
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                },
              }}
            >
              <Icon size={15} weight="light" />
            </IconButton>
          </Tooltip>
        ))}

        <Box
          sx={{
            width: '1px',
            height: 20,
            bgcolor: alpha(theme.palette.text.primary, 0.12),
            mx: 0.5,
          }}
        />

        <Tooltip title="More components">
          <IconButton
            size="small"
            onClick={(e) => setMoreAnchor(e.currentTarget)}
            sx={{
              width: 30,
              height: 30,
              color: moreAnchor
                ? 'primary.main'
                : alpha(theme.palette.text.primary, 0.5),
              bgcolor: moreAnchor
                ? alpha(theme.palette.primary.main, 0.08)
                : 'transparent',
              '&:hover': {
                color: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.08),
              },
            }}
          >
            <GridNineIcon size={15} weight="light" />
          </IconButton>
        </Tooltip>
      </Box>

      <Popover
        open={Boolean(moreAnchor)}
        anchorEl={moreAnchor}
        onClose={() => setMoreAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              mt: -1,
              p: 1.5,
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: alpha(theme.palette.text.primary, 0.12),
              boxShadow: `0 4px 16px ${alpha(theme.palette.text.primary, 0.12)}`,
            },
          },
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 0.5,
          }}
        >
          {SECONDARY_ITEMS.map(({ type, icon: Icon, label }) => (
            <Box
              key={type}
              onClick={() => handleSecondaryAdd(type)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                px: 1.5,
                py: 1,
                borderRadius: 1.5,
                cursor: 'pointer',
                color: alpha(theme.palette.text.primary, 0.6),
                '&:hover': {
                  color: 'primary.main',
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                },
              }}
            >
              <Icon size={18} weight="light" />
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.65rem',
                  lineHeight: 1,
                  color: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Popover>
    </Panel>
  );
}
