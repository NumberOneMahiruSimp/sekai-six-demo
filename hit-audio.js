const ORIGINAL_MANIFEST = 'assets/sfx/manifest.json';

export function sampleFor(event = {}) {
  const detail = typeof event === 'string' ? {type: event} : event;
  const type = detail.type || 'tap';
  const judgment = String(detail.judgment || '').toLowerCase();
  const critical = Boolean(detail.critical || type === 'accent');

  if (type === 'ui') return 'tap';
  if (type === 'flick') return critical ? 'flickCritical' : 'flick';
  if (type === 'slideTick') return critical ? 'connectCritical' : 'connect';
  if (type === 'trace') return critical ? 'traceCritical' : 'trace';
  if (type === 'holdLoop') return critical ? 'longCritical' : 'long';
  if (judgment === 'great') return 'great';
  if (judgment === 'good') return 'good';
  return critical ? 'critical' : 'perfect';
}

// The original-game pack is loaded after the player performs a gesture. Until it
// is ready, `sekai` uses the small local synthesized fallback instead of silence.
export class HitAudio {
  constructor(context) {
    this.context = context;
    this.output = context.createGain();
    this.output.connect(context.destination);
    this.originalBuffers = new Map();
    this.originalStatus = 'idle';
    this.originalPromise = null;
    this.noise = context.createBuffer(1, Math.ceil(context.sampleRate * .12), context.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }

  async loadOriginal() {
    if (this.originalStatus === 'ready') return true;
    if (this.originalPromise) return this.originalPromise;
    this.originalStatus = 'loading';
    this.originalPromise = (async () => {
      try {
        const manifestResponse = await fetch(ORIGINAL_MANIFEST);
        if (!manifestResponse.ok) throw new Error(`Could not load hit-sound manifest (${manifestResponse.status})`);
        const manifest = await manifestResponse.json();
        const entries = Object.entries(manifest.samples || manifest.files || {}).map(([name, value]) => {
          const key=name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
          const path=typeof value === 'string' ? value : `assets/sfx/${value.file}`;
          return [key, path];
        });
        const decoded = await Promise.all(entries.map(async ([name, path]) => {
          const response = await fetch(path);
          if (!response.ok) throw new Error(`Could not load ${name} (${response.status})`);
          const bytes = await response.arrayBuffer();
          const buffer = await this.context.decodeAudioData(bytes);
          return [name, buffer];
        }));
        decoded.forEach(([name, buffer]) => this.originalBuffers.set(name, buffer));
        this.originalStatus = this.originalBuffers.size ? 'ready' : 'failed';
        return this.originalStatus === 'ready';
      } catch (error) {
        console.warn('Original hit sounds could not be loaded; using synthesized fallback.', error);
        this.originalStatus = 'failed';
        return false;
      }
    })();
    return this.originalPromise;
  }

  play(event, volume, style = 'sekai') {
    if (volume <= 0 || this.context.state !== 'running') return;
    if (style === 'sekai') {
      const sample = this.originalBuffers.get(sampleFor(event));
      if (sample) {
        this.playBuffer(sample, volume, event?.type === 'ui' ? .45 : 1);
        return;
      }
      this.playSynth(event, volume, 'pop');
      return;
    }
    this.playSynth(event, volume, style);
  }

  playBuffer(buffer, volume, trim = 1) {
    const ac = this.context;
    const now = ac.currentTime;
    const source = ac.createBufferSource();
    const gain = ac.createGain();
    gain.gain.setValueAtTime(Math.min(1, volume * .5 * trim), now);
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(this.output);
    source.start(now);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
  }

  playSynth(event, volume, style) {
    const detail = typeof event === 'string' ? {type: event} : event;
    const type = detail.type || 'tap';
    const ac = this.context, now = ac.currentTime;
    const voice = ac.createGain();
    voice.gain.setValueAtTime(volume * .38, now);
    voice.connect(this.output);
    const flick = type === 'flick', tail = type === 'release', ui = type === 'ui';
    const length = flick ? .11 : tail || ui ? .045 : .07;
    const envelope = ac.createGain();
    envelope.gain.setValueAtTime(.0001, now);
    envelope.gain.exponentialRampToValueAtTime(tail || ui ? .35 : .65, now + .002);
    envelope.gain.exponentialRampToValueAtTime(.0001, now + length);
    envelope.connect(voice);
    const oscillator = ac.createOscillator();
    oscillator.type = style === 'arcade' ? 'square' : style === 'soft' ? 'sine' : 'triangle';
    const pitch = style === 'soft' ? 780 : ui ? 980 : 1250;
    oscillator.frequency.setValueAtTime(flick ? 1200 : pitch, now);
    oscillator.frequency.exponentialRampToValueAtTime(flick ? 2600 : pitch * .55, now + length);
    oscillator.connect(envelope);
    oscillator.start(now); oscillator.stop(now + length);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); voice.disconnect(); };
    if ((style !== 'soft' || flick) && !ui) {
      const source = ac.createBufferSource(); source.buffer = this.noise;
      const filter = ac.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = flick ? 3200 : 1600;
      const snap = ac.createGain(); snap.gain.setValueAtTime(flick ? .3 : .15, now); snap.gain.exponentialRampToValueAtTime(.0001, now + length);
      source.connect(filter); filter.connect(snap); snap.connect(voice);
      source.start(now); source.stop(now + length);
      source.onended = () => { source.disconnect(); filter.disconnect(); snap.disconnect(); };
    }
  }
}
