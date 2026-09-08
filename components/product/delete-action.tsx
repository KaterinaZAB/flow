'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { localAction } from '@/lib/local/actions';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, } from '@/components/ui/alert-dialog';
export function DeleteAction({ expenseId, }: {
    expenseId: string;
    
}) {
    const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const title = 'Удалить расход';
    async function remove() {
        setBusy(true);
        setError('');
        try {
            const response = await localAction('/api/expenses/' + encodeURIComponent(expenseId), {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
            });
            const result = (await response.json()) as {
                error?: string;
            };
            if (!response.ok)
                throw new Error(result.error);
            window.location.href = '/expenses';
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось удалить данные.');
        }
        finally {
            setBusy(false);
        }
    }
    return (<>
      <button className="danger-button" onClick={() => setOpen(true)}>
        <Trash2 size={16}/>
        {title}
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-[450px] p-6">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}?</AlertDialogTitle>
            <AlertDialogDescription>
              Расход исчезнет из вашего списка. Импортированная история платежей сохранится. Это не отменяет услугу у поставщика.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (<p role="alert" className="error-box">
              {error}
            </p>)}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Оставить</AlertDialogCancel>
            <button className="danger-button" disabled={busy} onClick={() => void remove()}>
              {busy ? 'Удаляем…' : 'Удалить'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>);
}
