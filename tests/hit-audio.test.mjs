import test from 'node:test';
import assert from 'node:assert/strict';
import {HitAudio} from '../hit-audio.js';

function mockAudioContext() {
  const parameter = (value = 1) => ({
    value,
    setValueAtTime(next) { this.value = next; },
    exponentialRampToValueAtTime() {},
  });
  const node = extra => ({
    ...extra,
    connect(destination) { this.destination = destination; },
    disconnect() { this.destination = null; },
    start() {},
    stop() {},
  });
  const sources = [];
  return {
    state: 'running', currentTime: 0, sampleRate: 1000, destination: {}, sources,
    createBuffer: (_, length) => ({getChannelData: () => new Float32Array(length)}),
    createGain: () => node({gain: parameter()}),
    createOscillator: () => node({frequency: parameter()}),
    createBufferSource() { const source = node({}); sources.push(source); return source; },
  };
}

function outputGain(source) {
  let gain = 1;
  for (let node = source.destination; node; node = node.destination) {
    if (node.gain) gain *= node.gain.value;
  }
  return gain;
}

test('synthesized feedback cannot turn down playing or subsequent original samples', () => {
  const context = mockAudioContext();
  const audio = new HitAudio(context);
  audio.originalBuffers.set('perfect', {});

  audio.play('tap', .8, 'sekai');
  const original = context.sources.at(-1);
  assert.equal(outputGain(original), .4);

  audio.play({type: 'ui'}, .15, 'soft');
  assert.equal(outputGain(original), .4, 'a quiet UI sound must not change an active hit sample');

  audio.play('tap', .8, 'sekai');
  assert.equal(outputGain(context.sources.at(-1)), .4, 'returning to original sounds must keep the selected volume');
});
