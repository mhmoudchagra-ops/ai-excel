import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  CheckCircle2,
  Loader2,
  Wrench,
  RotateCcw,
} from 'lucide-react';
import type { ExtractedTable } from '../types/table';
import type { TableDiagnosticReport } from '../utils/tableFixes';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  suggestedActionTitle?: string;
  proposedTable?: {
    title: string;
    headers: string[];
    rows: string[][];
  };
  applied?: boolean;
}

interface AiAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeTable: ExtractedTable | null;
  diagnostic: TableDiagnosticReport | null;
  lastError: string | null;
  imageUrl: string | null;
  onApplyProposedTable: (proposed: {
    title: string;
    headers: string[];
    rows: string[][];
  }) => void;
  canUndo: boolean;
  onUndo: () => void;
}

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  isOpen,
  onClose,
  activeTable,
  diagnostic,
  lastError,
  imageUrl,
  onApplyProposedTable,
  canUndo,
  onUndo,
}) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'مرحباً! أنا مساعد حل المشاكل في جدولك. يمكنك سؤالي عن أي مشكلة في قراءة الصورة، أو طلب تعديل أو تنظيف أو إعادة هيكلة للجدول الحالي وسأنفذها لك فوراً.',
    },
  ]);
  const [input, setInput] = useState('');
  const [includeImage, setIncludeImage] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const quickPrompts = activeTable
    ? [
        'افحص الجدول مع الصورة واكتشف أي أخطاء قراءة أو خلايا ناقصة وصححها',
        'نظّف الأرقام والعملات في الجدول لتكون جاهزة للحساب في Excel',
        'رتّب الصفوف والأعمدة وعالج أي بيانات مدمجة في خلية واحدة',
      ]
    : [
        'لماذا تعذر استخراج الجدول من الصورة؟ وكيف أحل المشكلة؟',
        'الصورة مظلمة أو مائلة والخط صغير، ما أفضل إعدادات لتحويلها؟',
      ];

  const sendMessage = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isSending) return;

    const userMsg: AssistantMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setIsSending(true);

    try {
      let imageBase64: string | undefined;
      let mimeType: string | undefined;
      if (includeImage && imageUrl && imageUrl.startsWith('data:')) {
        const [header, b64] = imageUrl.split(',');
        const match = header.match(/data:([^;]+);base64/);
        imageBase64 = b64;
        mimeType = match ? match[1] : 'image/png';
      }

      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: nextHistory
            .filter((m) => m.id !== 'welcome')
            .slice(-8)
            .map((m) => ({ role: m.role, text: m.text })),
          activeTable: activeTable
            ? {
                title: activeTable.title,
                headers: activeTable.headers,
                rows: activeTable.rows,
                notes: activeTable.notes,
                uncertainCells: activeTable.uncertainCells,
              }
            : null,
          diagnostic,
          lastError,
          imageBase64,
          mimeType,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || 'تعذر الحصول على رد من المساعد الذكي.');
      }

      const assistantMsg: AssistantMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: payload.reply || 'تم تحليل طلبك.',
        suggestedActionTitle: payload.suggestedActionTitle,
        proposedTable: payload.updatedTable || undefined,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text:
            err instanceof Error
              ? err.message
              : 'حدث خطأ أثناء الاتصال بالمساعد الذكي.',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleApply = (msgId: string, proposed: NonNullable<AssistantMessage['proposedTable']>) => {
    onApplyProposedTable(proposed);
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, applied: true } : m))
    );
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/25">
      <div
        className="w-full max-w-md bg-white h-full border-r border-slate-200 flex flex-col shadow-xl"
        role="dialog"
        aria-label="مساعد حل المشاكل الذكي"
      >
        {/* Drawer Header */}
        <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-slate-900">
              مساعد حل المشاكل الذكي
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              تشخيص الأخطاء، مقارنة الصورة، وإصلاح بيانات الجدول
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {canUndo && (
              <button
                type="button"
                onClick={onUndo}
                title="تراجع عن آخر تعديل"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>تراجع</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق المساعد"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Diagnostic Summary Strip (if issues detected) */}
        {diagnostic &&
          (diagnostic.emptyRowsCount > 0 ||
            diagnostic.duplicateRowsCount > 0 ||
            diagnostic.currencyMixedNumericCells > 0 ||
            diagnostic.uncertainCellsCount > 0) && (
            <div className="px-4 py-2.5 border-b border-amber-200 bg-amber-50/70 text-xs text-amber-900 space-y-1">
              <p className="font-semibold">ملاحظات مرصودة في الجدول الحالي:</p>
              <p className="tabular-nums text-amber-800">
                {[
                  diagnostic.uncertainCellsCount > 0
                    ? `${diagnostic.uncertainCellsCount} خلايا غير واضحة`
                    : null,
                  diagnostic.currencyMixedNumericCells > 0
                    ? `${diagnostic.currencyMixedNumericCells} قيم مختلطة بالعملة`
                    : null,
                  diagnostic.emptyRowsCount > 0
                    ? `${diagnostic.emptyRowsCount} صفوف فارغة`
                    : null,
                  diagnostic.duplicateRowsCount > 0
                    ? `${diagnostic.duplicateRowsCount} صفوف مكررة`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          )}

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-start' : 'items-end'
              }`}
            >
              <div
                className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-800 border border-slate-200'
                }`}
              >
                {msg.text}

                {msg.proposedTable && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-600 tabular-nums">
                      {msg.proposedTable.rows.length} صف ·{' '}
                      {msg.proposedTable.headers.length} عمود
                    </span>
                    {msg.applied ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تم التطبيق</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleApply(msg.id, msg.proposedTable!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>
                          {msg.suggestedActionTitle || 'تطبيق التعديل على الجدول'}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex items-end flex-col">
              <div className="bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-600 inline-flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                <span>جاري فحص المشكلة وتجهيز الحل...</span>
              </div>
            </div>
          )}
          <div ref={scrollEndRef} />
        </div>

        {/* Quick Problem-Solving Action Buttons */}
        <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50/70 space-y-2">
          <p className="text-[11px] font-medium text-slate-500">
            حلول سريعة بضغطة واحدة:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((q) => (
              <button
                key={q}
                type="button"
                disabled={isSending}
                onClick={() => void sendMessage(q)}
                className="text-right text-xs px-2.5 py-1.5 bg-white border border-slate-200 hover:border-emerald-600 hover:text-emerald-800 text-slate-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input);
          }}
          className="p-3 border-t border-slate-200 bg-white space-y-2"
        >
          {imageUrl && (
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={includeImage}
                onChange={(e) => setIncludeImage(e.target.checked)}
                className="w-3.5 h-3.5 accent-emerald-700 rounded cursor-pointer"
              />
              <span>مشاركة صورة الجدول مع المساعد للتحقق البصري</span>
            </label>
          )}

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="صف المشكلة أو اطلب تعديل الجدول..."
              disabled={isSending}
              className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              aria-label="إرسال"
              className="p-2.5 text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
