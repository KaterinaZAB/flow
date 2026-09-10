'use client';
import { localCommand, type ImportOutcome } from '@/lib/local/actions';
import { PdfReview } from './pdf-review';
import type { PdfPreview } from '@/lib/import/pdf';
import { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { SelectField } from './select-field';
import { type TransactionImport } from '@/lib/domain/types';

import type { Candidate, Transaction } from '@/lib/domain/types';
type Result = {
  id: string;
  analyzedCount: number;
  transactionCount: number;
  skippedCount: number;
  warnings: string[];
  candidateCount?: number;
  repeatedImport?: boolean;
  confirmedCandidateCount?: number;
  rejectedCandidateCount?: number;
  knownServiceCount?: number;
  outcomes?: ImportOutcome[];
  candidates?: Candidate[];
  transactions?: Transaction[];
};
export function ImportForm({ imports }: { imports: TransactionImport[] }) {
  const [pdfPreview, setPdfPreview] = useState<PdfPreview | null>(null);
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [drag, setDrag] = useState(false),
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
  const highlightedOutcome = result?.outcomes?.find(
    (outcome) => outcome.kind !== 'not_recurring',
  );
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
      form.set('currency', 'RUB');
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
      const hasFinalizedOutcome = data.outcomes?.some(
        (outcome) =>
          outcome.kind === 'confirmed_expense' ||
          outcome.kind === 'previously_rejected',
      );
      if (
        !hasFinalizedOutcome &&
        ((data.candidateCount ?? 0) > 0 ||
          data.outcomes?.some(
            (outcome) =>
              outcome.kind === 'new_candidate' ||
              outcome.kind === 'pending_candidate',
          ))
      ) {
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
  async function reconsider(candidateId: string) {
    setBusy(true);
    setError('');
    try {
      const response = await localCommand('/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [candidateId], decision: 'reconsider' }),
      });
      if (!response.ok)
        throw new Error('Не удалось вернуть расход на проверку.');
      window.location.href = '/detected';
    } catch (reason) {
      setError((reason as Error).message);
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
              <h2>
                {highlightedOutcome?.kind === 'confirmed_expense'
                  ? highlightedOutcome.expenseName +
                    ' уже добавлен в регулярные расходы'
                  : highlightedOutcome?.kind === 'previously_rejected'
                    ? highlightedOutcome.expenseName +
                      ' был ранее отмечен как нерегулярный'
                    : result.repeatedImport
                      ? 'Эта выписка уже была импортирована'
                      : 'Регулярные расходы не найдены'}
              </h2>
              <p>
                {highlightedOutcome?.kind === 'confirmed_expense'
                  ? 'Этот расход уже учтён в вашем обзоре.'
                  : highlightedOutcome?.kind === 'previously_rejected'
                    ? 'Мы не добавили его автоматически. Вы можете вернуть решение на проверку.'
                    : result.repeatedImport
                      ? 'Мы повторно проверили ранее найденные операции и не добавили дубликаты.'
                      : 'Мы проанализировали ' +
                        result.analyzedCount +
                        ' операций, но не нашли достаточно уверенных повторяющихся платежей.'}
              </p>
              {result.confirmedCandidateCount &&
              highlightedOutcome?.kind !== 'confirmed_expense' ? (
                <p className="import-hint">
                  {result.confirmedCandidateCount === 1
                    ? 'Похожий расход уже подтверждён и учтён в вашем обзоре.'
                    : 'Похожие расходы уже подтверждены и учтены в вашем обзоре.'}
                </p>
              ) : result.rejectedCandidateCount &&
                highlightedOutcome?.kind !== 'previously_rejected' ? (
                <p className="import-hint">
                  {result.rejectedCandidateCount === 1
                    ? 'Похожий расход был ранее отклонён и не будет добавлен автоматически.'
                    : 'Похожие расходы были ранее отклонены и не будут добавлены автоматически.'}
                </p>
              ) : result.knownServiceCount ? (
                <p className="import-hint">
                  Мы нашли известный сервис, но не смогли создать новый
                  кандидат. Проверьте операции или повторите анализ после
                  обновления страницы.
                </p>
              ) : null}
              {result.warnings.length > 0 && (
                <details>
                  <summary>Подробнее о распознавании</summary>
                  {result.warnings.map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </details>
              )}
              <div className="empty-actions">
                {highlightedOutcome?.kind === 'confirmed_expense' ? (
                  <a
                    className="primary-button"
                    href={'/expenses/' + highlightedOutcome.expenseId}
                  >
                    Открыть расход
                  </a>
                ) : highlightedOutcome?.kind === 'previously_rejected' ? (
                  <button
                    className="primary-button"
                    disabled={busy}
                    onClick={() =>
                      void reconsider(highlightedOutcome.candidateId)
                    }
                  >
                    Пересмотреть решение
                  </button>
                ) : (
                  <button
                    className="primary-button"
                    onClick={() => {
                      setResult(null);
                      setFile(null);
                      setPdfPreview(null);
                    }}
                  >
                    Загрузить выписку
                  </button>
                )}
                <a
                  className="secondary-button"
                  href={
                    result.outcomes?.some(
                      (outcome) =>
                        outcome.kind === 'new_candidate' ||
                        outcome.kind === 'pending_candidate',
                    )
                      ? '/detected'
                      : '/expenses'
                  }
                >
                  {result.outcomes?.some(
                    (outcome) =>
                      outcome.kind === 'new_candidate' ||
                      outcome.kind === 'pending_candidate',
                  )
                    ? 'Посмотреть кандидаты'
                    : result.confirmedCandidateCount
                      ? 'Открыть расходы'
                      : 'Добавить расход вручную'}
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
              busy={busy}
            />
          ) : (
            <>
              <div
                className={'dropzone ' + (file ? 'file-ready ' : '') + (drag ? 'drag' : '')}
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
                    <h2>Перетащите выписку сюда</h2>
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
                      Изменить
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void upload()}
                      className="primary-button import-analyze"
                    >
                      Найти расходы
                      <ArrowRight size={20} />
                    </button>
                  </div>
                )}
                {!file && (
                  <>
                    <span className="muted">
                      PDF до 5 МБ · CSV / XLSX до 2 МБ
                    </span>
                  </>
                )}
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
