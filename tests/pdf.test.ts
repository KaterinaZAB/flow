import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanMerchantText,
  extractPdf,
  parsePdfPage,
  pdfRowReviewReason,
  pdfRowsToTable,
} from '../lib/import/pdf.ts';
import {
  groupItemsIntoLines,
  mergeNearbyTextItems,
} from '../lib/import/pdf/layout.ts';
import { parseStatement } from '../lib/import/parse.ts';
import { makePdf, fixtureLines } from './pdf-fixture.ts';
test('real PDF bytes: extracts dates, merchant and debit, not balance', async () => {
  const p = await extractPdf(makePdf(fixtureLines()));
  assert.equal(p.totalPages, 1);
  assert.equal(p.rows.length, 3);
  assert.equal(p.rows[0].amount, '699');
  assert.equal(p.rows[0].merchant, 'NETFLIX');
  assert.equal(p.rows[0].date, '2026-06-21');
  assert.equal(p.rows[0].direction, 'expense');
  assert.equal(p.rows[0].selected, true);
});
test('reviewed PDF operations re-enter the validated import pipeline', async () => {
  const bytes = makePdf(fixtureLines());
  const p = await extractPdf(bytes);
  const r = await parseStatement(makePdf(fixtureLines()), 'bank.pdf', 'i', {
    amountMode: 'negative',
    currency: 'RUB',
    pdfRows: p.rows,
  });
  assert.equal(r.transactions.length, 3);
  assert.equal(r.transactions[0].normalizedMerchant, 'service:netflix');
  assert.equal(r.transactions[0].amountMinor, 69900);
});
test('PDF without text, invalid PDF and unresolved directions are explicit failures', async () => {
  await assert.rejects(() => extractPdf(makePdf([])), /текстового слоя/);
  await assert.rejects(
    () => extractPdf(new Uint8Array([1, 2])),
    /не является PDF/,
  );
  assert.throws(
    () =>
      pdfRowsToTable([
        {
          date: '2026-01-01',
          merchant: 'Test',
          amount: '100',
          currency: 'RUB',
          selected: true,
          direction: 'unknown',
        },
      ]),
    /направление/,
  );
});
test('PDF unsigned amounts are preselected expenses; multiline description is retained', () => {
  const cells = [
    { text: '21.06.2026', x: 40, y: 700, width: 60 },
    { text: 'Some service', x: 170, y: 700, width: 70 },
    { text: '399,00', x: 380, y: 700, width: 40 },
    { text: 'monthly payment', x: 170, y: 688, width: 85 },
  ];
  const r = parsePdfPage(cells).rows[0];
  assert.equal(r.direction, 'expense');
  assert.equal(r.selected, true);
  assert.match(r.merchant, /monthly payment/);
});
test('PDF prefers the merchant column over a bank category', () => {
  const row = parsePdfPage([
    { text: 'Date', x: 40, y: 720, width: 30 },
    { text: 'Category', x: 120, y: 720, width: 50 },
    { text: 'Merchant', x: 240, y: 720, width: 50 },
    { text: 'Amount', x: 400, y: 720, width: 50 },
    { text: '21.06.2026', x: 40, y: 690, width: 60 },
    { text: 'Travel', x: 120, y: 690, width: 40 },
    { text: 'NETFLIX', x: 240, y: 690, width: 55 },
    { text: '-699.00', x: 400, y: 690, width: 50 },
  ]).rows[0];
  assert.equal(row.merchant, 'NETFLIX');
  assert.equal(row.selected, true);
});
test('ambiguous PDF rows stay available but are excluded by default', () => {
  const row = parsePdfPage([
    { text: 'Date', x: 40, y: 720, width: 30 },
    { text: 'Merchant', x: 170, y: 720, width: 50 },
    { text: 'Amount', x: 380, y: 720, width: 50 },
    { text: '21.06.2026', x: 40, y: 690, width: 60 },
    { text: 'Travel', x: 170, y: 690, width: 40 },
    { text: '-699.00', x: 380, y: 690, width: 50 },
  ]).rows[0];
  assert.match(pdfRowReviewReason(row) ?? '', /получателя|категория банка/);
  assert.equal(row.selected, false);
  assert.deepEqual(pdfRowsToTable([row]), [
    [
      'date',
      'time',
      'processedAt',
      'authorizationCode',
      'merchant',
      'rawDescription',
      'bankCategory',
      'amount',
      'currency',
      'direction',
      'parseConfidence',
      'parseReviewReasons',
    ],
  ]);
});

