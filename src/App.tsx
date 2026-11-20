import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header, type AppView } from './components/Header';
import { ImageUploadZone } from './components/ImageUploadZone';
import { ImageInspector } from './components/ImageInspector';
import { SpreadsheetGrid } from './components/SpreadsheetGrid';
import { HistoryView } from './components/HistoryView';
import { GuideView } from './components/GuideView';
import { AiAssistantPanel } from './components/AiAssistantPanel';
import type {
  ExtractedTable,
  ExtractionOptions,
  ExtractionResponse,
  HistoryItem,
} from './types/table';
import { exportTablesToXlsx } from './utils/excelExport';
import { prepareImageForOcr } from './utils/imageEnhance';
import { analyzeTableIssues } from './utils/tableFixes';

const HISTORY_STORAGE_KEY = 'jadwalk_extraction_history_v1';
const MAX_HISTORY_ITEMS = 12;

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]): void {
  try {
    localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS))
    );
  } catch {
    // Ignore storage quota errors cleanly
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة.'));
    reader.readAsDataURL(file);
  });
}

async function createThumbnail(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 240;
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('workspace');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [enhancedPreviewUrl, setEnhancedPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('جدول_مستخرج.png');
  const [rotation, setRotation] = useState<number>(0);

  const [tables, setTables] = useState<ExtractedTable[]>([]);
  const [undoStack, setUndoStack] = useState<ExtractedTable[][]>([]);
  const [activeTableIndex, setActiveTableIndex] = useState<number>(0);
  const [summary, setSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);

  const [options, setOptions] = useState<ExtractionOptions>({
    normalizeDigits: true,
    multiTable: true,
    preferredDirection: 'auto',
    enhancementMode: 'auto',
    highAccuracyMode: true,
    customInstruction: '',
  });

  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory());
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);

  const activeTable = tables[activeTableIndex] ?? null;

  const activeDiagnostic = useMemo(() => {
    if (!activeTable) return null;
    return analyzeTableIssues(activeTable);
  }, [activeTable]);

  // Keep live enhanced preview synced whenever image, rotation, or enhancement mode changes
  useEffect(() => {
    let cancelled = false;
    if (!imageUrl || options.enhancementMode === 'none') {
      setEnhancedPreviewUrl(null);
      return;
    }

    prepareImageForOcr(imageUrl, rotation, options.enhancementMode)
      .then((res) => {
        if (!cancelled) {
          setEnhancedPreviewUrl(res.dataUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEnhancedPreviewUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [imageUrl, rotation, options.enhancementMode]);

  const runExtraction = useCallback(
    async (
      targetDataUrl: string,
      targetFileName: string,
      targetRotation: number,
      targetOptions: ExtractionOptions
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const prepared = await prepareImageForOcr(
          targetDataUrl,
          targetRotation,
          targetOptions.enhancementMode
        );
        if (targetOptions.enhancementMode !== 'none') {
          setEnhancedPreviewUrl(prepared.dataUrl);
        }

        const res = await fetch('/api/extract-table', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: prepared.base64,
            mimeType: prepared.mimeType,
            options: targetOptions,
          }),
        });

        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.error || 'حدث خطأ غير متوقع أثناء استخراج الجدول.');
        }

        const data = payload as ExtractionResponse;
        setTables(data.tables);
        setUndoStack([]);
        setActiveTableIndex(0);
        setSummary(data.summary);

        if (data.tables.length > 0) {
          const thumb = await createThumbnail(targetDataUrl);
          const entry: HistoryItem = {
            id: `hist-${Date.now()}`,
            fileName: targetFileName,
            createdAt: new Date().toISOString(),
            thumbnailDataUrl: thumb,
            tables: data.tables,
            summary: data.summary,
          };
          setHistory((prev) => {
            const next = [entry, ...prev].slice(0, MAX_HISTORY_ITEMS);
            saveHistory(next);
            return next;
          });
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : 'تعذر الاتصال بالخادم لاستخراج الجدول.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleLoadImageDataUrl = useCallback(
    (dataUrl: string, name: string) => {
      setActiveView('workspace');
      setImageUrl(dataUrl);
      setEnhancedPreviewUrl(null);
      setFileName(name);
      setRotation(0);
      setTables([]);
      setUndoStack([]);
      setSummary('');
      void runExtraction(dataUrl, name, 0, options);
    },
    [options, runExtraction]
  );

  const handleSelectFile = useCallback(
    async (file: File) => {
      try {
        const dataUrl = await fileToDataUrl(file);
        handleLoadImageDataUrl(dataUrl, file.name);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'تعذر قراءة الملف.');
      }
    },
    [handleLoadImageDataUrl]
  );

  // Global clipboard paste listener (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '-');
            const pastedFile = new File([blob], `لقطة_جدول_${stamp}.png`, {
              type: blob.type || 'image/png',
            });
            void handleSelectFile(pastedFile);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleSelectFile]);

  const handleUpdateTable = useCallback((idx: number, updated: ExtractedTable) => {
    setTables((prev) => {
      setUndoStack((stack) => [...stack.slice(-14), prev]);
      return prev.map((t, i) => (i === idx ? updated : t));
    });
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1];
      setTables(previous);
      return stack.slice(0, -1);
    });
  }, []);

  const handleApplyAssistantTable = useCallback(
    (proposed: { title: string; headers: string[]; rows: string[][] }) => {
      setTables((prev) => {
        if (prev.length === 0) return prev;
        setUndoStack((stack) => [...stack.slice(-14), prev]);
        return prev.map((tbl, idx) =>
          idx === activeTableIndex
            ? {
                ...tbl,
                title: proposed.title || tbl.title,
                headers: proposed.headers,
                rows: proposed.rows,
                uncertainCells: undefined,
              }
            : tbl
        );
      });
    },
    [activeTableIndex]
  );

  const handleRestoreHistory = (item: HistoryItem) => {
    setImageUrl(item.thumbnailDataUrl);
    setEnhancedPreviewUrl(null);
    setFileName(item.fileName);
    setRotation(0);
    setTables(item.tables);
    setUndoStack([]);
    setActiveTableIndex(0);
    setSummary(item.summary);
    setError(null);
    setActiveView('workspace');
  };

  const handleDeleteHistory = (id: string) => {
    setHistory((prev) => {
      const next = prev.filter((item) => item.id !== id);
      saveHistory(next);
      return next;
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  const handleTriggerUpload = () => {
    hiddenInputRef.current?.click();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <input
        ref={hiddenInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            void handleSelectFile(file);
            e.target.value = '';
          }
        }}
      />

      <Header
        activeView={activeView}
        onChangeView={setActiveView}
        hasTables={tables.length > 0 && Boolean(imageUrl)}
        historyCount={history.length}
        onExportExcel={() => exportTablesToXlsx(tables, fileName, true)}
        onTriggerUpload={handleTriggerUpload}
      />

      <main className="flex-1">
        {activeView === 'history' && (
          <HistoryView
            items={history}
            onRestore={handleRestoreHistory}
            onDelete={handleDeleteHistory}
            onClearAll={handleClearHistory}
            onGoToWorkspace={() => setActiveView('workspace')}
          />
        )}

        {activeView === 'guide' && (
          <GuideView onGoToWorkspace={() => setActiveView('workspace')} />
        )}

        {activeView === 'workspace' && !imageUrl && (
          <ImageUploadZone
            onSelectFile={(file) => void handleSelectFile(file)}
            onSelectSample={handleLoadImageDataUrl}
          />
        )}

        {activeView === 'workspace' && imageUrl && (
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-4 xl:col-span-4">
                <ImageInspector
                  imageUrl={imageUrl}
                  enhancedPreviewUrl={enhancedPreviewUrl}
                  fileName={fileName}
                  rotation={rotation}
                  isLoading={isLoading}
                  options={options}
                  onChangeOptions={setOptions}
                  onRotate={(delta) => setRotation((r) => r + delta)}
                  onReplaceImage={() => {
                    setImageUrl(null);
                    setEnhancedPreviewUrl(null);
                    setTables([]);
                    setUndoStack([]);
                    setError(null);
                    setSummary('');
                  }}
                  onReExtract={() =>
                    void runExtraction(imageUrl, fileName, rotation, options)
                  }
                />
              </div>

              <div className="lg:col-span-8 xl:col-span-8 min-w-0">
                <SpreadsheetGrid
                  tables={tables}
                  activeTableIndex={activeTableIndex}
                  fileName={fileName}
                  summary={summary}
                  isLoading={isLoading}
                  error={error}
                  canUndo={undoStack.length > 0}
                  onUndo={handleUndo}
                  onSelectTableIndex={setActiveTableIndex}
                  onUpdateTable={handleUpdateTable}
                  onRetryExtract={() =>
                    void runExtraction(imageUrl, fileName, rotation, options)
                  }
                  onOpenAssistant={() => setIsAssistantOpen(true)}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      <AiAssistantPanel
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        activeTable={activeTable}
        diagnostic={activeDiagnostic}
        lastError={error}
        imageUrl={enhancedPreviewUrl || imageUrl}
        onApplyProposedTable={handleApplyAssistantTable}
        canUndo={undoStack.length > 0}
        onUndo={handleUndo}
      />
    </div>
  );
}
