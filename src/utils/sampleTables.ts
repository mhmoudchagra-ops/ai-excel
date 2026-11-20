export interface SampleTablePreset {
  id: string;
  label: string;
  subtitle: string;
  fileName: string;
  generateDataUrl: () => string;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function renderSampleTableCanvas(config: {
  title: string;
  meta: string;
  headers: string[];
  rows: string[][];
  colWidths: number[];
  headerBg: string;
  stripeBg: string;
}): string {
  const width = 1080;
  const padX = 56;
  const startY = 140;
  const rowH = 52;
  const height = startY + (config.rows.length + 1) * rowH + 72;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Paper background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Subtle paper frame
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 20, 20, width - 40, height - 40, 8);
  ctx.stroke();

  // Title & Metadata (RTL aligned right)
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 28px "IBM Plex Sans Arabic", Arial, sans-serif';
  ctx.fillText(config.title, width - padX, 74);

  ctx.fillStyle = '#64748B';
  ctx.font = '400 16px "IBM Plex Sans Arabic", Arial, sans-serif';
  ctx.fillText(config.meta, width - padX, 108);

  const tableWidth = width - padX * 2;
  const totalRatio = config.colWidths.reduce((a, b) => a + b, 0);
  const pxWidths = config.colWidths.map((w) => (w / totalRatio) * tableWidth);

  const allRows = [config.headers, ...config.rows];

  allRows.forEach((row, rIdx) => {
    const y = startY + rIdx * rowH;
    const isHeader = rIdx === 0;

    if (isHeader) {
      ctx.fillStyle = config.headerBg;
      ctx.fillRect(padX, y, tableWidth, rowH);
    } else if (rIdx % 2 === 0) {
      ctx.fillStyle = config.stripeBg;
      ctx.fillRect(padX, y, tableWidth, rowH);
    }

    // Draw cells from right to left (RTL)
    let cursorRight = width - padX;
    row.forEach((cellText, cIdx) => {
      const colW = pxWidths[cIdx];
      const cellLeft = cursorRight - colW;

      ctx.strokeStyle = isHeader ? config.headerBg : '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.strokeRect(cellLeft, y, colW, rowH);

      ctx.fillStyle = isHeader ? '#FFFFFF' : '#1E293B';
      ctx.font = isHeader
        ? '600 17px "IBM Plex Sans Arabic", Arial, sans-serif'
        : '400 16px "IBM Plex Sans Arabic", Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(cellText, cursorRight - 14, y + rowH / 2, colW - 28);

      cursorRight = cellLeft;
    });
  });

  return canvas.toDataURL('image/png');
}

export const SAMPLE_PRESETS: SampleTablePreset[] = [
  {
    id: 'invoice',
    label: 'فاتورة مبيعات ضريبية',
    subtitle: 'بنود · كميات · ضريبة 15%',
    fileName: 'فاتورة_مبيعات_نموذجية.png',
    generateDataUrl: () =>
      renderSampleTableCanvas({
        title: 'تفاصيل فاتورة المبيعات — رقم #INV-2026-408',
        meta: 'التاريخ: 2026/11/14 · العملة: ريال سعودي (SAR)',
        headers: ['الصنف', 'الكمية', 'سعر الوحدة', 'الضريبة (15%)', 'الإجمالي'],
        rows: [
          ['شاشة عرض مكتبية 27 بوصة', '4', '1,250.00', '750.00', '5,750.00'],
          ['لوحة مفاتيح لاسلكية عربية', '10', '220.00', '330.00', '2,530.00'],
          ['حامل لابتوب ألمنيوم قابل للطي', '6', '145.00', '130.50', '1,000.50'],
          ['موزع منافذ USB-C متعدد', '8', '180.00', '216.00', '1,656.00'],
          ['كابل شبكات Cat6 بطول 5 متر', '15', '35.00', '78.75', '603.75'],
          ['الإجمالي النهائي', '43', '—', '1,505.25', '11,540.25'],
        ],
        colWidths: [3.2, 1.1, 1.5, 1.6, 1.6],
        headerBg: '#15803D',
        stripeBg: '#F8FAFC',
      }),
  },
  {
    id: 'sales-report',
    label: 'تقرير المبيعات الفصلي',
    subtitle: 'المناطق · الأهداف · النمو',
    fileName: 'تقرير_المبيعات_الفصلي.png',
    generateDataUrl: () =>
      renderSampleTableCanvas({
        title: 'ملخص الأداء والمبيعات للربع الثالث',
        meta: 'القسم التجاري · جميع القيم بآلاف الريالات',
        headers: ['المنطقة', 'المستهدف', 'المحقق فعلياً', 'نسبة الإنجاز', 'عدد العقود'],
        rows: [
          ['الرياض الوسطى', '450,000', '492,500', '109.4%', '34'],
          ['المنطقة الشرقية', '380,000', '365,200', '96.1%', '27'],
          ['جدة والمنطقة الغربية', '410,000', '448,900', '109.5%', '31'],
          ['المنطقة الجنوبية', '210,000', '198,400', '94.5%', '16'],
          ['القصيم والشمال', '175,000', '186,000', '106.3%', '14'],
        ],
        colWidths: [2.4, 1.5, 1.6, 1.3, 1.2],
        headerBg: '#0F172A',
        stripeBg: '#F1F5F9',
      }),
  },
  {
    id: 'inventory',
    label: 'كشف جرد المستودع',
    subtitle: 'أكواد SKU · الرصيد · الحالة',
    fileName: 'كشف_جرد_المستودع.png',
    generateDataUrl: () =>
      renderSampleTableCanvas({
        title: 'بيان جرد المخزون الشهري — مستودع رقم 2',
        meta: 'المشرف: خالد المنصور · حالة الجرد: معتمد',
        headers: ['رمز الصنف', 'اسم المادة', 'الرصيد المتاح', 'الحد الأدنى', 'حالة التوفر'],
        rows: [
          ['SKU-1042', 'ورق طباعة A4 (صندوق)', '142', '50', 'متوفر'],
          ['SKU-1088', 'حبر طابعة ليزر أسود', '18', '25', 'منخفض'],
          ['SKU-1120', 'ملفات أرشيف بلاستيكية', '310', '80', 'متوفر'],
          ['SKU-1154', 'أقلام تحديد سبورة (علبة)', '9', '20', 'طلب عاجل'],
          ['SKU-1209', 'أظرف مراسلات رسمية', '540', '100', 'متوفر'],
        ],
        colWidths: [1.5, 2.8, 1.4, 1.3, 1.5],
        headerBg: '#1E293B',
        stripeBg: '#F8FAFC',
      }),
  },
];