test('visual lines tolerate baseline drift and preserve column gaps', () => {
  const items = [
    { text: '23.05.2026', x: 40, y: 700, width: 55, height: 10 },
    { text: 'VK*VK', x: 160, y: 701.2, width: 32, height: 10 },
    { text: 'MUSIC', x: 195, y: 700.6, width: 30, height: 10 },
    { text: '89,00', x: 410, y: 700.1, width: 32, height: 10 },
  ];
  const lines = groupItemsIntoLines(items);
  assert.equal(lines.length, 1);
  assert.match(lines[0].text, /VK\*VK MUSIC/);
  assert.equal(mergeNearbyTextItems(items.slice(1, 3)).length, 1);
});

test('merchant cleanup removes card suffixes but preserves the merchant', () => {
  assert.equal(
    cleanMerchantText('VK*VK MUSIC MOSCOW RUS. Операция по карте ****1422'),
    'VK*VK MUSIC MOSCOW RUS',
  );
  assert.equal(cleanMerchantText('Яндекс.Плюс'), 'Яндекс.Плюс');
});

test('multi-line PDF operation keeps category separate from merchant', async () => {
  const cells = [
    { text: '23.05.2026', x: 35, y: 700, width: 58 },
    { text: '14:16', x: 100, y: 700, width: 28 },
    { text: 'Прочие операции', x: 160, y: 700, width: 95 },
    { text: '89,00', x: 410, y: 700, width: 32 },
    { text: '23.05.2026', x: 35, y: 686, width: 58 },
    { text: '654235', x: 100, y: 686, width: 38 },
    {
      text: 'VK*VK MUSIC MOSCOW RUS. Операция по карте ****1422',
      x: 160,
      y: 686,
      width: 280,
    },
  ];
  const parsed = parsePdfPage(cells);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].date, '2026-05-23');
  assert.equal(parsed.rows[0].time, '14:16');
  assert.equal(parsed.rows[0].merchant, 'VK*VK MUSIC MOSCOW RUS');
  assert.equal(parsed.rows[0].bankCategory, 'Прочие операции');
  assert.equal(parsed.rows[0].amount, '89');
  assert.equal(parsed.rows[0].direction, 'expense');
  assert.equal(parsed.rows[0].selected, true);
  const imported = await parseStatement(makePdf(cells), 'bank.pdf', 'i', {
    currency: 'RUB',
    pdfRows: parsed.rows,
  });
  assert.equal(
    imported.transactions[0].originalMerchant,
    'VK*VK MUSIC MOSCOW RUS',
  );
  assert.equal(imported.transactions[0].bankCategory, 'Прочие операции');
  assert.equal(imported.transactions[0].transactionTime, '14:16');
  assert.equal(imported.transactions[0].amountMinor, 8900);
});

test('balance-like amount loses to the actual transaction amount', () => {
  const row = parsePdfPage([
    { text: '21.05.2026', x: 35, y: 710, width: 58 },
    { text: 'Яндекс.Плюс', x: 150, y: 696, width: 75 },
    { text: '249 ₽', x: 405, y: 696, width: 38 },
    { text: 'Оплата товаров и услуг', x: 150, y: 682, width: 125 },
    { text: 'Хотелки: 29 592,92 ₽', x: 150, y: 668, width: 150 },
  ]).rows[0];
  assert.equal(row.merchant, 'Яндекс.Плюс');
  assert.equal(row.bankCategory, 'Оплата товаров и услуг');
  assert.equal(row.amount, '249');
  assert.equal(row.currency, 'RUB');
  assert.ok((row.amountConfidence ?? 0) >= 0.8);
});

test('PDF accepts two-digit years without treating the next line as a transaction', () => {
  const parsed = parsePdfPage([
    { text: '23/05/26', x: 35, y: 700, width: 48 },
    { text: '14:16', x: 92, y: 700, width: 28 },
    { text: 'Прочие операции', x: 150, y: 700, width: 95 },
    { text: '89,00', x: 410, y: 700, width: 32 },
    { text: '23/05/26', x: 35, y: 686, width: 48 },
    { text: 'VK*VK MUSIC', x: 150, y: 686, width: 75 },
  ]);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].date, '2026-05-23');
  assert.equal(parsed.rows[0].merchant, 'VK*VK MUSIC');
});

test('equally plausible amounts require review and stay out of automatic import', () => {
  const row = parsePdfPage([
    { text: '21.05.2026', x: 35, y: 700, width: 58 },
    { text: 'UNKNOWN SERVICE', x: 150, y: 700, width: 95 },
    { text: '249,00', x: 360, y: 700, width: 38 },
    { text: '249,00', x: 420, y: 700, width: 38 },
  ]).rows[0];
  assert.ok(row.reviewReasons?.includes('multiple_amount_candidates'));
  assert.equal(row.selected, false);
  assert.equal(pdfRowsToTable([row]).length, 1);
});
