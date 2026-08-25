import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { GENERATED_DIR, writeGeneratedViews } from '../src/generate.ts';
import { ENCLOSURE_VIEWS } from '../src/views.ts';

const SOLID_IDS = [
  'envelope',
  'B01-corner-block',
  'B05-view-cassette',
  'B06-front-door',
] as const;

const mmSize = (svg: string, filePath: string): { readonly width: number; readonly height: number } => {
  const widthMatch = /width="([0-9.]+)mm"/.exec(svg);
  const heightMatch = /height="([0-9.]+)mm"/.exec(svg);
  assert.ok(widthMatch?.[1], `${filePath} missing width mm`);
  assert.ok(heightMatch?.[1], `${filePath} missing height mm`);
  return { width: Number(widthMatch[1]), height: Number(heightMatch[1]) };
};

const assertNear = (actual: number, expected: number, filePath: string, label: string): void => {
  assert.ok(
    Math.abs(actual - expected) < 0.02,
    `${filePath} ${label} ${actual} !== ${expected}`,
  );
};

const assertStrokedOutline = (svg: string, filePath: string): void => {
  assert.ok(svg.includes('<svg'), filePath);
  assert.ok(svg.includes('mm'), filePath);
  assert.ok(svg.includes('stroke='), `${filePath} missing stroke`);
  assert.equal(svg.includes('fill="black"'), false, `${filePath} is a filled-black slab`);
};

const readGenerated = (fileName: string): { readonly filePath: string; readonly svg: string } => {
  const filePath = join(GENERATED_DIR, fileName);
  assert.equal(existsSync(filePath), true, filePath);
  return { filePath, svg: readFileSync(filePath, 'utf8') };
};

test('generate writes stroked front, side, and top SVG for every authored solid', () => {
  const written = writeGeneratedViews();
  for (const view of ENCLOSURE_VIEWS) {
    const shortName = `${view.name}.svg`;
    const { filePath, svg } = readGenerated(shortName);
    assertStrokedOutline(svg, filePath);
    assert.ok(written.includes(filePath));
  }
  for (const solidId of SOLID_IDS) {
    for (const view of ENCLOSURE_VIEWS) {
      const fileName = `${solidId}-${view.name}.svg`;
      const { filePath, svg } = readGenerated(fileName);
      assertStrokedOutline(svg, filePath);
      assert.ok(written.includes(filePath), fileName);
    }
  }
  const views = readFileSync(join(GENERATED_DIR, 'VIEWS.md'), 'utf8');
  assert.ok(views.includes('class: generated'));
  assert.ok(views.includes('path2'));
  for (const solidId of SOLID_IDS) {
    for (const view of ENCLOSURE_VIEWS) {
      assert.ok(views.includes(`${solidId}-${view.name}.svg`), `${solidId}-${view.name}.svg missing from VIEWS.md`);
    }
  }
  assert.ok(views.includes('front.svg'));
  assert.ok(views.includes('[0, 1, 0]'));
  assert.ok(views.includes('[1, 0, 0]'));
  assert.ok(views.includes('[0, 0, 1]'));
});

test('B05 front is a 202 x 427 mm stroked plate, not a 250 x 500 slab', () => {
  writeGeneratedViews();
  const { filePath, svg } = readGenerated('B05-view-cassette-front.svg');
  assertStrokedOutline(svg, filePath);
  const size = mmSize(svg, filePath);
  assertNear(size.width, 202, filePath, 'width');
  assertNear(size.height, 427, filePath, 'height');
  assert.equal(Math.abs(size.width - 250) < 1 && Math.abs(size.height - 500) < 1, false);
});

test('envelope front stays the 250 x 500 mm stroked outline under the existing name', () => {
  writeGeneratedViews();
  const { filePath, svg } = readGenerated('front.svg');
  assertStrokedOutline(svg, filePath);
  const size = mmSize(svg, filePath);
  assertNear(size.width, 250, filePath, 'width');
  assertNear(size.height, 500, filePath, 'height');
});

test('B01 unique solid is the 24 mm cube, B06 front matches B05 front', () => {
  writeGeneratedViews();
  const corner = readGenerated('B01-corner-block-front.svg');
  assertStrokedOutline(corner.svg, corner.filePath);
  const cornerSize = mmSize(corner.svg, corner.filePath);
  assertNear(cornerSize.width, 24, corner.filePath, 'width');
  assertNear(cornerSize.height, 24, corner.filePath, 'height');

  const door = readGenerated('B06-front-door-front.svg');
  const cassette = readGenerated('B05-view-cassette-front.svg');
  assertStrokedOutline(door.svg, door.filePath);
  const doorSize = mmSize(door.svg, door.filePath);
  const cassetteSize = mmSize(cassette.svg, cassette.filePath);
  assertNear(doorSize.width, cassetteSize.width, door.filePath, 'width');
  assertNear(doorSize.height, cassetteSize.height, door.filePath, 'height');
});
