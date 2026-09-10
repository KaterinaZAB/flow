import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractPdf,
  parsePdfPage,
  pdfRowReviewReason,
  pdfRowsToTable,
} from '../lib/import/pdf.ts';
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
  assert.match(pdfRowReviewReason(row) ?? '', /категория банка/);
  assert.equal(row.selected, false);
  assert.deepEqual(pdfRowsToTable([row]), [
    ['date', 'merchant', 'amount', 'currency', 'direction'],
  ]);
});
