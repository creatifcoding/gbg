import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** `projects/biomemetics/labs/mantis` */
export const labRoot = path.resolve(here, '../../../..');

export const assistantRoot = path.join(labRoot, 'assistant');

export const contractRegistryPath = path.join(
  assistantRoot,
  'contracts/registry.json',
);
