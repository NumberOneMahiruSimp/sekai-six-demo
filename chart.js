export const KEYS = ['d', 'f', 'g', 'j', 'k', 'l'];

const RHYTHMS = {
  easy: [
    [0, 2, 4, 6], [0, 1, 4, 6], [0, 2, 3, 6], [0, 3, 4, 7],
    [0, 2, 4, 5, 7], [0, 1, 3, 5, 6], [0, 2, 5, 7], [0, 3, 5, 6],
  ],
  normal: [
    [0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 1.5, 2.5, 3, 4, 5.5, 6, 7],
    [0, .5, 1.5, 2, 3, 4, 4.5, 5.5, 6.5, 7], [0, 1.5, 3, 4, 5, 6.5],
    [0, 1, 2, 2.5, 3, 4.5, 5, 6, 6.5, 7], [0, 2, 3, 4, 6, 7.5],
    [0, .5, 1, 2.5, 3.5, 4, 5, 5.5, 6.5, 7], [0, 2, 3, 4, 5, 5.5, 6, 6.5, 7],
    [0, 1, 2.5, 4, 4.5, 6, 7], [0, 1.5, 2, 3, 4, 5.5, 6.5, 7.5],
    [0, .5, 2, 3.5, 4, 5, 6.5], [0, 1, 2.5, 3, 4.5, 5.5, 6, 7.5],
  ],
  hard: [
    [0, .5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 5.5, 6, 6.5, 7, 7.5],
    [0, .5, 1, 1.75, 2, 2.5, 3, 4, 4.5, 5.5, 6, 6.25, 6.5, 7.5],
    [0, .75, 1.5, 2, 2.5, 3.5, 4, 4.75, 5.5, 6, 7, 7.5],
    [0, 1, 1.5, 2.5, 3, 3.5, 4, 4.5, 5.5, 6, 6.5, 7, 7.5],
    [0, .5, 1, 2, 2.25, 2.5, 3, 4, 5, 5.5, 6, 6.25, 6.5, 7],
    [0, 1.5, 2, 2.5, 3, 4, 4.5, 5, 5.75, 6, 6.5, 7.5],
    [0, .5, 1.5, 2, 3, 3.5, 4, 4.5, 5.5, 6, 6.5, 7.25, 7.5],
    [0, .5, 1, 2, 3, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5],
    [0, 1, 1.5, 2.25, 2.5, 3.5, 4, 5, 5.5, 6, 6.5, 7],
    [0, .5, 1, 1.5, 2.5, 3, 4, 4.75, 5, 5.5, 6.5, 7, 7.5],
  ],
};

// Arrangement preferences, not transcriptions of official charts.
const SONG_STYLES = {
  201: { swing: true, sustain: .28, chord: .2, rotation: 1 },
  1: { swing: false, sustain: .42, chord: .18, rotation: 0 },
  47: { swing: false, sustain: .62, chord: .12, rotation: 2 },
  110: { swing: true, sustain: .2, chord: .27, rotation: 0 },
};
const HAND_PATTERNS = [[0, 1, 2, 1], [2, 1, 0, 1], [0, 2, 1, 2], [1, 0, 2, 0], [2, 0, 1, 0]];
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function seedFor(value) {
  let seed = 2166136261;
  for (const character of String(value)) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return seed >>> 0;
}

