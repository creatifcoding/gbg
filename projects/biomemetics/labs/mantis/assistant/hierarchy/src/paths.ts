import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const hierarchyRoot = path.resolve(here, '..');

export const manifestsDir = path.join(hierarchyRoot, 'manifests');

export const policiesDir = path.join(hierarchyRoot, 'policies');

export const importedA0Dir = path.join(hierarchyRoot, 'imported-a0');

export const assistantRootFromLab = path.resolve(hierarchyRoot, '..');
