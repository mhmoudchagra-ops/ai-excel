import * as XLSX from 'xlsx';
import type { ExtractedTable } from '../types/table';

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function toWesternDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/٬/g, ',');
}

export function parseNumericCell(value: string): number | null {
  const normalized = toWesternDigits(value).trim();
  if (!normalized) return null;

  // Strip common currency labels / symbols and spaces, keep leading minus and decimal dot
  const cleaned = normalized
    .replace(/[,،\s]/g, '')
    .replace(/(ر\.س|ريال|د\.إ|ج\.م|د\.ك|SAR|USD|EUR|AED|EGP|\$|€|£|٪|%)/gi, '')
    .trim();

  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return null;
  }

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function sanitizeSheetName(name: string, usedNames: Set<string>, fallbackIndex: number): string {
  // Excel sheet names cannot contain \ / ? * [ ] : and max length is 31
  let clean = name.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) {
    clean = `جدول ${fallbackIndex + 1}`;
  }
  clean = clean.slice(0, 31).trim();

  let candidate = clean;
  let counter = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    const suffix = ` (${counter})`;
    candidate = `${clean.slice(0, 31 - suffix.length)}${suffix}`;
    counter++;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function buildWorksheet(table: ExtractedTable, parseNumbers: boolean): XLSX.WorkSheet {
  const aoa: Array<Array<string | number>> = [
    table.headers,
    ...table.rows.map((row) =>
      row.map((cell) => {
        if (parseNumbers) {
          const parsed = parseNumericCell(cell);
          // Avoid converting codes with leading zeros like "00412" or phone numbers > 12 digits
          const trimmed = toWesternDigits(cell).trim();
          const hasLeadingZero = /^0\d+/.test(trimmed);
          if (parsed !== null && !hasLeadingZero && trimmed.length <= 12) {
            return parsed;
          }
        }
        return cell;
      })
    ),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Set RTL view in Excel when table direction is RTL
  ws['!views'] = [{ rightToLeft: table.detectedDirection === 'rtl' }];

  // Auto-calculate generous column widths so Arabic & numeric text are readable in Excel
  const colWidths = table.headers.map((header, colIdx) => {
    let maxLen = header.length;
    for (const row of table.rows) {
      const cellStr = row[colIdx] ?? '';
      if (cellStr.length > maxLen) {
        maxLen = cellStr.length;
      }
    }
    return { wch: Math.min(Math.max(maxLen + 5, 12), 45) };
  });
  ws['!cols'] = colWidths;

  return ws;
}

export function exportTablesToXlsx(
  tables: ExtractedTable[],
  fileNameBase: string,
  parseNumbers = true
): void {
  if (tables.length === 0) return;

  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  tables.forEach((table, idx) => {
    const ws = buildWorksheet(table, parseNumbers);
    const sheetName = sanitizeSheetName(table.title, usedNames, idx);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const safeFileBase =
    fileNameBase.replace(/\.[^/.]+$/, '').replace(/[\\/:*?"<>|]/g, '_') || 'جدول_مستخرج';
  XLSX.writeFile(wb, `${safeFileBase}.xlsx`);
}

function escapeCsvCell(val: string): string {
  const needsQuotes = /[",\n\r]/.test(val);
  const escaped = val.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export function exportTableToCsv(table: ExtractedTable, fileNameBase: string): void {
  const lines = [
    table.headers.map(escapeCsvCell).join(','),
    ...table.rows.map((row) => row.map((c) => escapeCsvCell(c ?? '')).join(',')),
  ];
  // Add UTF-8 BOM (\uFEFF) so Microsoft Excel opens Arabic CSV cleanly without mojibake
  const csvContent = `\uFEFF${lines.join('\r\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const safeFileBase =
    fileNameBase.replace(/\.[^/.]+$/, '').replace(/[\\/:*?"<>|]/g, '_') || table.title || 'جدول';
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileBase}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function copyTableAsTsv(table: ExtractedTable): Promise<void> {
  const lines = [
    table.headers.map((h) => h.replace(/\t/g, ' ')).join('\t'),
    ...table.rows.map((row) => row.map((c) => (c ?? '').replace(/\t/g, ' ')).join('\t')),
  ];
  await navigator.clipboard.writeText(lines.join('\n'));
}

export function transposeTable(table: ExtractedTable): ExtractedTable {
  const matrix: string[][] = [table.headers, ...table.rows];
  const rowCount = matrix.length;
  const colCount = table.headers.length;

  const transposed: string[][] = Array.from({ length: colCount }, (_, c) =>
    Array.from({ length: rowCount }, (_, r) => matrix[r]?.[c] ?? '')
  );

  const [newHeaders = [], ...newRows] = transposed;
  return {
    ...table,
    headers: newHeaders,
    rows: newRows,
  };
}

export function columnLetter(index: number): string {
  let result = '';
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

export function computeColumnStats(rows: string[][], colIdx: number): {
  numericCount: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
} | null {
  const nums: number[] = [];
  for (const row of rows) {
    const val = parseNumericCell(row[colIdx] ?? '');
    if (val !== null) {
      nums.push(val);
    }
  }
  if (nums.length === 0) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return {
    numericCount: nums.length,
    sum,
    avg: sum / nums.length,
    min: Math.min(...nums),
    max: Math.max(...nums),
  };
}
