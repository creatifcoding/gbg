import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildEnclosure } from './enclosure.ts';
import { serializeSvg } from './svg.ts';
import { ENCLOSURE_VIEWS, projectView } from './views.ts';

const packageRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

export const GENERATED_DIR = join(packageRoot, 'generated');

export const writeGeneratedViews = (): readonly string[] => {
  mkdirSync(GENERATED_DIR, { recursive: true });
  const { solid } = buildEnclosure();
  const written: string[] = [];
  const lines = [
    '# Generated orthographic views',
    '',
    'class: generated. Not shop-release.',
    'Leftover S01 stays the extract view.',
    '',
    'Command: `npm run generate`',
    'Solid: `extrusions.project({axis, origin}, solid)` then `svgSerializer.serialize({unit: \'mm\'}, geom2)`.',
    '',
    '| file | view | axis | origin | plane |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const view of ENCLOSURE_VIEWS) {
    const svg = serializeSvg(projectView(view, solid));
    if (!svg.includes('<svg')) {
      throw new Error(`${view.name} serialize did not return SVG`);
    }
    const fileName = `${view.name}.svg`;
    const filePath = join(GENERATED_DIR, fileName);
    writeFileSync(filePath, svg);
    written.push(filePath);
    lines.push(
      `| ${fileName} | ${view.name} | [${view.axis.join(', ')}] | [${view.origin.join(', ')}] | ${view.plane} |`,
    );
  }
  lines.push('');
  lines.push(
    'PNG/iso: blank. `require("gl")(64, 64)` created a context. Official `@jscad/regl-renderer` `demo-cli.js` then failed with `Cannot find module \'@jscad/img-utils\'`. No PNG was written.',
  );
  lines.push('');
  const viewsPath = join(GENERATED_DIR, 'VIEWS.md');
  writeFileSync(viewsPath, `${lines.join('\n')}\n`);
  written.push(viewsPath);
  return written;
};

const invoked =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const files = writeGeneratedViews();
  process.stdout.write(`${files.join('\n')}\n`);
}
