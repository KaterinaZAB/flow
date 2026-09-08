import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from 'fflate';
import { parseStatement } from '../lib/import/parse.ts';
import { amountDirection } from '../lib/import/direction.ts';
import { extractPdf, parsePdfPage } from '../lib/import/pdf.ts';
import { detectRecurring } from '../lib/domain/detection.ts';
import { makePdf } from './pdf-fixture.ts';

test('automatic CSV direction accepts minus and unsigned expenses, excludes explicit plus', async () => {
  const csv =
    'date;merchant;amount\n2026-08-01;NETFLIX;−699,00\n2026-08-02;MTS;500\n2026-08-03;NETFLIX;+699,00\n2026-08-04;Salary;＋50 000,00\n2026-08-05;Internet;0';
  const result = await parseStatement(strToU8(csv), 'month.csv', 'i', {
    currency: 'RUB',
  });
  assert.deepEqual(
    result.transactions.map((t) => [t.normalizedMerchant, t.amountMinor]),
    [
      ['service:netflix', 69900],
      ['service:mts', 50000],
    ],
  );
  assert.equal(result.skipped, 3);
  const candidates = detectRecurring(result.transactions, 'i', '2026-09-06');
  assert.equal(candidates.length, 2);
  assert.ok(
    candidates.every(
      (c) => c.transactionIds.length === 1 && (c.expense.confidence ?? 1) < 0.5,
    ),
  );
  assert.ok(
    candidates.every((c) =>
      c.reasons.some((r) => r.includes('Повторяемость пока не подтверждена')),
    ),
  );
});

test('explicit reviewed directions and bank direction columns are respected', async () => {
  const csv =
    'date;merchant;amount;direction\n2026-08-01;NETFLIX;699;expense\n2026-08-02;Salary;50000;income\n2026-08-03;NETFLIX;699;refund';
  const result = await parseStatement(strToU8(csv), 'month.csv', 'i', {
    currency: 'RUB',
  });
  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].amountMinor, 69900);
});

test('automatic XLSX direction distinguishes a textual plus from unsigned numeric amounts', async () => {
  const rows = [
    ['date', 'merchant', 'amount'],
    ['2026-08-01', 'NETFLIX', '699'],
    ['2026-08-02', 'Income', '+9000'],
    ['2026-08-03', 'MTS', '-500'],
  ];
  const xml =
    '<worksheet><sheetData>' +
    rows
      .map(
        (row, i) =>
          '<row r="' +
          (i + 1) +
          '">' +
          row
            .map(
              (value, j) =>
                '<c r="' +
                String.fromCharCode(65 + j) +
                (i + 1) +
                '" t="inlineStr"><is><t>' +
                value +
                '</t></is></c>',
            )
            .join('') +
          '</row>',
      )
      .join('') +
    '</sheetData></worksheet>';
  const bytes = zipSync({
    'xl/workbook.xml': strToU8(
      '<workbook><sheets><sheet name="Data" r:id="rId1"/></sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(xml),
  });
  const result = await parseStatement(bytes, 'month.xlsx', 'i', {
    currency: 'RUB',
  });
  assert.deepEqual(
    result.transactions.map((t) => t.amountMinor),
    [69900, 50000],
  );
});

test('PDF signs override headings; nearest credit column classifies an unsigned top-up', () => {
  const headers = [
    { text: 'Debit', x: 360, y: 720, width: 25 },
    { text: 'Credit', x: 420, y: 720, width: 25 },
  ];
  for (const [amount, x, direction] of [
    ['+699,00', 360, 'income'],
    ['−699,00', 420, 'expense'],
    ['699,00', 360, 'expense'],
    ['699,00', 420, 'income'],
  ] as const) {
    const row = parsePdfPage([
      ...headers,
      { text: '21.08.2026', x: 40, y: 700, width: 60 },
      { text: 'NETFLIX', x: 170, y: 700, width: 70 },
      { text: amount, x, y: 700, width: 45 },
    ]).rows[0];
    assert.equal(row.direction, direction);
    assert.equal(row.selected, direction === 'expense');
  }
});

test('outgoing mobile top-ups remain expenses; unicode and separated signs work', () => {
  const row = parsePdfPage([
    { text: '21.08.2026', x: 40, y: 700, width: 60 },
    { text: 'Пополнение мобильного МТС', x: 140, y: 700, width: 180 },
    { text: '−', x: 380, y: 700, width: 7 },
    { text: '500,00', x: 391, y: 700, width: 40 },
  ]).rows[0];
  assert.equal(row.direction, 'expense');
  assert.equal(row.selected, true);
  assert.equal(amountDirection(' ＋ 1\u202f000,00 '), 'income');
  assert.equal(amountDirection('1 000,00'), 'expense');
});

test('one-month PDF completes extraction, automatic selection and detection without sign settings', async () => {
  const lines = [
    { text: 'Card account statement August 2026', x: 40, y: 750 },
    { text: 'Date', x: 40, y: 720 },
    { text: 'Merchant', x: 170, y: 720 },
    { text: 'Amount', x: 380, y: 720 },
  ];
  for (const [index, merchant, amount] of [
    [0, 'NETFLIX', '-699.00'],
    [1, 'MTS', '500.00'],
    [2, 'Salary', '+50000.00'],
  ] as const) {
    const y = 690 - index * 30;
    lines.push(
      { text: '0' + (index + 1) + '.08.2026', x: 40, y },
      { text: merchant, x: 170, y },
      { text: amount, x: 380, y },
    );
  }
  const preview = await extractPdf(makePdf(lines));
  assert.deepEqual(
    preview.rows.map((r) => r.selected),
    [true, true, false],
  );
  const parsed = await parseStatement(makePdf(lines), 'month.pdf', 'i', {
    currency: 'RUB',
    pdfRows: preview.rows,
  });
  const found = detectRecurring(parsed.transactions, 'i', '2026-09-06');
  assert.equal(parsed.transactions.length, 2);
  assert.equal(found.length, 2);
  assert.deepEqual(
    new Set(found.map((c) => c.expense.serviceId)),
    new Set(['netflix', 'mts']),
  );
});

test('a month supports weekly evidence; an unknown isolated purchase is not a subscription', async () => {
  const csv =
    'date;merchant;amount\n2026-08-01;Lessons;1000\n2026-08-08;Lessons;1000\n2026-08-15;Lessons;1000\n2026-08-22;Lessons;1000\n2026-08-26;Supermarket;1500';
  const result = await parseStatement(strToU8(csv), 'month.csv', 'i', {
    currency: 'RUB',
  });
  const found = detectRecurring(result.transactions, 'i', '2026-08-30');
  assert.equal(found.length, 1);
  assert.equal(found[0].expense.billingPeriod, 'weekly');
  assert.ok((found[0].expense.confidence ?? 0) > 0.8);
});
