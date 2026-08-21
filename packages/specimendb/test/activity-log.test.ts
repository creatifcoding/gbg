/**
 * Append-only activity log (#61): AppendActivity / GetByRef over existing PGlite.
 * Tiny fixtures only — not seed ingest (#62), not shop, not EVA.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as Effect from 'effect/Effect';
import * as Either from 'effect/Either';
import * as RpcTest from 'effect/unstable/rpc/RpcTest';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import { layer } from '../src/layers.js';
import { ActivityRpcs } from '../src/rpc/ActivityRpcs.js';
import { decodeLabEntity } from '../src/schemas/provenance.js';
import { trustEntityRef } from '../src/schemas/identifiers.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'provenance');

const load = (name: string): unknown =>
  JSON.parse(readFileSync(join(fixturesDir, name), 'utf8')) as unknown;

const originalActivity = () => decodeLabEntity(load('activity-freecad-part-occt.json'));
const correctionActivity = () =>
  decodeLabEntity(load('activity-freecad-part-occt-corrected.json'));

const runLog = async (program: Effect.Effect<unknown, unknown, never>) => {
  const root = await mkdtemp(join(tmpdir(), 'specimendb-log-'));
  try {
    await Effect.runPromise(
      Effect.scoped(program).pipe(
        Effect.provide(
          layer({
            dataDir: 'memory://',
            assetsRoot: join(root, 'assets'),
          }),
        ),
      ) as Effect.Effect<unknown>,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe('AppendActivity / GetByRef', () => {
  it('appends an activity and gets it by its ref and by generated ref', async () => {
    await runLog(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(ActivityRpcs);
        const activity = originalActivity();
        const appended = yield* client.AppendActivity(activity);
        expect(appended.ref).toBe('gbg:activity:freecad-part-occt@fe8f875a');
        expect(appended.how).toBe('freecad-part-occt');
        expect(appended.who?.[0]?.label).toBe('freecad-part-occt');
        expect(appended.when?.startedAt).toBe('2026-08-20T10:05:07Z');

        const byActivity = yield* client.GetByRef({
          ref: trustEntityRef('gbg:activity:freecad-part-occt@fe8f875a'),
        });
        expect(byActivity).toHaveLength(1);
        expect(byActivity[0]?.ref).toBe(activity.ref);
        expect(byActivity[0]?.who).toEqual(activity.who);
        expect(byActivity[0]?.when).toEqual(activity.when);
        expect(byActivity[0]?.where).toBe('unknown');
        expect(byActivity[0]?.why).toBe('#28');
        expect(byActivity[0]?.how).toBe('freecad-part-occt');

        const byGenerated = yield* client.GetByRef({
          ref: trustEntityRef('gbg:step:B01@fe8f875a'),
        });
        expect(byGenerated).toHaveLength(1);
        expect(byGenerated[0]?.ref).toBe(activity.ref);
        expect(byGenerated[0]?.what?.generated).toContain('gbg:step:B01@fe8f875a');
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('gets activities that used a ref', async () => {
    await runLog(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(ActivityRpcs);
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
        expect(byUsed.map((row) => row.ref)).toEqual([
          'gbg:activity:freecad-part-occt@fe8f875a',
          'gbg:activity:project-s01@pr58',
        ]);

        const bySheet = yield* client.GetByRef({
          ref: trustEntityRef('gbg:sheet:S01@pr58'),
        });
        expect(bySheet).toHaveLength(1);
        expect(bySheet[0]?.how).toBe('project_step.py → HLRBRep');
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('corrections append; original who/when are not rewritten', async () => {
    await runLog(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(ActivityRpcs);
        const original = originalActivity();
        yield* client.AppendActivity(original);
        yield* client.AppendActivity(correctionActivity());

        const history = yield* client.GetByRef({
          ref: trustEntityRef('gbg:activity:freecad-part-occt@fe8f875a'),
        });
        expect(history).toHaveLength(2);
        expect(history[0]?.ref).toBe(original.ref);
        expect(history[0]?.who).toEqual(original.who);
        expect(history[0]?.when).toEqual(original.when);
        expect(history[0]?.why).toBe('#28');
        expect(history[1]?.ref).toBe('gbg:activity:freecad-part-occt-corrected@fe8f875a');
        expect(history[1]?.supersedes).toBe(original.ref);
        expect(history[1]?.who?.[0]?.label).toBe('creatifcoding');
        expect(history[1]?.when?.startedAt).toBe('2026-08-21T01:00:00Z');

        const bySolid = yield* client.GetByRef({
          ref: trustEntityRef('gbg:step:B01@fe8f875a'),
        });
        expect(bySolid.map((row) => row.ref)).toEqual([
          original.ref,
          'gbg:activity:freecad-part-occt-corrected@fe8f875a',
        ]);
        expect(bySolid[0]?.who).toEqual(original.who);
        expect(bySolid[0]?.when?.startedAt).toBe('2026-08-20T10:05:07Z');
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('rejects a second append of the same ref', async () => {
    await runLog(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(ActivityRpcs);
        yield* client.AppendActivity(originalActivity());
        const dup = yield* Effect.either(client.AppendActivity(originalActivity()));
        expect(Either.isLeft(dup)).toBe(true);
        if (Either.isLeft(dup)) {
          expect(dup.left._tag).toBe('ActivityAppendError');
        }
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('rejects appending a non-activity entity', async () => {
    await runLog(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(ActivityRpcs);
        const sheet = decodeLabEntity(load('sheet-s01-pr58.json'));
        const result = yield* Effect.either(client.AppendActivity(sheet));
        expect(Either.isLeft(result)).toBe(true);
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('ActivityAppendError');
        }
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('returns an empty list for an unknown ref', async () => {
    await runLog(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(ActivityRpcs);
        const rows = yield* client.GetByRef({
          ref: trustEntityRef('gbg:sheet:missing@none'),
        });
        expect(rows).toEqual([]);
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('rejects UPDATE of who/when on lab_activities', async () => {
    await runLog(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(ActivityRpcs);
        const original = originalActivity();
        yield* client.AppendActivity(original);
        const sql = yield* SqlClient;
        const update = yield* Effect.either(
          sql.unsafe(`UPDATE lab_activities SET why = 'tampered'`),
        );
        expect(Either.isLeft(update)).toBe(true);
        const del = yield* Effect.either(sql.unsafe(`DELETE FROM lab_activities`));
        expect(Either.isLeft(del)).toBe(true);

        const still = yield* client.GetByRef({ ref: original.ref });
        expect(still).toHaveLength(1);
        expect(still[0]?.who).toEqual(original.who);
        expect(still[0]?.when).toEqual(original.when);
        expect(still[0]?.why).toBe('#28');
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });
});
