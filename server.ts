import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

interface ExtractTableRequestBody {
  imageBase64?: string;
  mimeType?: string;
  options?: {
    normalizeDigits?: boolean;
    multiTable?: boolean;
    preferredDirection?: 'auto' | 'rtl' | 'ltr';
    highAccuracyMode?: boolean;
    customInstruction?: string;
  };
}

interface RawUncertainCell {
  row?: number;
  col?: number;
  reason?: string;
}

interface RawExtractedTable {
  title?: string;
  detectedDirection?: string;
  headers?: string[];
  rows?: string[][];
  notes?: string;
  uncertainCells?: RawUncertainCell[];
}

interface RawModelResponse {
  tables?: RawExtractedTable[];
  summary?: string;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? Number((err as { status?: number }).status)
          : 0;
      const retryable = status === 429 || status >= 500 || status === 0;
      if (!retryable || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * Math.pow(2, attempt - 1)));
    }
  }
  throw lastError;
}

function buildSystemPrompt(options: ExtractTableRequestBody['options']): string {
  const normalizeDigits = options?.normalizeDigits ?? true;
  const multiTable = options?.multiTable ?? true;
  const preferredDirection = options?.preferredDirection ?? 'auto';
  const customInstruction = (options?.customInstruction ?? '').trim();

  const lines = [
    'You are an expert multimodal document & tabular OCR specialist engineered to read difficult real-world table images accurately.',
    'You must handle diverse typography (modern sans-serif, traditional Arabic Naskh/Ruqah, serif, condensed receipts, dot-matrix print, bold/italic headers, and handwritten entries), extreme font size variations (large merged banners alongside tiny dense footnotes or small SKU codes), and non-ideal lighting (shadows, camera flash glare, low contrast, warm color casts, skewed angles, folded paper, and faint or missing grid lines).',
    'Extraction Rules:',
    '1. Visual Alignment & Borderless Tables: Even if grid lines are faint, broken, shadowed, or absent, infer column boundaries strictly from horizontal x-coordinates and row baselines from y-coordinates. Do not merge separate columns or split wrapped single-cell text into extra rows.',
    '2. Multi-Font & Multi-Size Fidelity: Read oversized headers, mid-sized body cells, and tiny subscripts/notes with equal care. Preserve mixed Arabic + English + symbols/units inside the same cell cleanly.',
    '3. Script & Lighting Disambiguation: Under low contrast or glare, distinguish similar Arabic glyphs (e.g., ت/ث/ن/ب/ي, ر/ز, ع/غ, ف/ق, ه/ة, ا/ل/١, ٠/٥/ه) using surrounding word context, and cross-check arithmetic totals/subtotals when present to verify partially faded digits without ever inventing unprinted values.',
    '4. Strict Rectangular Shape: Every row inside `rows` MUST have the exact same length as `headers`. Pad empty cells with "" and unmerge spanned cells logically so no data is lost.',
    '5. Column Reading Order: For Arabic/RTL tables, column 0 is the rightmost column; for LTR tables, column 0 is the leftmost column.',
    multiTable
      ? '6. Multiple Tables: If the image contains more than one distinct table, output each as a separate item in `tables` with a concise `title` (max 25 chars, valid Excel sheet name).'
      : '6. Single Table Consolidation: Combine the primary tabular data into one clean table object.',
    normalizeDigits
      ? '7. Digit Normalization: Convert Eastern Arabic/Hindi numerals (٠١٢٣٤٥٦٧٨٩) and Persian numerals to ASCII digits (0123456789) while keeping Arabic text untouched.'
      : '7. Preserve Original Numeral Script: Keep digits in the exact numeral script shown in the image.',
    preferredDirection === 'auto'
      ? '8. Direction Detection: Set `detectedDirection` to "rtl" if the table is predominantly Arabic/Hebrew, else "ltr".'
      : `8. Direction Override: Set \`detectedDirection\` to "${preferredDirection}".`,
    '9. Uncertain Cell Flagging: If any specific cell has poor lighting, heavy shadow, blur, or illegible handwriting making a character uncertain, include its 0-based body row index (`row`: 0..N-1, or -1 for header) and 0-based column index (`col`) in `uncertainCells` with a short Arabic `reason`. Only flag genuinely ambiguous cells.',
    '10. Empty/Non-Table Images: If no table exists, return `tables: []` and explain clearly in Arabic inside `summary`. Write `summary` and `notes` in clear, concise Arabic.',
  ];

  if (customInstruction) {
    lines.push(`11. User-specified instruction: ${customInstruction}`);
  }

  return lines.join('\n');
}

