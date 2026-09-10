import { validDate } from '../../domain/validation.ts';
import type { BankStatementProfile } from './profiles.ts';
import type { VisualLine } from './layout.ts';
import {
  cleanPdfMerchantText,
  extractFinancialEntities,
  pdfTimePattern,
  type FinancialEntity,
} from './entities.ts';

export type UniversalParseReviewReason =
  | 'multiple_amount_candidates'
  | 'merchant_missing'
  | 'merchant_looks_like_category'
  | 'balance_may_be_amount'
  | 'ambiguous_direction'
  | 'date_uncertain'
  | 'unknown_layout'
  | 'multiple_merchant_candidates';

export type UniversalPdfTransaction = {
  date: string;
  time?: string;
  processedAt?: string;
  authorizationCode?: string;
  merchant: string;
  rawDescription?: string;
  bankCategory?: string;
  amountMinor: number;
  balanceAfterMinor?: number;
  currency: string;
  direction: 'expense' | 'income' | 'unknown';
  dateConfidence: number;
  merchantConfidence: number;
  amountConfidence: number;
  directionConfidence: number;
  transactionConfidence: number;
  serviceId?: string;
  serviceMatchConfidence?: number;
  reviewReasons: UniversalParseReviewReason[];
};

export type StatementReconciliation = {
  status: 'exact' | 'mismatch' | 'unavailable';
  openingBalanceMinor?: number;
  expectedIncomeMinor?: number;
  parsedIncomeMinor: number;
  incomeDifferenceMinor?: number;
  expectedExpenseMinor?: number;
  parsedExpenseMinor: number;
  expenseDifferenceMinor?: number;
  closingBalanceMinor?: number;
  balanceDifferenceMinor?: number;
};

export type MoneyScore = {
  entity: FinancialEntity;
  transactionAmountScore: number;
  balanceScore: number;
  reasons: string[];
};

export type PdfAssemblyDebug = {
  page: number;
  rawBlock: string[];
  extractedEntities: FinancialEntity[];
  amountCandidates: MoneyScore[];
  merchantCandidate?: FinancialEntity;
  assembledTransaction?: UniversalPdfTransaction;
};

export type UniversalPdfResult = {
  transactions: UniversalPdfTransaction[];
  transactionBlocks: number;
  ignoredBlocks: number;
  reconciliation: StatementReconciliation;
  period?: { from: string; to: string };
  debug?: PdfAssemblyDebug[];
};

type Anchor = {
  page: number;
  y: number;
  date?: FinancialEntity;
  time?: FinancialEntity;
  confidence: number;
};

type LearnedLayout = {
  amountRight?: number;
  balanceRight?: number;
};

