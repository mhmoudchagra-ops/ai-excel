import React, { useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  RefreshCw,
  Image as ImageIcon,
  SlidersHorizontal,
  Eye,
} from 'lucide-react';
import type { ExtractionOptions, ImageEnhancementMode } from '../types/table';

interface ImageInspectorProps {
  imageUrl: string;
  enhancedPreviewUrl: string | null;
  fileName: string;
  rotation: number;
  isLoading: boolean;
  options: ExtractionOptions;
  onChangeOptions: (next: ExtractionOptions) => void;
  onRotate: (delta: number) => void;
  onReplaceImage: () => void;
  onReExtract: () => void;
}

export const ImageInspector: React.FC<ImageInspectorProps> = ({
  imageUrl,
  enhancedPreviewUrl,
  fileName,
  rotation,
  isLoading,
  options,
  onChangeOptions,
  onRotate,
  onReplaceImage,
  onReExtract,
}) => {
  const [zoom, setZoom] = useState(1);
  const [showSettings, setShowSettings] = useState(true);
  const [previewEnhanced, setPreviewEnhanced] = useState(true);

  const handleZoomIn = () => setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))));
  const handleResetZoom = () => setZoom(1);

  const activePreviewSrc =
    previewEnhanced && enhancedPreviewUrl && options.enhancementMode !== 'none'
      ? enhancedPreviewUrl
      : imageUrl;
  const applyCssRotation = activePreviewSrc === imageUrl;

  return (
    <aside className="bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50/70">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate" title={fileName}>
            {fileName}
          </p>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            معاينة المصدر · التكبير {Math.round(zoom * 100)}%
          </p>
        </div>

        <button
          type="button"
          onClick={onReplaceImage}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>تغيير الصورة</span>
        </button>
      </div>

      {/* Image Viewport */}
      <div className="relative bg-slate-100/80 h-[320px] lg:h-[390px] overflow-auto flex items-center justify-center p-4">
        <img
          src={activePreviewSrc}
          alt={fileName}
          referrerPolicy="no-referrer"
          style={{
            transform: `scale(${zoom}) rotate(${applyCssRotation ? rotation : 0}deg)`,
            transformOrigin: 'center center',
          }}
          className="max-w-full max-h-full object-contain rounded shadow-sm transition-transform duration-150 select-none"
        />
      </div>

      {/* Image Controls Strip */}
      <div className="px-3 py-2.5 border-t border-slate-200 bg-white flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomIn}
            title="تكبير"
            aria-label="تكبير الصورة"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="تصغير"
            aria-label="تصغير الصورة"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2 py-1 text-xs font-mono text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer tabular-nums"
          >
            100%
          </button>
          <span className="h-4 w-px bg-slate-200 mx-1" aria-hidden="true" />
          <button
            type="button"
            onClick={() => onRotate(-90)}
            title="تدوير لليسار 90°"
            aria-label="تدوير لليسار"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onRotate(90)}
            title="تدوير لليمين 90°"
            aria-label="تدوير لليمين"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {options.enhancementMode !== 'none' && enhancedPreviewUrl && (
            <button
              type="button"
              onClick={() => setPreviewEnhanced((prev) => !prev)}
              className={`inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                previewEnhanced
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="التبديل بين معاينة الصورة المحسّنة والأصلية"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{previewEnhanced ? 'المحسّنة' : 'الأصلية'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowSettings((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              showSettings
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>خيارات التحليل</span>
          </button>
        </div>
      </div>

      {/* Collapsible Extraction Settings */}
      {showSettings && (
        <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-4">
          {/* Lighting & OCR Pre-processing Mode */}
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-slate-700">
              تحسين الإضاءة ووضوح الخطوط قبل القراءة
            </span>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-200/70 rounded-lg">
              {(
                [
                  { value: 'auto', label: 'ذكي تلقائي' },
                  { value: 'document', label: 'مسح للظلال' },
                  { value: 'none', label: 'الأصلية' },
                ] as Array<{ value: ImageEnhancementMode; label: string }>
              ).map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() =>
                    onChangeOptions({ ...options, enhancementMode: item.value })
                  }
                  className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    options.enhancementMode === item.value
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-xs font-medium text-slate-700">
                دقة فائقة للخطوط المتنوعة والإضاءة الصعبة
              </span>
              <input
                type="checkbox"
                checked={options.highAccuracyMode}
                onChange={(e) =>
                  onChangeOptions({ ...options, highAccuracyMode: e.target.checked })
                }
                className="w-4 h-4 accent-emerald-700 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-xs font-medium text-slate-700">
                توحيد الأرقام إلى الصيغة العالمية (0123)
              </span>
              <input
                type="checkbox"
                checked={options.normalizeDigits}
                onChange={(e) =>
                  onChangeOptions({ ...options, normalizeDigits: e.target.checked })
                }
                className="w-4 h-4 accent-emerald-700 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-xs font-medium text-slate-700">
                فصل الجداول المتعددة في أوراق مستقلة
              </span>
              <input
                type="checkbox"
                checked={options.multiTable}
                onChange={(e) =>
                  onChangeOptions({ ...options, multiTable: e.target.checked })
                }
                className="w-4 h-4 accent-emerald-700 rounded cursor-pointer"
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-slate-700">
              اتجاه الجدول في ملف Excel
            </span>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-200/70 rounded-lg">
              {(
                [
                  { value: 'auto', label: 'تلقائي' },
                  { value: 'rtl', label: 'عربي (RTL)' },
                  { value: 'ltr', label: 'إنجليزي (LTR)' },
                ] as const
              ).map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() =>
                    onChangeOptions({ ...options, preferredDirection: item.value })
                  }
                  className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    options.preferredDirection === item.value
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="custom-instruction"
              className="block text-xs font-medium text-slate-700"
            >
              توجيه إضافي للنموذج (اختياري)
            </label>
            <input
              id="custom-instruction"
              type="text"
              value={options.customInstruction}
              onChange={(e) =>
                onChangeOptions({ ...options, customInstruction: e.target.value })
              }
              placeholder="مثال: تجاهل صف التوقيعات أو افصل العملة في عمود مستقل"
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        </div>
      )}

      {/* Re-extract Action */}
      <div className="p-3 border-t border-slate-200 bg-white">
        <button
          type="button"
          onClick={onReExtract}
          disabled={isLoading}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'جاري تحليل الجدول...' : 'إعادة تحليل الصورة'}</span>
        </button>
      </div>
    </aside>
  );
};
