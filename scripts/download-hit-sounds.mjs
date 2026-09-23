import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

// Public, extracted game assets; preserve their exact bytes and record provenance.
const destination = fileURLToPath(new URL('../assets/sfx/', import.meta.url));
const base = 'https://storage.sekai.best/sekai-jp-assets/live/tap_se/custom01/';
const names = ['perfect','critical','flick','flick_critical','connect','connect_critical','trace','trace_critical','long','long_critical','great','good','tap'];
await fs.mkdir(destination, {recursive: true});
const entries = await Promise.all(names.map(async name => {
  const filename = `se_live_${name}.wav`, url = base + filename;
  let bytes;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(30000)});
      if (!response.ok) throw new Error(`${response.status}: ${url}`);
      bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`Not a WAV: ${url}`);
      break;
    } catch (error) { if (attempt === 2) throw error; }
  }
  await fs.writeFile(path.join(destination, filename), bytes);
  console.log(filename, bytes.length, 'bytes');
  return [name, {file: filename, source: url, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')}];
}));
await fs.writeFile(path.join(destination, 'manifest.json'), JSON.stringify({pack: 'Project SEKAI custom01', downloadedAt: new Date().toISOString(), samples: Object.fromEntries(entries)}, null, 2) + '\n');