const median = (values: number[]) => {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const right = (entity: FinancialEntity) => entity.x + entity.width;
const closeY = (a: number, b: number, tolerance = 7) =>
  Math.abs(a - b) <= tolerance;

function moneyNear(
  entities: FinancialEntity[],
  page: number,
  y: number,
  tolerance = 8,
) {
  return entities.filter(
    (entity) =>
      entity.type === 'money' &&
      entity.page === page &&
      closeY(entity.y, y, tolerance),
  );
}

function findAnchors(entities: FinancialEntity[], pages: VisualLine[][]) {
  const anchors: Anchor[] = [];
  const tableHeaderY = new Map<number, number>();
  for (let page = 0; page < pages.length; page++) {
    const header = pages[page].find(
      (line) =>
        /(?:дата.*операц|date)/i.test(line.text) &&
        /(?:сумм|amount|debit|credit)/i.test(line.text),
    );
    if (header) tableHeaderY.set(page + 1, header.y);
  }
  const times = entities.filter((entity) => entity.type === 'time');
  for (const time of times) {
    const headerY = tableHeaderY.get(time.page);
    if (headerY !== undefined && time.y >= headerY - 2) continue;
    const date = entities
      .filter(
        (entity) =>
          entity.type === 'date' &&
          entity.page === time.page &&
          closeY(entity.y, time.y, 9),
      )
      .sort((a, b) => Math.abs(a.y - time.y) - Math.abs(b.y - time.y))[0];
    const nearbyMoney = moneyNear(entities, time.page, time.y, 11);
    const nearbyCategory = entities.some(
      (entity) =>
        entity.type === 'category' &&
        entity.page === time.page &&
        closeY(entity.y, time.y, 11),
    );
    const nearbyMerchant = entities.some(
      (entity) =>
        entity.type === 'merchant' &&
        entity.page === time.page &&
        closeY(entity.y, time.y, 11) &&
        !/остаток|пополн|списан|валюта|формирован/i.test(String(entity.value)),
    );
    if (
      !date ||
      !nearbyMoney.length ||
      (nearbyMoney.length < 2 && !nearbyCategory && !nearbyMerchant)
    )
      continue;
    anchors.push({
      page: time.page,
      y: (date.y + time.y) / 2,
      date,
      time,
      confidence: 0.99,
    });
  }
  const dates = entities.filter((entity) => entity.type === 'date');
  for (const date of dates) {
    const headerY = tableHeaderY.get(date.page);
    if (headerY !== undefined && date.y >= headerY - 2) continue;
    if (
      anchors.some(
        (anchor) => anchor.page === date.page && closeY(anchor.y, date.y, 8),
      )
    )
      continue;
    if (!moneyNear(entities, date.page, date.y, 9).length) continue;
    anchors.push({ page: date.page, y: date.y, date, confidence: 0.74 });
  }
  return anchors.sort((a, b) => a.page - b.page || b.y - a.y);
}

function learnLayout(entities: FinancialEntity[], anchors: Anchor[]) {
  const amountRights: number[] = [];
  const balanceRights: number[] = [];
  for (const anchor of anchors) {
    const values = moneyNear(entities, anchor.page, anchor.y, 11).sort(
      (a, b) => right(a) - right(b),
    );
    if (values.length >= 2) {
      amountRights.push(right(values[values.length - 2]));
      balanceRights.push(right(values[values.length - 1]));
    } else if (values.length === 1) amountRights.push(right(values[0]));
  }
  return {
    amountRight: median(amountRights),
    balanceRight: median(balanceRights),
  } satisfies LearnedLayout;
}

function linesForAnchor(
  pages: VisualLine[][],
  anchors: Anchor[],
  anchorIndex: number,
) {
  const anchor = anchors[anchorIndex];
  const samePage = anchors.filter(
    (candidate) => candidate.page === anchor.page,
  );
  const localIndex = samePage.indexOf(anchor);
  const above = samePage[localIndex - 1];
  const below = samePage[localIndex + 1];
  const upper = above ? (above.y + anchor.y) / 2 : Infinity;
  const lower = below ? (anchor.y + below.y) / 2 : -Infinity;
  return pages[anchor.page - 1].filter(
    (line) => line.y <= upper && line.y > lower,
  );
}

function entitiesForLines(
  entities: FinancialEntity[],
  page: number,
  lines: VisualLine[],
) {
  if (!lines.length) return [];
  const maxY = Math.max(...lines.map((line) => line.y)) + 5;
  const minY = Math.min(...lines.map((line) => line.y)) - 5;
  return entities.filter(
    (entity) => entity.page === page && entity.y <= maxY && entity.y >= minY,
  );
}

function scoreMoney(
  values: FinancialEntity[],
  anchor: Anchor,
  layout: LearnedLayout,
  blockLines: VisualLine[],
) {
  return values
    .map((candidate) => {
      let transactionAmountScore = candidate.confidence * 20;
      let balanceScore = candidate.confidence * 10;
      const reasons: string[] = [];
      const sameBand = values
        .filter((value) => closeY(value.y, candidate.y, 8))
        .sort((a, b) => right(a) - right(b));
      const index = sameBand.indexOf(candidate);
      if (closeY(candidate.y, anchor.y, 11)) {
        transactionAmountScore += 25;
        reasons.push('near_operation_anchor');
      }
      if (sameBand.length >= 2) {
        if (index < sameBand.length - 1) {
          transactionAmountScore += 35;
          balanceScore -= 20;
          reasons.push('money_before_rightmost_balance');
        } else {
          transactionAmountScore -= 35;
          balanceScore += 35;
          reasons.push('rightmost_money_in_pair');
        }
      }
      if (
        layout.amountRight !== undefined &&
        Math.abs(right(candidate) - layout.amountRight) <= 24
      ) {
        transactionAmountScore += 25;
        reasons.push('learned_amount_column');
      }
      if (
        layout.balanceRight !== undefined &&
        Math.abs(right(candidate) - layout.balanceRight) <= 24
      ) {
        transactionAmountScore -= 30;
        balanceScore += 30;
        reasons.push('learned_balance_column');
      }
      const sourceLine = blockLines.find((line) =>
        closeY(line.y, candidate.y, 5),
      );
      if (
        /остат|баланс|доступно|на сч[её]те|available/i.test(
          sourceLine?.text ?? '',
        )
      ) {
        transactionAmountScore -= 45;
        balanceScore += 40;
        reasons.push('balance_semantics');
      }
      if (/^[+＋−–—﹣－-]/.test(candidate.rawText.trim())) {
        transactionAmountScore += 8;
        reasons.push('explicit_sign');
      }
      return {
        entity: candidate,
        transactionAmountScore,
        balanceScore,
        reasons,
      };
    })
    .sort((a, b) => b.transactionAmountScore - a.transactionAmountScore);
}

function merchantScore(entity: FinancialEntity, anchor: Anchor) {
  let score = entity.confidence * 20;
  if (entity.serviceId) score += 80;
  if (entity.y < anchor.y && anchor.y - entity.y <= 35) score += 12;
  if (/[*.]|\b(?:RU|RUS|MOSCOW|ООО|ИП)\b/i.test(String(entity.value)))
    score += 6;
  return score;
}

function chooseMerchant(entities: FinancialEntity[], anchor: Anchor) {
  const candidates = entities
    .filter((entity) => entity.type === 'merchant')
    .filter(
      (entity) =>
        !/^(?:операция|описание|получатель|merchant|расшифровка операций)$/i.test(
          String(entity.value),
        ),
    )
    .sort((a, b) => merchantScore(b, anchor) - merchantScore(a, anchor));
  return { chosen: candidates[0], candidates };
}

function direction(
  amount: FinancialEntity,
  blockLines: VisualLine[],
): { value: UniversalPdfTransaction['direction']; confidence: number } {
  const raw = amount.rawText.trim();
  if (/^[+＋]/.test(raw)) return { value: 'income', confidence: 0.99 };
  if (/^[−–—﹣－-]/.test(raw)) return { value: 'expense', confidence: 0.99 };
  const text =
    blockLines.find((line) => closeY(line.y, amount.y, 11))?.text ??
    blockLines.map((line) => line.text).join(' ');
  if (/пополн|зачислен|возврат|приход|credit|refund/i.test(text))
    return { value: 'income', confidence: 0.9 };
  if (/списан|расход|покуп|оплат|debit/i.test(text))
    return { value: 'expense', confidence: 0.9 };
  return { value: 'expense', confidence: 0.72 };
}

function assemble(
  anchor: Anchor,
  blockLines: VisualLine[],
  blockEntities: FinancialEntity[],
  layout: LearnedLayout,
) {
  const values = blockEntities.filter((entity) => entity.type === 'money');
  const amountCandidates = scoreMoney(values, anchor, layout, blockLines);
  const chosenAmount = amountCandidates[0];
  const balance = [...amountCandidates].sort(
    (a, b) => b.balanceScore - a.balanceScore,
  )[0];
  const merchant = chooseMerchant(blockEntities, anchor);
  if (!chosenAmount && !merchant.chosen?.serviceId)
    return { amountCandidates, merchantCandidate: merchant.chosen };
  const date = String(anchor.date?.value ?? '');
  const processing = blockEntities
    .filter(
      (entity) =>
        entity.type === 'date' &&
        entity.id !== anchor.date?.id &&
        entity.y < anchor.y,
    )
    .sort((a, b) => b.y - a.y)[0];
  const authorization = blockEntities.find(
    (entity) => entity.type === 'authorization_code',
  );
  const category = blockEntities.find((entity) => entity.type === 'category');
  const chosenDirection = chosenAmount
    ? direction(chosenAmount.entity, blockLines)
    : { value: 'unknown' as const, confidence: 0.2 };
  const amountGap = chosenAmount
    ? chosenAmount.transactionAmountScore -
      (amountCandidates[1]?.transactionAmountScore ?? -Infinity)
    : 0;
  const amountConfidence = !chosenAmount
    ? 0.1
    : amountGap <= 4
      ? 0.62
      : chosenAmount.transactionAmountScore >= 60
        ? 0.98
        : 0.82;
  const merchantConfidence = merchant.chosen?.serviceId
    ? 0.99
    : merchant.chosen
      ? Math.min(0.9, merchant.chosen.confidence + 0.18)
      : 0.1;
  const dateConfidence = validDate(date) ? anchor.confidence : 0.15;
  const transactionConfidence =
    amountConfidence * 0.35 +
    merchantConfidence * 0.3 +
    dateConfidence * 0.2 +
    chosenDirection.confidence * 0.15;
  const reasons: UniversalParseReviewReason[] = [];
  if (amountGap <= 4) reasons.push('multiple_amount_candidates');
  if (!merchant.chosen) reasons.push('merchant_missing');
  if (merchant.candidates[1] && !merchant.chosen?.serviceId) {
    const first = merchantScore(merchant.candidates[0], anchor);
    const second = merchantScore(merchant.candidates[1], anchor);
    if (first - second <= 2) reasons.push('multiple_merchant_candidates');
  }
  if (dateConfidence < 0.75) reasons.push('date_uncertain');
  if (chosenDirection.confidence < 0.7) reasons.push('ambiguous_direction');
  if (transactionConfidence < 0.72 && !reasons.length)
    reasons.push('unknown_layout');
  const rawDescription = blockLines
    .map((line) => line.text)
    .join(' ')
    .slice(0, 1000);
  const transaction: UniversalPdfTransaction = {
    date,
    time: anchor.time ? String(anchor.time.value) : undefined,
    processedAt: processing ? String(processing.value) : undefined,
    authorizationCode: authorization ? String(authorization.value) : undefined,
    merchant: merchant.chosen
      ? cleanPdfMerchantText(String(merchant.chosen.value))
      : '',
    rawDescription,
    bankCategory: category ? String(category.value) : undefined,
    amountMinor: chosenAmount ? Number(chosenAmount.entity.value) : 0,
    balanceAfterMinor:
      balance && balance.entity.id !== chosenAmount?.entity.id
        ? Number(balance.entity.value)
        : undefined,
    currency: /USD/.test(rawDescription)
      ? 'USD'
      : /EUR|€/.test(rawDescription)
        ? 'EUR'
        : 'RUB',
    direction: chosenDirection.value,
    dateConfidence,
    merchantConfidence,
    amountConfidence,
    directionConfidence: chosenDirection.confidence,
    transactionConfidence,
    serviceId: merchant.chosen?.serviceId,
    serviceMatchConfidence: merchant.chosen?.serviceMatchConfidence,
    reviewReasons: reasons,
  };
  return { transaction, amountCandidates, merchantCandidate: merchant.chosen };
}

function moneyOnLine(
  line: VisualLine,
  entities: FinancialEntity[],
  page: number,
) {
  return entities.filter(
    (entity) =>
      entity.type === 'money' &&
      entity.page === page &&
      closeY(entity.y, line.y, 5),
  );
}

function reconciliation(
  pages: VisualLine[][],
  entities: FinancialEntity[],
  transactions: UniversalPdfTransaction[],
): StatementReconciliation {
  const summary = (pattern: RegExp) => {
    for (let page = 0; page < pages.length; page++) {
      for (const line of pages[page]) {
        if (!pattern.test(line.text) || pdfTimePattern.test(line.text))
          continue;
        const values = moneyOnLine(line, entities, page + 1);
        if (values.length) return Number(values[values.length - 1].value);
      }
    }
    return undefined;
  };
  const expectedIncomeMinor = summary(/пополнение|зачислени[ея]|total income/i);
  const expectedExpenseMinor = summary(/списание|total expense/i);
  const explicitOpening = summary(
    /начальн(?:ый|ого) остаток|входящий остаток|opening balance/i,
  );
  const explicitClosing = summary(
    /конечн(?:ый|ого) остаток|исходящий остаток|closing balance/i,
  );
  const balanceCandidates: number[] = [];
  for (let page = 0; page < pages.length; page++) {
    for (const line of pages[page]) {
      if (!/остаток на\s+\d{2}[./]\d{2}[./]\d{2,4}/i.test(line.text)) continue;
      const values = moneyOnLine(line, entities, page + 1);
      if (values.length)
        balanceCandidates.push(Number(values[values.length - 1].value));
    }
  }
  const parsedIncomeMinor = transactions
    .filter((transaction) => transaction.direction === 'income')
    .reduce((sum, transaction) => sum + transaction.amountMinor, 0);
  const parsedExpenseMinor = transactions
    .filter((transaction) => transaction.direction === 'expense')
    .reduce((sum, transaction) => sum + transaction.amountMinor, 0);
  const incomeDifferenceMinor =
    expectedIncomeMinor === undefined
      ? undefined
      : parsedIncomeMinor - expectedIncomeMinor;
  const expenseDifferenceMinor =
    expectedExpenseMinor === undefined
      ? undefined
      : parsedExpenseMinor - expectedExpenseMinor;
  let openingBalanceMinor = explicitOpening;
  let closingBalanceMinor = explicitClosing;
  let balanceDifferenceMinor: number | undefined;
  const possibleOpenings =
    explicitOpening === undefined ? balanceCandidates : [explicitOpening];
  const possibleClosings =
    explicitClosing === undefined ? balanceCandidates : [explicitClosing];
  for (const opening of possibleOpenings) {
    for (const closing of possibleClosings) {
      const difference =
        opening + parsedIncomeMinor - parsedExpenseMinor - closing;
      if (
        balanceDifferenceMinor === undefined ||
        Math.abs(difference) < Math.abs(balanceDifferenceMinor)
      ) {
        openingBalanceMinor = opening;
        closingBalanceMinor = closing;
        balanceDifferenceMinor = difference;
      }
    }
  }
  const totalsAvailable =
    incomeDifferenceMinor !== undefined && expenseDifferenceMinor !== undefined;
  const exact =
    totalsAvailable &&
    Math.abs(incomeDifferenceMinor) <= 1 &&
    Math.abs(expenseDifferenceMinor) <= 1 &&
    (balanceDifferenceMinor === undefined ||
      Math.abs(balanceDifferenceMinor) <= 1);
  return {
    status: !totalsAvailable ? 'unavailable' : exact ? 'exact' : 'mismatch',
    openingBalanceMinor,
    expectedIncomeMinor,
    parsedIncomeMinor,
    incomeDifferenceMinor,
    expectedExpenseMinor,
    parsedExpenseMinor,
    expenseDifferenceMinor,
    closingBalanceMinor,
    balanceDifferenceMinor,
  };
}

function applyBalanceContinuity(transactions: UniversalPdfTransaction[]) {
  for (let index = 0; index < transactions.length - 1; index++) {
    const newer = transactions[index];
    const older = transactions[index + 1];
    if (
      newer.balanceAfterMinor === undefined ||
      older.balanceAfterMinor === undefined ||
      newer.currency !== older.currency ||
      newer.direction === 'unknown'
    )
      continue;
    const expected =
      older.balanceAfterMinor +
      (newer.direction === 'income' ? newer.amountMinor : -newer.amountMinor);
    if (Math.abs(expected - newer.balanceAfterMinor) <= 1) {
      newer.amountConfidence = Math.min(0.99, newer.amountConfidence + 0.01);
      newer.transactionConfidence = Math.min(
        0.99,
        newer.transactionConfidence + 0.01,
      );
    }
  }
}

export function assemblePdfTransactions(
  pages: VisualLine[][],
  profile: BankStatementProfile,
  options: { debug?: boolean } = {},
): UniversalPdfResult {
  const document = extractFinancialEntities(pages, profile);
  const anchors = findAnchors(document.entities, pages);
  const layout = learnLayout(document.entities, anchors);
  const transactions: UniversalPdfTransaction[] = [];
  const debug: PdfAssemblyDebug[] = [];
  let ignoredBlocks = 0;
  for (let index = 0; index < anchors.length; index++) {
    const anchor = anchors[index];
    const blockLines = linesForAnchor(pages, anchors, index);
    const blockEntities = entitiesForLines(
      document.entities,
      anchor.page,
      blockLines,
    );
    const assembled = assemble(anchor, blockLines, blockEntities, layout);
    if (assembled.transaction) transactions.push(assembled.transaction);
    else ignoredBlocks++;
    if (options.debug)
      debug.push({
        page: anchor.page,
        rawBlock: blockLines.map((line) => line.text),
        extractedEntities: blockEntities,
        amountCandidates: assembled.amountCandidates,
        merchantCandidate: assembled.merchantCandidate,
        assembledTransaction: assembled.transaction,
      });
  }
  applyBalanceContinuity(transactions);
  const dates = transactions
    .map((transaction) => transaction.date)
    .filter(validDate)
    .sort();
  return {
    transactions,
    transactionBlocks: anchors.length,
    ignoredBlocks,
    reconciliation: reconciliation(pages, document.entities, transactions),
    period: dates.length
      ? { from: dates[0], to: dates[dates.length - 1] }
      : undefined,
    debug: options.debug ? debug : undefined,
  };
}
