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

  const repeatedResponse = await localCommand('/imports', {
    method: 'POST',
    body: importForm,
  });
  const repeated = (await repeatedResponse.json()) as {
    candidateCount: number;
    repeatedImport: boolean;
  };
  assert.equal(repeated.candidateCount, 1);
  assert.equal(repeated.repeatedImport, true);
  const repeatedWorkspace = await readWorkspace();
  assert.equal(repeatedWorkspace.transactions.length, 2);
  assert.equal(repeatedWorkspace.candidates.length, 1);
  assert.equal(
    repeatedWorkspace.transactions.some((transaction) =>
      repeatedWorkspace.candidates[0].transactionIds.includes(transaction.id),
    ),
    true,
  );

  await localCommand('/candidates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ids: [repeatedWorkspace.candidates[0].id],
      decision: 'confirmed',
    }),
  });
  const confirmedResponse = await localCommand('/imports', {
    method: 'POST',
    body: importForm,
  });
  const confirmed = (await confirmedResponse.json()) as {
    candidateCount: number;
    confirmedCandidateCount: number;
    repeatedImport: boolean;
  };
  assert.equal(confirmed.candidateCount, 0);
  assert.equal(confirmed.confirmedCandidateCount, 1);
  assert.equal(confirmed.repeatedImport, true);

  await clearWorkspace();
  const rejectedFirstResponse = await localCommand('/imports', {
    method: 'POST',
    body: importForm,
  });
  assert.equal(
    ((await rejectedFirstResponse.json()) as { candidateCount: number })
      .candidateCount,
    1,
  );
  const rejectedFirstWorkspace = await readWorkspace();
  await localCommand('/candidates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ids: [rejectedFirstWorkspace.candidates[0].id],
      decision: 'rejected',
    }),
  });
  const rejectedResponse = await localCommand('/imports', {
    method: 'POST',
    body: importForm,
  });
  const rejected = (await rejectedResponse.json()) as {
    candidateCount: number;
    rejectedCandidateCount: number;
  };
  assert.equal(rejected.candidateCount, 0);
  assert.equal(rejected.rejectedCandidateCount, 1);
});
