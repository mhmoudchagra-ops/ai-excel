import React from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';

export type AppView = 'workspace' | 'history' | 'guide';

interface HeaderProps {
  activeView: AppView;
  onChangeView: (view: AppView) => void;
  hasTables: boolean;
  historyCount: number;
  onExportExcel: () => void;
  onTriggerUpload: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onChangeView,
  hasTables,
  historyCount,
  onExportExcel,
  onTriggerUpload,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => onChangeView('workspace')}
          className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded"
        >
          جدولك
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="flex items-center gap-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => onChangeView('workspace')}
            className={`py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer border-b-2 ${
              activeView === 'workspace'
                ? 'text-slate-900 border-emerald-700'
                : 'text-slate-500 border-transparent hover:text-slate-900'
            }`}
          >
            مساحة التحويل
          </button>
          <button
            type="button"
            onClick={() => onChangeView('history')}
            className={`py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer border-b-2 ${
              activeView === 'history'
                ? 'text-slate-900 border-emerald-700'
                : 'text-slate-500 border-transparent hover:text-slate-900'
            }`}
          >
            السجل المحفوظ{historyCount > 0 ? ` (${historyCount})` : ''}
          </button>
          <button
            type="button"
            onClick={() => onChangeView('guide')}
            className={`hidden sm:inline-flex py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer border-b-2 ${
              activeView === 'guide'
                ? 'text-slate-900 border-emerald-700'
                : 'text-slate-500 border-transparent hover:text-slate-900'
            }`}
          >
            نصائح الدقة
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          {hasTables && activeView === 'workspace' ? (
            <button
              type="button"
              onClick={onExportExcel}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>تصدير Excel</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (activeView !== 'workspace') {
                  onChangeView('workspace');
                }
                onTriggerUpload();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
            >
              <Upload className="w-4 h-4" />
              <span>رفع صورة جدول</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
