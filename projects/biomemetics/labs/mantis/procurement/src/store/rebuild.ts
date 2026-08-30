import { mkdir, rm } from 'node:fs/promises';
import { DEFAULT_DATA_DIR } from './paths';
import { rebuildStore } from './open';

const rebuild = async (): Promise<void> => {
  await rm(DEFAULT_DATA_DIR, { recursive: true, force: true });
  await mkdir(DEFAULT_DATA_DIR, { recursive: true });
  const db = await rebuildStore(DEFAULT_DATA_DIR);
  await db.close();
};

await rebuild();
