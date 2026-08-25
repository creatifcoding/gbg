import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as Effect from 'effect/Effect';
import * as Result from 'effect/Result';
import * as RpcTest from 'effect/unstable/rpc/RpcTest';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import {
  CAD01_COMMITTED_AT,
  CAD01_EXPORT_REF,
  CAD01_HLR_SHEET_REFS,
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
import {
  LANDING_PR96_REF,
  NOTE81_REF,
  QUARRY_PR95_REF,
  WORKER_REF,
} from '../src/adapters/generating-note.js';
import { activityComponents, declarationComponents } from '../src/adapters/activity.js';
import {
  HowComponent,
  WhenComponent,
  WhereComponent,
  WhoComponent,
  WhyComponent,
  relationTargets,
  sameComponent,
} from '../src/schemas/components.js';
import type { CatalogRecord } from '../src/schemas/entity.js';
import { decodeLabEntity } from '../src/schemas/provenance.js';
import { trustEntityRef } from '../src/schemas/identifiers.js';
import { CatalogRpcs } from '../src/rpc/CatalogRpcs.js';
import { SpecimenRpcs } from '../src/rpc/SpecimenRpcs.js';
import { MemoryCatalogLive } from '../testbed/memory-rpc.js';
import { testCatalogLayer } from './catalog-pg.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const CAD01_CORRECTION_REF = trustEntityRef('gbg:activity:project-cad01-corrected@pr58');
const MINT_ACTIVITY_REF = trustEntityRef('gbg:activity:mint-w7@test');

const ids = (rows: ReadonlyArray<{ id: string }>): ReadonlyArray<string> =>
  rows.map((row) => row.id);

const expectW7 = (
  record: CatalogRecord,
  expected: { readonly who: string; readonly why: string; readonly how: string },
): void => {
  const who = record.components.find((component) => component._tag === 'Who');
  expect(who?._tag === 'Who' && who.agentType).toBe('software');
  expect(who?._tag === 'Who' && who.label).toBe(expected.who);
  expect(
    record.components.some(
      (component) =>
        component._tag === 'When' &&
        component.startedAt === CAD01_COMMITTED_AT &&
        component.gitSha === CAD01_TREE_SHA,
    ),
  ).toBe(true);
  expect(
    record.components.some(
      (component) => component._tag === 'Where' && component.value === 'unknown',
    ),
  ).toBe(true);
  expect(
    record.components.some(
      (component) => component._tag === 'Why' && component.value === expected.why,
    ),
  ).toBe(true);
  expect(
    record.components.some(
      (component) => component._tag === 'How' && component.value === expected.how,
    ),
  ).toBe(true);
  expect(record.components.some((component) => component._tag === 'What')).toBe(false);
  expect(record.components.some((component) => component._tag === 'Honesty')).toBe(false);
};

const cad01Correction = () =>
  decodeLabEntity({
    _tag: 'LabEntity',
    ref: CAD01_CORRECTION_REF,
    kind: 'activity',
    type: 'hlr',
    label: 'HLR/project CAD-01 sheets (correction)',
    class: 'theoretical',
    who: [
      {
        _tag: 'Agent',
        agentType: 'software',
        label: 'generate_schematics.py',
      },
    ],
    what: {
      used: [CAD01_SOLID_REF],
      generated: [...CAD01_HLR_SHEET_REFS],
    },
    when: {
      startedAt: CAD01_COMMITTED_AT,
      gitSha: CAD01_TREE_SHA,
    },
    where: 'unknown',
    why: '#58',
    how: 'generate_schematics.py',
    used: [CAD01_SOLID_REF],
    generated: [...CAD01_HLR_SHEET_REFS],
    supersedes: CAD01_PROJECT_REF,
  });

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

const runMemory = (program: Effect.Effect<unknown, unknown, never>) =>
  Effect.runPromise(
    Effect.scoped(program).pipe(Effect.provide(MemoryCatalogLive)) as Effect.Effect<unknown>,
  );

const typeOf = (record: {
  type?: string;
  components: ReadonlyArray<{ _tag: string; value?: string }>;
}) => {
  const fromRow = record.type;
  const fromComponent = record.components.find((c) => c._tag === 'Type');
  const componentValue = fromComponent?._tag === 'Type' ? fromComponent.value : undefined;
  return { fromRow, componentValue };
};

const proveCad01Activities = Effect.gen(function* () {
  const catalog = yield* RpcTest.makeClient(CatalogRpcs);
  const specimens = yield* RpcTest.makeClient(SpecimenRpcs);

  const exportRecord = yield* catalog.GetEntity({ entityId: CAD01_EXPORT_REF });
  expect(exportRecord.kind).toBe('activity');
  expect(exportRecord.type).toBe('export');
  expect(relationTargets(exportRecord.components, 'Generated')).toEqual([CAD01_SOLID_REF]);
  expect(relationTargets(exportRecord.components, 'Used')).toEqual([]);
  expectW7(exportRecord, {
    who: 'freecad-part-occt',
    why: '#20',
    how: 'freecad-part-occt',
  });

  const hlr = yield* catalog.GetEntity({ entityId: CAD01_PROJECT_REF });
  expect(hlr.kind).toBe('activity');
  expect(hlr.type).toBe('hlr');
  expect(relationTargets(hlr.components, 'Used')).toEqual([CAD01_SOLID_REF]);
  expect(relationTargets(hlr.components, 'Generated')).toEqual([...CAD01_HLR_SHEET_REFS]);
  expect(relationTargets(hlr.components, 'Generated')).toHaveLength(7);
  expect(relationTargets(hlr.components, 'Generated').includes(CAD01_SHEET_REFS[7]!)).toBe(false);
  expect(relationTargets(hlr.components, 'Generated').includes(CAD01_PDF_REF)).toBe(false);
  expectW7(hlr, {
    who: 'generate_schematics.py',
    why: '#58',
    how: 'generate_schematics.py',
  });

  const byStep = yield* specimens.GetByRef({ ref: CAD01_SOLID_REF });
  expect(ids(byStep)).toEqual(expect.arrayContaining([CAD01_EXPORT_REF, CAD01_PROJECT_REF]));
  expect(byStep).toHaveLength(2);

  const byS00 = yield* specimens.GetByRef({ ref: CAD01_SHEET_REFS[0]! });
  expect(ids(byS00)).toEqual([CAD01_PROJECT_REF]);
  const byS06 = yield* specimens.GetByRef({ ref: CAD01_SHEET_REFS[6]! });
  expect(ids(byS06)).toEqual([CAD01_PROJECT_REF]);
  const byS07 = yield* specimens.GetByRef({ ref: CAD01_SHEET_REFS[7]! });
  expect(ids(byS07).includes(CAD01_PROJECT_REF)).toBe(false);

  const byWhoHlr = yield* specimens.GetByRef({ who: 'generate_schematics.py' });
  expect(ids(byWhoHlr)).toContain(CAD01_PROJECT_REF);
  const byWhoExport = yield* specimens.GetByRef({ who: 'freecad-part-occt' });
  expect(ids(byWhoExport)).toContain(CAD01_EXPORT_REF);
  const byWhy58 = yield* specimens.GetByRef({ why: '#58' });
  expect(ids(byWhy58)).toContain(CAD01_PROJECT_REF);
  const byWhy20 = yield* specimens.GetByRef({ why: '#20' });
  expect(ids(byWhy20)).toContain(CAD01_EXPORT_REF);
  const bySha = yield* specimens.GetByRef({ gitSha: CAD01_TREE_SHA });
  expect(ids(bySha)).toEqual(expect.arrayContaining([CAD01_EXPORT_REF, CAD01_PROJECT_REF]));
  const byWhen = yield* specimens.GetByRef({ startedAt: CAD01_COMMITTED_AT });
  expect(ids(byWhen)).toEqual(expect.arrayContaining([CAD01_EXPORT_REF, CAD01_PROJECT_REF]));

  const specimensListed = yield* specimens.List();
  expect(specimensListed).toEqual([]);
  const specimenEntities = yield* catalog.ListEntities({ kind: 'specimen' });
  expect(specimenEntities).toEqual([]);
});

describe('W7 sameComponent', () => {
  it('does not collapse two Who agents that share a tag', () => {
    const left = new WhoComponent({ agentType: 'software', label: 'generate_schematics.py' });
    const right = new WhoComponent({ agentType: 'software', label: 'freecad-part-occt' });
    expect(sameComponent(left, right)).toBe(false);
    expect(sameComponent(left, left)).toBe(true);
    expect(
      sameComponent(
        new WhyComponent({ value: '#58' }),
        new WhyComponent({ value: '#20' }),
      ),
    ).toBe(false);
    expect(
      sameComponent(
        new WhenComponent({ startedAt: CAD01_COMMITTED_AT, gitSha: CAD01_TREE_SHA }),
        new WhenComponent({ startedAt: CAD01_COMMITTED_AT, gitSha: 'deadbeef' }),
      ),
    ).toBe(false);
  });
});

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
    expect(pack.exportActivity.ref).toBe(CAD01_EXPORT_REF);
    expect(pack.exportActivity.type).toBe('export');
    expect(pack.exportActivity.who?.[0]?.label).toBe('freecad-part-occt');
    expect(pack.exportActivity.how).toBe('freecad-part-occt');
    expect(pack.exportActivity.why).toBe('#20');
    expect(pack.exportActivity.where).toBe('unknown');
    expect(pack.exportActivity.what?.generated).toEqual([CAD01_SOLID_REF]);
    expect(pack.exportActivity.what?.used).toEqual([]);
    expect(pack.activity.type).toBe('hlr');
    expect(pack.activity.who?.[0]?.agentType).toBe('software');
    expect(pack.activity.who?.[0]?.label).toBe('generate_schematics.py');
    expect(pack.activity.where).toBe('unknown');
    expect(pack.activity.why).toBe('#58');
    expect(pack.activity.how).toBe('generate_schematics.py');
    expect(pack.activity.what?.used).toEqual([CAD01_SOLID_REF]);
    expect(pack.activity.what?.generated).toEqual([...CAD01_HLR_SHEET_REFS]);
    expect(pack.activity.what?.generated).toHaveLength(7);
    expect(pack.activity.what?.generated.includes(CAD01_SHEET_REFS[7]!)).toBe(false);
    expect(pack.activity.what?.generated.includes(CAD01_PDF_REF)).toBe(false);
    const manifest = readFileSync(
      join(repoRoot, 'projects/biomemetics/labs/mantis/terrarium/MANIFEST.sha256'),
      'utf8',
    );
    expect(manifest.includes('FRAME-RAIL-B20-DRAFT.step')).toBe(false);
    expect(existsSync(join(repoRoot, 'projects/biomemetics/labs/mantis/evidence/fixtures/cube.step'))).toBe(
      false,
    );
    const cubeOnRef =
      'projects/biomemetics/labs/mantis/evidence/runs/environment/fixtures/review/cube.step';
    expect(existsSync(join(repoRoot, cubeOnRef))).toBe(true);
    const declared = loadDeclaredEntities(repoRoot);
    const cube = declared.find((row) => row.mint.type === 'fixture');
    expect(cube?.bytes.path).toBe(cubeOnRef);
    expect(declared.some((row) => row.mint.kind === 'html')).toBe(false);
    expect(declared.filter((row) => row.mint.kind === 'solid' && row.mint.type === 'part').length).toBe(17);
    expect(declared.some((row) => row.mint.kind === 'report')).toBe(true);
    expect(declared.some((row) => row.mint.kind === 'contract' && row.mint.type === 'params')).toBe(true);
    expect(declared.some((row) => row.mint.kind === 'catalog' && row.mint.type === 'analog')).toBe(true);
  });
});

