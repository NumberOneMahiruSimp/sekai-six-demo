import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getHostedSongs} from '../library.js';

const songs=JSON.parse(readFileSync(new URL('../catalog.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('../assets/manifest.json',import.meta.url)));

test('the library view only includes catalog songs with site-hosted audio',()=>{
  const hosted=getHostedSongs(songs,manifest);
  assert.equal(songs.length,721,'keep the full catalog intact');
  assert.deepEqual(hosted.map(song=>song.id),[201,1,47,110]);
  assert.equal(songs.length-hosted.length,717);
  assert.ok(hosted.every(song=>manifest[song.id]?.audio));
});
