import fs from 'node:fs/promises';

const catalog = JSON.parse(await fs.readFile(new URL('../catalog.json', import.meta.url), 'utf8'));
const manifestPath = new URL('../assets/manifest.json', import.meta.url);
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const ids = [2, 3, 6, 8, 10, 11, 13, 15, 19, 21, 26, 27, 28, 36, 38, 41, 43, 44, 45, 46, 48, 49, 50, 51, 52, 54, 55, 57, 60, 61, 62, 63, 64, 66, 67, 68];
const destination = new URL('../assets/', import.meta.url);
let totalBytes = 0;

async function downloadSong(id) {
    const song = catalog.find(entry => entry.id === id);
    if (!song?.audio) throw new Error(`Catalog song ${id} has no audio source.`);
    const source = song.audio.replace(/\.wav$/i, '.mp3');
    if (!source.endsWith('.mp3')) throw new Error(`Unexpected audio URL for ${song.title}.`);
    let lastError;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const response = await fetch(source, {headers: {'User-Agent': 'SEKAI-SIX personal-project asset import'}, signal: AbortSignal.timeout(90_000)});
        if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/mpeg')) {
          throw new Error(`HTTP ${response.status} (${response.headers.get('content-type') || 'unknown content type'})`);
        }
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length < 100_000) throw new Error('download was unexpectedly small');
        const filename = `${id}.mp3`;
        await fs.writeFile(new URL(filename, destination), bytes);
        manifest[id] = {...manifest[id], audio: `assets/${filename}`};
        totalBytes += bytes.length;
        console.log(`${song.title}: ${(bytes.length / 1_000_000).toFixed(2)} MB`);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 5) await new Promise(resolve => setTimeout(resolve, attempt * 1_500));
      }
    }
    throw new Error(`Could not download ${song.title} after 5 attempts: ${lastError?.message}`);
}

for (const id of ids) {
  await downloadSong(id);
}

await fs.writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
console.log(`Added ${ids.length} tracks (${(totalBytes / 1_000_000).toFixed(1)} MB).`);
