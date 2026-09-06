import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseMinor,divideRounded} from '../lib/domain/money.ts';
test('money parsing is exact, localized and validates precision',()=>{assert.equal(parseMinor('7 200,19'),720019);assert.equal(parseMinor('-399.01'),-39901);assert.throws(()=>parseMinor('1.999'));assert.throws(()=>parseMinor('=SUM(1)'));assert.equal(divideRounded(100,3),33);assert.equal(divideRounded(101,2),51)});
