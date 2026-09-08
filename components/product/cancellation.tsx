'use client';
import { localAction } from '@/lib/local/actions';
import { useState } from 'react';
import { ExternalLink, Check, Info } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, } from '@/components/ui/alert-dialog';
import type { RecurringExpense, CancellationStrategy, } from '@/lib/domain/types';
export function Cancellation({ expense, strategy, }: {
    expense: RecurringExpense;
    strategy: CancellationStrategy;
    
}) {
    const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const subscription = ['subscription', 'software', 'cloud'].includes(expense.type);
    async function cancel() {
        setBusy(true);
        setError('');
        try {
            const r = await localAction('/api/expenses/' + expense.id, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...expense,
                    amount: String(expense.amountMinor / 100),
                    status: 'cancelled',
                }),
            });
            const data = (await r.json()) as {
                error?: string;
            };
            if (!r.ok)
                throw new Error(data.error);
            window.location.reload();
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    return (<section className="panel cancellation-panel">
      <h2>{subscription ? 'Управление подпиской' : 'Управление расходом'}</h2>
      {expense.status === 'cancelled' ? (<div className="success-box">
          <Check size={17}/>
          <span>
            Вы отметили расход отменённым. Будущие платежи не учитываются в
            прогнозе.
          </span>
        </div>) : (<>
          {strategy.type === 'external-url' ? (<>
              <p>
                Откройте официальный сайт и проверьте условия для своего
                аккаунта. Если оплата оформлена через магазин приложений или
                партнёра, управлять ей нужно у них.
              </p>
              <a href={strategy.url} target="_blank" rel="noopener noreferrer" className="primary-button">
                {subscription ? 'Управлять подпиской' : 'Открыть управление'}
                <ExternalLink size={16}/>
              </a>
            </>) : strategy.type === 'instructions' ? (<ol>
              {strategy.steps.map((step, i) => (<li key={i}>{step}</li>))}
            </ol>) : (<div className="unsupported-note">
              <Info size={19}/>
              <p>
                Для этого расхода у нас пока нет проверенной инструкции.
                Откройте личный кабинет поставщика или обратитесь в его
                поддержку.
              </p>
            </div>)}
          <div className="cancellation-bottom">
            <p>После отмены у поставщика отметьте это здесь.</p>
            {(<button className="secondary-button" onClick={() => setConfirm(true)}>
                <Check size={16}/>
                {subscription ? 'Я отменил подписку' : 'Отметить отменённым'}
              </button>)}
          </div>
        </>)}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="sm:max-w-[440px] p-6">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Отметить «{expense.name}» отменённым?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Поток исключит этот расход из будущих платежей. Это действие не
              отменяет услугу у поставщика. История платежей сохранится.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (<p role="alert" className="error-box">
              {error}
            </p>)}
          <AlertDialogFooter>
            <AlertDialogCancel>Назад</AlertDialogCancel>
            <button className="primary-button" disabled={busy} onClick={cancel}>
              {busy ? 'Сохраняем…' : 'Да, я отменил услугу'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>);
}
