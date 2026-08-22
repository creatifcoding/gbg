import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { DEFAULT_DATA_DIR, SCHEMA_SQL, SEED_SQL } from './paths';

export type OpenStoreOptions = {
  dataDir?: string;
  memory?: boolean;
};

export const openStore = async (
  options: OpenStoreOptions = {},
): Promise<PGlite> => {
  const db = options.memory
    ? await PGlite.create('memory://')
    : await PGlite.create(options.dataDir ?? DEFAULT_DATA_DIR);
  await applySql(db);
  return db;
};

export const applySql = async (db: PGlite): Promise<void> => {
  const schema = await readFile(SCHEMA_SQL, 'utf8');
  const seed = await readFile(SEED_SQL, 'utf8');
  await db.exec(schema);
  await db.exec(seed);
};

export const rebuildStore = async (dataDir = DEFAULT_DATA_DIR): Promise<PGlite> => {
  const db = await PGlite.create(dataDir);
  await applySql(db);
  return db;
};
