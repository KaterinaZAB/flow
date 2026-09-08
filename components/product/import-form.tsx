'use client';
import { localAction } from '@/lib/local/actions';
import { PdfReview } from './pdf-review';
import type { PdfPreview } from '@/lib/import/pdf';
import { useState, useRef } from 'react';
import { UploadCloud, ShieldCheck, FileSpreadsheet, ArrowRight, CheckCircle2, } from 'lucide-react';
import { SelectField } from './select-field';
import { currencies, type TransactionImport } from '@/lib/domain/types';

import type { Candidate, Transaction } from '@/lib/domain/types';
type Result = {
    id: string;
    transactionCount: number;
    skippedCount: number;
    warnings: string[];
    candidateCount?: number;
    candidates?: Candidate[];
    transactions?: Transaction[];
};
export function ImportForm({ imports, }: {
    imports: TransactionImport[];
    
}) {
    const [pdfPreview, setPdfPreview] = useState<PdfPreview | null>(null);
    const [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [drag, setDrag] = useState(false), [currency, setCurrency] = useState('RUB'), [result, setResult] = useState<Result | null>(null), [headers, setHeaders] = useState<string[]>([]), [mapping, setMapping] = useState<Record<string, number>>({
        date: 0,
        merchant: 1,
        amount: 2,
        currency: -1,
        direction: -1,
    });
    const ref = useRef<HTMLInputElement>(null);
    function choose(f: File | undefined) {
        setError('');
        setHeaders([]);
        setResult(null);
        setPdfPreview(null);
        if (!f)
            return;
        if (!/\.(pdf|csv|xlsx)$/i.test(f.name) ||
            f.size > (f.name.toLowerCase().endsWith('.pdf') ? 5 : 2) * 1024 * 1024) {
            setError('Выберите PDF до 5 МБ или CSV/XLSX до 2 МБ.');
            return;
        }
        setFile(f);
    }
    async function upload(reviewed = false) {
        if (!file)
            return;
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
            if (headers.length)
                form.set('mapping', JSON.stringify(mapping));
            const r = await localAction('/api/imports', {
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
            if (!r.ok)
                throw new Error(data.error);
            setResult(data);
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    return (<>
      <div className="page-heading">
        <div>
          <div className="eyebrow">МЕНЬШЕ РУЧНОЙ РАБОТЫ</div>
          <h1>Найдём регулярные расходы автоматически</h1>
          <p>
            Загрузите выписку по счёту карты — подойдёт даже один месяц. Мы
            найдём известные сервисы и повторяющиеся платежи.
          </p>
        </div>
      </div>
      {error && pdfPreview && (<div role="alert" className="error-box">
          {error}
        </div>)}
      <div className="import-layout">
        <section className="panel import-panel">
          {result ? (<div className="import-success">
              <CheckCircle2 size={44}/>
              <h2>Выписка обработана</h2>
              <p>
                {result.transactionCount} операций{' '}
                {'добавлено'} ·{' '}
                {result.skippedCount} пропущено
              </p>
              {result.candidateCount !== undefined && (<p>
                  Найдено возможных расходов:{' '}
                  <strong>{result.candidateCount}</strong>
                </p>)}
              {result.warnings.length > 0 && (<details>
                  <summary>
                    Замечания к данным ({result.warnings.length})
                  </summary>
                  {result.warnings.map((w, i) => (<p key={i}>{w}</p>))}
                </details>)}
              {(<a className="primary-button" href="/detected">
                  Проверить найденные расходы
                  <ArrowRight size={17}/>
                </a>)}
              <button className="text-link" onClick={() => {
                setResult(null);
                setFile(null);
                setPdfPreview(null);
            }}>
                Загрузить ещё одну выписку
              </button>
            </div>) : busy ? (<div className="processing" role="status" aria-live="polite">
              <div className="spinner"/>
              <h2>Анализируем операции</h2>
              <p>
                Распознаём данные и проверяем повторяющиеся платежи.
                <br />
                Это может занять несколько секунд.
              </p>
              <small>Файл: {file?.name}</small>
            </div>) : pdfPreview ? (<PdfReview preview={pdfPreview} onChange={(rows) => setPdfPreview({ ...pdfPreview, rows })} onSubmit={() => void upload(true)} onBack={() => {
                setPdfPreview(null);
                setFile(null);
            }} busy={busy}/>) : (<>
              <div className={'dropzone ' + (drag ? 'drag' : '')} onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
            }} onDragLeave={() => setDrag(false)} onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                choose(e.dataTransfer.files[0]);
            }}>
                <div className="scan-icon">
                  {file ? (<FileSpreadsheet size={32}/>) : (<UploadCloud size={34}/>)}
                </div>
                <h2>{file ? file.name : 'Перетащите PDF-выписку сюда'}</h2>
                <p>
                  {file
                ? (file.size / 1024).toFixed(0) + ' КБ · готов к анализу'
                : 'или выберите файл на устройстве'}
                </p>
                <button type="button" className="secondary-button" onClick={() => ref.current?.click()}>
                  {file ? 'Выбрать другой файл' : 'Выбрать файл'}
                </button>
                <input ref={ref} type="file" accept=".pdf,.csv,.xlsx" className="sr-only" aria-label="Банковская выписка" onChange={(e) => choose(e.target.files?.[0])}/>
                <span className="muted">PDF до 5 МБ · CSV / XLSX до 2 МБ</span>
              </div>
              <div className="import-options">
                <div className="form-field">
                  <label htmlFor="import-currency">
                    Валюта, если не указана
                  </label>
                  <SelectField id="import-currency" label="Валюта импорта" value={currency} onChange={setCurrency} options={currencies.map((v) => ({ value: v, label: v }))}/>
                </div>
              </div>
              <p className="import-hint">
                Направление определяется автоматически: «−790» и «790» — расход,
                «+790» — пополнение. Учитываем и отдельные столбцы направления
                операции.
              </p>
              {headers.length > 0 && (<div className="mapping-fields">
                  <h3>Сопоставьте столбцы</h3>
                  {[
                    { key: 'date', label: 'Дата' },
                    { key: 'merchant', label: 'Описание / получатель' },
                    { key: 'amount', label: 'Сумма расхода' },
                    { key: 'currency', label: 'Валюта (необязательно)' },
                    { key: 'direction', label: 'Направление (необязательно)' },
                ].map(({ key, label }) => (<div className="form-field" key={key}>
                      <label>{label}</label>
                      <SelectField label={label} value={String(mapping[key])} onChange={(v) => setMapping((s) => ({ ...s, [key]: Number(v) }))} options={[
                        ...(['currency', 'direction'].includes(key)
                            ? [{ value: '-1', label: 'Нет столбца' }]
                            : []),
                        ...headers.map((h, i) => ({
                            value: String(i),
                            label: h || 'Столбец ' + (i + 1),
                        })),
                    ]}/>
                    </div>))}
                </div>)}
              {error && (<div role="alert" className="error-box">
                  {error}
                </div>)}
              <div className="import-submit">
                <span>
                  {'Данные сохраняются на устройстве'}
                </span>
                <button disabled={!file || busy} onClick={() => upload()} className="primary-button">
                  {file?.name.toLowerCase().endsWith('.pdf')
                ? 'Прочитать PDF'
                : 'Найти мои расходы'}
                  <ArrowRight size={17}/>
                </button>
              </div>
            </>)}
        </section>
        <aside className="import-aside">
          <div className="panel">
            <ShieldCheck size={24}/>
            <h3>Ваши данные — под контролем</h3>
            <p>
              Исходный файл обрабатывается на устройстве и не отправляется на сервер.{' '}
              {'Операции сохраняются в локальном хранилище.'}
            </p>
            <p>Удалить импортированные данные можно в настройках.</p>
          </div>
          <div className="panel">
            <h3>Что поможет анализу</h3>
            <ul>
              <li>
                Текстовая выписка за любой период, в том числе за один месяц
              </li>
              <li>Перед импортом PDF можно проверить и исправить строки</li>
              <li>Сканы и PDF с паролем пока не поддерживаются</li>
              <li>
                При короткой истории известные сервисы предложим для проверки.
                Больше операций поможет уточнить периодичность.
              </li>
            </ul>
            <a href="/example-statement.csv" download className="text-link">
              Скачать пример CSV ↗
            </a>
            <p className="sample-note">Пример содержит вымышленные платежи.</p>
          </div>
        </aside>
      </div>
      
      {imports.length > 0 && (<section className="panel import-history">
          <h2>История импортов</h2>
          {imports.slice(0, 6).map((i) => (<div key={i.id}>
              <FileSpreadsheet size={19}/>
              <span>
                <strong>{i.filename}</strong>
                <small>
                  {new Date(i.createdAt).toLocaleDateString('ru-RU')} ·{' '}
                  {i.transactionCount} операций
                </small>
              </span>
              <span className={'status ' + (i.status === 'completed' ? 'active' : 'paused')}>
                {i.status === 'completed'
                    ? 'Обработан'
                    : i.status === 'failed'
                        ? 'Ошибка'
                        : 'Обработка'}
              </span>
            </div>))}
        </section>)}
    </>);
}
