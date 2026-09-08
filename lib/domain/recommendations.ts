import type { RecurringExpense, Transaction, Recommendation } from './types.ts';
import { serviceById } from './catalog.ts';
import { monthlyEquivalent, yearlyEquivalent } from './analytics.ts';
import { divideRounded, money } from './money.ts';
export function recommendations(
  expenses: RecurringExpense[],
  transactions: Transaction[],
): Recommendation[] {
  const out: Recommendation[] = [];
  const active = expenses.filter((e) => e.status === 'active');
  for (const e of active) {
    const history = transactions
      .filter((t) => t.recurringExpenseId === e.id && t.currency === e.currency)
      .sort((a, b) => a.paidAt.localeCompare(b.paidAt));
    if (history.length >= 2) {
      const last = history[history.length - 1].amountMinor,
        previous = history[history.length - 2].amountMinor;
      const baseline = divideRounded(
        history
          .slice(0, -1)
          .slice(-6)
          .reduce((sum, t) => sum + t.amountMinor, 0),
        Math.min(6, history.length - 1),
      );
      const pct = Math.round(((last - previous) / previous) * 100),
        deviation = Math.round(((last - baseline) / baseline) * 100);
      const variable = e.type === 'utility';
      if (deviation >= 30 && history.length >= 3 && variable) {
        out.push({
          id: 'anomaly:' + e.id,
          kind: 'anomaly',
          title: 'Последний платёж «' + e.name + '» выше обычного',
          explanation:
            money(last, e.currency) +
            ' вместо среднего ' +
            money(baseline, e.currency) +
            ' по предыдущим операциям. Проверьте начисления: разница может быть сезонной.',
          estimatedSaving: 0,
          currency: e.currency,
          severity: 'warning',
          relatedExpenseIds: [e.id],
          action: 'Проверить платежи',
        });
      } else if (pct >= 10) {
        out.push({
          id: 'increase:' + e.id,
          kind: 'increase',
          title: 'Стоимость «' + e.name + '» выросла примерно на ' + pct + '%',
          explanation:
            money(previous, e.currency) +
            ' → ' +
            money(last, e.currency) +
            '. Сравнение двух последних платежей. Потенциал указан на случай возврата к прежней стоимости; доступность такого варианта нужно проверить у сервиса.',
          estimatedSaving: variable
            ? 0
            : monthlyEquivalent({ ...e, amountMinor: last - previous }),
          currency: e.currency,
          severity: 'warning',
          relatedExpenseIds: [e.id],
          action: 'Посмотреть историю',
        });
      } else if (deviation >= 30 && history.length >= 3) {
        out.push({
          id: 'anomaly:' + e.id,
          kind: 'anomaly',
          title: 'Нетипичный платёж «' + e.name + '»',
          explanation:
            'Последний платёж ' +
            money(last, e.currency) +
            ' выше среднего ' +
            money(baseline, e.currency) +
            '. Проверьте состав услуги и историю начислений.',
          estimatedSaving: 0,
          currency: e.currency,
          severity: 'warning',
          relatedExpenseIds: [e.id],
          action: 'Проверить платёж',
        });
      }
    }
  }
  const groups = new Map<string, RecurringExpense[]>();
  for (const e of active) {
    const group = serviceById(e.serviceId)?.group;
    if (!group || !['video', 'music', 'ai'].includes(group)) continue;
    const key = group + '|' + e.currency;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    group.sort((a, b) => monthlyEquivalent(a) - monthlyEquivalent(b));
    const total = group.reduce((sum, e) => sum + monthlyEquivalent(e), 0);
    const kind = key.startsWith('video')
      ? 'видеосервиса'
      : key.startsWith('music')
        ? 'музыкальных сервиса'
        : 'AI-сервиса';
    out.push({
      id: 'overlap:' + key,
      kind: 'overlap',
      title: 'Вы оплачиваете ' + group.length + ' ' + kind,
      explanation:
        group.map((e) => e.name).join(', ') +
        ' — вместе ' +
        money(total, group[0].currency) +
        ' в месяц. Если один из них вам не нужен, пересмотрите его. Оценка экономии равна стоимости одного самого недорогого сервиса.',
      estimatedSaving: monthlyEquivalent(group[0]),
      currency: group[0].currency,
      severity: 'info',
      relatedExpenseIds: group.map((e) => e.id),
      action: 'Сравнить расходы',
    });
  }
  const covered = new Set(out.flatMap((r) => r.relatedExpenseIds));
  const annual = active
    .filter(
      (e) =>
        ['subscription', 'software', 'cloud'].includes(e.type) &&
        !covered.has(e.id),
    )
    .sort((a, b) => yearlyEquivalent(b) - yearlyEquivalent(a))
    .slice(0, 2);
  for (const e of annual)
    out.push({
      id: 'annual:' + e.id,
      kind: 'annual',
      title:
        e.name + ' — ' + money(yearlyEquivalent(e), e.currency) + ' за год',
      explanation:
        'Это годовой эквивалент текущей стоимости. Оцените, соответствует ли польза от сервиса этой сумме. Поток не знает, как часто вы им пользуетесь.',
      estimatedSaving: 0,
      currency: e.currency,
      severity: 'info',
      relatedExpenseIds: [e.id],
      action: 'Открыть расход',
    });
  return out;
}
export function potentialSavingsPerMonth(
  items: Recommendation[],
  currency: string,
) {
  const byExpense = new Map<string, number>();
  for (const r of items.filter((r) => r.currency === currency)) {
    const id = r.relatedExpenseIds[0];
    if (id)
      byExpense.set(id, Math.max(byExpense.get(id) ?? 0, r.estimatedSaving));
  }
  return [...byExpense.values()].reduce((a, b) => a + b, 0);
}
