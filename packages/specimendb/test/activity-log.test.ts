import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as Effect from 'effect/Effect';
import * as Result from 'effect/Result';
import * as RpcTest from 'effect/unstable/rpc/RpcTest';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import { SpecimenRpcs } from '../src/rpc/SpecimenRpcs.js';
import { CatalogRpcs } from '../src/rpc/CatalogRpcs.js';
import { decodeLabEntity } from '../src/schemas/provenance.js';
import { relationTargets } from '../src/schemas/components.js';
import { trustEntityRef } from '../src/schemas/identifiers.js';
import {
  CAD01_COMMITTED_AT,
  CAD01_HLR_SHEET_REFS,
  CAD01_PROJECT_REF,
  CAD01_SOLID_REF,
  CAD01_TREE_SHA,
  loadCad01Pack,
} from '../src/adapters/cad01-seed.js';
import { declarationComponents } from '../src/adapters/activity.js';
import { MemoryCatalogLive } from '../testbed/memory-rpc.js';
import { testCatalogLayer } from './catalog-pg.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'provenance');

const load = (name: string): unknown =>
  JSON.parse(readFileSync(join(fixturesDir, name), 'utf8')) as unknown;

const originalActivity = () => decodeLabEntity(load('activity-freecad-part-occt.json'));
const correctionActivity = () =>
  decodeLabEntity(load('activity-freecad-part-occt-corrected.json'));

const pgUnavailable = (cause: unknown): Error => {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new Error(
    `AppendActivity tests need Postgres at SPECIMENDB_PG_* (default 127.0.0.1:5434). ${detail}`,
    { cause },
  );
};

