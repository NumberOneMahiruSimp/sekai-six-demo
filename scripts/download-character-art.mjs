// Official images referenced by the character profile pages, checked 2026-09-23.
// Run explicitly with network access: node scripts/download-character-art.mjs
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const characters = [
  ['ichika', 'Hoshino Ichika', 'unite01'],
  ['saki', 'Tenma Saki', 'unite01'],
  ['minori', 'Hanasato Minori', 'unite02'],
  ['kohane', 'Azusawa Kohane', 'unite03'],
  ['tsukasa', 'Tenma Tsukasa', 'unite04'],
  ['kanade', 'Yoisaki Kanade', 'unite05'],
  ['miku', 'Hatsune Miku', 'virtualsinger'],
];

function dimensions(data) {
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WEBP') throw new Error('Expected a WebP image');
  for (let offset = 12; offset + 8 <= data.length;) {
    const type = data.toString('ascii', offset, offset + 4);
    const length = data.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (type === 'VP8X') return {width: 1 + data.readUIntLE(start + 4, 3), height: 1 + data.readUIntLE(start + 7, 3)};
    if (type === 'VP8 ') return {width: data.readUInt16LE(start + 6) & 0x3fff, height: data.readUInt16LE(start + 8) & 0x3fff};
    if (type === 'VP8L') {
      const bits = data.readUInt32LE(start + 1);
      return {width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1};
    }
    offset = start + length + (length % 2);
  }
  throw new Error('No WebP image dimensions found');
}

const manifest = {downloadedAt: new Date().toISOString(), credit: '© SEGA / © Colorful Palette Inc. / © Crypton Future Media, INC. All rights reserved.', characters: []};
async function getImage(source, localPath) {
  try {
    const data = await readFile(localPath);
    dimensions(data);
    return data;
  } catch {}
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(source, {signal: AbortSignal.timeout(25000)});
      if (!response.ok) throw new Error(`${response.status}: ${source}`);
      const data = Buffer.from(await response.arrayBuffer());
      dimensions(data);
      return data;
    } catch (error) {lastError = error; console.error(`Retry ${attempt + 1}: ${source}`);}
  }
  throw lastError;
}
for (const [id, name, unit] of characters) {
  const profile = `https://pjsekai.sega.jp/character/${unit}/${id}/index.html`;
  const assetBase = `https://pjsekai.sega.jp/assets/data/webp/character/${unit}/${id}/`;
  const assets = [['standing', 'now/img.png.webp'], ['avatar', 'now/navi_icon.png.webp'], ['card', id === 'miku' ? 'now/img.png.webp' : 'card_1.png.webp']];
  const character = {id, name, profile, assets: []};
  await mkdir(path.join(root, 'assets', 'characters', id), {recursive: true});
  for (const [kind, sourcePath] of assets) {
    const source = assetBase + sourcePath;
    const local = `assets/characters/${id}/${kind}.webp`;
    const data = await getImage(source, path.join(root, local));
    const size = dimensions(data);
    await writeFile(path.join(root, local), data);
    character.assets.push({kind, local, source, ...size, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex')});
    console.log(`${local}: ${size.width} × ${size.height}, ${data.length} bytes`);
  }
  manifest.characters.push(character);
}
await writeFile(path.join(root, 'assets/characters/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