function randomFor(seed) {
  return () => {
    seed += 0x6d2b79f5;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

/** Lightweight amplitude/transient analysis of decoded audio.
 * Cache this once per AudioBuffer; analysis is independent of difficulty.
 */
export function analyzeRhythm(buffer) {
  if (!buffer || !Number.isFinite(buffer.duration) || buffer.duration <= 0 ||
      !Number.isFinite(buffer.sampleRate) || buffer.sampleRate <= 0 ||
      !Number.isInteger(buffer.numberOfChannels) || buffer.numberOfChannels < 1 ||
      typeof buffer.getChannelData !== 'function') throw Error('Rhythm analysis needs decoded audio.');
  const frameDuration = .02;
  const frameSamples = Math.max(1, Math.round(buffer.sampleRate * frameDuration));
  const channels = Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, i) => buffer.getChannelData(i));
  const frameCount = Math.ceil(channels[0].length / frameSamples);
  const energies = new Float32Array(frameCount);
  const onsets = new Float32Array(frameCount);
  const stride = Math.max(1, Math.floor(buffer.sampleRate / 11025));
  for (let frame = 0; frame < frameCount; frame++) {
    let sum = 0;
    let count = 0;
    const end = Math.min(channels[0].length, (frame + 1) * frameSamples);
    for (let sample = frame * frameSamples; sample < end; sample += stride) {
      for (const channel of channels) { sum += channel[sample] * channel[sample]; count++; }
    }
    energies[frame] = Math.sqrt(sum / Math.max(1, count));
    const preceding = ((energies[frame - 1] || 0) * 2 + (energies[frame - 2] || 0) + (energies[frame - 3] || 0)) / 4;
    onsets[frame] = Math.max(0, energies[frame] - preceding);
  }
  const energyScale = Math.max(.00001, percentile(energies, .95));
  const onsetScale = Math.max(.00001, percentile(onsets.filter(n => n > .0001), .9));
  const peakTimes = [];
  for (let i = 0; i < frameCount; i++) {
    energies[i] = Math.min(1, energies[i] / energyScale);
    onsets[i] = Math.min(1, onsets[i] / onsetScale);
  }
  for (let i = 0; i < frameCount; i++) {
    if (onsets[i] < .32 || onsets[i] < (onsets[i - 1] || 0) || onsets[i] <= (onsets[i + 1] || 0)) continue;
    const time = i * frameDuration;
    const previous = peakTimes.at(-1);
    if (previous && time - previous.time < .08) {
      if (onsets[i] > previous.strength) peakTimes[peakTimes.length - 1] = { time, strength: onsets[i] };
    } else peakTimes.push({ time, strength: onsets[i] });
  }
  return { duration: buffer.duration, frameDuration, energies, onsets, peakTimes };
}

function sampleAnalysis(analysis, seconds, field = 'energies', radius = 0) {
  if (!analysis) return field === 'energies' ? .7 : .5;
  const frame = Math.round(seconds / analysis.frameDuration);
  const width = Math.round(radius / analysis.frameDuration);
  let value = 0;
  for (let i = frame - width; i <= frame + width; i++) value = Math.max(value, analysis[field][i] || 0);
  return value;
}

function audioOffset(analysis, secondsPerBeat) {
  const firstSound = analysis.energies.findIndex(value => value > .07) * analysis.frameDuration;
  const start = Math.max(.75, firstSound + .12);
  const peaks = analysis.peakTimes.filter(peak => peak.time >= start && peak.time < Math.min(60, analysis.duration));
  if (peaks.length < 4) return start;
  // Fit the known BPM to strong transients. Timing remains an editable estimate.
  let bestPhase = 0;
  let bestScore = -Infinity;
  for (let phaseStep = 0; phaseStep < 48; phaseStep++) {
    const phase = phaseStep / 48 * secondsPerBeat;
    let score = 0;
    for (const peak of peaks) {
      const beat = (peak.time - phase) / secondsPerBeat;
      const distance = Math.abs(beat - Math.round(beat));
      const eighthDistance = Math.abs(beat * 2 - Math.round(beat * 2)) / 2;
      score += peak.strength * (Math.exp(-distance * distance / .012) + .25 * Math.exp(-eighthDistance * eighthDistance / .006));
    }
    if (score > bestScore) { bestScore = score; bestPhase = phase; }
  }
  return Math.round((bestPhase + Math.ceil((start - bestPhase) / secondsPerBeat) * secondsPerBeat) * 10000) / 10000;
}

/** Varied practice arrangement. Optional analysis follows actual audio's
 * transients/energy; patterns still use the song's supplied beat grid.
 */
