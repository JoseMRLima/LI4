import React from 'react';

const styles = {
  normal: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  online: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  delayed: 'bg-amber-50 text-amber-700 border-amber-200',
  issue: 'bg-red-50 text-red-700 border-red-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  neutral: 'bg-slate-50 text-slate-700 border-slate-200',
};

export default function StatusBadge({ children, tone = 'neutral' }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${styles[tone] || styles.neutral}`}>
      {children}
    </span>
  );
}
