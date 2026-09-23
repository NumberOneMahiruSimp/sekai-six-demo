import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('browser JavaScript parses before the app starts', () => {
  const root = new URL('../', import.meta.url);
  const modules = readdirSync(root).filter(name => name.endsWith('.js'));
  for (const name of modules) {
    const result = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(name, root))], {encoding: 'utf8'});
    assert.ifError(result.error);
    assert.equal(result.status, 0, `${name} must parse before songs or controls can initialize:\n${result.stderr}`);
  }
});
