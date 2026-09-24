import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeVideoDelay,videoTimeAt} from '../video-sync.js';

test('positive video delay holds its first frame until the song catches up',()=>{
  assert.equal(videoTimeAt(0,1.5,20),null);
  assert.equal(videoTimeAt(1.49,1.5,20),null);
  assert.equal(videoTimeAt(1.5,1.5,20),0);
  assert.equal(videoTimeAt(2,1.5,20),.5);
});

test('negative video delay skips a video intro and looped clips remain aligned',()=>{
  assert.equal(videoTimeAt(0,-2,20),2);
  assert.equal(videoTimeAt(8,-2,6),4);
  assert.equal(videoTimeAt(2.5,.5,Number.NaN),2);
});

test('saved video timing values stay within the supported range',()=>{
  assert.equal(normalizeVideoDelay('1.25'),1.25);
  assert.equal(normalizeVideoDelay(-20),-10);
  assert.equal(normalizeVideoDelay(20),10);
  assert.equal(normalizeVideoDelay('oops'),0);
});
