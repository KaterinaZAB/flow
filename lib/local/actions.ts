import { readWorkspace, updateWorkspace } from './repository.ts';
import { validateExpense } from '../domain/validation.ts';
import { parseStatement, MappingError } from '../import/parse.ts';
import { extractPdf } from '../import/pdf.ts';
import { detectRecurring } from '../domain/detection.ts';
import { today } from '../domain/calendar.ts';
import { findService } from '../domain/catalog.ts';
import type { Candidate } from '../domain/types.ts';
import {
  createKnownSubscriptionCandidate,
  isKnownSubscription,
} from '../domain/known-subscription.ts';

export type ImportOutcome =
  | { kind: 'new_candidate'; candidate: Candidate }
  | { kind: 'pending_candidate'; candidateId: string }
  | {
      kind: 'confirmed_expense';
      expenseId: string;
      expenseName: string;
    }
  | {
      kind: 'previously_rejected';
      candidateId: string;
      expenseName: string;
    }
  | { kind: 'not_recurring' };

function candidateKey(candidate: Candidate) {
  return [
    candidate.expense.serviceId ?? candidate.expense.name.toLowerCase(),
    candidate.expense.amountMinor,
    candidate.expense.currency,
    candidate.expense.billingPeriod,
  ].join('|');
}

function sameEvidence(a: Candidate, b: Candidate) {
  return a.transactionIds.some((id) => b.transactionIds.includes(id));
}

function uniqueCandidates(candidates: Candidate[]) {
  return candidates.filter(
    (candidate, index) =>
      candidates.findIndex(
        (other) =>
          candidateKey(other) === candidateKey(candidate) &&
          sameEvidence(other, candidate),
      ) === index,
  );
}

