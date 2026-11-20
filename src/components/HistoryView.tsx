import React from 'react';
import { FileSpreadsheet, Trash2, ArrowUpLeft } from 'lucide-react';
import type { HistoryItem } from '../types/table';
import { exportTablesToXlsx } from '../utils/excelExport';

interface HistoryViewProps {
  items: HistoryItem[];
  onRestore: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onGoToWorkspace: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  items,
  onRestore,
  onDelete,
  onClearAll,
  onGoToWorkspace,
}) => {
  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            سجل الجداول المحفوظة
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            تُحفظ عمليات التحويل السابقة محلياً على جهازك للوصول السريع وإعادة التصدير.
          </p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>مسح السجل بالكامل</span>
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-4">
          <p className="text-base font-semibold text-slate-900">
            لا توجد جداول محفوظة في السجل حتى الآن
          </p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            عند رفع أي صورة وتحويلها إلى جدول، سيتم حفظ نسخة منها هنا تلقائياً لتتمكن من تعديلها أو تصديرها لاحقاً.
          </p>
          <button
            type="button"
            onClick={onGoToWorkspace}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
          >
            <span>الانتقال لمساحة التحويل</span>
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
          {items.map((item) => {
            const totalRows = item.tables.reduce((acc, t) => acc + t.rows.length, 0);
            const dateLabel = new Date(item.createdAt).toLocaleString('ar-SA', {
              dateStyle: 'medium',
              timeStyle: 'short',
            });

            return (
              <div
                key={item.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-20 h-14 rounded-lg border border-slate-200 bg-slate-100 overflow-hidden shrink-0">
                    <img
                      src={item.thumbnailDataUrl}
                      alt={item.fileName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {item.fileName}
                    </p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {item.tables.length} جدول · {totalRows} صف · {dateLabel}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onRestore(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <ArrowUpLeft className="w-3.5 h-3.5" />
                    <span>فتح وتعديل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportTablesToXlsx(item.tables, item.fileName, true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    aria-label={`حذف ${item.fileName}`}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
