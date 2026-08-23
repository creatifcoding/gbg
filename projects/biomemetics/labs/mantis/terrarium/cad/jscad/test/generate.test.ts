import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { GENERATED_DIR, writeGeneratedViews } from '../src/generate.ts';
import { ENCLOSURE_VIEWS } from '../src/views.ts';

test('generate writes front, side, and top SVG from project + serialize', () => {
  const written = writeGeneratedViews();
  for (const view of ENCLOSURE_VIEWS) {
    const filePath = join(GENERATED_DIR, `${view.name}.svg`);
    assert.equal(existsSync(filePath), true, filePath);
    const svg = readFileSync(filePath, 'utf8');
    assert.ok(svg.includes('<svg'), filePath);
    assert.ok(svg.includes('mm'), filePath);
    assert.ok(written.includes(filePath));
  }
  const views = readFileSync(join(GENERATED_DIR, 'VIEWS.md'), 'utf8');
  assert.ok(views.includes('[0, 1, 0]'));
  assert.ok(views.includes('[1, 0, 0]'));
  assert.ok(views.includes('[0, 0, 1]'));
  assert.ok(views.includes('class: generated'));
});
