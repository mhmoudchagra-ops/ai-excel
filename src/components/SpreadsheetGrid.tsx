import React, { useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  Plus,
  Trash2,
  Search,
  ArrowLeftRight,
  Calculator,
  AlertCircle,
  AlertTriangle,
  MessageSquareText,
  Wrench,
  RotateCcw,
} from 'lucide-react';
import type { ExtractedTable } from '../types/table';
import {
  columnLetter,
  computeColumnStats,
  copyTableAsTsv,
  exportTableToCsv,
  exportTablesToXlsx,
  toWesternDigits,
  transposeTable,
} from '../utils/excelExport';
import {
  analyzeTableIssues,
  appendTotalsRow,
  fixEmptyAndDuplicateRows,
  fixWhitespaceAndDigits,
  stripCurrencyForNumericCells,
} from '../utils/tableFixes';

interface SpreadsheetGridProps {
  tables: ExtractedTable[];
  activeTableIndex: number;
  fileName: string;
  summary: string;
  isLoading: boolean;
  error: string | null;
  canUndo: boolean;
  onUndo: () => void;
  onSelectTableIndex: (idx: number) => void;
  onUpdateTable: (idx: number, updated: ExtractedTable) => void;
  onRetryExtract: () => void;
  onOpenAssistant: () => void;
}

