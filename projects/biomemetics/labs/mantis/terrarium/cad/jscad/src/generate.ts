import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Geom3 } from '@jscad/modeling/src/geometries/types.js';

import { buildViewCassette } from './cassette.ts';
import { buildCornerBlock, CORNER_ORIGINS } from './corner.ts';
import { buildFrontDoor } from './door.ts';
import { buildEnclosure } from './enclosure.ts';
import { serializeSvg } from './svg.ts';
import { ENCLOSURE_VIEWS, projectView, type ViewName, type ViewSpec } from './views.ts';

const packageRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

export const GENERATED_DIR = join(packageRoot, 'generated');

export type AuthoredSolidId =
  | 'envelope'
  | 'B01-corner-block'
  | 'B05-view-cassette'
  | 'B06-front-door';

type AuthoredSolid = {
  readonly id: AuthoredSolidId;
  readonly solid: Geom3;
  readonly alsoEmit: readonly ViewName[];
};

type WrittenView = {
  readonly fileName: string;
  readonly solidId: AuthoredSolidId;
  readonly view: ViewSpec;
};

const authoredSolids = (): readonly AuthoredSolid[] => [
  { id: 'envelope', solid: buildEnclosure().solid, alsoEmit: ['front', 'side', 'top'] },
  { id: 'B01-corner-block', solid: buildCornerBlock().solid, alsoEmit: [] },
  { id: 'B05-view-cassette', solid: buildViewCassette().solid, alsoEmit: [] },
  { id: 'B06-front-door', solid: buildFrontDoor().solid, alsoEmit: [] },
];

const writeSvg = (fileName: string, svg: string): string => {
  if (!svg.includes('<svg')) {
    throw new Error(`${fileName} serialize did not return SVG`);
  }
  if (svg.includes('fill="black"')) {
    throw new Error(`${fileName} serialized as filled geom2, not stroked path2`);
  }
  if (!svg.includes('stroke=')) {
    throw new Error(`${fileName} has no stroke`);
  }
  const filePath = join(GENERATED_DIR, fileName);
  writeFileSync(filePath, svg);
  return filePath;
};

const viewsMarkdown = (written: readonly WrittenView[]): string => {
  const originLines = CORNER_ORIGINS.map(
    (origin, index) =>
      `| B01-corner-0${index + 1} | [${origin.join(', ')}] |`,
  );
  const fileLines = written.map(
    (row) =>
      `| ${row.fileName} | ${row.solidId} | ${row.view.name} | [${row.view.axis.join(', ')}] | [${row.view.origin.join(', ')}] | ${row.view.plane} |`,
  );
  return [
    '# Generated orthographic views',
    '',
    'class: generated. Not shop-release.',
    'Leftover S01 stays the extract view.',
    '',
    'Command: `npm run generate`',
    'Each still is `extrusions.project({axis, origin}, solid)`, then `geom2.toOutlines`, closed `path2.fromPoints`, `colors.colorize([0, 0, 0, 1], path)`, then `svgSerializer.serialize({unit: \'mm\'}, ...paths)`.',
    'Official `@jscad/svg-serializer` fills geom2 black. path2 is stroke. Generate never passes geom2 to serialize.',
    '',
    'B01 is one 24 mm cube. The eight instance origins are recorded below. Pocket cuts are omitted.',
    'B05 and B06 are the local 202 x 3 x 427 mm plates. World face and gasket Z stay unverified.',
    '',
    '| instance | origin mm |',
    '| --- | --- |',
    ...originLines,
    '',
    '| file | solid | view | axis | origin | plane |',
    '| --- | --- | --- | --- | --- | --- |',
    ...fileLines,
    '',
    'PNG/iso: blank. `require("gl")(64, 64)` created a context. Official `@jscad/regl-renderer` `demo-cli.js` then failed with `Cannot find module \'@jscad/img-utils\'`. No PNG was written.',
    '',
  ].join('\n');
};

export const writeGeneratedViews = (): readonly string[] => {
  mkdirSync(GENERATED_DIR, { recursive: true });
  const written: string[] = [];
  const catalog: WrittenView[] = [];
  for (const part of authoredSolids()) {
    for (const view of ENCLOSURE_VIEWS) {
      const svg = serializeSvg(projectView(view, part.solid));
      const fileName = `${part.id}-${view.name}.svg`;
      written.push(writeSvg(fileName, svg));
      catalog.push({ fileName, solidId: part.id, view });
      for (const alias of part.alsoEmit) {
        if (alias === view.name) {
          written.push(writeSvg(`${alias}.svg`, svg));
          catalog.push({ fileName: `${alias}.svg`, solidId: part.id, view });
        }
      }
    }
  }
  const viewsPath = join(GENERATED_DIR, 'VIEWS.md');
  writeFileSync(viewsPath, `${viewsMarkdown(catalog)}\n`);
  written.push(viewsPath);
  return written;
};

const invoked =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const files = writeGeneratedViews();
  process.stdout.write(`${files.join('\n')}\n`);
}
