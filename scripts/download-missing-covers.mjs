import fs from 'node:fs/promises';

const catalog = JSON.parse(await fs.readFile(new URL('../catalog.json', import.meta.url), 'utf8'));
const manifestPath = new URL('../assets/manifest.json', import.meta.url);
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const ids = [55, 57, 60, 61, 62, 63, 64, 66, 67, 68];

for (const id of ids) {
  const song = catalog.find(entry => entry.id === id);
  if (!song?.cover) throw new Error(`Catalog song ${id} has no cover source.`);
  const response = await fetch(song.cover, {headers: {'User-Agent': 'SEKAI-SIX personal-project artwork import'}, signal: AbortSignal.timeout(60_000)});
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/png')) {
    throw new Error(`Could not fetch cover for ${song.title}: HTTP ${response.status}.`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 10_000) throw new Error(`Downloaded cover for ${song.title} is unexpectedly small.`);
  const filename = `${id}.png`;
  await fs.writeFile(new URL(`../assets/${filename}`, import.meta.url), bytes);
  manifest[id] = {...manifest[id], cover: `assets/${filename}`};
  console.log(`${song.title}: ${(bytes.length / 1_000).toFixed(0)} KB`);
}

await fs.writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
console.log(`Added local cover art for ${ids.length} hosted songs.`);
