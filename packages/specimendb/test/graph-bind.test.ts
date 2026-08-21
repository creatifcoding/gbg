/**
 * Graph bind walks Used/Generated components for CAD-01 / HLR.
 * AGE Cypher is an empty well unless a later bind records it.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as Effect from 'effect/Effect';
import * as Result from 'effect/Result';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import { ageAvailable, generated, projectToAge, used, usedBy } from '@gbg/graph';
import {
  CAD01_PDF_REF,
  CAD01_PROJECT_REF,
  CAD01_SHEET_REFS,
  CAD01_SOLID_REF,
  seedCad01Hlr,
} from '../src/adapters/cad01-seed.js';
import { NOTE81_REF, QUARRY_PR95_REF } from '../src/adapters/generating-note.js';
import { testCatalogLayer } from './catalog-pg.js';

const pgUnavailable = (cause: unknown): Error => {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new Error(
    `Graph bind tests need Postgres at SPECIMENDB_PG_* (default 127.0.0.1:5434). ${detail}`,
    { cause },
  );
};

const runCatalog = async (program: Effect.Effect<unknown, unknown, never>) => {
  const root = await mkdtemp(join(tmpdir(), 'specimendb-graph-'));
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

describe('graph projection of Used/Generated', () => {
  it('walks CAD-01 from components; AGE stays an empty well here', async () => {
    await runCatalog(
      Effect.gen(function* () {
        yield* seedCad01Hlr();
        const sql = yield* SqlClient;
        const activities = yield* usedBy(sql, CAD01_SOLID_REF);
        expect(activities).toEqual([CAD01_PROJECT_REF]);

        const noteYields = yield* generated(sql, NOTE81_REF);
        expect(noteYields).toEqual(
          expect.arrayContaining([CAD01_SOLID_REF, CAD01_PROJECT_REF]),
        );

        const usedTargets = yield* used(sql, CAD01_PROJECT_REF);
        expect(usedTargets).toEqual([CAD01_SOLID_REF]);

        const quarryUsers = yield* usedBy(sql, QUARRY_PR95_REF);
        expect(quarryUsers).toEqual([NOTE81_REF]);
        const noteUsed = yield* used(sql, NOTE81_REF);
        expect(noteUsed).toEqual([QUARRY_PR95_REF]);

        const sheets = yield* generated(sql, CAD01_PROJECT_REF);
        expect(sheets).toEqual(expect.arrayContaining([...CAD01_SHEET_REFS]));
        expect(sheets.includes(CAD01_PDF_REF)).toBe(false);

        const hasAge = yield* ageAvailable(sql);
        const projected = yield* Effect.result(projectToAge(sql));
        expect(Result.isFailure(projected)).toBe(true);
        if (Result.isFailure(projected)) {
          expect(projected.failure._tag).toBe('GraphError');
          if (!hasAge) {
            expect(projected.failure.message).toBe('age extension is not installed');
          } else {
            expect(projected.failure.message).toContain(
              'Cypher MERGE bind is not on this branch yet',
            );
          }
        }
      }),
    );
  });
});
