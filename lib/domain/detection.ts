import type {
  Transaction,
  RecurringExpense,
  Candidate,
  BillingPeriod,
  RecurringExpenseType,
} from './types.ts';
import { merchantBehavior, services } from './catalog.ts';
import {
  addPeriod,
  advanceTo,
  daysBetween,
  monthEnd,
  today,
} from './calendar.ts';
import { divideRounded } from './money.ts';
export function median(values: number[]) {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : divideRounded(v[mid - 1] + v[mid], 2);
}
type Pattern = {
  rows: Transaction[];
  period: BillingPeriod;
  anchor: number;
  score: number;
  missed: number;
  maxDeviation: number;
  amountDeviation: number;
};
function inferType(name: string): RecurringExpenseType {
  if (/ЖКХ|КОММУН|КВАРТПЛАТ|ВОДОКАНАЛ|ЭНЕРГО|UTILITY/i.test(name))
    return 'utility';
  if (/ИНТЕРНЕТ|INTERNET|ДОМ РУ/i.test(name)) return 'internet';
  if (/АРЕНДА|RENT/i.test(name)) return 'rent';
  if (/СТРАХ|INSURANCE/i.test(name)) return 'insurance';
  return 'other';
}
function bestPattern(rows: Transaction[], known: boolean): Pattern | null {
  let best: Pattern | null = null;
  for (const period of [
    'weekly',
    'monthly',
    'quarterly',
    'yearly',
  ] as BillingPeriod[]) {
    const minimum =
      period === 'yearly' || period === 'quarterly' || known ? 2 : 3;
    if (rows.length < minimum) continue;
    for (let start = 0; start < Math.min(rows.length - 1, 24); start++) {
      const first = rows[start];
      const anchor = Number(first.paidAt.slice(8));
      const chain = [first];
      let cursor = start,
        missed = 0,
        maxDeviation = 0;
      while (cursor < rows.length - 1) {
        const last = chain[chain.length - 1];
        let next = -1,
          deviation = Infinity,
          skip = 0;
        for (const step of [1, 2]) {
          if (
            step === 2 &&
            (missed > 0 || period === 'weekly' || period === 'yearly')
          )
            continue;
          const expected = addPeriod(last.paidAt, period, step, anchor);
          const tolerance =
            period === 'weekly' ? 1 : period === 'yearly' ? 7 : 4;
          for (let k = cursor + 1; k < rows.length; k++) {
            const distance = daysBetween(expected, rows[k].paidAt);
            if (distance > tolerance) break;
            if (distance < -tolerance) continue;
            const amounts = chain.map((t) => t.amountMinor);
            const ratio = rows[k].amountMinor / median(amounts);
            if (ratio < 0.35 || ratio > 2.5) continue;
            const cost = Math.abs(distance) + Math.abs(Math.log(ratio)) * 0.25;
            if (cost < deviation) {
              deviation = cost;
              next = k;
              skip = step - 1;
            }
          }
          if (next >= 0) break;
        }
        if (next < 0) break;
        missed += skip;
        const expected = addPeriod(last.paidAt, period, skip + 1, anchor);
        maxDeviation = Math.max(
          maxDeviation,
          Math.abs(daysBetween(expected, rows[next].paidAt)),
        );
        chain.push(rows[next]);
        cursor = next;
      }
      if (chain.length < minimum) continue;
      const coverage = chain.length / rows.length;
      if (!known && coverage < 0.65) continue;
      const amounts = chain.map((t) => t.amountMinor),
        base = median(amounts),
        dev =
          median(
            amounts.map((a) => Math.round((Math.abs(a - base) * 10000) / base)),
          ) / 10000;
      if (dev > 0.6) continue;
      const countScore = Math.min(chain.length, 6) * 0.035;
      let score =
        0.66 +
        countScore +
        (known ? 0.07 : 0) +
        (dev < 0.05 ? 0.04 : dev < 0.2 ? 0.015 : -0.07) -
        maxDeviation * 0.015 -
        missed * 0.07;
      if (chain.length === 2)
        score = Math.min(
          score,
          period === 'yearly' || period === 'quarterly' ? 0.78 : 0.74,
        );
      score = Math.max(0.5, Math.min(0.98, score));
      const candidate = {
        rows: chain,
        period,
        anchor,
        score,
        missed,
        maxDeviation,
        amountDeviation: dev,
      };
      if (
        !best ||
        candidate.rows.length * candidate.score > best.rows.length * best.score
      )
        best = candidate;
    }
  }
  return best;
}
export function detectRecurring(
  transactions: Transaction[],
  importId: string,
  asOf = today(),
): Candidate[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.recurringExpenseId) continue;
    if (
      ['usage_based', 'retail', 'transfer'].includes(
        merchantBehavior(t.originalMerchant),
      )
    )
      continue;
    const key = t.normalizedMerchant + '|' + t.currency;
    const g = groups.get(key) ?? [];
    g.push(t);
    groups.set(key, g);
  }
  const result: Candidate[] = [];
  for (const rows of groups.values()) {
    rows.sort((a, b) => a.paidAt.localeCompare(b.paidAt));
    const service = services.find(
      (s) => rows[0].normalizedMerchant === 'service:' + s.id,
    );
    let remaining = rows.slice(-1000);
    // A short statement can identify a service, but one charge cannot establish its cycle.
    if (rows.length === 1) {
      const last = rows[0],
        type = service?.category ?? inferType(last.normalizedMerchant);
      if (service || ['utility', 'internet', 'rent'].includes(type)) {
        const anchor = Number(last.paidAt.slice(8)),
          now = new Date().toISOString();
        const expense: RecurringExpense = {
          id: crypto.randomUUID(),
          name: service?.name ?? last.originalMerchant,
          type,
          amountMinor: last.amountMinor,
          currency: last.currency,
          billingPeriod: 'monthly',
          customDays: null,
          nextPaymentAt: advanceTo(
            addPeriod(last.paidAt, 'monthly', 1, anchor),
            'monthly',
            asOf,
            anchor,
          ),
          anchorDay: anchor,
          status: 'active',
          serviceId: service?.id ?? null,
          source: 'bank-import',
          recurringConfidence: 0.4,
          subscriptionConfidence:
            service?.merchantClass === 'subscription' ||
            service?.category === 'subscription'
              ? Math.max(
                  0.9,
                  ...rows.map((row) => row.serviceMatchConfidence ?? 0),
                )
              : 0.1,
          periodConfidence: 0.2,
          confidence: 0.4,
          createdAt: now,
          updatedAt: now,
        };
        result.push({
          id: crypto.randomUUID(),
          importId,
          expense,
          transactionIds: [last.id],
          decision: 'pending',
          reasons: [
            service
              ? 'Описание соответствует сервису «' + service.name + '».'
              : 'Описание похоже на оплату жилья или связи.',
            'В истории только один платёж. Повторяемость пока не подтверждена.',
            'Ежемесячный период и следующая дата — предварительное предположение. Перед подтверждением проверьте их через «Изменить».',
            'Сумма взята из операции, а не из предполагаемого тарифа.',
          ],
        });
      }
      continue;
    }
    for (let lane = 0; lane < 4 && remaining.length >= 2; lane++) {
      const pattern = bestPattern(remaining, !!service);
      if (!pattern) break;
      const {
        rows: chain,
        period,
        score,
        missed,
        maxDeviation,
        amountDeviation,
      } = pattern;
      const days = chain.map((t) => Number(t.paidAt.slice(8)));
      const nearEnd = chain.every(
        (t) => monthEnd(t.paidAt) - Number(t.paidAt.slice(8)) <= 1,
      );
      const anchor = nearEnd ? 31 : median(days);
      const last = chain[chain.length - 1];
      const originalNext = addPeriod(last.paidAt, period, 1, anchor);
      const currentDate = advanceTo(originalNext, period, asOf, anchor);
      const latestGap = daysBetween(last.paidAt, asOf),
        cycleDays = Math.max(1, daysBetween(last.paidAt, originalNext));
      const stale = latestGap > cycleDays * 2;
      const amounts = chain.map((t) => t.amountMinor);
      const type = service?.category ?? inferType(last.normalizedMerchant);
      const variable = type === 'utility' || amountDeviation > 0.12;
      const amountMinor = variable
        ? median(amounts.slice(-4))
        : last.amountMinor;
      const now = new Date().toISOString();
      const recurringConfidence = Math.max(0.5, score - (stale ? 0.14 : 0));
      const subscriptionConfidence =
        service?.merchantClass === 'subscription' ||
        service?.category === 'subscription'
          ? Math.min(
              0.99,
              Math.max(
                recurringConfidence + 0.08,
                ...chain.map((row) => row.serviceMatchConfidence ?? 0),
              ),
            )
          : service?.merchantClass === 'regular_bill' ||
              service?.merchantClass === 'bank_service'
            ? 0.1
            : Math.min(0.35, recurringConfidence * 0.4);
      const expense: RecurringExpense = {
        id: crypto.randomUUID(),
        name: service?.name ?? last.originalMerchant,
        type,
        amountMinor,
        currency: last.currency,
        billingPeriod: period,
        customDays: null,
        nextPaymentAt: currentDate,
        anchorDay: anchor,
        status: 'active',
        serviceId: service?.id ?? null,
        source: 'bank-import',
        recurringConfidence,
        subscriptionConfidence,
        periodConfidence: Math.min(
          0.98,
          recurringConfidence + (chain.length >= 3 ? 0.08 : 0),
        ),
        confidence: recurringConfidence,
        createdAt: now,
        updatedAt: now,
      };
      const intervals = chain
        .slice(1)
        .map((t, i) => daysBetween(chain[i].paidAt, t.paidAt));
      const reasons = [
        service
          ? 'Описание операций соответствует сервису «' + service.name + '».'
          : 'Операции имеют одинаковое нормализованное описание.',
        chain.length +
          ' похожих платежей; интервалы ' +
          Math.min(...intervals) +
          '–' +
          Math.max(...intervals) +
          ' дней.',
        'Отклонение даты от календарного периода — до ' +
          maxDeviation +
          ' дней.',
        variable
          ? 'Сумма меняется; прогноз основан на медиане последних платежей.'
          : 'Для прогноза использована последняя фактическая сумма.',
      ];
      if (missed)
        reasons.push(
          'Есть пропуск одного периода — проверьте актуальность расхода.',
        );
      if (stale)
        reasons.push(
          'Последний платёж давно не повторялся. Возможно, расход уже отменён.',
        );
      const id = crypto.randomUUID();
      result.push({
        id,
        importId,
        expense,
        transactionIds: chain.map((t) => t.id),
        reasons,
        decision: 'pending',
      });
      const used = new Set(chain.map((t) => t.id));
      remaining = remaining.filter((t) => !used.has(t.id));
    }
  }
  return result.sort(
    (a, b) => (b.expense.confidence ?? 0) - (a.expense.confidence ?? 0),
  );
}
