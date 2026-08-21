/**
 * EVA Postgres SourceAdapter over seeded CAD-01 / HLR rows.
 * query(sql) returns Arrow. No wasm. No DataFusion rebuild.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import { CAD01_PROJECT_REF, CAD01_SOLID_REF, seedCad01Hlr } from '../src/adapters/cad01-seed.js';
import { columnValues } from '../src/eva/arrow.js';
import { PostgresSqlSource } from '../src/eva/postgres.js';
import { testCatalogLayer } from './catalog-pg.js';

const pgUnavailable = (cause: unknown): Error => {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new Error(
    `EVA tests need Postgres at SPECIMENDB_PG_* (default 127.0.0.1:5434). ${detail}`,
    { cause },
  );
};

const evaLayer = (assetsRoot: string) =>
  PostgresSqlSource.layer.pipe(Layer.provideMerge(testCatalogLayer(assetsRoot)));

const runEva = async (program: Effect.Effect<unknown, unknown, never>) => {
  const root = await mkdtemp(join(tmpdir(), 'specimendb-eva-'));
  try {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const sql = yield* SqlClient;
          yield* sql.unsafe(`TRUNCATE TABLE components, entities CASCADE`);
          yield* program;
        }),
      ).pipe(Effect.provide(evaLayer(join(root, 'assets')))) as Effect.Effect<unknown>,
    );
  } catch (cause) {
    throw pgUnavailable(cause);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe('EVA Postgres SourceAdapter', () => {
  it('query(sql) returns Arrow for CAD-01 assembly and HLR Used', async () => {
    await runEva(
      Effect.gen(function* () {
        yield* seedCad01Hlr();
        const source = yield* PostgresSqlSource;
        expect(source.kind).toBe('sql');

        const assemblies = yield* source.query(
          `SELECT id, kind, type FROM entities WHERE type = 'assembly'`,
        );
        expect(columnValues(assemblies, 'id')).toContain(CAD01_SOLID_REF);
        expect(columnValues(assemblies, 'kind')).toContain('solid');
        expect(columnValues(assemblies, 'type')).toContain('assembly');

        const used = yield* source.query(
          `SELECT entity_id, payload->>'target' AS target FROM components WHERE kind = 'Used'`,
        );
        expect(columnValues(used, 'entity_id')).toContain(CAD01_PROJECT_REF);
        expect(columnValues(used, 'target')).toContain(CAD01_SOLID_REF);

        const schema = yield* source.schema();
        expect(columnValues(schema, 'table_name')).toEqual(
          expect.arrayContaining(['entities', 'components']),
        );
      }),
    );
  });
});
