import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { detectRecurring } from '../lib/domain/detection.ts';
import { scoreDetection } from './detection-benchmark.ts';
for (const name of readdirSync(
  new URL('./fixtures/detection/', import.meta.url),
).filter((n) => n.endsWith('.json'))) {
  test('synthetic detection benchmark: ' + name, () => {
    const fixture = JSON.parse(
      readFileSync(
        new URL('./fixtures/detection/' + name, import.meta.url),
        'utf8',
      ),
    );
    const actual = detectRecurring(
      fixture.transactions,
      'benchmark',
      fixture.asOf,
    );
    const result = scoreDetection(actual, fixture.expectedRecurringGroups);
    // At 0.8, conservative/old three-payment patterns remain suggestions rather than confident detections.
    assert.deepEqual(result, {
      truePositives: 3,
      falsePositives: 0,
      falseNegatives: 2,
      precision: 1,
      recall: 0.6,
    });
    const suggestions = scoreDetection(
      actual,
      fixture.expectedRecurringGroups,
      0.7,
    );
    assert.equal(suggestions.falsePositives, 0);
    assert.equal(suggestions.recall, 1);
    const duplicates = scoreDetection(
      [...actual, ...actual],
      fixture.expectedRecurringGroups,
    );
    assert.equal(duplicates.falsePositives, result.truePositives);
  });
}
