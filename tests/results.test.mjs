import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreRank, resultSummary, chartFingerprint} from '../results.js';

test('score rank steps match the demo score ceiling', () => {
  assert.equal(scoreRank(0),'C');
  assert.equal(scoreRank(499_999),'C');
  assert.equal(scoreRank(500_000),'B');
  assert.equal(scoreRank(750_000),'A');
  assert.equal(scoreRank(900_000),'S');
});

test('a full combo requires every note to be perfect or great', () => {
  const base={score:980_000,totalNotes:10,maxCombo:10,timing:{FAST:2,LATE:1,FLICK:1}};
  const full=resultSummary({...base,counts:{PERFECT:9,GREAT:1,GOOD:0,BAD:0,MISS:0}});
  assert.equal(full.badge,'FULL COMBO');
  assert.deepEqual([full.fast,full.late,full.flick],[2,1,1]);
  const perfect=resultSummary({...base,counts:{PERFECT:10,GREAT:0,GOOD:0,BAD:0,MISS:0}});
  assert.equal(perfect.badge,'ALL PERFECT');
  const broken=resultSummary({...base,maxCombo:7,counts:{PERFECT:9,GREAT:0,GOOD:1,BAD:0,MISS:0}});
  assert.equal(broken.badge,'LIVE COMPLETE');
});

test('early failure never awards a combo badge and keeps progress in range', () => {
  const summary=resultSummary({score:220_000,totalNotes:10,maxCombo:2,failed:true,counts:{PERFECT:2,GREAT:0,GOOD:0,BAD:0,MISS:1}});
  assert.equal(summary.badge,'LIVE FAILED');
  assert.equal(summary.rank,'C');
  assert.equal(summary.progress,22);
  assert.equal(summary.accuracy,20);
  assert.equal(summary.flick,0);
});

test('personal bests can be kept per exact chart', () => {
  const chart={bpm:120,offset:0,notes:[{beat:1,lane:0,type:'tap'}]};
  assert.equal(chartFingerprint(chart),chartFingerprint(structuredClone(chart)));
  assert.notEqual(chartFingerprint(chart),chartFingerprint({...chart,notes:[{beat:1,lane:1,type:'tap'}]}));
});
