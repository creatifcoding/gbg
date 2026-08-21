/**
 * In-repo lab files as cheap entities (kind + type). HLR activity is gated.
 * No specimen. No GPS/taxon/SKU. Honesty is not attached on mint.
 */

import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as Effect from 'effect/Effect';
import * as RpcTest from 'effect/unstable/rpc/RpcTest';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import {
  CAD01_PDF_REF,
  CAD01_PROJECT_REF,
  CAD01_SHEET_REFS,
  CAD01_SOLID_REF,
  CAD01_STEP_PATH,
  CAD01_TREE_SHA,
  loadCad01Pack,
  loadDeclaredEntities,
  seedCad01Hlr,
} from '../src/adapters/cad01-seed.js';
import { declarationComponents } from '../src/adapters/activity.js';
import { relationTargets } from '../src/schemas/components.js';
import { CatalogRpcs } from '../src/rpc/CatalogRpcs.js';
import { SpecimenRpcs } from '../src/rpc/SpecimenRpcs.js';
import { MemoryCatalogLive } from '../testbed/memory-rpc.js';
import { testCatalogLayer } from './catalog-pg.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const pgUnavailable = (cause: unknown): Error => {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new Error(
    `CAD-01 seed tests need Postgres at SPECIMENDB_PG_* (default 127.0.0.1:5434). ${detail}`,
    { cause },
  );
};

