'use client';
import { useId, useState } from 'react';
import { money } from '@/lib/domain/money';
/** Straight segments preserve the forecast values; no invented interpolation peaks. */
export function ForecastChart({
  months,
  currency,
}: {
  months: { month: string; label: string; amount: number; partial: boolean }[];
  currency: string;
}) {
  const id = useId().replace(/:/g, '');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const selected = months.find((month) => month.month === selectedMonth);
  const max = Math.max(1, ...months.map((m) => m.amount));
  const points = months
    .map(
      (m, i) =>
        `${8 + (i * 384) / Math.max(1, months.length - 1)},${166 - (m.amount / max) * 148}`,
    )
    .join(' ');
  const description = months
    .map(
      (m) =>
        `${m.label}: ${money(m.amount, currency)}${m.partial ? ' до конца месяца' : ''}`,
    )
    .join('; ');
  return (
    <div>
      <div className="forecast-selection" aria-live="polite">
        {selected ? (
          <>
            <span>
              {selected.label}
              {selected.partial ? ' · до конца месяца' : ''}
            </span>
            <strong>{money(selected.amount, currency)}</strong>
          </>
        ) : (
          <span>Нажмите на точку, чтобы увидеть сумму</span>
        )}
      </div>
      <svg
        className="forecast-chart"
        viewBox="0 0 400 180"
        preserveAspectRatio="none"
        role="group"
        aria-label={description}
      >
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity=".35" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[18, 67, 116, 166].map((y) => (
          <line key={y} x1="8" x2="392" y1={y} y2={y} className="chart-grid" />
        ))}
        <polygon points={`8,176 ${points} 392,176`} fill={`url(#${id})`} />
        <polyline points={points} className="chart-line" />
        {months.map((m, i) => (
          <g
            key={m.month}
            className="forecast-point"
            role="button"
            tabIndex={0}
            aria-label={`${m.label}: ${money(m.amount, currency)}${m.partial ? ' до конца месяца' : ''}`}
            aria-pressed={selectedMonth === m.month}
            onClick={() => setSelectedMonth(m.month)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedMonth(m.month);
              }
            }}
          >
            <circle
              cx={8 + (i * 384) / Math.max(1, months.length - 1)}
              cy={166 - (m.amount / max) * 148}
              r="22"
              fill="transparent"
            />
            <circle
              className="forecast-dot"
              cx={8 + (i * 384) / Math.max(1, months.length - 1)}
              cy={166 - (m.amount / max) * 148}
              r={selectedMonth === m.month ? 6 : 4}
              fill="var(--primary)"
            />
          </g>
        ))}
      </svg>
      <div className="chart-labels" aria-hidden="true">
        {months.map((m) => (
          <span key={m.month}>{m.label}</span>
        ))}
      </div>
    </div>
  );
}
