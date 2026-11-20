import type { ExtractedTable } from '../types/table';
import { parseNumericCell, toWesternDigits } from './excelExport';

export interface TableDiagnosticReport {
  emptyRowsCount: number;
  duplicateRowsCount: number;
  extraWhitespaceCells: number;
  currencyMixedNumericCells: number;
  uncertainCellsCount: number;
  numericColumnIndices: number[];
}

export function analyzeTableIssues(table: ExtractedTable): TableDiagnosticReport {
  let emptyRowsCount = 0;
  let duplicateRowsCount = 0;
  let extraWhitespaceCells = 0;
  let currencyMixedNumericCells = 0;

  const seenRows = new Set<string>();

  for (const row of table.rows) {
    const isRowEmpty = row.every((cell) => cell.trim() === '');
    if (isRowEmpty) {
      emptyRowsCount++;
    } else {
      const key = row.map((c) => c.trim()).join('\u0001');
      if (seenRows.has(key)) {
        duplicateRowsCount++;
      } else {
        seenRows.add(key);
      }
    }

    for (const cell of row) {
      if (/\s{2,}|\n/.test(cell) || cell !== cell.trim()) {
        extraWhitespaceCells++;
      }
      const trimmed = cell.trim();
      if (
        trimmed &&
        /(ر\.س|ريال|د\.إ|ج\.م|د\.ك|SAR|USD|EUR|AED|EGP|\$|€|£)/i.test(trimmed) &&
        parseNumericCell(trimmed) !== null
      ) {
        currencyMixedNumericCells++;
      }
    }
  }

  const numericColumnIndices: number[] = [];
  for (let c = 0; c < table.headers.length; c++) {
    let numericHits = 0;
    let nonEmpty = 0;
    for (const row of table.rows) {
      const val = (row[c] ?? '').trim();
      if (!val) continue;
      nonEmpty++;
      if (parseNumericCell(val) !== null) numericHits++;
    }
    if (nonEmpty > 0 && numericHits >= Math.ceil(nonEmpty * 0.6)) {
      numericColumnIndices.push(c);
    }
  }

  return {
    emptyRowsCount,
    duplicateRowsCount,
    extraWhitespaceCells,
    currencyMixedNumericCells,
    uncertainCellsCount: table.uncertainCells?.length ?? 0,
    numericColumnIndices,
  };
}

export function fixEmptyAndDuplicateRows(table: ExtractedTable): ExtractedTable {
  const seen = new Set<string>();
  const cleanedRows: string[][] = [];

  for (const row of table.rows) {
    if (row.every((c) => c.trim() === '')) continue;
    const key = row.map((c) => c.trim()).join('\u0001');
    if (seen.has(key)) continue;
    seen.add(key);
    cleanedRows.push(row);
  }

  return {
    ...table,
    rows: cleanedRows,
    uncertainCells: undefined,
  };
}

export function fixWhitespaceAndDigits(table: ExtractedTable): ExtractedTable {
  const cleanCell = (v: string) =>
    toWesternDigits(v).replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  return {
    ...table,
    headers: table.headers.map(cleanCell),
    rows: table.rows.map((row) => row.map(cleanCell)),
  };
}

export function stripCurrencyForNumericCells(table: ExtractedTable): ExtractedTable {
  return {
    ...table,
    rows: table.rows.map((row) =>
      row.map((cell) => {
        const trimmed = cell.trim();
        if (
          trimmed &&
          /(ر\.س|ريال|د\.إ|ج\.م|د\.ك|SAR|USD|EUR|AED|EGP|\$|€|£)/i.test(trimmed)
        ) {
          const parsed = parseNumericCell(trimmed);
          if (parsed !== null) {
            return String(parsed);
          }
        }
        return cell;
      })
    ),
  };
}

export function appendTotalsRow(table: ExtractedTable): ExtractedTable {
  const report = analyzeTableIssues(table);
  if (report.numericColumnIndices.length === 0) return table;

  const newRow = table.headers.map((_, colIdx) => {
    if (colIdx === 0 && !report.numericColumnIndices.includes(0)) {
      return 'الإجمالي';
    }
    if (!report.numericColumnIndices.includes(colIdx)) {
      return '';
    }
    let sum = 0;
    for (const row of table.rows) {
      const val = parseNumericCell(row[colIdx] ?? '');
      if (val !== null) sum += val;
    }
    return Number.isInteger(sum) ? String(sum) : sum.toFixed(2);
  });

  return {
    ...table,
    rows: [...table.rows, newRow],
  };
}
