'use client';
import { useState } from 'react';
import {
  pdfRowReviewReason,
  type PdfPreview,
  type PdfRow,
} from '@/lib/import/pdf';
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
import { ArrowRight, ChevronDown, FileCheck2, Search } from 'lucide-react';

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
  const [showRows, setShowRows] = useState(false);
  const [reviewOnly, setReviewOnly] = useState(false);
  const selected = preview.rows.filter((row) => row.selected);
  const reviewRows = preview.rows.filter((row) => pdfRowReviewReason(row));
  const reviewCount = reviewRows.length + preview.skippedRows;
  const unresolved = selected.some((row) => pdfRowReviewReason(row));
  const visibleRows = reviewOnly ? reviewRows : preview.rows;
  const edit = (id: string, change: Partial<PdfRow>) =>
    onChange(
      preview.rows.map((row) =>
        row.id === id
          ? {
              ...row,
              ...change,
              ...('date' in change ||
              'merchant' in change ||
              'amount' in change ||
              'currency' in change ||
              'direction' in change
                ? {
                    reviewReasons: [],
                    parseConfidence: 1,
                  }
                : {}),
            }
          : row,
      ),
    );
  const openRows = (onlyReview = false) => {
    setReviewOnly(onlyReview);
    setShowRows(true);
  };

  return (
    <div className="pdf-review">
      <div className="pdf-review-heading">
        <FileCheck2 size={27} />
        <div>
          <h2>Мы распознали операции</h2>
          <p>
            Нашли {preview.rows.length} операций. Вы можете проверить результат
            или сразу продолжить — сомнительные строки мы не будем учитывать
            автоматически.
          </p>
        </div>
      </div>

      <div className="recognition-summary" aria-label="Результат распознавания">
        <div>
          <strong>{preview.rows.length}</strong>
          <span>операций найдено</span>
        </div>
        <div>
          <strong>{reviewCount}</strong>
          <span>требуют проверки</span>
        </div>
        <div>
          <strong>{preview.totalPages}</strong>
          <span>страниц обработано</span>
        </div>
      </div>

      {reviewCount > 0 && (
        <div className="review-notice">
          <div>
            <strong>Есть операции, которые стоит проверить</strong>
            <p>
              {reviewCount} строк требуют дополнительной проверки. Они не будут
              учтены автоматически.
            </p>
          </div>
          {reviewRows.length > 0 && (
            <button className="text-link" onClick={() => openRows(true)}>
              Проверить
            </button>
          )}
        </div>
      )}

      <div className="recognition-actions">
        <button
          className="primary-button"
          disabled={busy || !selected.length || unresolved}
          onClick={onSubmit}
        >
          {busy ? 'Ищем расходы…' : 'Найти регулярные расходы'}{' '}
          <ArrowRight size={18} />
        </button>
        <button className="secondary-button" onClick={() => openRows(false)}>
          <Search size={17} />
          Посмотреть распознанные операции
        </button>
        <button className="text-link" onClick={onBack}>
          Выбрать другой файл
        </button>
      </div>

      {!selected.length && (
        <p className="quiet-note">
          Уверенно распознанных расходов пока нет. Проверьте строки вручную или
          выберите другой файл.
        </p>
      )}

      {showRows && (
        <section className="recognized-rows" aria-label="Распознанные операции">
          <div className="recognized-rows-heading">
            <div>
              <h3>
                {reviewOnly ? 'Операции для проверки' : 'Распознанные операции'}
              </h3>
              <p>
                Измените данные или снимите отметку, чтобы исключить операцию.
              </p>
            </div>
            <button className="text-link" onClick={() => setShowRows(false)}>
              Скрыть
            </button>
          </div>
          {!reviewOnly && (
            <label className="pdf-select">
              <Checkbox
                checked={
                  preview.rows.some(
                    (row) =>
                      row.direction === 'expense' && !pdfRowReviewReason(row),
                  ) &&
                  preview.rows
                    .filter(
                      (row) =>
                        row.direction === 'expense' && !pdfRowReviewReason(row),
                    )
                    .every((row) => row.selected)
                }
                onCheckedChange={(checked) =>
                  onChange(
                    preview.rows.map((row) => ({
                      ...row,
                      selected:
                        !!checked &&
                        row.direction === 'expense' &&
                        !pdfRowReviewReason(row),
                    })),
                  )
                }
              />
              Выбрать все уверенно распознанные расходы
            </label>
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
                {visibleRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Checkbox
                        checked={row.selected}
                        aria-label={'Учитывать ' + row.merchant}
                        onCheckedChange={(checked) =>
                          edit(row.id, { selected: !!checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        aria-label="Дата операции"
                        value={row.date}
                        onChange={(event) =>
                          edit(row.id, { date: event.target.value })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label="Описание операции"
                        value={row.merchant}
                        maxLength={240}
                        onChange={(event) =>
                          edit(row.id, { merchant: event.target.value })
                        }
                      />
                      {pdfRowReviewReason(row) && (
                        <small className="row-review-reason">
                          {pdfRowReviewReason(row)}
                        </small>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label="Сумма операции"
                        inputMode="decimal"
                        value={row.amount}
                        onChange={(event) =>
                          edit(row.id, { amount: event.target.value })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label="Валюта операции"
                        value={row.currency}
                        maxLength={3}
                        onChange={(event) =>
                          edit(row.id, {
                            currency: event.target.value.toUpperCase(),
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <SelectField
                        label="Направление операции"
                        value={row.direction}
                        onChange={(value) => {
                          const direction = value as PdfRow['direction'];
                          edit(row.id, {
                            direction,
                            selected:
                              direction === 'expense' &&
                              !pdfRowReviewReason({ ...row, direction }),
                          });
                        }}
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
        </section>
      )}

      <details className="recognition-details">
        <summary>
          Подробнее о распознавании <ChevronDown size={15} />
        </summary>
        <p>
          Пополнения и исключённые строки не участвуют в поиске регулярных
          расходов.
        </p>
        {preview.warnings.map((warning, index) => (
          <p key={index}>{warning}</p>
        ))}
      </details>
    </div>
  );
}