function importOutcomeKey(outcome: ImportOutcome, serviceId: string) {
  switch (outcome.kind) {
    case 'new_candidate':
      return outcome.kind + ':' + outcome.candidate.id;
    case 'pending_candidate':
    case 'previously_rejected':
      return outcome.kind + ':' + outcome.candidateId;
    case 'confirmed_expense':
      return outcome.kind + ':' + outcome.expenseId;
    case 'not_recurring':
      return outcome.kind + ':' + serviceId;
  }
}
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
        count = 0,
        repeatedImport = false,
        confirmedCandidateCount = 0,
        rejectedCandidateCount = 0,
        knownServiceCount = 0,
        outcomes: ImportOutcome[] = [];
      await updateWorkspace((state) => {
        const existing = new Set(
          state.transactions.map((t) => t.fingerprint + ':' + t.occurrence),
        );
        const fresh = result.transactions.filter(
          (t) => !existing.has(t.fingerprint + ':' + t.occurrence),
        );
        added = fresh.length;
        state.transactions.push(...fresh);
        const persistedByFingerprint = new Map(
          state.transactions.map((transaction) => [
            transaction.fingerprint + ':' + transaction.occurrence,
            transaction,
          ]),
        );
        const importedRows = result.transactions.flatMap((transaction) => {
          const persisted = persistedByFingerprint.get(
            transaction.fingerprint + ':' + transaction.occurrence,
          );
          return persisted ? [persisted] : [];
        });
        repeatedImport = added === 0;
        const importedServices = new Set(
          importedRows.flatMap((transaction) => {
            const service = findService(transaction.originalMerchant);
            return service ? [service.id] : [];
          }),
        );
        knownServiceCount = importedServices.size;
        // Final decisions protect their evidence. Pending candidates stay in the
        // workspace so a repeated import can show the same review instead of
        // deleting and recreating it with a new id.
        const finalized = state.candidates.filter(
          (candidate) => candidate.decision !== 'pending',
        );
        const used = new Set(
          finalized.flatMap((candidate) => candidate.transactionIds),
        );
        const eligible = state.transactions.filter(
          (t) => !t.recurringExpenseId && !used.has(t.id),
        );
        // Run this import independently as well. On a repeated upload these
        // are persisted rows, so every candidate still links to real evidence.
        const detected = uniqueCandidates([
          ...detectRecurring(eligible, id, today()),
          ...(importedRows.length
            ? detectRecurring(
                importedRows.filter((transaction) => !used.has(transaction.id)),
                id,
                today(),
              )
            : []),
        ]).filter(
          (candidate) =>
            !state.candidates.some(
              (existing) =>
                candidateKey(existing) === candidateKey(candidate) &&
                (sameEvidence(existing, candidate) ||
                  existing.decision !== 'pending'),
            ),
        );
        state.candidates.push(...detected);
        count = detected.length;
        const newCandidateIds = new Set(
          detected.map((candidate) => candidate.id),
        );
        const outcomeByKey = new Map<string, ImportOutcome>();
        for (const transaction of importedRows) {
          const service = findService(transaction.originalMerchant);
          if (!service || !isKnownSubscription(service)) continue;
          const matching = (candidate: Candidate) =>
            candidate.expense.serviceId === service.id &&
            candidate.expense.amountMinor === transaction.amountMinor &&
            candidate.expense.currency === transaction.currency;
          const confirmed = state.candidates.find(
            (candidate) =>
              candidate.decision === 'confirmed' && matching(candidate),
          );
          const expense = state.expenses.find(
            (item) =>
              item.status === 'active' &&
              item.serviceId === service.id &&
              item.currency === transaction.currency &&
              Math.abs(item.amountMinor - transaction.amountMinor) <=
                Math.max(100, transaction.amountMinor * 0.1),
          );
          const rejected = state.candidates.find(
            (candidate) =>
              candidate.decision === 'rejected' && matching(candidate),
          );
          let outcome: ImportOutcome;
          if (expense || confirmed) {
            outcome = {
              kind: 'confirmed_expense' as const,
              expenseId: expense?.id ?? confirmed!.expense.id,
              expenseName: expense?.name ?? confirmed!.expense.name,
            };
          } else if (rejected) {
            outcome = {
              kind: 'previously_rejected',
              candidateId: rejected.id,
              expenseName: rejected.expense.name,
            };
          } else {
            let pending = state.candidates.find(
              (candidate) =>
                candidate.decision === 'pending' && matching(candidate),
            );
            let createdKnownCandidate = false;
            if (!pending) {
              pending = createKnownSubscriptionCandidate({
                transaction,
                service,
                importId: id,
                asOf: today(),
              });
              state.candidates.push(pending);
              newCandidateIds.add(pending.id);
              count += 1;
              createdKnownCandidate = true;
            } else if (!pending.transactionIds.includes(transaction.id)) {
              pending.transactionIds.push(transaction.id);
            }
            outcome =
              createdKnownCandidate || newCandidateIds.has(pending.id)
                ? { kind: 'new_candidate', candidate: pending }
                : {
                    kind: 'pending_candidate',
                    candidateId: pending.id,
                  };
          }
          outcomeByKey.set(importOutcomeKey(outcome, service.id), outcome);
        }
        outcomes = [...outcomeByKey.values()];
        confirmedCandidateCount = outcomes.filter(
          (outcome) => outcome.kind === 'confirmed_expense',
        ).length;
        rejectedCandidateCount = outcomes.filter(
          (outcome) => outcome.kind === 'previously_rejected',
        ).length;
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
        repeatedImport,
        confirmedCandidateCount,
        rejectedCandidateCount,
        knownServiceCount,
        outcomes,
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
        !['confirmed', 'rejected', 'edit', 'reconsider'].includes(
          input.decision,
        )
      )
        throw new Error('Некорректное действие.');
      const edit =
        input.decision === 'edit' ? validateExpense(input.edit) : null;
      await updateWorkspace((state) => {
        for (const c of state.candidates.filter(
          (candidate) =>
            input.ids.includes(candidate.id) &&
            (input.decision === 'reconsider'
              ? candidate.decision === 'rejected'
              : candidate.decision === 'pending'),
        )) {
          if (input.decision === 'reconsider') {
            c.decision = 'pending';
            continue;
          }
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
