export type TableDirection = 'rtl' | 'ltr';

export type ImageEnhancementMode = 'auto' | 'document' | 'none';

export interface UncertainCell {
  row: number; // 0-based body row index (-1 for header row)
  col: number; // 0-based column index
  reason: string;
}

export interface ExtractedTable {
  id: string;
  title: string;
  detectedDirection: TableDirection;
  headers: string[];
  rows: string[][];
  notes?: string;
  uncertainCells?: UncertainCell[];
}

export interface ExtractionOptions {
  normalizeDigits: boolean;
  multiTable: boolean;
  preferredDirection: 'auto' | 'rtl' | 'ltr';
  enhancementMode: ImageEnhancementMode;
  highAccuracyMode: boolean;
  customInstruction: string;
}

export interface ExtractionResponse {
  tables: ExtractedTable[];
  summary: string;
}

export interface HistoryItem {
  id: string;
  fileName: string;
  createdAt: string;
  thumbnailDataUrl: string;
  tables: ExtractedTable[];
  summary: string;
}