function normalizeTableShape(raw: RawExtractedTable, index: number): {
  id: string;
  title: string;
  detectedDirection: 'rtl' | 'ltr';
  headers: string[];
  rows: string[][];
  notes?: string;
  uncertainCells?: Array<{ row: number; col: number; reason: string }>;
} {
  const rawHeaders = Array.isArray(raw.headers) ? raw.headers.map((h) => String(h ?? '').trim()) : [];
  const rawRows = Array.isArray(raw.rows)
    ? raw.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '').trim()) : []))
    : [];

  const maxRowCols = rawRows.reduce((max, row) => Math.max(max, row.length), 0);
  const colCount = Math.max(rawHeaders.length, maxRowCols, 1);

  const headers = Array.from({ length: colCount }, (_, i) => {
    const val = rawHeaders[i];
    return val && val.length > 0 ? val : `عمود ${i + 1}`;
  });

  const rows = rawRows.map((row) =>
    Array.from({ length: colCount }, (_, i) => row[i] ?? '')
  );

  const direction = raw.detectedDirection === 'ltr' ? 'ltr' : 'rtl';
  const cleanTitle = (raw.title ?? '').trim() || `جدول ${index + 1}`;

  const uncertainCells = Array.isArray(raw.uncertainCells)
    ? raw.uncertainCells
        .filter(
          (uc) =>
            typeof uc?.row === 'number' &&
            typeof uc?.col === 'number' &&
            uc.row >= -1 &&
            uc.row < rows.length &&
            uc.col >= 0 &&
            uc.col < colCount
        )
        .map((uc) => ({
          row: Number(uc.row),
          col: Number(uc.col),
          reason: String(uc.reason ?? 'نص غير واضح').trim(),
        }))
    : undefined;

  return {
    id: `tbl-${Date.now()}-${index}`,
    title: cleanTitle,
    detectedDirection: direction,
    headers,
    rows,
    notes: raw.notes ? String(raw.notes).trim() : undefined,
    uncertainCells: uncertainCells && uncertainCells.length > 0 ? uncertainCells : undefined,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/extract-table', async (req, res) => {
    try {
      const body = req.body as ExtractTableRequestBody;
      const imageBase64 = body?.imageBase64;
      const mimeType = body?.mimeType || 'image/png';

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'يرجى رفع صورة جدول صالحة أولاً.' });
        return;
      }

      const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
      const safeMime = allowedMimes.includes(mimeType.toLowerCase()) ? mimeType : 'image/png';

      const ai = getGeminiClient();
      const systemInstruction = buildSystemPrompt(body.options);
      const useHighAccuracy = body.options?.highAccuracyMode ?? true;

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: safeMime,
                  data: imageBase64,
                },
              },
              {
                text: 'اقرأ الصورة بعناية بالغة واستخرج جميع الجداول بكل صفوفها وأعمدتها بدقة عالية، مع مراعاة اختلاف أحجام الخطوط وأنواعها وتفاوت الإضاءة، وأعد النتيجة بصيغة JSON.',
              },
            ],
          },
          config: {
            systemInstruction,
            thinkingConfig: {
              thinkingLevel: useHighAccuracy ? ThinkingLevel.HIGH : ThinkingLevel.MEDIUM,
            },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                tables: {
                  type: Type.ARRAY,
                  description: 'List of tables extracted from the image.',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: {
                        type: Type.STRING,
                        description: 'Short descriptive sheet title for the table.',
                      },
                      detectedDirection: {
                        type: Type.STRING,
                        description: 'Either "rtl" for Arabic/right-to-left tables or "ltr" for left-to-right.',
                      },
                      headers: {
                        type: Type.ARRAY,
                        description: 'Column header names in logical reading order.',
                        items: { type: Type.STRING },
                      },
                      rows: {
                        type: Type.ARRAY,
                        description: '2D array of table body rows. Each row length matches headers length.',
                        items: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                        },
                      },
                      notes: {
                        type: Type.STRING,
                        description: 'Optional concise Arabic note about lighting, merged cells, or formatting.',
                      },
                      uncertainCells: {
                        type: Type.ARRAY,
                        description: 'Cells whose text was partially obscured by poor lighting, blur, or unclear handwriting.',
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            row: {
                              type: Type.INTEGER,
                              description: '0-based row index inside rows array (-1 for header row).',
                            },
                            col: {
                              type: Type.INTEGER,
                              description: '0-based column index.',
                            },
                            reason: {
                              type: Type.STRING,
                              description: 'Brief Arabic explanation of why the cell is uncertain.',
                            },
                          },
                          required: ['row', 'col', 'reason'],
                        },
                      },
                    },
                    required: ['title', 'detectedDirection', 'headers', 'rows'],
                  },
                },
                summary: {
                  type: Type.STRING,
                  description: 'Concise Arabic summary of what was extracted.',
                },
              },
              required: ['tables', 'summary'],
            },
          },
        })
      );

      const rawText = (response.text ?? '{}').trim();
      let parsed: RawModelResponse;
      try {
        parsed = JSON.parse(rawText) as RawModelResponse;
      } catch {
        res.status(502).json({
          error: 'تعذر قراءة استجابة الذكاء الاصطناعي بشكل منظم. يرجى المحاولة بصورة أوضح.',
        });
        return;
      }

      const rawTables = Array.isArray(parsed.tables) ? parsed.tables : [];
      const normalizedTables = rawTables.map((t, idx) => normalizeTableShape(t, idx));

      res.json({
        tables: normalizedTables,
        summary:
          parsed.summary ||
          (normalizedTables.length > 0
            ? `تم استخراج ${normalizedTables.length} جدول بنجاح.`
            : 'لم يتم العثور على جدول واضح في هذه الصورة.'),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? Number((err as { status?: number }).status)
          : 500;

      if (message === 'MISSING_API_KEY' || status === 400 || status === 403) {
        res.status(status === 403 ? 403 : 500).json({
          error:
            'مفتاح Gemini API غير مهيأ أو غير صالح. يرجى التحقق من إعدادات المفتاح في لوحة Settings > Secrets.',
        });
        return;
      }

      if (status === 429) {
        res.status(429).json({
          error: 'تم تجاوز حد الطلبات مؤقتاً. يرجى الانتظار قليلاً ثم إعادة المحاولة.',
        });
        return;
      }

      console.error('Table extraction error:', err);
      res.status(500).json({
        error: 'حدث خطأ أثناء تحليل الصورة. يرجى المحاولة مرة أخرى.',
      });
    }
  });

  app.post('/api/assistant', async (req, res) => {
    try {
      const body = req.body as {
        message?: string;
        history?: Array<{ role: string; text: string }>;
        activeTable?: {
          title?: string;
          headers?: string[];
          rows?: string[][];
          notes?: string;
          uncertainCells?: Array<{ row: number; col: number; reason: string }>;
        } | null;
        diagnostic?: Record<string, unknown> | null;
        lastError?: string | null;
        imageBase64?: string;
        mimeType?: string;
      };

      const userMessage = (body?.message ?? '').trim();
      if (!userMessage) {
        res.status(400).json({ error: 'يرجى كتابة المشكلة أو الطلب أولاً.' });
        return;
      }

      const ai = getGeminiClient();

      const contextLines: string[] = [
        'You are the intelligent problem-solving assistant inside "جدولك", an Arabic AI Table-Image-to-Excel converter.',
        'Your job is to diagnose OCR/lighting/formatting/Excel problems, explain clearly in concise Arabic how to solve them, and—whenever the user asks to clean, fix, split, sort, calculate, or correct the table—return a complete corrected `updatedTable` object in JSON so the user can apply it with one click.',
        'Rules:',
        '1. Reply in clear, practical, helpful Arabic.',
        '2. If `activeTable` is provided and the user asks to fix/clean/verify/transform it (or if you spot concrete OCR errors by comparing `activeTable` against the attached image), return `updatedTable` with `title`, `headers`, and `rows` (where every row has the exact same length as `headers`), plus a short `suggestedActionTitle` (max 35 chars).',
        '3. If the user is only asking a troubleshooting question (e.g. why an upload failed, how to improve poor lighting, or how to use Excel formulas), omit `updatedTable` and give clear actionable steps.',
        '4. Never invent numbers that are neither in `activeTable` nor visible in the image (unless computing requested arithmetic like sums, averages, or VAT from existing numbers).',
      ];

      const promptParts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
      > = [];

      if (body.imageBase64 && typeof body.imageBase64 === 'string') {
        promptParts.push({
          inlineData: {
            mimeType: body.mimeType || 'image/png',
            data: body.imageBase64,
          },
        });
      }

      const contextPayload = {
        activeTable: body.activeTable ?? null,
        diagnostic: body.diagnostic ?? null,
        lastError: body.lastError ?? null,
        recentConversation: Array.isArray(body.history) ? body.history.slice(-6) : [],
        userRequest: userMessage,
      };

      promptParts.push({
        text: `سياق مساحة العمل الحالية:\n${JSON.stringify(contextPayload)}`,
      });

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: { parts: promptParts },
          config: {
            systemInstruction: contextLines.join('\n'),
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                reply: {
                  type: Type.STRING,
                  description: 'Clear Arabic diagnosis and helpful response.',
                },
                suggestedActionTitle: {
                  type: Type.STRING,
                  description: 'Short Arabic action button label if updatedTable is returned.',
                },
                updatedTable: {
                  type: Type.OBJECT,
                  description: 'Optional corrected or transformed table ready to apply.',
                  properties: {
                    title: { type: Type.STRING },
                    headers: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    rows: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                    },
                  },
                  required: ['title', 'headers', 'rows'],
                },
              },
              required: ['reply'],
            },
          },
        })
      );

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText) as {
        reply?: string;
        suggestedActionTitle?: string;
        updatedTable?: {
          title?: string;
          headers?: string[];
          rows?: string[][];
        };
      };

      let normalizedUpdatedTable:
        | { title: string; headers: string[]; rows: string[][] }
        | undefined;

      if (
        parsed.updatedTable &&
        Array.isArray(parsed.updatedTable.headers) &&
        parsed.updatedTable.headers.length > 0 &&
        Array.isArray(parsed.updatedTable.rows)
      ) {
        const headers = parsed.updatedTable.headers.map((h) => String(h ?? '').trim());
        const colCount = headers.length;
        const rows = parsed.updatedTable.rows.map((r) =>
          Array.isArray(r)
            ? Array.from({ length: colCount }, (_, i) => String(r[i] ?? '').trim())
            : Array.from({ length: colCount }, () => '')
        );
        normalizedUpdatedTable = {
          title:
            String(parsed.updatedTable.title ?? '').trim() ||
            body.activeTable?.title ||
            'جدول محدث',
          headers,
          rows,
        };
      }

      res.json({
        reply: parsed.reply || 'تم فحص الطلب بنجاح.',
        suggestedActionTitle: parsed.suggestedActionTitle?.trim(),
        updatedTable: normalizedUpdatedTable,
      });
    } catch (err: unknown) {
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? Number((err as { status?: number }).status)
          : 500;
      if (status === 429) {
        res.status(429).json({
          error: 'تم تجاوز حد الطلبات مؤقتاً. يرجى المحاولة بعد لحظات.',
        });
        return;
      }
      console.error('Assistant API error:', err);
      res.status(500).json({
        error: 'تعذر معالجة طلب المساعد الذكي حالياً. يرجى المحاولة مرة أخرى.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
