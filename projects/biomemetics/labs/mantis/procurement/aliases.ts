import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const procurementRoot = here;
export const repoRoot = path.resolve(here, '../../../../../');

export const aliases = {
  '@tmnl/stx': path.join(here, 'src/tmnl-stx.ts'),
  '@gbg/lab-ui': path.join(repoRoot, 'packages/lab-ui/src/index.ts'),
  '@tmnl/pct/procedures': path.join(
    repoRoot,
    'packages/pct/src/procedures/index.ts',
  ),
  '@tmnl/msh/subject': path.join(repoRoot, 'packages/msh/src/subject/index.ts'),
  '@tmnl/lnk/contracts': path.join(
    repoRoot,
    'packages/lnk/src/contracts/index.ts',
  ),
  'ag-grid-community': path.join(here, 'node_modules/ag-grid-community'),
  'ag-grid-react': path.join(here, 'node_modules/ag-grid-react'),
  '@tanstack/react-table': path.join(here, 'node_modules/@tanstack/react-table'),
} as const;
