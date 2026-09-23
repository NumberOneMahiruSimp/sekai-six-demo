import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSettings, validateBinding, DEFAULT_KEYS} from '../preferences.js';
test('saved character choices survive preference normalization',()=>{
  for(const theme of ['emu','ichika','saki','minori','kohane','tsukasa','kanade','miku','classic']){
    assert.equal(normalizeSettings({theme}).theme,theme,`${theme} must survive a reload`);
  }
  assert.equal(normalizeSettings({theme:'unknown'}).theme,'emu');
});
test('existing preferences migrate with fresh flick, sound and theme defaults',()=>{const p=normalizeSettings({volume:.2,offset:40});assert.equal(p.volume,.2);assert.equal(p.offset,40);assert.equal(p.theme,'emu');assert.equal(p.flickKey,'shift');assert.deepEqual(p.keys,DEFAULT_KEYS);});
test('duplicates and reserved controls are rejected without discarding valid rebinding',()=>{assert.ok(validateBinding('f',DEFAULT_KEYS,'shift',0));assert.ok(validateBinding('escape',DEFAULT_KEYS,'shift',0));assert.ok(validateBinding('d',DEFAULT_KEYS,'shift','flick'));assert.equal(validateBinding('a',DEFAULT_KEYS,'shift',0),null);const p=normalizeSettings({keys:['a','s','d','j','k','l'],flickKey:' '});assert.equal(p.keys[0],'a');assert.equal(p.flickKey,' ');assert.deepEqual(normalizeSettings({keys:['d','d','g','j','k','l']}).keys,DEFAULT_KEYS);});
