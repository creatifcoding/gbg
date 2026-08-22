import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assemblePlant, receiptFromJson, type FixtureFile } from './assemble.ts';
import { CHANNEL, EPOCH_MS, type Phase, type Plant, type Receipt } from './types.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURE_ROOT = path.resolve(here, '../../fixtures/telemetry');

type CatalogEntry = {
  readonly id: string;
  readonly phase: Phase;
  readonly file: string;
};

type Catalog = {
  readonly schemaVersion: '1.0.0';
  readonly kind: 'telemetry-fixture-catalog';
  readonly sourceClass: 'simulated';
  readonly entries: readonly CatalogEntry[];
};

const loadReceipt = (id: string): Receipt => {
  const file = path.join(FIXTURE_ROOT, 'receipts', `${id}.json`);
  const raw = JSON.parse(readFileSync(file, 'utf8')) as {
    id: string;
    href: string;
    recordedAt: string;
    sourceClass: 'simulated';
  };
  if (raw.id !== id) {
    throw new Error(`receipt id mismatch in ${file}`);
  }
  if (raw.sourceClass !== 'simulated') {
    throw new Error(`A4a receipt ${id} must be sourceClass simulated`);
  }
  return receiptFromJson(raw);
};

export const loadCatalog = (): Catalog => {
  const raw = JSON.parse(
    readFileSync(path.join(FIXTURE_ROOT, 'catalog.json'), 'utf8'),
  ) as Catalog;
  if (raw.kind !== 'telemetry-fixture-catalog' || raw.sourceClass !== 'simulated') {
    throw new Error('catalog is not an A4a simulated telemetry catalog');
  }
  return raw;
};

export const loadPlant = (fixtureId: string, clockMs = EPOCH_MS): Plant => {
  const catalog = loadCatalog();
  const entry = catalog.entries.find((row) => row.id === fixtureId);
  if (!entry) {
    throw new Error(`unknown fixture ${fixtureId}`);
  }
  const file = JSON.parse(
    readFileSync(path.join(FIXTURE_ROOT, entry.file), 'utf8'),
  ) as FixtureFile;
  if (file.phase !== entry.phase) {
    throw new Error(`fixture ${fixtureId} phase disagrees with catalog`);
  }
  const receipts: Record<string, Receipt> = {};
  for (const row of file.samples) {
    receipts[row.receiptId] = loadReceipt(row.receiptId);
  }
  return assemblePlant(file, receipts, clockMs);
};

export { assemblePlant } from './assemble.ts';
export type { FixtureFile } from './assemble.ts';
export const knownChannels = CHANNEL;