export function demoChart(song, difficulty = 'normal', analysis = null) {
  difficulty = RHYTHMS[difficulty] ? difficulty : 'normal';
  const bpm = clamp(Number(song.bpm) || 120, 30, 400);
  const secondsPerBeat = 60 / bpm;
  const duration = analysis?.duration || Number(song.duration) || 75;
  const custom = song.group === 'CUSTOM TRACK';
  const offset = analysis ? audioOffset(analysis, secondsPerBeat) : Math.min(custom ? 1 : 9, duration / 4);
  const lastBeat = Math.max(0, (duration - offset - .3) / secondsPerBeat);
  const seed = seedFor(`${song.id}|${song.title || ''}|${bpm}`);
  const random = randomFor(seed);
  const style = SONG_STYLES[song.id] || { swing: seed % 2 === 0, sustain: .25 + random() * .35, chord: .15 + random() * .1, rotation: seed % 3 };
  const notes = [];
  const laneEnds = Array(6).fill(-1);
  const handEnds = [-1, -1];
  const handLast = [-1, -1];
  let lastPattern = -1;
  let previousPattern = -1;
  let lastHand = seed % 2;
  const minimumGap = Math.min(.25, .085 / secondsPerBeat);
  const phraseCount = Math.ceil(lastBeat / 8);

  const addNote = (beat, preferredHand, finger, type = 'tap', holdLength = 0) => {
    if (beat > lastBeat) return null;
    const availableHands = [preferredHand, 1 - preferredHand].filter(hand => handEnds[hand] + minimumGap < beat && handLast[hand] !== beat);
    for (const hand of availableHands) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const lane = hand * 3 + (finger + attempt) % 3;
        if (laneEnds[lane] + minimumGap >= beat) continue;
        const duration = type === 'hold' ? Math.min(holdLength, Math.floor((lastBeat - beat) * 2) / 2) : 0;
        const note = { beat, lane, type: type === 'hold' && duration < .5 ? 'tap' : type, duration: Math.max(0, duration) };
        notes.push(note);
        laneEnds[lane] = beat + note.duration;
        handLast[hand] = beat;
        if (note.duration) handEnds[hand] = beat + note.duration;
        lastHand = hand;
        return note;
      }
    }
    return null;
  };

  for (let phrase = 0; phrase < phraseCount; phrase++) {
    const phraseBeat = phrase * 8;
    const progress = phrase / Math.max(1, phraseCount - 1);
    let energy = 0;
    for (let b = 0; b < 8; b++) energy += sampleAnalysis(analysis, offset + (phraseBeat + b) * secondsPerBeat, 'energies', .12) / 8;
    if (!analysis) energy = progress < .1 || progress > .95 ? .4 : (Math.floor(phrase / 4) + seed) % 4 === 2 ? .38 : .78;
    const quiet = energy < .4;
    let pool = RHYTHMS[difficulty];
    if (quiet && difficulty !== 'easy') pool = difficulty === 'hard' ? RHYTHMS.normal : RHYTHMS.easy;
    let pattern = Math.floor(random() * pool.length);
    while (pattern === lastPattern || pattern === previousPattern) pattern = (pattern + 1) % pool.length;
    previousPattern = lastPattern;
    lastPattern = pattern;
    let rhythm = [...pool[pattern]];
    if (phrase % 4 === 3 && random() < .55) rhythm = rhythm.filter(beat => beat < 7);
    if (analysis && difficulty !== 'easy' && !quiet) {
      const subdivision = difficulty === 'hard' ? .25 : .5;
      for (let b = subdivision; b < 7.75; b += subdivision) {
        const t = offset + (phraseBeat + b) * secondsPerBeat;
        const onset = sampleAnalysis(analysis, t, 'onsets', .04);
        if (onset > .8 && !rhythm.some(beat => Math.abs(beat - b) < subdivision * .99) && random() < (difficulty === 'hard' ? .6 : .3)) rhythm.push(b);
      }
    }
    rhythm.sort((a, b) => a - b);
    const leftPattern = HAND_PATTERNS[(phrase + style.rotation + Math.floor(random() * 3)) % HAND_PATTERNS.length];
    const rightPattern = HAND_PATTERNS[(phrase * 3 + style.rotation + 2) % HAND_PATTERNS.length];
    const handCounts = [0, 0];
    const holdAt = random() < style.sustain + (quiet ? .25 : 0) ? (phrase % 2 === 0 ? 0 : rhythm.findIndex(beat => beat >= 4)) : -1;
    for (let index = 0; index < rhythm.length; index++) {
      const localBeat = rhythm[index];
      const beat = phraseBeat + localBeat;
      const t = offset + beat * secondsPerBeat;
      const loudness = sampleAnalysis(analysis, t, 'energies', .075);
      const onset = sampleAnalysis(analysis, t, 'onsets', .06);
      if (analysis && loudness < .045 && onset < .15) continue;
      if (analysis && quiet && onset < .12 && index % 2 === 1) continue;
      const preferredHand = 1 - lastHand;
      const handPattern = preferredHand ? rightPattern : leftPattern;
      const finger = (handPattern[handCounts[preferredHand]++ % handPattern.length] + Math.floor(phrase / 3)) % 3;
      const cadence = index === rhythm.length - 1 || (difficulty === 'hard' && localBeat >= 3 && localBeat < 4);
      const flick = cadence && (difficulty !== 'easy' || phrase % 3 === 1);
      const type = index === holdAt && !flick ? 'hold' : flick ? 'flick' : 'tap';
      const holdLength = difficulty === 'easy' ? 2 : [1, 1.5, 2, 2.5][(phrase + style.rotation) % 4];
      const note = addNote(beat, preferredHand, finger, type, holdLength);
      if (!note) continue;
      const strongBeat = localBeat === 0 || localBeat === 4 || (style.swing && localBeat === 6);
      const chordChance = difficulty === 'easy' ? .05 : style.chord * (difficulty === 'hard' ? 2.1 : 1);
      if (!quiet && strongBeat && random() < chordChance && (!analysis || onset > .18)) {
        addNote(beat, 1 - Math.floor(note.lane / 3), (finger + 1 + phrase % 2) % 3);
      }
    }
  }
  // Keep the existing rhythm/timing; give some sustained notes a moving path in
  // the already-reserved hand so the other hand's notes remain playable.
  let holdIndex = 0;
  for (const note of notes) {
    if (note.type !== 'hold' || note.duration < 1 || holdIndex++ % 2 !== 0) continue;
    const handStart = Math.floor(note.lane / 3) * 3;
    const target = note.lane === handStart + 2 ? note.lane - 1 : note.lane + 1;
    note.type = 'slide';
    note.points = [{beat:0,lane:note.lane,ease:'smooth'}, {beat:note.duration/2,lane:target,ease:'smooth'}, {beat:note.duration,lane:note.lane}];
  }
  return { version: 1, songId: song.id, bpm, offset, notes: notes.sort((a, b) => a.beat - b.beat || a.lane - b.lane) };
}