export const SpreadsheetGrid: React.FC<SpreadsheetGridProps> = ({
  tables,
  activeTableIndex,
  fileName,
  summary,
  isLoading,
  error,
  canUndo,
  onUndo,
  onSelectTableIndex,
  onUpdateTable,
  onRetryExtract,
  onOpenAssistant,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedColIdx, setSelectedColIdx] = useState<number | null>(null);
  const [showFixBar, setShowFixBar] = useState(false);

  const activeTable = tables[activeTableIndex] ?? null;

  const diagnostic = useMemo(() => {
    if (!activeTable) return null;
    return analyzeTableIssues(activeTable);
  }, [activeTable]);

  const uncertainMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!activeTable?.uncertainCells) return map;
    for (const uc of activeTable.uncertainCells) {
      map.set(`${uc.row}:${uc.col}`, uc.reason);
    }
    return map;
  }, [activeTable]);

  const filteredRowIndices = useMemo(() => {
    if (!activeTable) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return activeTable.rows.map((_, i) => i);
    }
    return activeTable.rows.reduce<number[]>((acc, row, i) => {
      const match = row.some((cell) => cell.toLowerCase().includes(q));
      if (match) acc.push(i);
      return acc;
    }, []);
  }, [activeTable, searchQuery]);

  const colStats = useMemo(() => {
    if (!activeTable || selectedColIdx === null) return null;
    if (selectedColIdx >= activeTable.headers.length) return null;
    return computeColumnStats(activeTable.rows, selectedColIdx);
  }, [activeTable, selectedColIdx]);

  if (isLoading) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-5 w-48 bg-slate-200 rounded animate-pulse" />
            <div className="h-3.5 w-72 bg-slate-100 rounded animate-pulse" />
          </div>
          <div className="h-9 w-36 bg-slate-200 rounded-lg animate-pulse" />
        </div>
        <div className="p-4 space-y-2.5">
          {Array.from({ length: 7 }).map((_, r) => (
            <div key={r} className="grid grid-cols-5 gap-2">
              {Array.from({ length: 5 }).map((__, c) => (
                <div
                  key={c}
                  className={`h-10 rounded ${
                    r === 0 ? 'bg-slate-200' : 'bg-slate-100'
                  } animate-pulse`}
                />
              ))}
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="bg-white border border-red-200 rounded-xl p-8 text-center space-y-4">
        <div className="mx-auto w-11 h-11 rounded-lg bg-red-50 text-red-700 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1.5 max-w-md mx-auto">
          <h3 className="font-display text-lg font-semibold text-slate-900">
            تعذر استخراج الجدول
          </h3>
          <p className="text-sm text-red-700 leading-relaxed">{error}</p>
        </div>
        <div className="flex items-center justify-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onRetryExtract}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <span>إعادة المحاولة</span>
          </button>
          <button
            type="button"
            onClick={onOpenAssistant}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
          >
            <MessageSquareText className="w-4 h-4" />
            <span>استشارة المساعد الذكي</span>
          </button>
        </div>
      </section>
    );
  }

  if (!activeTable) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4">
        <h3 className="font-display text-lg font-semibold text-slate-900">
          لم يتم العثور على جدول في هذه الصورة
        </h3>
        <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          {summary || 'تأكد من أن الصورة تحتوي على جدول واضح الأعمدة والصفوف ثم أعد المحاولة.'}
        </p>
        <button
          type="button"
          onClick={onOpenAssistant}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
        >
          <MessageSquareText className="w-4 h-4" />
          <span>تحليل سبب المشكلة بالمساعد الذكي</span>
        </button>
      </section>
    );
  }

  const updateCell = (rowIdx: number, colIdx: number, value: string) => {
    const nextRows = activeTable.rows.map((r, i) =>
      i === rowIdx ? r.map((c, j) => (j === colIdx ? value : c)) : r
    );
    const nextUncertain = activeTable.uncertainCells?.filter(
      (uc) => !(uc.row === rowIdx && uc.col === colIdx)
    );
    onUpdateTable(activeTableIndex, {
      ...activeTable,
      rows: nextRows,
      uncertainCells: nextUncertain,
    });
  };

  const updateHeader = (colIdx: number, value: string) => {
    const nextHeaders = activeTable.headers.map((h, i) => (i === colIdx ? value : h));
    const nextUncertain = activeTable.uncertainCells?.filter(
      (uc) => !(uc.row === -1 && uc.col === colIdx)
    );
    onUpdateTable(activeTableIndex, {
      ...activeTable,
      headers: nextHeaders,
      uncertainCells: nextUncertain,
    });
  };

  const updateTitle = (title: string) => {
    onUpdateTable(activeTableIndex, { ...activeTable, title });
  };

  const handleAddRow = () => {
    const emptyRow = Array.from({ length: activeTable.headers.length }, () => '');
    onUpdateTable(activeTableIndex, {
      ...activeTable,
      rows: [...activeTable.rows, emptyRow],
    });
  };

  const handleDeleteRow = (rowIdx: number) => {
    const nextRows = activeTable.rows.filter((_, i) => i !== rowIdx);
    onUpdateTable(activeTableIndex, {
      ...activeTable,
      rows: nextRows,
      uncertainCells: undefined,
    });
  };

  const handleAddColumn = () => {
    const nextHeaders = [...activeTable.headers, `عمود ${activeTable.headers.length + 1}`];
    const nextRows = activeTable.rows.map((r) => [...r, '']);
    onUpdateTable(activeTableIndex, {
      ...activeTable,
      headers: nextHeaders,
      rows: nextRows,
    });
  };

  const handleDeleteColumn = (colIdx: number) => {
    if (activeTable.headers.length <= 1) return;
    const nextHeaders = activeTable.headers.filter((_, i) => i !== colIdx);
    const nextRows = activeTable.rows.map((r) => r.filter((_, i) => i !== colIdx));
    if (selectedColIdx === colIdx) {
      setSelectedColIdx(null);
    } else if (selectedColIdx !== null && selectedColIdx > colIdx) {
      setSelectedColIdx(selectedColIdx - 1);
    }
    onUpdateTable(activeTableIndex, {
      ...activeTable,
      headers: nextHeaders,
      rows: nextRows,
      uncertainCells: undefined,
    });
  };

  const handleTranspose = () => {
    onUpdateTable(activeTableIndex, {
      ...transposeTable(activeTable),
      uncertainCells: undefined,
    });
    setSelectedColIdx(null);
  };

  const handleNormalizeAllDigits = () => {
    onUpdateTable(activeTableIndex, {
      ...activeTable,
      headers: activeTable.headers.map(toWesternDigits),
      rows: activeTable.rows.map((r) => r.map(toWesternDigits)),
    });
  };

  const handleToggleDirection = () => {
    onUpdateTable(activeTableIndex, {
      ...activeTable,
      detectedDirection: activeTable.detectedDirection === 'rtl' ? 'ltr' : 'rtl',
    });
  };

  const handleCopyTsv = async () => {
    await copyTableAsTsv(activeTable);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const isRtl = activeTable.detectedDirection === 'rtl';

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col min-w-0">
      {/* Header & Primary Export Strip */}
      <div className="px-4 sm:px-5 py-4 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={activeTable.title}
              onChange={(e) => updateTitle(e.target.value)}
              aria-label="اسم الورقة"
              className="font-display text-lg font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-600 focus:outline-none px-0.5 py-0.5 min-w-[140px] max-w-xs truncate"
            />
          </div>
          <p className="text-xs text-slate-500 tabular-nums">
            {tables.length > 1 ? `${tables.length} جداول مستخرجة · ` : ''}
            {activeTable.rows.length} صف · {activeTable.headers.length} عمود · اتجاه{' '}
            {isRtl ? 'من اليمين لليسار' : 'من اليسار لليمين'}
          </p>
        </div>

        {/* Export Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleCopyTsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                <span className="text-emerald-700">تم النسخ</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>نسخ لـ Excel</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => exportTableToCsv(activeTable, fileName)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تحميل CSV</span>
          </button>

          <button
            type="button"
            onClick={() => exportTablesToXlsx(tables, fileName, true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>تحميل Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Multi-Sheet Tabs (if >1 table detected) */}
      {tables.length > 1 && (
        <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center gap-1.5 overflow-x-auto">
          <span className="text-xs text-slate-500 ml-2 whitespace-nowrap shrink-0">
            الأوراق:
          </span>
          {tables.map((tbl, idx) => (
            <button
              key={tbl.id}
              type="button"
              onClick={() => {
                onSelectTableIndex(idx);
                setSelectedColIdx(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                idx === activeTableIndex
                  ? 'bg-white text-slate-900 border border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {tbl.title || `جدول ${idx + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Spreadsheet Editing & Filter Toolbar */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={onOpenAssistant}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <MessageSquareText className="w-3.5 h-3.5" />
            <span>مساعد الحلول الذكي</span>
          </button>
          <button
            type="button"
            onClick={() => setShowFixBar((prev) => !prev)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              showFixBar
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'text-slate-700 bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>
              أدوات الإصلاح
              {diagnostic &&
              diagnostic.emptyRowsCount +
                diagnostic.duplicateRowsCount +
                diagnostic.currencyMixedNumericCells >
                0
                ? ` (${
                    diagnostic.emptyRowsCount +
                    diagnostic.duplicateRowsCount +
                    diagnostic.currencyMixedNumericCells
                  })`
                : ''}
            </span>
          </button>
          {canUndo && (
            <button
              type="button"
              onClick={onUndo}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>تراجع</span>
            </button>
          )}
          <span className="h-4 w-px bg-slate-200 mx-0.5 hidden sm:inline-block" aria-hidden="true" />
          <button
            type="button"
            onClick={handleAddRow}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة صف</span>
          </button>
          <button
            type="button"
            onClick={handleAddColumn}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة عمود</span>
          </button>
          <button
            type="button"
            onClick={handleTranspose}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>عكس</span>
          </button>
          <button
            type="button"
            onClick={handleNormalizeAllDigits}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>أرقام (0123)</span>
          </button>
          <button
            type="button"
            onClick={handleToggleDirection}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <span>{isRtl ? 'RTL' : 'LTR'}</span>
          </button>
        </div>

        <div className="relative w-full sm:w-52">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث داخل خلايا الجدول..."
            className="w-full pr-8 pl-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* Diagnostic & Quick Problem-Fixing Strip */}
      {showFixBar && diagnostic && (
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() =>
                onUpdateTable(activeTableIndex, fixEmptyAndDuplicateRows(activeTable))
              }
              className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-emerald-600 text-slate-800 rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              حذف الصفوف الفارغة والمكررة ({diagnostic.emptyRowsCount + diagnostic.duplicateRowsCount})
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateTable(activeTableIndex, stripCurrencyForNumericCells(activeTable))
              }
              className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-emerald-600 text-slate-800 rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              فصل العملات لتحويل الأرقام ({diagnostic.currencyMixedNumericCells})
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateTable(activeTableIndex, fixWhitespaceAndDigits(activeTable))
              }
              className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-emerald-600 text-slate-800 rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              تنظيف المسافات والأسطر الزائدة ({diagnostic.extraWhitespaceCells})
            </button>
            {diagnostic.numericColumnIndices.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  onUpdateTable(activeTableIndex, appendTotalsRow(activeTable))
                }
                className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                إضافة صف المجموع التلقائي
              </button>
            )}
          </div>
        </div>
      )}

      {/* Extraction Note & Uncertain Cells Notice */}
      {(activeTable.notes || summary || uncertainMap.size > 0) && (
        <div className="px-4 py-2 border-b border-slate-200 bg-emerald-50/40 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2">
          <span>{activeTable.notes || summary}</span>
          {uncertainMap.size > 0 && (
            <span className="inline-flex items-center gap-1.5 text-amber-800 font-medium tabular-nums">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                يوجد {uncertainMap.size} خلية مميزة للمراجعة بسبب ضعف الإضاءة أو الخط
              </span>
            </span>
          )}
        </div>
      )}

      {/* Editable Excel Grid */}
      <div className="overflow-x-auto max-h-[540px] overflow-y-auto" dir={isRtl ? 'rtl' : 'ltr'}>
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            {/* Excel Column Letters Row (A, B, C...) */}
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="w-12 min-w-12 px-2 py-1.5 text-center text-[11px] font-mono font-medium text-slate-500 border-e border-slate-200">
                #
              </th>
              {activeTable.headers.map((_, colIdx) => {
                const isSelected = selectedColIdx === colIdx;
                return (
                  <th
                    key={colIdx}
                    className={`min-w-[130px] px-2 py-1 text-center font-mono text-[11px] font-semibold border-e border-slate-200 transition-colors ${
                      isSelected
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedColIdx(isSelected ? null : colIdx)
                        }
                        title="انقر لعرض إحصائيات العمود"
                        className="flex-1 text-center py-0.5 cursor-pointer"
                      >
                        {columnLetter(colIdx)}
                      </button>
                      {activeTable.headers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteColumn(colIdx)}
                          title="حذف العمود"
                          aria-label={`حذف العمود ${columnLetter(colIdx)}`}
                          className="p-0.5 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </th>
                );
              })}
              <th className="w-10 min-w-10 bg-slate-100" />
            </tr>

            {/* Editable Table Header Row */}
            <tr className="bg-slate-50 border-b border-slate-300">
              <td className="px-2 py-2 text-center text-xs font-mono text-slate-400 border-e border-slate-200 tabular-nums">
                1
              </td>
              {activeTable.headers.map((header, colIdx) => {
                const uncertainReason = uncertainMap.get(`-1:${colIdx}`);
                return (
                  <th
                    key={colIdx}
                    title={uncertainReason ? `تنبيه قراءة: ${uncertainReason}` : undefined}
                    className={`p-0 border-e border-slate-200 relative ${
                      uncertainReason ? 'bg-amber-50/80' : 'bg-slate-50'
                    }`}
                  >
                    <input
                      type="text"
                      value={header}
                      onChange={(e) => updateHeader(colIdx, e.target.value)}
                      aria-label={`عنوان العمود ${columnLetter(colIdx)}`}
                      className={`w-full h-10 px-3 text-xs font-semibold text-slate-900 bg-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-600 ${
                        uncertainReason ? 'ring-1 ring-inset ring-amber-400 pl-7' : ''
                      }`}
                    />
                    {uncertainReason && (
                      <AlertTriangle
                        aria-hidden="true"
                        className="w-3.5 h-3.5 text-amber-600 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
                      />
                    )}
                  </th>
                );
              })}
              <th className="bg-slate-50" />
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200">
            {filteredRowIndices.length === 0 ? (
              <tr>
                <td
                  colSpan={activeTable.headers.length + 2}
                  className="py-10 text-center text-sm text-slate-500"
                >
                  لا توجد صفوف مطابقة لنتيجة البحث.
                </td>
              </tr>
            ) : (
              filteredRowIndices.map((rowIdx) => {
                const row = activeTable.rows[rowIdx];
                return (
                  <tr
                    key={rowIdx}
                    className="group hover:bg-slate-50/90 transition-colors"
                  >
                    <td className="px-2 py-2 text-center text-xs font-mono text-slate-400 bg-slate-50/50 border-e border-slate-200 tabular-nums select-none">
                      {rowIdx + 2}
                    </td>
                    {activeTable.headers.map((_, colIdx) => {
                      const val = row[colIdx] ?? '';
                      const isNumeric = /^[\d\s.,٬٫%٪+-]+$/.test(val.trim()) && /\d/.test(val);
                      const uncertainReason = uncertainMap.get(`${rowIdx}:${colIdx}`);
                      return (
                        <td
                          key={colIdx}
                          title={uncertainReason ? `تنبيه قراءة: ${uncertainReason}` : undefined}
                          className={`p-0 border-e border-slate-200 relative ${
                            uncertainReason
                              ? 'bg-amber-50/70'
                              : selectedColIdx === colIdx
                                ? 'bg-emerald-50/30'
                                : ''
                          }`}
                        >
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                            className={`w-full h-10 px-3 text-[13px] text-slate-800 bg-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-600 ${
                              isNumeric ? 'tabular-nums font-mono' : ''
                            } ${uncertainReason ? 'ring-1 ring-inset ring-amber-400 pl-7' : ''}`}
                          />
                          {uncertainReason && (
                            <AlertTriangle
                              aria-hidden="true"
                              className="w-3.5 h-3.5 text-amber-600 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className="px-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(rowIdx)}
                        title="حذف الصف"
                        aria-label={`حذف الصف ${rowIdx + 2}`}
                        className="p-1.5 text-slate-300 group-hover:text-slate-500 hover:!text-red-600 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Quick-Stats Bar */}
      <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        {colStats && selectedColIdx !== null ? (
          <div className="flex items-center gap-3 flex-wrap tabular-nums">
            <span className="font-semibold text-slate-900">
              إحصائيات العمود {columnLetter(selectedColIdx)} ({activeTable.headers[selectedColIdx]}):
            </span>
            <span>عدد القيم: {colStats.numericCount}</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-emerald-800">
              المجموع: {colStats.sum.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              المتوسط: {colStats.avg.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              الأدنى: {colStats.min.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              الأعلى: {colStats.max.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </span>
          </div>
        ) : (
          <span>
            انقر على أي خلية لتعديلها مباشرة، أو انقر على حرف العمود (A, B, C) لحساب المجموع والمتوسط تلقائياً.
          </span>
        )}
      </div>
    </section>
  );
};
