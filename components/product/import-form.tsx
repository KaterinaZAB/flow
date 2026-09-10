'use client';
import { localCommand } from '@/lib/local/actions';
import { PdfReview } from './pdf-review';
import type { PdfPreview } from '@/lib/import/pdf';
import { useState, useRef } from 'react';
import {
  UploadCloud,
  ShieldCheck,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { SelectField } from './select-field';
import { currencies, type TransactionImport } from '@/lib/domain/types';

import type { Candidate, Transaction } from '@/lib/domain/types';
type Result = {
  id: string;
  analyzedCount: number;
  transactionCount: number;
  skippedCount: number;
  warnings: string[];
  candidateCount?: number;
  candidates?: Candidate[];
  transactions?: Transaction[];
};
export function ImportForm({ imports }: { imports: TransactionImport[] }) {
  const [pdfPreview, setPdfPreview] = useState<PdfPreview | null>(null);
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [drag, setDrag] = useState(false),
    [currency, setCurrency] = useState('RUB'),
    [result, setResult] = useState<Result | null>(null),
    [headers, setHeaders] = useState<string[]>([]),
    [mapping, setMapping] = useState<Record<string, number>>({
      date: 0,
      merchant: 1,
      amount: 2,
      currency: -1,
      direction: -1,
    });
  const ref = useRef<HTMLInputElement>(null);
  function choose(f: File | undefined) {
    if (!f) return;
    setError('');
    setHeaders([]);
    setResult(null);
    setPdfPreview(null);
    setFile(null);
    if (
      !/\.(pdf|csv|xlsx)$/i.test(f.name) ||
      f.size > (f.name.toLowerCase().endsWith('.pdf') ? 5 : 2) * 1024 * 1024
    ) {
      setError('Выберите PDF до 5 МБ или CSV/XLSX до 2 МБ.');
      return;
    }
    setFile(f);
  }
  async function upload(reviewed = false) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('amountMode', 'auto');
      form.set('currency', currency);
      if (reviewed && pdfPreview) {
        form.set('pdfReviewed', 'true');
        form.set('pdfRows', JSON.stringify(pdfPreview.rows));
      }
      if (headers.length) form.set('mapping', JSON.stringify(mapping));
      const r = await localCommand('/imports', {
        method: 'POST',
        body: form,
      });
      const data = (await r.json()) as Result & {
        error?: string;
        mappingRequired?: boolean;
        headers?: string[];
        pdfPreview?: PdfPreview;
      };
      if (data.pdfPreview) {
        setPdfPreview(data.pdfPreview);
        return;
      }
      if (data.mappingRequired) {
        setHeaders(data.headers ?? []);
        throw new Error(data.error);
      }
      if (!r.ok) throw new Error(data.error);
      if ((data.candidateCount ?? 0) > 0) {
        window.location.href = '/detected';
        return;
      }
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Найдём регулярные расходы автоматически</h1>
          <p>
            Загрузите выписку по счёту карты — подойдёт даже один месяц. Мы
            найдём известные сервисы и повторяющиеся платежи.
          </p>
        </div>
      </div>
      {error && pdfPreview && (
        <div role="alert" className="error-box">
          {error}
        </div>
      )}
      <ol className="import-steps" aria-label="Этапы импорта">
        <li aria-current={!file ? 'step' : undefined}>
          <span>1</span>
          <div>
            <strong>Загрузка</strong>
            <small>{file ? 'Выписка загружена' : 'Выберите файл'}</small>
          </div>
        </li>
        <li aria-current={file && !pdfPreview && !result ? 'step' : undefined}>
          <span>2</span>
          <div>
            <strong>Распознавание</strong>
            <small>
              {pdfPreview
                ? `${pdfPreview.rows.length} операций найдено`
                : result
                  ? `${result.analyzedCount} операций найдено`
                  : file
                    ? 'Готово к распознаванию'
                    : 'Ожидает загрузки'}
            </small>
          </div>
        </li>
        <li aria-current={pdfPreview || result ? 'step' : undefined}>
          <span>3</span>
          <div>
            <strong>Результат</strong>
            <small>
              {result
                ? `${result.candidateCount ?? 0} регулярных расходов найдено`
                : 'Ожидает анализа'}
            </small>
          </div>
        </li>
      </ol>
      <div className="import-layout import-focused">
        <section className="panel import-panel">
          {result ? (
            <div className="import-success">
              <CheckCircle2 size={44} />
              <h2>Регулярные расходы не найдены</h2>
              <p>
                Мы проанализировали {result.analyzedCount} операций, но не нашли
                достаточно уверенных повторяющихся платежей.
              </p>
              {result.warnings.length > 0 && (
                <details>
                  <summary>Подробнее о распознавании</summary>
                  {result.warnings.map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </details>
              )}
              <div className="empty-actions">
                <button
                  className="primary-button"
                  onClick={() => {
                    setResult(null);
                    setFile(null);
                    setPdfPreview(null);
                  }}
                >
                  Загрузить выписку за больший период
                </button>
                <a className="secondary-button" href="/expenses">
                  Добавить расход вручную
                </a>
              </div>
            </div>
          ) : busy ? (
            <div className="processing" role="status" aria-live="polite">
              <div className="spinner" />
              <h2>Анализируем операции</h2>
              <p>
                Распознаём данные и проверяем повторяющиеся платежи.
                <br />
                Это может занять несколько секунд.
              </p>
              <small>Файл: {file?.name}</small>
            </div>
          ) : pdfPreview ? (
            <PdfReview
              preview={pdfPreview}
              onChange={(rows) => setPdfPreview({ ...pdfPreview, rows })}
              onSubmit={() => void upload(true)}
              onBack={() => {
                setPdfPreview(null);
                setFile(null);
              }}
              busy={busy}
            />
          ) : (
            <>
              <div
                className={'dropzone ' + (drag ? 'drag' : '')}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  choose(e.dataTransfer.files[0]);
                }}
              >
                {file ? (
                  <div className="selected-file-card">
                    <div className="scan-icon">
                      <FileSpreadsheet size={32} />
                    </div>
                    <div className="selected-file-copy">
                      <h2>{file.name}</h2>
                      <p>
                        {file.name.split('.').pop()?.toUpperCase()} ·{' '}
                        {(file.size / 1024).toFixed(0)} КБ
                      </p>
                      <strong>Файл готов к анализу</strong>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="scan-icon">
                      <UploadCloud size={34} />
                    </div>
                    <h2>Перетащите PDF-выписку сюда</h2>
                    <p>или выберите файл на устройстве</p>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => ref.current?.click()}
                    >
                      Выбрать файл
                    </button>
                  </>
                )}
                <input
                  ref={ref}
                  type="file"
                  accept=".pdf,.csv,.xlsx"
                  className="sr-only"
                  aria-label="Банковская выписка"
                  onChange={(e) => choose(e.target.files?.[0])}
                />
                {file && headers.length === 0 && (
                  <div className="selected-file-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => ref.current?.click()}
                    >
                      Изменить загруженный файл
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void upload()}
                      className="primary-button import-analyze"
                    >
                      Найти подписки
                      <ArrowRight size={20} />
                    </button>
                  </div>
                )}
                {!file && (
                  <>
                    <span className="muted">
                      PDF до 5 МБ · CSV / XLSX до 2 МБ
                    </span>
                    <small className="muted">
                      Подойдёт один месяц. PDF — текстовый, без пароля.
                    </small>
                  </>
                )}
              </div>
              <div className="import-options">
                <div className="form-field">
                  <label htmlFor="import-currency">
                    Валюта, если не указана
                  </label>
                  <SelectField
                    id="import-currency"
                    label="Валюта импорта"
                    value={currency}
                    onChange={setCurrency}
                    options={currencies.map((v) => ({ value: v, label: v }))}
                  />
                </div>
              </div>
              <p className="import-hint">
                Расходы и пополнения определим автоматически.
              </p>
              {headers.length > 0 && (
                <div className="mapping-fields">
                  <h3>Сопоставьте столбцы</h3>
                  {[
                    { key: 'date', label: 'Дата' },
                    { key: 'merchant', label: 'Описание / получатель' },
                    { key: 'amount', label: 'Сумма расхода' },
                    { key: 'currency', label: 'Валюта (необязательно)' },
                    { key: 'direction', label: 'Направление (необязательно)' },
                  ].map(({ key, label }) => (
                    <div className="form-field" key={key}>
                      <label>{label}</label>
                      <SelectField
                        label={label}
                        value={String(mapping[key])}
                        onChange={(v) =>
                          setMapping((s) => ({ ...s, [key]: Number(v) }))
                        }
                        options={[
                          ...(['currency', 'direction'].includes(key)
                            ? [{ value: '-1', label: 'Нет столбца' }]
                            : []),
                          ...headers.map((h, i) => ({
                            value: String(i),
                            label: h || 'Столбец ' + (i + 1),
                          })),
                        ]}
                      />
                    </div>
                  ))}
                </div>
              )}
              {error && (
                <div role="alert" className="error-box">
                  {error}
                </div>
              )}
              {headers.length > 0 && (
                <div className="import-submit">
                  <button
                    disabled={!file || busy}
                    onClick={() => upload()}
                    className="primary-button import-analyze"
                  >
                    Применить столбцы и начать анализ
                    <ArrowRight size={17} />
                  </button>
                </div>
              )}
            </>
          )}
        </section>
        <div className="import-reassurance">
          <ShieldCheck size={24} />
          <p>Файл анализируется на устройстве и не отправляется на сервер.</p>
          <a href="/example-statement.csv" download className="text-link">
            Попробовать на примере CSV ↗
          </a>
        </div>
      </div>

      {imports.length > 0 && (
        <section className="panel import-history">
          <h2>История импортов</h2>
          {imports.slice(0, 6).map((i) => (
            <div key={i.id}>
              <FileSpreadsheet size={19} />
              <span>
                <strong>{i.filename}</strong>
                <small>
                  {new Date(i.createdAt).toLocaleDateString('ru-RU')} ·{' '}
                  {i.transactionCount} операций
                </small>
              </span>
              <span
                className={
                  'status ' + (i.status === 'completed' ? 'active' : 'paused')
                }
              >
                {i.status === 'completed'
                  ? 'Обработан'
                  : i.status === 'failed'
                    ? 'Ошибка'
                    : 'Обработка'}
              </span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