describe('CAD-01 seed (cheap mint, gated HLR + export)', () => {
  it('mints kind+type over Postgres; walks Used/Generated and W7; #81 note is cheap', async () => {
    await runCatalog(
      Effect.gen(function* () {
        const catalog = yield* RpcTest.makeClient(CatalogRpcs);
        const specimens = yield* RpcTest.makeClient(SpecimenRpcs);
        const seeded = yield* seedCad01Hlr();

        expect(seeded.exportActivity.id).toBe(CAD01_EXPORT_REF);
        expect(seeded.activity.id).toBe(CAD01_PROJECT_REF);
        expect(seeded.activity.type).toBe('hlr');
        expect(relationTargets(seeded.activity.components, 'Used')).toEqual([CAD01_SOLID_REF]);
        expect(relationTargets(seeded.activity.components, 'Generated')).toEqual([
          ...CAD01_HLR_SHEET_REFS,
        ]);
        expect(seeded.activity.components.some((c) => c._tag === 'Honesty')).toBe(false);
        expect(seeded.exportActivity.components.some((c) => c._tag === 'Honesty')).toBe(false);

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

        yield* proveCad01Activities;

        expect(seeded.note.id).toBe(NOTE81_REF);
        expect(seeded.note.kind).toBe('activity');
        expect(seeded.note.type).toBe('note');
        expect(seeded.note.components.some((c) => c._tag === 'Used' || c._tag === 'Generated')).toBe(
          false,
        );
        expect(seeded.note.components.some((c) => c._tag === 'Honesty')).toBe(false);

        const quarry = yield* catalog.GetEntity({ entityId: QUARRY_PR95_REF });
        expect(quarry.kind).toBe('pr');
        expect(quarry.type).toBe('quarry');
        expect(quarry.components.some((c) => c._tag === 'Used' || c._tag === 'Generated')).toBe(false);

        const landing = yield* catalog.GetEntity({ entityId: LANDING_PR96_REF });
        expect(landing.kind).toBe('pr');
        expect(landing.type).toBe('landing');

        const worker = yield* catalog.GetEntity({ entityId: WORKER_REF });
        expect(worker.kind).toBe('activity');
        expect(worker.type).toBe('worker');
        expect(worker.components.some((c) => c._tag === 'Used' || c._tag === 'Generated')).toBe(false);

        const minted = yield* catalog.MintEntity({
          id: MINT_ACTIVITY_REF,
          kind: 'activity',
          type: 'note',
          createdAt: CAD01_COMMITTED_AT,
          components: [
            ...activityComponents({ used: [], generated: [] }, 'note'),
            new WhoComponent({ agentType: 'software', label: 'generate_schematics.py' }),
            new WhenComponent({ startedAt: CAD01_COMMITTED_AT, gitSha: CAD01_TREE_SHA }),
            new WhereComponent({ value: 'unknown' }),
            new WhyComponent({ value: '#58' }),
            new HowComponent({ value: 'generate_schematics.py' }),
          ],
        });
        expect(minted.kind).toBe('activity');
        expectW7(minted, {
          who: 'generate_schematics.py',
          why: '#58',
          how: 'generate_schematics.py',
        });

        const originalGenerated = relationTargets(seeded.activity.components, 'Generated');
        yield* specimens.AppendActivity(cad01Correction());
        const history = yield* specimens.GetByRef({ ref: CAD01_PROJECT_REF });
        expect(ids(history)).toEqual(
          expect.arrayContaining([CAD01_PROJECT_REF, CAD01_CORRECTION_REF]),
        );
        expect(history).toHaveLength(2);
        const original = history.find((row) => row.id === CAD01_PROJECT_REF);
        expect(relationTargets(original?.components ?? [], 'Generated')).toEqual(originalGenerated);
        expect(relationTargets(original?.components ?? [], 'Used')).toEqual([CAD01_SOLID_REF]);
        const correction = history.find((row) => row.id === CAD01_CORRECTION_REF);
        expect(relationTargets(correction?.components ?? [], 'Supersedes')).toEqual([
          CAD01_PROJECT_REF,
        ]);

        const dup = yield* Effect.result(specimens.AppendActivity(seeded.pack.activity));
        expect(Result.isFailure(dup)).toBe(true);
        if (Result.isFailure(dup)) {
          expect(dup.failure._tag).toBe('ActivityAppendError');
        }
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('mints declarations through Catalog.MintEntity, then AppendActivity', async () => {
    await runMemory(
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
            components: [
              ...declarationComponents({
                kind: row.mint.kind,
                type: row.mint.type,
                bytes: row.bytes,
              }),
            ],
          });
        }
        const exported = yield* specimens.AppendActivity(pack.exportActivity);
        expect(exported.kind).toBe('activity');
        expect(exported.type).toBe('export');
        expect(relationTargets(exported.components, 'Generated')).toEqual([CAD01_SOLID_REF]);
        const appended = yield* specimens.AppendActivity(pack.activity);
        expect(appended.kind).toBe('activity');
        expect(appended.type).toBe('hlr');
        expect(relationTargets(appended.components, 'Used')).toEqual([CAD01_SOLID_REF]);
        expect(relationTargets(appended.components, 'Generated')).toHaveLength(7);
        const listed = yield* specimens.List();
        expect(listed).toEqual([]);
        const mintedSolid = yield* catalog.GetEntity({ entityId: CAD01_SOLID_REF });
        expect(mintedSolid.type).toBe('assembly');
        expect(mintedSolid.components.some((c) => c._tag === 'Honesty')).toBe(false);

        yield* proveCad01Activities;

        const minted = yield* catalog.MintEntity({
          id: MINT_ACTIVITY_REF,
          kind: 'activity',
          type: 'note',
          createdAt: CAD01_COMMITTED_AT,
          components: [
            ...activityComponents({ used: [], generated: [] }, 'note'),
            new WhoComponent({ agentType: 'software', label: 'generate_schematics.py' }),
            new WhenComponent({ startedAt: CAD01_COMMITTED_AT, gitSha: CAD01_TREE_SHA }),
            new WhereComponent({ value: 'unknown' }),
            new WhyComponent({ value: '#58' }),
            new HowComponent({ value: 'generate_schematics.py' }),
          ],
        });
        expect(minted.kind).toBe('activity');
        expectW7(minted, {
          who: 'generate_schematics.py',
          why: '#58',
          how: 'generate_schematics.py',
        });

        yield* specimens.AppendActivity(cad01Correction());
        const history = yield* specimens.GetByRef({ ref: CAD01_PROJECT_REF });
        expect(ids(history)).toEqual(
          expect.arrayContaining([CAD01_PROJECT_REF, CAD01_CORRECTION_REF]),
        );
        const original = history.find((row) => row.id === CAD01_PROJECT_REF);
        expect(relationTargets(original?.components ?? [], 'Generated')).toEqual([
          ...CAD01_HLR_SHEET_REFS,
        ]);
        const dup = yield* Effect.result(specimens.AppendActivity(pack.activity));
        expect(Result.isFailure(dup)).toBe(true);
        if (Result.isFailure(dup)) {
          expect(dup.failure._tag).toBe('ActivityAppendError');
        }
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });
});
