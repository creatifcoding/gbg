/**
 * Graph bind walks Used/Generated components for CAD-01 / HLR.
 * AGE is a projection when the extension exists. Components stay SoT.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as Effect from 'effect/Effect';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import { ageAvailable, generated, projectToAge, used, usedBy, usedByAge } from '@gbg/graph';
import {
  CAD01_PDF_REF,
  CAD01_PROJECT_REF,
  CAD01_SHEET_REFS,
  CAD01_SOLID_REF,
  seedCad01Hlr,
} from '../src/adapters/cad01-seed.js';
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

describe('pgGraph bind (Used/Generated projection)', () => {
  it('walks CAD-01 Used / Generated from components', async () => {
    await runCatalog(
      Effect.gen(function* () {
        yield* seedCad01Hlr();
        const sql = yield* SqlClient;
        const activities = yield* usedBy(sql, CAD01_SOLID_REF);
        expect(activities).toContain(CAD01_PROJECT_REF);

        const usedTargets = yield* used(sql, CAD01_PROJECT_REF);
        expect(usedTargets).toEqual([CAD01_SOLID_REF]);

        const sheets = yield* generated(sql, CAD01_PROJECT_REF);
        expect(sheets).toEqual(expect.arrayContaining([...CAD01_SHEET_REFS]));
        expect(sheets.includes(CAD01_PDF_REF)).toBe(false);

        const hasAge = yield* ageAvailable(sql);
        if (hasAge) {
          yield* projectToAge(sql);
          const fromAge = yield* usedByAge(sql, CAD01_SOLID_REF);
          expect(fromAge).toContain(CAD01_PROJECT_REF);
        }
      }),
    );
  });
});
