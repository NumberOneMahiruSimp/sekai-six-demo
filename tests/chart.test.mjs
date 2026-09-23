import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeRhythm,demoChart,validateChart,judgmentFor,noteTime} from '../chart.js';

const songs = [
  { id: 201, title: "At God's Mercy", bpm: 135, duration: 132 },
  { id: 1, title: 'Tell Your World', bpm: 150, duration: 122 },
  { id: 47, title: 'Melt', bpm: 170, duration: 181 },
  { id: 110, title: 'Senbonzakura', bpm: 154, duration: 123 },
];

function pulseAudio(duration = 24, silentFrom = 10, silentTo = 14) {
  const sampleRate = 8000;
  const data = new Float32Array(sampleRate * duration);
  for (let time = 1; time < duration - .5; time += .5) {
    if (time >= silentFrom && time < silentTo) continue;
    const amplitude = time < 8 ? .5 : .9;
    const start = Math.floor(time * sampleRate);
    for (let i = 0; i < sampleRate * .14; i++) data[start + i] = amplitude * Math.sin(i * .22) * Math.exp(-i / 250);
  }
  return { duration, sampleRate, numberOfChannels: 1, getChannelData: () => data };
}

test('every difficulty has valid, varied, hand-playable six-key charts', () => {
  for (const song of songs) {
    let previousCount = 0;
    for (const difficulty of ['easy', 'normal', 'hard']) {
      const chart = validateChart(demoChart(song, difficulty));
      assert.ok(chart.notes.length > previousCount, `${song.title}: ${difficulty} must increase density`);
      previousCount = chart.notes.length;
      assert.ok(chart.notes.some(note => note.type === 'hold'));
      assert.ok(chart.notes.some(note => note.type === 'flick'));
      assert.equal(new Set(chart.notes.map(note => note.lane)).size, 6);
      assert.ok(chart.notes.every(note => noteTime(note, chart) + note.duration * 60 / chart.bpm <= song.duration - .29));
      for (const note of chart.notes) {
        const simultaneous = chart.notes.filter(other => other.beat === note.beat);
        assert.ok(simultaneous.length <= 2, 'No more than two notes at once');
        if (simultaneous.length === 2) assert.notEqual(Math.floor(simultaneous[0].lane / 3), Math.floor(simultaneous[1].lane / 3));
        if (note.type === 'hold') {
          assert.ok(!chart.notes.some(other => other !== note && other.beat >= note.beat && other.beat <= note.beat + note.duration && Math.floor(other.lane / 3) === Math.floor(note.lane / 3)), 'A hold leaves the other hand free');
        }
      }
    }
  }
});

test('arrangements are deterministic and differ between songs and phrases', () => {
  const first = demoChart(songs[0]);
  assert.deepEqual(first, demoChart(songs[0]));
  assert.notDeepEqual(first.notes, demoChart({ ...songs[0], id: 47, title: 'Melt' }).notes);
  const fullPhraseCount = Math.floor(first.notes.at(-1).beat / 8);
  const signatures = [];
  const rhythms = [];
  for (let phrase = 0; phrase < fullPhraseCount; phrase++) {
    const notes = first.notes.filter(note => Math.floor(note.beat / 8) === phrase);
    signatures.push(notes.map(note => `${note.beat % 8}:${note.lane}:${note.type}:${note.duration}`).join('|'));
    rhythms.push([...new Set(notes.map(note => note.beat % 8))].join('|'));
  }
  assert.ok(new Set(signatures).size > fullPhraseCount * .8, 'At least 80% of complete phrases have a distinct arrangement');
  assert.ok(new Set(rhythms).size > 10, 'Uses distinct rhythms, not just lane shuffling');
  const spacings = new Set(first.notes.slice(1).map((note, i) => note.beat - first.notes[i].beat));
  assert.ok(spacings.size >= 5, 'Contains subdivisions, chords, and longer spaces');
});

test('audio analysis detects transients and charts follow decoded duration and silence', () => {
  const analysis = analyzeRhythm(pulseAudio());
  assert.equal(analysis.duration, 24);
  assert.ok(analysis.peakTimes.length >= 30);
  assert.ok(analysis.peakTimes.some(peak => Math.abs(peak.time - 1) < .04));
  const chart = validateChart(demoChart({ id: 201, bpm: 120, duration: 999 }, 'hard', analysis));
  assert.ok(chart.notes.length > 15);
  assert.ok(chart.offset >= .75 && chart.offset < 2);
  assert.ok(chart.notes.every(note => noteTime(note, chart) + note.duration * .5 < 24));
  assert.ok(!chart.notes.some(note => noteTime(note, chart) > 10.3 && noteTime(note, chart) < 13.8), 'No note heads in the silent break');
  assert.deepEqual(chart, validateChart(demoChart({ id: 201, bpm: 120, duration: 999 }, 'hard', analysis)));
});

test('changing the audio changes the generated arrangement', () => {
  const song = { id: 1, bpm: 120, duration: 24 };
  const first = demoChart(song, 'normal', analyzeRhythm(pulseAudio()));
  const second = demoChart(song, 'normal', analyzeRhythm(pulseAudio(24, 4, 8)));
  assert.notDeepEqual(first.notes, second.notes);
});

test('short and silent audio never generate out-of-range notes', () => {
  const chart = validateChart(demoChart(songs[0], 'hard', analyzeRhythm(pulseAudio(2, 99, 100))));
  assert.ok(chart.notes.every(note => noteTime(note, chart) + note.duration * 60 / chart.bpm < 2));
  const silent = { duration: 3, sampleRate: 8000, numberOfChannels: 1, getChannelData: () => new Float32Array(24000) };
  assert.equal(demoChart(songs[0], 'normal', analyzeRhythm(silent)).notes.length, 0);
  assert.throws(() => analyzeRhythm(null));
});

test('flick and legacy accent notes survive version 1 round trips', () => {
  const chart = { version: 1, songId: 1, bpm: 120, offset: 0, notes: [
    { beat: 0, lane: 0, type: 'flick', duration: 0 },
    { beat: 1, lane: 3, type: 'accent', duration: 0 },
  ] };
  assert.deepEqual(validateChart(JSON.parse(JSON.stringify(chart))), chart);
  assert.throws(() => validateChart({ ...chart, notes: [null] }));
});
test('timing judgments have symmetric windows',()=>{for(const d of [-1,1]){assert.equal(judgmentFor(d*.04),'PERFECT');assert.equal(judgmentFor(d*.08),'GREAT');assert.equal(judgmentFor(d*.13),'GOOD');assert.equal(judgmentFor(d*.17),'BAD');assert.equal(judgmentFor(d*.19),null);}});
test('invalid and overlapping imported notes are rejected',()=>{const base={version:1,songId:1,bpm:120,offset:0,notes:[]};assert.throws(()=>validateChart({...base,bpm:0}));assert.throws(()=>validateChart({...base,notes:[{beat:0,lane:6,type:'tap',duration:0}]}));assert.throws(()=>validateChart({...base,notes:[{beat:0,lane:0,type:'hold',duration:2},{beat:1,lane:0,type:'tap',duration:0}]}));assert.throws(()=>validateChart({...base,notes:[{beat:0,lane:0,type:'tap',duration:0},{beat:0,lane:0,type:'tap',duration:0}]}));});
test('JSON round trip preserves chart timing',()=>{const chart=demoChart({id:1,bpm:150,duration:122});assert.deepEqual(validateChart(JSON.parse(JSON.stringify(chart))),validateChart(chart));assert.equal(noteTime({beat:4},chart),10.6);});
