import { Box } from '@mui/material';

import { AccordionComponent } from './components/AccordionComponent';
import { BookmarkComponent } from './components/BookmarkComponent';
import { CalloutComponent } from './components/CalloutComponent';
import { ChartComponent } from './components/ChartComponent';
import { ChecklistComponent } from './components/ChecklistComponent';
import { CitationList } from './components/CitationList';
import { CodeComponent } from './components/CodeComponent';
import { ComparisonComponent } from './components/ComparisonComponent';
import { DocumentLinkComponent } from './components/DocumentLinkComponent';
import { FunnelComponent } from './components/FunnelComponent';
import { HeaderComponent } from './components/HeaderComponent';
import { ImageComponent } from './components/ImageComponent';
import { JsonComponent } from './components/JsonComponent';
import { KanbanComponent } from './components/KanbanComponent';
import { KeyValueComponent } from './components/KeyValueComponent';
import { KpiRowComponent } from './components/KpiRowComponent';
import { LinkListComponent } from './components/LinkListComponent';
import { MatrixComponent } from './components/MatrixComponent';
import { NumberComponent } from './components/NumberComponent';
import { ProgressComponent } from './components/ProgressComponent';
import { ProsConsComponent } from './components/ProsConsComponent';
import { QuoteComponent } from './components/QuoteComponent';
import { RatingComponent } from './components/RatingComponent';
import { SearchFilterComponent } from './components/SearchFilterComponent';
import { SourceLinkComponent } from './components/SourceLinkComponent';
import { StatusListComponent } from './components/StatusListComponent';
import { StickyNoteComponent } from './components/StickyNoteComponent';
import { SummaryComponent } from './components/SummaryComponent';
import { SwotComponent } from './components/SwotComponent';
import { TableComponent } from './components/TableComponent';
import { TagCloudComponent } from './components/TagCloudComponent';
import { TextComponent } from './components/TextComponent';
import { TimelineComponent } from './components/TimelineComponent';
import { TopicMapComponent } from './components/TopicMapComponent';

import { type NonDbId, nonDbIdSchema } from '@grabdy/common';

const parseComponentId = nonDbIdSchema('CanvasComponent').parse;
import type { ComponentNode } from '@grabdy/contracts';

type OnComponentSave = (cardId: NonDbId<'CanvasCard'>, componentId: NonDbId<'CanvasComponent'>, data: Record<string, unknown>) => void;

function renderComponentInner(
  node: ComponentNode,
  onSave?: (data: Record<string, unknown>) => void,
) {
  switch (node.type) {
    case 'table':
      return <TableComponent data={node.data} onSave={onSave} />;
    case 'chart':
      return <ChartComponent data={node.data} onSave={onSave} />;
    case 'summary':
      return <SummaryComponent data={node.data} onSave={onSave} />;
    case 'text':
      return <TextComponent data={node.data} onSave={onSave} />;
    case 'source_link':
      return <SourceLinkComponent data={node.data} />;
    case 'document_link':
      return <DocumentLinkComponent data={node.data} />;
    case 'search_filter':
      return <SearchFilterComponent data={node.data} />;
    case 'topic_map':
      return <TopicMapComponent data={node.data} onSave={onSave} />;
    case 'bookmark':
      return <BookmarkComponent data={node.data} onSave={onSave} />;
    case 'checklist':
      return <ChecklistComponent data={node.data} onSave={onSave} />;
    case 'progress':
      return <ProgressComponent data={node.data} onSave={onSave} />;
    case 'alert':
      return <CalloutComponent data={node.data} onSave={onSave} />;
    case 'code':
      return <CodeComponent data={node.data} onSave={onSave} />;
    case 'image':
      return <ImageComponent data={node.data} onSave={onSave} />;
    case 'quote':
      return <QuoteComponent data={node.data} onSave={onSave} />;
    case 'kpi_row':
      return <KpiRowComponent data={node.data} onSave={onSave} />;
    case 'rating':
      return <RatingComponent data={node.data} onSave={onSave} />;
    case 'timeline':
      return <TimelineComponent data={node.data} onSave={onSave} />;
    case 'comparison':
      return <ComparisonComponent data={node.data} onSave={onSave} />;
    case 'swot':
      return <SwotComponent data={node.data} onSave={onSave} />;
    case 'funnel':
      return <FunnelComponent data={node.data} onSave={onSave} />;
    case 'status_list':
      return <StatusListComponent data={node.data} onSave={onSave} />;
    case 'link_list':
      return <LinkListComponent data={node.data} onSave={onSave} />;
    case 'number':
      return <NumberComponent data={node.data} onSave={onSave} />;
    case 'sticky_note':
      return <StickyNoteComponent data={node.data} onSave={onSave} />;
    case 'json':
      return <JsonComponent data={node.data} onSave={onSave} />;
    case 'key_value':
      return <KeyValueComponent data={node.data} onSave={onSave} />;
    case 'pros_cons':
      return <ProsConsComponent data={node.data} onSave={onSave} />;
    case 'tag_cloud':
      return <TagCloudComponent data={node.data} onSave={onSave} />;
    case 'accordion':
      return <AccordionComponent data={node.data} onSave={onSave} />;
    case 'header':
      return <HeaderComponent data={node.data} onSave={onSave} />;
    case 'kanban':
      return <KanbanComponent data={node.data} onSave={onSave} />;
    case 'matrix':
      return <MatrixComponent data={node.data} onSave={onSave} />;
    default:
      return null;
  }
}

export function renderComponent(
  node: ComponentNode,
  cardId?: NonDbId<'CanvasCard'>,
  onComponentEdit?: OnComponentSave,
) {
  const onSave = cardId && onComponentEdit
    ? (data: Record<string, unknown>) => onComponentEdit(cardId, parseComponentId(node.id), data)
    : undefined;

  const componentContent = renderComponentInner(node, onSave);
  const nodeCitations = 'citations' in node ? node.citations : undefined;

  if (nodeCitations && nodeCitations.length > 0) {
    return (
      <Box sx={{ px: 0.5, pb: 0.5 }}>
        {componentContent}
        <Box sx={{ px: 1 }}>
          <CitationList citations={nodeCitations} />
        </Box>
      </Box>
    );
  }

  return componentContent;
}
