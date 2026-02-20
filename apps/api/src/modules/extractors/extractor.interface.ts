export interface PageText {
  page: number;
  text: string;
}

export interface SheetRow {
  row: number;
  text: string;
}

export interface SheetData {
  sheet: string;
  columns: string[];
  rows: SheetRow[];
}

export type ExtractionResult =
  | { type: 'pages'; text: string; pages: PageText[] }
  | { type: 'sheets'; text: string; sheets: SheetData[] }
  | { type: 'rows'; text: string; columns: string[]; rows: SheetRow[] }
  | { type: 'text'; text: string };
