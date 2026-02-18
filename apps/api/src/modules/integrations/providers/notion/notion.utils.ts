import type { ListBlockChildrenResponse } from '@notionhq/client/build/src/api-endpoints';

type BlockObject = ListBlockChildrenResponse['results'][number];

export function extractRichText(richText: Array<{ plain_text: string }>): string {
  return richText.map((t) => t.plain_text).join('');
}

export function blockToText(block: BlockObject): string {
  if (!('type' in block)) return '';

  switch (block.type) {
    case 'paragraph':
      return extractRichText(block.paragraph.rich_text);
    case 'quote':
      return extractRichText(block.quote.rich_text);
    case 'callout':
      return extractRichText(block.callout.rich_text);
    case 'heading_1':
      return '# ' + extractRichText(block.heading_1.rich_text);
    case 'heading_2':
      return '## ' + extractRichText(block.heading_2.rich_text);
    case 'heading_3':
      return '### ' + extractRichText(block.heading_3.rich_text);
    case 'bulleted_list_item':
      return '- ' + extractRichText(block.bulleted_list_item.rich_text);
    case 'numbered_list_item':
      return '- ' + extractRichText(block.numbered_list_item.rich_text);
    case 'to_do': {
      const check = block.to_do.checked ? '[x]' : '[ ]';
      return `${check} ${extractRichText(block.to_do.rich_text)}`;
    }
    case 'toggle':
      return extractRichText(block.toggle.rich_text);
    case 'code':
      return `\`\`\`${block.code.language}\n${extractRichText(block.code.rich_text)}\n\`\`\``;
    case 'divider':
      return '---';
    case 'table_row':
      return block.table_row.cells.map((cell) => extractRichText(cell)).join(' | ');
    case 'child_page':
      return `[Child Page: ${block.child_page.title}]`;
    case 'child_database':
      return `[Child Database: ${block.child_database.title}]`;
    case 'image':
    case 'video':
    case 'file':
    case 'pdf':
    case 'bookmark':
    case 'embed':
      return `[${block.type}]`;
    default:
      return '';
  }
}
