import { readWorkspace, updateWorkspace } from './repository';
import { validateExpense } from '../domain/validation';
import { parseStatement, MappingError } from '../import/parse';
import { extractPdf } from '../import/pdf';
import { detectRecurring } from '../domain/detection';
import { today } from '../domain/calendar';
/** Local command adapter for existing forms. Response objects are in-memory results, never HTTP requests. */
export async function localCommand(path: string, options: RequestInit = {}) {
  try {
    const method = options.method ?? 'GET';
    const input =
      typeof options.body === 'string' ? JSON.parse(options.body) : {};
    if (path === '/data' && method === 'DELETE') {
      await updateWorkspace((state) => {
        state.transactions = [];
        state.imports = [];
        state.candidates = [];
        state.expenses = state.expenses.filter(
          (e) => e.source === 'manual' || e.source === 'gmail',
        );
      });
      return Response.json({ deleted: true });
    }
    if (path === '/expenses' || path.startsWith('/expenses/')) {
      const id = path.split('/')[2];
      if (method === 'GET')
        return Response.json(
          id
            ? (await readWorkspace()).expenses.find((e) => e.id === id)
            : (await readWorkspace()).expenses,
        );
      let savedId = id;
      const fields = method === 'DELETE' ? null : validateExpense(input);
      await updateWorkspace((state) => {
        if (id && !state.expenses.some((e) => e.id === id))
          throw new Error('Расход не найден.');
        if (method === 'DELETE') {
          state.expenses = state.expenses.filter((e) => e.id !== id);
          for (const t of state.transactions)
            if (t.recurringExpenseId === id) t.recurringExpenseId = null;
          return;
        }
        const now = new Date().toISOString();
        if (id) {
          const e = state.expenses.find((e) => e.id === id)!;
          Object.assign(e, fields, { updatedAt: now });
        } else {
          savedId = crypto.randomUUID();
          state.expenses.push({
            id: savedId,
            ...fields!,
            source: 'manual',
            confidence: null,
            createdAt: now,
            updatedAt: now,
          });
        }
        state.started = true;
      });
      return Response.json({ id: savedId });
    }
    if (path === '/imports') {
      if (method === 'GET')
        return Response.json((await readWorkspace()).imports);
      const form = options.body;
      if (!(form instanceof FormData)) throw new Error('Выберите выписку.');
      const file = form.get('file');
      if (!(file instanceof File)) throw new Error('Выберите выписку.');
      const format = file.name.split('.').pop()?.toLowerCase();
      if (
        !['pdf', 'csv', 'xlsx'].includes(format ?? '') ||
        file.size > (format === 'pdf' ? 5 : 2) * 1024 * 1024
      )
        throw new Error('Неподдерживаемый формат или размер файла.');
      const field = (key: string, fallback = '') => {
        const v = form.get(key);
        if (v !== null && typeof v !== 'string')
          throw new Error('Некорректное поле.');
        return v ?? fallback;
      };
      const bytes = new Uint8Array(await file.arrayBuffer()),
        currency = field('currency', 'RUB');
      if (format === 'xlsx' && (bytes[0] !== 80 || bytes[1] !== 75))
        throw new Error('Файл не является XLSX.');
      if (
        format === 'csv' &&
        (bytes.includes(0) || (bytes[0] === 80 && bytes[1] === 75))
      )
        throw new Error('Файл не является CSV.');
      if (format === 'pdf' && form.get('pdfReviewed') !== 'true')
        return Response.json({ pdfPreview: await extractPdf(bytes, currency) });
      const id = crypto.randomUUID(),
        result = await parseStatement(bytes, file.name, id, {
          currency,
          amountMode: 'auto',
          mapping: form.get('mapping')
            ? JSON.parse(field('mapping'))
            : undefined,
          pdfRows: form.get('pdfRows')
            ? JSON.parse(field('pdfRows'))
            : undefined,
        });
      let added = 0,
        count = 0;
      await updateWorkspace((state) => {
        const existing = new Set(
          state.transactions.map((t) => t.fingerprint + ':' + t.occurrence),
        );
        const fresh = result.transactions.filter(
          (t) => !existing.has(t.fingerprint + ':' + t.occurrence),
        );
        added = fresh.length;
        state.transactions.push(...fresh);
        // Detect across imports, but retain confirmed/rejected decisions and avoid linked evidence.
        const used = new Set(
          state.candidates
            .filter((c) => c.decision !== 'pending')
            .flatMap((c) => c.transactionIds),
        );
        state.candidates = state.candidates.filter(
          (c) => c.decision !== 'pending',
        );
        const detected = detectRecurring(
          state.transactions.filter(
            (t) => !t.recurringExpenseId && !used.has(t.id),
          ),
          id,
          today(),
        );
        state.candidates.push(...detected);
        count = detected.length;
        state.imports.unshift({
          id,
          filename: file.name,
          format: format as 'csv' | 'xlsx' | 'pdf',
          status: 'completed',
          createdAt: new Date().toISOString(),
          transactionCount: added,
          skippedCount: result.skipped + result.transactions.length - added,
          error: null,
        });
        state.started = true;
      });
      return Response.json({
        id,
        analyzedCount: result.transactions.length,
        transactionCount: added,
        skippedCount: result.skipped + result.transactions.length - added,
        warnings: result.warnings,
        candidateCount: count,
      });
    }
    if (path === '/candidates') {
      if (method === 'GET')
        return Response.json(
          (await readWorkspace()).candidates.filter(
            (c) => c.decision === 'pending',
          ),
        );
      if (
        !Array.isArray(input.ids) ||
        !['confirmed', 'rejected', 'edit'].includes(input.decision)
      )
        throw new Error('Некорректное действие.');
      const edit =
        input.decision === 'edit' ? validateExpense(input.edit) : null;
      await updateWorkspace((state) => {
        for (const c of state.candidates.filter(
          (c) => input.ids.includes(c.id) && c.decision === 'pending',
        )) {
          if (edit) {
            Object.assign(c.expense, edit);
            continue;
          }
          c.decision = input.decision;
          if (c.decision === 'confirmed') {
            const e = c.expense;
            const match = state.expenses.find(
              (x) =>
                x.status === 'active' &&
                x.currency === e.currency &&
                x.billingPeriod === e.billingPeriod &&
                (e.serviceId
                  ? x.serviceId === e.serviceId
                  : x.name.toLowerCase() === e.name.toLowerCase()) &&
                Math.abs(x.amountMinor - e.amountMinor) <=
                  Math.max(100, e.amountMinor * 0.1),
            );
            const expenseId = match?.id ?? e.id;
            if (!match) state.expenses.push({ ...e, source: 'bank-import' });
            for (const t of state.transactions)
              if (c.transactionIds.includes(t.id))
                t.recurringExpenseId = expenseId;
          }
        }
      });
      return Response.json({ ok: true });
    }
    throw new Error('Эта операция больше не поддерживается.');
  } catch (e) {
    return Response.json(
      e instanceof MappingError
        ? { error: e.message, mappingRequired: true, headers: e.headers }
        : {
            error:
              e instanceof Error ? e.message : 'Не удалось сохранить данные.',
          },
      { status: 400 },
    );
  }
}
