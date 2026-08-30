import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const PROCUREMENT_ROOT = join(here, '../..');
export const SQL_DIR = join(PROCUREMENT_ROOT, 'sql');
export const DEFAULT_DATA_DIR = join(PROCUREMENT_ROOT, 'data', 'pglite');
export const SCHEMA_SQL = join(SQL_DIR, '0001_schema.sql');
export const SEED_SQL = join(SQL_DIR, '0002_seed.sql');
export const BOM_MD = join(
  PROCUREMENT_ROOT,
  '../terrarium/BOM.md',
);
