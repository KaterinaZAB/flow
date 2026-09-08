import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { parseStatement, MappingError } from '../lib/import/parse.ts';
import { parseCsv } from '../lib/import/csv.ts';
import { parseXlsx } from '../lib/import/xlsx.ts';
import { normalizeMerchant } from '../lib/domain/catalog.ts';
const opts = { amountMode: 'negative' as const, currency: 'RUB' };
test('CSV quotes, localized amounts, refunds and injection', async () => {
  const csv =
    'Дата;Описание;Сумма;Валюта\n21.06.2026;"YANDEX*PLUS";-399,00;RUB\n21.07.2026;"YA PLUS";-399;RUB\n22.07.2026;Возврат;399;RUB\n23.07.2026;=WEBSERVICE(1);-100;RUB';
  const r = await parseStatement(strToU8(csv), 'bank.csv', 'i', opts);
  assert.equal(r.transactions.length, 2);
  assert.equal(r.skipped, 2);
  assert.equal(r.transactions[0].normalizedMerchant, 'service:yandex-plus');
  assert.equal(r.transactions[0].amountMinor, 39900);
  assert.deepEqual(parseCsv('a,b,c\n"aa,bb","x""y",7')[1], [
    'aa,bb',
    'x"y',
    '7',
  ]);
  assert.throws(() => parseCsv('a,b\n"bad,1'));
});
test('separate expense column and explicit direction override sign', async () => {
  const r = await parseStatement(
    strToU8('date;merchant;расход\n2026-01-01;Дом;6900\n2026-02-01;Дом;7350'),
    'bank.csv',
    'i',
    opts,
  );
  assert.equal(r.transactions.length, 2);
  assert.equal(r.transactions[1].amountMinor, 735000);
});
test('ambiguous headers require explicit mapping; duplicated payments retain multiplicity', async () => {
  const csv = strToU8('A;B;C\n2026-01-01;Test;99\n2026-01-01;Test;99');
  await assert.rejects(
    () => parseStatement(csv, 'b.csv', 'i', opts),
    MappingError,
  );
  const r = await parseStatement(csv, 'b.csv', 'i', {
    ...opts,
    amountMode: 'positive',
    mapping: { date: 0, merchant: 1, amount: 2 },
  });
  assert.equal(r.transactions[0].fingerprint, r.transactions[1].fingerprint);
  assert.deepEqual(
    r.transactions.map((t) => t.occurrence),
    [0, 1],
  );
});
function xlsx(sheet: string) {
  return zipSync({
    'xl/workbook.xml': strToU8(
      '<workbook><sheets><sheet name="Data" r:id="rId1"/></sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(sheet),
  });
}
test('XLSX inline strings, numeric date serial and numeric amount', async () => {
  const bytes = xlsx(
    '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>date</t></is></c><c r="B1" t="inlineStr"><is><t>merchant</t></is></c><c r="C1" t="inlineStr"><is><t>amount</t></is></c></row><row r="2"><c r="A2"><v>46023</v></c><c r="B2" t="inlineStr"><is><t>Интернет</t></is></c><c r="C2"><v>-790.10</v></c></row></sheetData></worksheet>',
  );
  const r = await parseStatement(bytes, 'b.xlsx', 'i', opts);
  assert.equal(r.transactions.length, 1);
  assert.equal(r.transactions[0].amountMinor, 79010);
  assert.equal(r.transactions[0].paidAt, '2026-01-01');
});
test('XLSX rejects formulas, DTD and compressed oversized content', () => {
  assert.throws(
    () =>
      parseXlsx(
        xlsx(
          '<worksheet><sheetData><row><c r="A1"><f>SUM(1)</f><v>1</v></c></row></sheetData></worksheet>',
        ),
      ),
    /формул/,
  );
  assert.throws(() =>
    parseXlsx(xlsx('<!DOCTYPE x [<!ENTITY a "bad">]><worksheet/>')),
  );
  assert.throws(() => parseXlsx(xlsx('x'.repeat(9 * 1024 * 1024))));
});
test('aliases normalize; ambiguous APPLE.COM is not invented as iCloud', () => {
  assert.equal(normalizeMerchant('YA PLUS'), 'service:yandex-plus');
  assert.equal(normalizeMerchant('YANDEX*PLUS'), 'service:yandex-plus');
  assert.notEqual(normalizeMerchant('APPLE.COM/BILL'), 'service:icloud');
});