export function validateChart(value) {
  if (!value || value.version !== 1 || !Number.isFinite(value.bpm) || value.bpm < 30 || value.bpm > 400 ||
      !Number.isFinite(value.offset) || value.offset < -10 || value.offset > 600 || !Array.isArray(value.notes) || value.notes.length > 20000) {
    throw Error('Invalid chart. Use an exported version 1 chart with BPM 30–400.');
  }
  const notes = value.notes.map(note => {
    if (!note || !Number.isFinite(note.beat) || note.beat < 0 || note.beat > 100000 || !Number.isInteger(note.lane) || note.lane < 0 || note.lane > 5 ||
        !['tap', 'hold', 'slide', 'flick', 'accent'].includes(note.type) || !Number.isFinite(note.duration) || note.duration < 0 ||
        (['hold','slide'].includes(note.type) && (note.duration <= 0 || note.duration > 128))) {
      throw Error('Invalid note: check beat, lane (0–5), type and duration.');
    }
    const result = {beat:note.beat,lane:note.lane,type:note.type,duration:['hold','slide'].includes(note.type)?note.duration:0};
    if (note.type === 'slide') {
      if (!Array.isArray(note.points) || note.points.length < 2 || note.points.length > 256) throw Error('A slide needs 2–256 path points.');
      let previous = -1;
      result.points = note.points.map(point => {
        if (!point || !Number.isFinite(point.beat) || point.beat < 0 || point.beat > note.duration || point.beat <= previous || !Number.isFinite(point.lane) || point.lane < 0 || point.lane > 5 || (point.ease && !['linear','smooth','in','out'].includes(point.ease))) throw Error('Slide points must move forward in time and stay within the six lanes.');
        previous=point.beat;
        return {beat:point.beat,lane:point.lane,...(point.ease?{ease:point.ease}:{})};
      });
      if (result.points[0].beat !== 0 || result.points[0].lane !== note.lane || Math.abs(result.points.at(-1).beat-note.duration) > .00001) throw Error('Slide path must start at its head and end at its full duration.');
      if (typeof note.endFlick === 'boolean') result.endFlick=note.endFlick;
    }
    return result;
  }).sort((a, b) => a.beat - b.beat || a.lane - b.lane);
  const ends = Array(6).fill(-1);
  for (const note of notes) {
    if (note.beat <= ends[note.lane] + .00001) throw Error('Notes overlap in the same lane. Remove duplicates or shorten holds.');
    ends[note.lane] = note.beat + note.duration;
  }
  return { version: 1, songId: value.songId, bpm: value.bpm, offset: value.offset, notes };
}

export function judgmentFor(delta) {
  const distance = Math.abs(delta);
  return distance <= .045 ? 'PERFECT' : distance <= .09 ? 'GREAT' : distance <= .14 ? 'GOOD' : distance <= .18 ? 'BAD' : null;
}

export function noteTime(note, chart) { return chart.offset + note.beat * 60 / chart.bpm; }
