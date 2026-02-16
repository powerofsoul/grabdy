import { type NonDbId, nonDbIdSchema } from '@grabdy/common';
import { type ChatSource, chatSourceSchema } from '@grabdy/contracts';

import { SourceChips } from '../chat/components/source-chips';

import { AccordionComponent } from './components/AccordionComponent';
import { BookmarkComponent } from './components/BookmarkComponent';
import { CalloutComponent } from './components/callout';
import { ChartComponent } from './components/chart';
import { ChecklistComponent } from './components/ChecklistComponent';
import { CodeComponent } from './components/code';
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
import { MatrixComponent } from './components/matrix';
import { NumberComponent } from './components/number';
import { ProgressComponent } from './components/ProgressComponent';
import { ProsConsComponent } from './components/ProsConsComponent';
import { QuoteComponent } from './components/QuoteComponent';
import { RatingComponent } from './components/RatingComponent';
import { SearchFilterComponent } from './components/SearchFilterComponent';
import { StatusListComponent } from './components/status-list';
import { StickyNoteComponent } from './components/sticky-note';
import { SummaryComponent } from './components/SummaryComponent';
import { SwotComponent } from './components/SwotComponent';
import { TableComponent } from './components/TableComponent';
import { TagCloudComponent } from './components/TagCloudComponent';
import { TextComponent } from './components/TextComponent';
import { TimelineComponent } from './components/TimelineComponent';
import { TopicMapComponent } from './components/TopicMapComponent';

const parseComponentId = nonDbIdSchema('CanvasComponent').parse;
import type { ComponentNode } from '@grabdy/contracts';

type OnComponentSave = (
  cardId: NonDbId<'CanvasCard'>,
  componentId: NonDbId<'CanvasComponent'>,
  data: Record<string, unknown>
) => void;

export function renderComponent(
  node: ComponentNode,
  cardId?: NonDbId<'CanvasCard'>,
  onComponentEdit?: OnComponentSave
) {
  const onSave =
    cardId && onComponentEdit
      ? (data: Record<string, unknown>) => onComponentEdit(cardId, parseComponentId(node.id), data)
      : undefined;

  switch (node.type) {
    case 'table':
      return <TableComponent data={node.data} onSave={onSave} />;
    case 'chart':
      return <ChartComponent data={node.data} onSave={onSave} />;
    case 'summary':
      return <SummaryComponent data={node.data} onSave={onSave} />;
    case 'text':
      return <TextComponent data={node.data} onSave={onSave} />;
    case 'source_link': {
      const chatSources: ChatSource[] = [];
      for (const s of node.data.sources) {
        if (!s.dataSourceId) continue;
        const t = s.type ?? 'TXT';
        const base = {
          dataSourceId: s.dataSourceId,
          dataSourceName: s.name,
          score: s.score ?? 0,
          type: t,
          sourceUrl: s.sourceUrl,
        };
        let full: Record<string, unknown> = base;
        if (t === 'PDF' || t === 'DOCX') {
          full = { ...base, pages: s.pages ?? [] };
        } else if (t === 'XLSX') {
          full = { ...base, sheet: s.sheet ?? '', rows: s.rows ?? [], columns: s.columns ?? [] };
        } else if (t === 'CSV') {
          full = { ...base, rows: s.rows ?? [], columns: s.columns ?? [] };
        }
        const parsed = chatSourceSchema.safeParse(full);
        if (parsed.success) chatSources.push(parsed.data);
      }
      return chatSources.length > 0 ? <SourceChips sources={chatSources} /> : null;
    }
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