const runCatalog = async (program: Effect.Effect<unknown, unknown, never>) => {
  const root = await mkdtemp(join(tmpdir(), 'specimendb-cad01-'));
  try {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const sql = yield* SqlClient;
          yield* sql.unsafe(`TRUNCATE TABLE components, entities CASCADE`);
          yield* program;
        }),
      ).pipe(Effect.provide(testCatalogLayer(join(root, 'assets')))) as Effect.Effect<unknown>,
    );
  } catch (cause) {
    throw pgUnavailable(cause);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

const typeOf = (record: { type?: string; components: ReadonlyArray<{ _tag: string; value?: string }> }) => {
  const fromRow = record.type;
  const fromComponent = record.components.find((c) => c._tag === 'Type');
  const componentValue = fromComponent?._tag === 'Type' ? fromComponent.value : undefined;
  return { fromRow, componentValue };
};

describe('CAD-01 files on this ref', () => {
  it('finds in-repo solids, sheets, reports, contracts, catalogs', () => {
    expect(existsSync(join(repoRoot, CAD01_STEP_PATH))).toBe(true);
    const pack = loadCad01Pack(repoRoot);
    expect(pack.solid.mint.kind).toBe('solid');
    expect(pack.solid.mint.type).toBe('assembly');
    expect(pack.solid.bytes.path).toBe(CAD01_STEP_PATH);
    expect(pack.solid.bytes.gitSha).toBe(CAD01_TREE_SHA);
    expect(pack.solid.bytes.digest).toBe(
      '6142c3308b628126151620d8b2b86a9a9ca845e718971db592f4d945214ad0c3',
    );
    expect(pack.sheets).toHaveLength(12);
    expect(pack.sheets.map((row) => row.mint.type)).toEqual([
      'projected',
      'projected',
      'projected',
      'projected',
      'projected',
      'projected',
      'projected',
      'diagram',
      'diagram',
      'diagram',
      'projected',
      'projected',
    ]);
    expect(pack.activity.type).toBe('hlr');
    expect(pack.activity.who?.[0]?.agentType).toBe('software');
    expect(pack.activity.who?.[0]?.label).toBe('generate_schematics.py');
    expect(pack.activity.where).toBe('unknown');
    expect(pack.activity.why).toBe('#58');
    expect(pack.activity.how).toBe('generate_schematics.py');
    expect(pack.activity.what?.used).toEqual([CAD01_SOLID_REF]);
    expect(pack.activity.what?.generated).toEqual([...CAD01_SHEET_REFS]);
    expect(pack.activity.what?.generated.includes(CAD01_PDF_REF)).toBe(false);
    const manifest = readFileSync(
      join(repoRoot, 'projects/biomemetics/labs/mantis/terrarium/MANIFEST.sha256'),
      'utf8',
    );
    expect(manifest.includes('FRAME-RAIL-B20-DRAFT.step')).toBe(false);
    expect(existsSync(join(repoRoot, 'projects/biomemetics/labs/mantis/evidence/fixtures/cube.step'))).toBe(
      false,
    );
    const declared = loadDeclaredEntities(repoRoot);
    expect(declared.some((row) => row.mint.type === 'fixture')).toBe(false);
    expect(declared.some((row) => row.mint.kind === 'html')).toBe(false);
    expect(declared.filter((row) => row.mint.kind === 'solid' && row.mint.type === 'part').length).toBe(17);
    expect(declared.some((row) => row.mint.kind === 'report')).toBe(true);
    expect(declared.some((row) => row.mint.kind === 'contract' && row.mint.type === 'params')).toBe(true);
    expect(declared.some((row) => row.mint.kind === 'catalog' && row.mint.type === 'analog')).toBe(true);
  });
});

describe('CAD-01 seed (cheap mint, gated HLR)', () => {
  it('mints kind+type over Postgres; Used/Generated only on the HLR activity', async () => {
    await runCatalog(
      Effect.gen(function* () {
        const catalog = yield* RpcTest.makeClient(CatalogRpcs);
        const specimens = yield* RpcTest.makeClient(SpecimenRpcs);
        const seeded = yield* seedCad01Hlr();

        expect(seeded.activity.id).toBe(CAD01_PROJECT_REF);
        expect(seeded.activity.type).toBe('hlr');
        expect(relationTargets(seeded.activity.components, 'Used')).toEqual([CAD01_SOLID_REF]);
        expect(relationTargets(seeded.activity.components, 'Generated')).toEqual([
          ...CAD01_SHEET_REFS,
        ]);
        expect(seeded.activity.components.some((c) => c._tag === 'Honesty')).toBe(false);

        const solid = yield* catalog.GetEntity({ entityId: CAD01_SOLID_REF });
        expect(solid.kind).toBe('solid');
        expect(typeOf(solid)).toEqual({ fromRow: 'assembly', componentValue: 'assembly' });
        expect(solid.components.some((c) => c._tag === 'Kind' && c.value === 'solid')).toBe(true);
        expect(solid.components.some((c) => c._tag === 'Honesty')).toBe(false);
        expect(solid.components.some((c) => c._tag === 'Used')).toBe(false);
        expect(solid.components.some((c) => c._tag === 'Generated')).toBe(false);
        const solidBytes = solid.components.find((c) => c._tag === 'Bytes');
        expect(solidBytes?._tag === 'Bytes' && solidBytes.path).toBe(CAD01_STEP_PATH);
        expect(solid.components.some((c) => c._tag === 'Locality')).toBe(false);
        expect(solid.components.some((c) => c._tag === 'Taxon')).toBe(false);
        expect(solid.components.some((c) => c._tag === 'Media')).toBe(false);

        const b01 = yield* catalog.GetEntity({
          entityId: seeded.pack.declared.find((row) => row.mint.id.includes(':B01@'))!.mint.id,
        });
        expect(typeOf(b01)).toEqual({ fromRow: 'part', componentValue: 'part' });
        expect(b01.components.some((c) => c._tag === 'Used' || c._tag === 'Generated')).toBe(false);
        expect(b01.components.some((c) => c._tag === 'Honesty')).toBe(false);

        const s08 = yield* catalog.GetEntity({ entityId: CAD01_SHEET_REFS[8]! });
        expect(typeOf(s08).fromRow).toBe('diagram');
        expect(s08.components.some((c) => c._tag === 'Honesty')).toBe(false);
        const s01 = yield* catalog.GetEntity({ entityId: CAD01_SHEET_REFS[1]! });
        expect(typeOf(s01).fromRow).toBe('projected');
        const s07 = yield* catalog.GetEntity({ entityId: CAD01_SHEET_REFS[7]! });
        expect(typeOf(s07).fromRow).toBe('diagram');

        const pdf = yield* catalog.GetEntity({ entityId: CAD01_PDF_REF });
        expect(pdf.kind).toBe('sheet');
        expect(relationTargets(seeded.activity.components, 'Generated').includes(CAD01_PDF_REF)).toBe(
          false,
        );

        const assemblies = yield* catalog.ListEntities({ kind: 'solid', type: 'assembly' });
        expect(assemblies.map((row) => row.id)).toEqual([CAD01_SOLID_REF]);
        const parts = yield* catalog.ListEntities({ kind: 'solid', type: 'part' });
        expect(parts).toHaveLength(17);
        const sheets = yield* catalog.ListEntities({ kind: 'sheet' });
        expect(sheets.length).toBeGreaterThanOrEqual(17);

        const specimensListed = yield* specimens.List();
        expect(specimensListed).toEqual([]);
        const specimenEntities = yield* catalog.ListEntities({ kind: 'specimen' });
        expect(specimenEntities).toEqual([]);

        const byStep = yield* specimens.GetByRef({ ref: CAD01_SOLID_REF });
        expect(byStep.map((row) => row.id)).toEqual([CAD01_PROJECT_REF]);
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('mints declarations through Catalog.MintEntity, then AppendActivity', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const catalog = yield* RpcTest.makeClient(CatalogRpcs);
          const specimens = yield* RpcTest.makeClient(SpecimenRpcs);
          const pack = loadCad01Pack(repoRoot);
          for (const row of pack.declared) {
            yield* catalog.MintEntity({
              id: row.mint.id,
              kind: row.mint.kind,
              type: row.mint.type,
              createdAt: row.mint.createdAt,
              components: [...declarationComponents({
                kind: row.mint.kind,
                type: row.mint.type,
                bytes: row.bytes,
              })],
            });
          }
          const appended = yield* specimens.AppendActivity(pack.activity);
          expect(appended.kind).toBe('activity');
          expect(appended.type).toBe('hlr');
          expect(relationTargets(appended.components, 'Used')).toEqual([CAD01_SOLID_REF]);
          expect(relationTargets(appended.components, 'Generated')).toHaveLength(12);
          const listed = yield* specimens.List();
          expect(listed).toEqual([]);
          const mintedSolid = yield* catalog.GetEntity({ entityId: CAD01_SOLID_REF });
          expect(mintedSolid.type).toBe('assembly');
          expect(mintedSolid.components.some((c) => c._tag === 'Honesty')).toBe(false);
        }),
      ).pipe(Effect.provide(MemoryCatalogLive)) as Effect.Effect<unknown>,
    );
  });
});