const runLog = async (program: Effect.Effect<unknown, unknown, never>) => {
  const root = await mkdtemp(join(tmpdir(), 'specimendb-log-'));
  try {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const sql = yield* SqlClient;
          yield* sql.unsafe(`TRUNCATE TABLE components, entities CASCADE`);
          yield* program;
        }),
      ).pipe(
        Effect.provide(testCatalogLayer(join(root, 'assets'))),
      ) as Effect.Effect<unknown>,
    );
  } catch (cause) {
    throw pgUnavailable(cause);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe('AppendActivity / GetByRef', () => {
  it('appends an activity and gets it by its ref and by generated ref', async () => {
    await runLog(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SpecimenRpcs);
        const activity = originalActivity();
        const appended = yield* client.AppendActivity(activity);
        expect(appended.id).toBe('gbg:activity:freecad-part-occt@fe8f875a');
        expect(appended.kind).toBe('activity');
        expect(relationTargets(appended.components, 'Generated')).toEqual([
          'gbg:step:B01@fe8f875a',
        ]);
        expect(appended.components.some((c) => c._tag === 'Who')).toBe(true);
        expect(appended.components.some((c) => c._tag === 'When')).toBe(true);
        expect(appended.components.some((c) => c._tag === 'Where')).toBe(true);
        expect(appended.components.some((c) => c._tag === 'Why')).toBe(true);
        expect(appended.components.some((c) => c._tag === 'How')).toBe(true);
        const who = appended.components.find((c) => c._tag === 'Who');
        expect(who?._tag === 'Who' && who.label).toBe('freecad-part-occt');

        const byActivity = yield* client.GetByRef({
          ref: trustEntityRef('gbg:activity:freecad-part-occt@fe8f875a'),
        });
        expect(byActivity).toHaveLength(1);
        expect(byActivity[0]?.id).toBe(activity.ref);

        const byGenerated = yield* client.GetByRef({
          ref: trustEntityRef('gbg:step:B01@fe8f875a'),
        });
        expect(byGenerated).toHaveLength(1);
        expect(byGenerated[0]?.id).toBe(activity.ref);
        expect(relationTargets(byGenerated[0]?.components ?? [], 'Generated')).toContain(
          'gbg:step:B01@fe8f875a',
        );

        const byWho = yield* client.GetByRef({ who: 'freecad-part-occt' });
        expect(byWho.map((row) => row.id)).toEqual(['gbg:activity:freecad-part-occt@fe8f875a']);
        const byWhy = yield* client.GetByRef({ why: '#28' });
        expect(byWhy.map((row) => row.id)).toEqual(['gbg:activity:freecad-part-occt@fe8f875a']);
        const bySha = yield* client.GetByRef({
          gitSha: 'fe8f875a80b37a1003f05f3a0190fbe2f0417842',
        });
        expect(bySha.map((row) => row.id)).toEqual(['gbg:activity:freecad-part-occt@fe8f875a']);
        const byWhen = yield* client.GetByRef({ startedAt: '2026-08-20T10:05:07Z' });
        expect(byWhen.map((row) => row.id)).toEqual(['gbg:activity:freecad-part-occt@fe8f875a']);
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('gets activities that used a ref (HLR projector)', async () => {
    await runLog(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SpecimenRpcs);
        yield* client.AppendActivity(originalActivity());
        const projector = decodeLabEntity({
          _tag: 'LabEntity',
          ref: 'gbg:activity:project-s01@pr58',
          kind: 'activity',
          label: 'project S01',
          class: 'projected',
          who: [
            {
              _tag: 'Agent',
              agentType: 'software',
              label: 'project_step.py',
            },
          ],
          what: {
            used: ['gbg:step:B01@fe8f875a'],
            generated: ['gbg:sheet:S01@pr58'],
          },
          when: { startedAt: '2026-08-20T12:00:00Z' },
          where: 'unknown',
          why: '#41',
          how: 'project_step.py → HLRBRep',
          used: ['gbg:step:B01@fe8f875a'],
          generated: ['gbg:sheet:S01@pr58'],
        });
        yield* client.AppendActivity(projector);

        const byUsed = yield* client.GetByRef({
          ref: trustEntityRef('gbg:step:B01@fe8f875a'),
        });
        expect(byUsed.map((row) => row.id)).toEqual([
          'gbg:activity:freecad-part-occt@fe8f875a',
          'gbg:activity:project-s01@pr58',
        ]);

        const bySheet = yield* client.GetByRef({
          ref: trustEntityRef('gbg:sheet:S01@pr58'),
        });
        expect(bySheet).toHaveLength(1);
        expect(relationTargets(bySheet[0]?.components ?? [], 'Generated')).toEqual([
          'gbg:sheet:S01@pr58',
        ]);
        expect(relationTargets(bySheet[0]?.components ?? [], 'Used')).toEqual([
          'gbg:step:B01@fe8f875a',
        ]);
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('corrections append; original Used/Generated are not rewritten', async () => {
    await runLog(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SpecimenRpcs);
        const original = originalActivity();
        yield* client.AppendActivity(original);
        yield* client.AppendActivity(correctionActivity());

        const history = yield* client.GetByRef({
          ref: trustEntityRef('gbg:activity:freecad-part-occt@fe8f875a'),
        });
        expect(history).toHaveLength(2);
        expect(history[0]?.id).toBe(original.ref);
        expect(relationTargets(history[0]?.components ?? [], 'Generated')).toEqual([
          'gbg:step:B01@fe8f875a',
        ]);
        expect(history[1]?.id).toBe('gbg:activity:freecad-part-occt-corrected@fe8f875a');
        expect(relationTargets(history[1]?.components ?? [], 'Supersedes')).toEqual([
          original.ref,
        ]);

        const bySolid = yield* client.GetByRef({
          ref: trustEntityRef('gbg:step:B01@fe8f875a'),
        });
        expect(bySolid.map((row) => row.id)).toEqual([
          original.ref,
          'gbg:activity:freecad-part-occt-corrected@fe8f875a',
        ]);
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('rejects a second append of the same ref', async () => {
    await runLog(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SpecimenRpcs);
        yield* client.AppendActivity(originalActivity());
        const dup = yield* Effect.result(client.AppendActivity(originalActivity()));
        expect(Result.isFailure(dup)).toBe(true);
        if (Result.isFailure(dup)) {
          expect(dup.failure._tag).toBe('ActivityAppendError');
        }
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('rejects appending a non-activity entity', async () => {
    await runLog(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SpecimenRpcs);
        const sheet = decodeLabEntity(load('sheet-s01-pr58.json'));
        const result = yield* Effect.result(client.AppendActivity(sheet));
        expect(Result.isFailure(result)).toBe(true);
        if (Result.isFailure(result)) {
          expect(result.failure._tag).toBe('ActivityAppendError');
        }
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('returns an empty list for an unknown ref', async () => {
    await runLog(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SpecimenRpcs);
        const rows = yield* client.GetByRef({
          ref: trustEntityRef('gbg:sheet:missing@none'),
        });
        expect(rows).toEqual([]);
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });
});

describe('AppendActivity / GetByRef (memory)', () => {
  it('walks W7 and a CAD-01 HLR correction as a new ref', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const catalog = yield* RpcTest.makeClient(CatalogRpcs);
          const client = yield* RpcTest.makeClient(SpecimenRpcs);
          const activity = originalActivity();
          const appended = yield* client.AppendActivity(activity);
          expect(appended.components.some((c) => c._tag === 'Who')).toBe(true);
          const byWho = yield* client.GetByRef({ who: 'freecad-part-occt' });
          expect(byWho.map((row) => row.id)).toEqual([activity.ref]);

          const pack = loadCad01Pack();
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
          yield* client.AppendActivity(pack.exportActivity);
          const hlr = yield* client.AppendActivity(pack.activity);
          const generated = relationTargets(hlr.components, 'Generated');
          expect(generated).toEqual([...CAD01_HLR_SHEET_REFS]);

          const correction = decodeLabEntity({
            _tag: 'LabEntity',
            ref: 'gbg:activity:project-cad01-corrected@pr58',
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
            when: { startedAt: CAD01_COMMITTED_AT, gitSha: CAD01_TREE_SHA },
            where: 'unknown',
            why: '#58',
            how: 'generate_schematics.py',
            used: [CAD01_SOLID_REF],
            generated: [...CAD01_HLR_SHEET_REFS],
            supersedes: CAD01_PROJECT_REF,
          });
          yield* client.AppendActivity(correction);
          const history = yield* client.GetByRef({ ref: CAD01_PROJECT_REF });
          expect(history.map((row) => row.id)).toEqual(
            expect.arrayContaining([CAD01_PROJECT_REF, correction.ref]),
          );
          const original = history.find((row) => row.id === CAD01_PROJECT_REF);
          expect(relationTargets(original?.components ?? [], 'Generated')).toEqual(generated);
          const dup = yield* Effect.result(client.AppendActivity(pack.activity));
          expect(Result.isFailure(dup)).toBe(true);
        }),
      ).pipe(Effect.provide(MemoryCatalogLive)) as Effect.Effect<unknown>,
    );
  });
});
