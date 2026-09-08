import type { Candidate, BillingPeriod } from '../lib/domain/types.ts';
export type ExpectedGroup = {
  transactionIds: string[];
  billingPeriod: BillingPeriod;
};
/** Exact evidence-set matching: a duplicate prediction counts as a false positive. */
export function scoreDetection(
  actual: Candidate[],
  expected: ExpectedGroup[],
  threshold = 0.8,
) {
  const key = (ids: string[], period: BillingPeriod) =>
    period + ':' + [...ids].sort().join('|');
  const unmatched = new Set(
    expected.map((e) => key(e.transactionIds, e.billingPeriod)),
  );
  let truePositives = 0,
    falsePositives = 0;
  for (const candidate of actual.filter(
    (c) => (c.expense.confidence ?? 0) >= threshold,
  )) {
    if (
      unmatched.delete(
        key(candidate.transactionIds, candidate.expense.billingPeriod),
      )
    )
      truePositives++;
    else falsePositives++;
  }
  const falseNegatives = unmatched.size;
  return {
    truePositives,
    falsePositives,
    falseNegatives,
    precision:
      truePositives + falsePositives
        ? truePositives / (truePositives + falsePositives)
        : 1,
    recall:
      truePositives + falseNegatives
        ? truePositives / (truePositives + falseNegatives)
        : 1,
  };
}
