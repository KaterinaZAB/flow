import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localCommand } from '../lib/local/actions.ts';
import { clearWorkspace, readWorkspace } from '../lib/local/repository.ts';
import { makePdf } from './pdf-fixture.ts';

test('reviewed PDF import creates known-subscription candidates in local storage', async () => {
  Object.defineProperty(globalThis, 'window', {
    value: new EventTarget(),
    configurable: true,
  });
  await clearWorkspace();
  const lines = [
    { text: 'Date', x: 40, y: 750 },
    { text: 'Description', x: 200, y: 750 },
    { text: 'Amount', x: 420, y: 750 },
    { text: '09.08.2026', x: 40, y: 700 },
    { text: 'YANDEX * 1111 * PLUS MOSCOW RUS', x: 200, y: 700 },
    { text: '249.00', x: 420, y: 700 },
    { text: '09.09.2026', x: 40, y: 670 },
    { text: 'YANDEX * 2222 * PLUS MOSCOW RUS', x: 200, y: 670 },
    { text: '249.00', x: 420, y: 670 },
  ];
  const bytes = makePdf(lines);
  const file = new File([bytes.buffer as ArrayBuffer], 'statement.pdf', {
    type: 'application/pdf',
  });
  const previewForm = new FormData();
  previewForm.set('file', file);
  previewForm.set('currency', 'RUB');
  const previewResponse = await localCommand('/imports', {
    method: 'POST',
    body: previewForm,
  });
  const preview = (await previewResponse.json()) as {
    pdfPreview: { rows: unknown[] };
  };
  assert.equal(preview.pdfPreview.rows.length, 2);

  const importForm = new FormData();
  importForm.set('file', file);
  importForm.set('currency', 'RUB');
  importForm.set('pdfReviewed', 'true');
  importForm.set('pdfRows', JSON.stringify(preview.pdfPreview.rows));
  const response = await localCommand('/imports', {
    method: 'POST',
    body: importForm,
  });
  const result = (await response.json()) as { candidateCount: number };
  assert.equal(result.candidateCount, 1);
  const workspace = await readWorkspace();
  assert.equal(workspace.candidates.length, 1);
  assert.equal(workspace.candidates[0].expense.serviceId, 'yandex-plus');
});
