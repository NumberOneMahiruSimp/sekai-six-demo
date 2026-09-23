import test from 'node:test';
import assert from 'node:assert/strict';
import {validateChart} from '../chart.js';
import {slideAtBeat, slideIsHeld, slideLanesAt} from '../slide.js';
import {sampleFor} from '../hit-audio.js';

test('slides preserve their route and accept a lane handover', () => {
  const chart = validateChart({version:1,songId:1,bpm:120,offset:0,notes:[{
    beat:2,lane:0,type:'slide',duration:2,
    points:[{beat:0,lane:0,ease:'smooth'},{beat:1,lane:1,ease:'smooth'},{beat:2,lane:2}],
  }]});
  assert.equal(slideAtBeat(chart.notes[0],1).lane,1);
  const runtime={...chart.notes[0],t:10,end:11,path:[{t:10,lane:0},{t:10.5,lane:1},{t:11,lane:2}]};
  assert.ok(slideLanesAt(runtime,10.5).has(1));
  assert.ok(slideIsHeld(runtime,10.5,new Set([1])));
  assert.ok(!slideIsHeld(runtime,10.5,new Set([4])));
});

test('invalid slide paths are rejected and game samples map predictably', () => {
  const base={version:1,songId:1,bpm:120,offset:0,notes:[{beat:0,lane:0,type:'slide',duration:2,points:[{beat:0,lane:0},{beat:1,lane:2}]}]};
  assert.throws(() => validateChart(base));
  assert.equal(sampleFor({type:'tap',judgment:'GREAT'}),'great');
  assert.equal(sampleFor({type:'flick',critical:true}),'flickCritical');
  assert.equal(sampleFor({type:'slideTick'}),'connect');
  assert.equal(sampleFor({type:'ui'}),'tap');
});
