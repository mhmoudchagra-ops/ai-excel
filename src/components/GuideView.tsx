import React from 'react';

interface GuideViewProps {
  onGoToWorkspace: () => void;
}

export const GuideView: React.FC<GuideViewProps> = ({ onGoToWorkspace }) => {
  const sections = [
    {
      num: '01.',
      title: 'التصوير والوضوح الأمثل',
      body: 'التقط الصورة بإضاءة متساوية ومن زاوية عمودية قدر الإمكان. إذا كانت الصورة مائلة أو مقلوبة، يمكنك استخدام أزرار التدوير (90 درجة) داخل المعاينة ثم الضغط على "إعادة تحليل الصورة".',
    },
    {
      num: '02.',
      title: 'اللصق السريع من الحافظة (Ctrl+V)',
      body: 'عند العمل على ملفات PDF أو تقارير الويب، خذ لقطة شاشة للجدول مباشرة والصقها في أي مكان داخل الصفحة باستخدام Ctrl+V (أو Cmd+V على نظام ماك) ليبدأ التحويل فوراً دون حفظ ملفات مؤقتة.',
    },
    {
      num: '03.',
      title: 'توحيد الأرقام والحسابات في Excel',
      body: 'يقوم المحول تلقائياً بتحويل الأرقام العربية والهندية (٠١٢٣) إلى أرقام قياسية (0123) وتنسيق الخلايا الرقمية كأرقام فعلية داخل ملف .xlsx بحيث تعمل معادلات الجمع (SUM) والمتوسط في Microsoft Excel مباشرة.',
    },
    {
      num: '04.',
      title: 'الجداول المتعددة في صورة واحدة',
      body: 'إذا احتوت الصفحة المصورة على أكثر من جدول (مثل فاتورة بها جدول بنود وجدول ملخص ضريبي)، سيتم فصل كل جدول في ورقة عمل مستقلة داخل نفس ملف الإكسل.',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      <div className="border-b border-slate-200 pb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            نصائح للحصول على أعلى دقة في التحويل
          </h1>
          <p className="text-sm text-slate-600">
            إرشادات عملية لتجهيز صور الجداول والفواتير الورقية والرقمية قبل التصدير إلى Excel.
          </p>
        </div>
        <button
          type="button"
          onClick={onGoToWorkspace}
          className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
        >
          العودة لمساحة التحويل
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((sec) => (
          <article
            key={sec.num}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-2.5"
          >
            <h2 className="font-display text-base font-bold text-slate-900">
              <span className="font-mono text-emerald-700 ml-2">{sec.num}</span>
              {sec.title}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">{sec.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
};
