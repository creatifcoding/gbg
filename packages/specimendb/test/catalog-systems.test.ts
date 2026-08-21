/**
 * ECS systems over entities + components. Used / Generated hang on entity_id.
 * Seed from existing LabEntity fixtures — do not invent a specimen.
 * HLR on the PR 34 STEP is Project: kind=activity, Used(step) Generated(svgs).
 */

import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as Effect from 'effect/Effect';
import * as RpcTest from 'effect/unstable/rpc/RpcTest';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import { seedLabEntities } from '../src/adapters/seed.js';
import { doctorActivityRef, relationsFromLabEntity } from '../src/adapters/activity.js';
import { relationTargets } from '../src/schemas/components.js';
import { decodeLabEntity, type LabEntity } from '../src/schemas/provenance.js';
import { trustEntityRef } from '../src/schemas/identifiers.js';
import { CatalogRpcs } from '../src/rpc/CatalogRpcs.js';
import { SpecimenRpcs } from '../src/rpc/SpecimenRpcs.js';
import { MemoryCatalogLive } from '../testbed/memory-rpc.js';
import { testCatalogLayer } from './catalog-pg.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'provenance');

const loadEntity = (name: string): LabEntity =>
  decodeLabEntity(JSON.parse(readFileSync(join(fixturesDir, name), 'utf8')) as unknown);

const sheet = loadEntity('sheet-s01-pr58.json');
const solid = loadEntity('solid-b01-fe8f875a.json');
const exportActivity = loadEntity('activity-freecad-part-occt.json');
const doctorRun = loadEntity('run-doctor-pr57.json');

const pgUnavailable = (cause: unknown): Error => {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new Error(
    `Catalog systems tests need Postgres at SPECIMENDB_PG_* (default 127.0.0.1:5434). ${detail}`,
    { cause },
  );
};

const runCatalog = async (program: Effect.Effect<unknown, unknown, never>) => {
  const root = await mkdtemp(join(tmpdir(), 'specimendb-ecs-'));
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

describe('catalog systems (entities + components)', () => {
  it('exports Freecad B01 and projects HLR Used(step) Generated(sheet)', async () => {
    await runCatalog(
      Effect.gen(function* () {
        const specimens = yield* RpcTest.makeClient(SpecimenRpcs);
        const catalog = yield* RpcTest.makeClient(CatalogRpcs);

        yield* seedLabEntities([sheet, solid, doctorRun]);

        const relations = relationsFromLabEntity(exportActivity);
        expect(relations.generated).toEqual([solid.ref]);
        expect(relations.used).toEqual([]);

        const exported = yield* specimens.Export({
          ref: exportActivity.ref,
          generated: relations.generated,
          used: relations.used,
        });
        expect(exported.kind).toBe('activity');
        expect(exported.components.some((c) => c._tag === 'Kind' && c.value === 'activity')).toBe(
          true,
        );
        expect(relationTargets(exported.components, 'Generated')).toEqual([solid.ref]);
        expect(relationTargets(exported.components, 'Used')).toEqual([]);

        const hlr = yield* specimens.Project({
          ref: trustEntityRef('gbg:activity:project-s01@pr58'),
          used: [solid.ref],
          generated: [sheet.ref],
        });
        expect(hlr.kind).toBe('activity');
        expect(relationTargets(hlr.components, 'Used')).toEqual([solid.ref]);
        expect(relationTargets(hlr.components, 'Generated')).toEqual([sheet.ref]);

        const doctor = yield* specimens.Doctor({ run: doctorRun.ref });
        expect(doctor.id).toBe(doctorActivityRef(doctorRun.ref));
        expect(relationTargets(doctor.components, 'Generated')).toEqual([doctorRun.ref]);

        const listed = yield* catalog.ListEntities({ kind: 'activity' });
        expect(listed.some((row) => row.id === exported.id)).toBe(true);
        expect(listed.some((row) => row.id === hlr.id)).toBe(true);
        expect(listed.some((row) => row.id === doctor.id)).toBe(true);
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });
});

describe('catalog systems (in-memory EntityState)', () => {
  it('projects HLR Used(B01) Generated(S01) without inventing a specimen', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const specimens = yield* RpcTest.makeClient(SpecimenRpcs);
          yield* seedLabEntities([solid, sheet]);
          const hlr = yield* specimens.Project({
            ref: trustEntityRef('gbg:activity:project-s01@pr58'),
            used: [solid.ref],
            generated: [sheet.ref],
          });
          expect(relationTargets(hlr.components, 'Used')).toEqual([solid.ref]);
          expect(relationTargets(hlr.components, 'Generated')).toEqual([sheet.ref]);
          expect(hlr.id).not.toContain('specimen');
        }),
      ).pipe(Effect.provide(MemoryCatalogLive)) as Effect.Effect<unknown>,
    );
  });
});
