import React, { useMemo, useState } from 'react';
import { Upload, ImagePlus, ArrowLeft } from 'lucide-react';
import { SAMPLE_PRESETS, type SampleTablePreset } from '../utils/sampleTables';

interface ImageUploadZoneProps {
  onSelectFile: (file: File) => void;
  onSelectSample: (dataUrl: string, fileName: string) => void;
}

export const ImageUploadZone: React.FC<ImageUploadZoneProps> = ({
  onSelectFile,
  onSelectSample,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const previews = useMemo(() => {
    return SAMPLE_PRESETS.map((preset) => ({
      ...preset,
      dataUrl: preset.generateDataUrl(),
    }));
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onSelectFile(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectFile(file);
      e.target.value = '';
    }
  };

  const handleSampleClick = (preset: SampleTablePreset & { dataUrl: string }) => {
    onSelectSample(preset.dataUrl, preset.fileName);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-10">
      {/* Editorial Intro */}
      <div className="space-y-3 max-w-2xl">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight [text-wrap:balance]">
          حوّل صور الجداول والوثائق إلى جداول Excel قابلة للتعديل
        </h1>
        <p className="text-base text-slate-600 leading-relaxed">
          ارفع صورة فاتورة، كشف حساب، تقرير ورقي، أو الصق لقطة شاشة مباشرة. يتعرف الذكاء الاصطناعي على الأعمدة والصفوف العربية والإنجليزية ويجهزها للتصدير الفوري.
        </p>
      </div>

      {/* Primary Upload Zone */}
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`block bg-white border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-colors cursor-pointer ${
          isDragging
            ? 'border-emerald-600 bg-emerald-50/40'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleInputChange}
          className="sr-only"
        />

        <div className="mx-auto w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 mb-4">
          <Upload className="w-6 h-6" />
        </div>

        <p className="text-lg font-semibold text-slate-900 mb-1.5">
          اسحب صورة الجدول وأفلتها هنا، أو انقر لاختيار ملف
        </p>
        <p className="text-sm text-slate-500 mb-6">
          يدعم PNG و JPG و WEBP · يمكنك أيضاً لصق لقطة شاشة مباشرة عبر Ctrl+V
        </p>

        <span className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap">
          <ImagePlus className="w-4 h-4" />
          <span>اختيار صورة من الجهاز</span>
        </span>
      </label>

      {/* Instant Sample Presets */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between border-b border-slate-200 pb-3">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            أو جرّب فوراً بأحد النماذج الجاهزة
          </h2>
          <span className="text-xs text-slate-500">
            انقر على أي نموذج لبدء التحويل مباشرة
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {previews.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSampleClick(preset)}
              className="group text-right bg-white border border-slate-200 hover:border-emerald-600 rounded-xl overflow-hidden transition-colors cursor-pointer flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <div className="aspect-[16/10] w-full bg-slate-100 border-b border-slate-200 overflow-hidden">
                {preset.dataUrl ? (
                  <img
                    src={preset.dataUrl}
                    alt={preset.label}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform duration-200"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                    معاينة النموذج
                  </div>
                )}
              </div>
              <div className="p-4 flex items-center justify-between gap-3 w-full">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {preset.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {preset.subtitle}
                  </p>
                </div>
                <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 shrink-0 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
