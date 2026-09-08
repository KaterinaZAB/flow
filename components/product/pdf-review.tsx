'use client';
import type { PdfPreview, PdfRow } from '@/lib/import/pdf';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { SelectField } from './select-field';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { ArrowRight, FileCheck2 } from 'lucide-react';
export function PdfReview({
  preview,
  onChange,
  onSubmit,
  onBack,
  busy,
}: {
  preview: PdfPreview;
  onChange: (rows: PdfRow[]) => void;
  onSubmit: () => void;
  onBack: () => void;
  busy: boolean;
}) {
  const selected = preview.rows.filter((r) => r.selected);
  const unresolved = selected.some((r) => r.direction === 'unknown');
  function edit(id: string, change: Partial<PdfRow>) {
    onChange(preview.rows.map((r) => (r.id === id ? { ...r, ...change } : r)));
  }
  return (
    <div className="pdf-review">
      <div className="pdf-review-heading">
        <FileCheck2 size={25} />
        <div>
          <h2>Проверьте операции из PDF</h2>
          <p>
            {preview.totalPages} стр. · {preview.rows.length} строк распознано
          </p>
        </div>
      </div>
      <div className="pdf-review-warnings">
        {preview.warnings.map((w, i) => (
          <p key={i}>{w}</p>
        ))}
      </div>
      <label className="pdf-select">
        <Checkbox
          checked={
            preview.rows.some((r) => r.direction === 'expense') &&
            preview.rows
              .filter((r) => r.direction === 'expense')
              .every((r) => r.selected)
          }
          onCheckedChange={(v) =>
            onChange(
              preview.rows.map((r) => ({
                ...r,
                selected: !!v && r.direction === 'expense',
              })),
            )
          }
        />
        Выбрать все распознанные расходы
      </label>
      {preview.rows.some((r) => r.direction === 'unknown') && (
        <button
          className="secondary-button mb-4"
          onClick={() =>
            onChange(
              preview.rows.map((r) =>
                r.direction === 'unknown'
                  ? { ...r, direction: 'expense', selected: true }
                  : r,
              ),
            )
          }
        >
          Неясные строки — это расходы
        </button>
      )}
      <div className="pdf-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <span className="sr-only">Выбрать</span>
              </TableHead>
              <TableHead>Дата</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead>Сумма</TableHead>
              <TableHead>Валюта</TableHead>
              <TableHead>Направление</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Checkbox
                    checked={r.selected}
                    aria-label={'Импортировать ' + r.merchant}
                    onCheckedChange={(v) => edit(r.id, { selected: !!v })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="date"
                    aria-label="Дата операции"
                    value={r.date}
                    onChange={(e) => edit(r.id, { date: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    aria-label="Описание операции"
                    value={r.merchant}
                    maxLength={240}
                    onChange={(e) => edit(r.id, { merchant: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    aria-label="Сумма операции"
                    inputMode="decimal"
                    value={r.amount}
                    onChange={(e) => edit(r.id, { amount: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    aria-label="Валюта операции"
                    value={r.currency}
                    maxLength={3}
                    onChange={(e) =>
                      edit(r.id, { currency: e.target.value.toUpperCase() })
                    }
                  />
                </TableCell>
                <TableCell>
                  <SelectField
                    label="Направление операции"
                    value={r.direction}
                    onChange={(v) =>
                      edit(r.id, {
                        direction: v as PdfRow['direction'],
                        selected: v === 'expense',
                      })
                    }
                    options={[
                      { value: 'unknown', label: 'Уточните' },
                      { value: 'expense', label: 'Расход' },
                      { value: 'income', label: 'Пополнение' },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="pdf-review-footer">
        <button className="secondary-button" onClick={onBack}>
          Другой файл
        </button>
        <button
          className="primary-button"
          disabled={busy || !selected.length || unresolved}
          onClick={onSubmit}
        >
          {busy
            ? 'Импортируем…'
            : 'Найти регулярные расходы (' + selected.length + ')'}
          <ArrowRight size={16} />
        </button>
      </div>
      {unresolved && (
        <p className="error-box">
          Укажите направление у всех выбранных операций.
        </p>
      )}
      <p className="import-hint">
        Пополнения не учитываются в расходах. После этого шага вы отдельно
        подтвердите найденные регулярные платежи.
      </p>
    </div>
  );
}
