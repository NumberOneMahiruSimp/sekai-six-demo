import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {getHostedSongs} from '../library.js';

const songs=JSON.parse(readFileSync(new URL('../catalog.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('../assets/manifest.json',import.meta.url)));

test('the library view only includes catalog songs with site-hosted audio',()=>{
  const hosted=getHostedSongs(songs,manifest);
  assert.equal(songs.length,721,'keep the full catalog intact');
  assert.equal(hosted.length,40,'show the four original songs and 36 imported songs');
  for (const id of [201,1,47,110]) assert.ok(hosted.some(song=>song.id===id), `preserve the original hosted song ${id}`);
  assert.ok(hosted.every(song=>manifest[song.id]?.audio));
  assert.ok(hosted.every(song=>existsSync(new URL(`../${manifest[song.id].audio}`,import.meta.url))), 'every visible song has a local audio file');
  assert.equal(hosted.filter(song=>manifest[song.id].audio.endsWith('.mp3')).length,36);
  assert.equal(songs.length-hosted.length,681,'keep the rest of the catalog while hiding tracks without site-hosted audio');
});
