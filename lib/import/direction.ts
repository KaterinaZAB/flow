export type OperationDirection = 'expense' | 'income';

export function normalizeAmountSign(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[−–—﹣－]/g, '-')
    .trim();
}

/** An explicit sign wins; unsigned amounts use a dedicated column when present. */
export function amountDirection(
  value: string,
  unsigned: OperationDirection = 'expense',
): OperationDirection {
  const amount = normalizeAmountSign(value).replace(/\s/g, '');
  if (amount.startsWith('+')) return 'income';
  if (amount.startsWith('-')) return 'expense';
  return unsigned;
}
