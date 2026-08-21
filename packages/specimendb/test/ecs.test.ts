/**
 * ECS tables + Effect machinery. Postgres at SPECIMENDB_PG_* (default 127.0.0.1:5434).
 */

import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as RpcTest from 'effect/unstable/rpc/RpcTest';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import { jpegWithoutGps } from './fixtures.js';
import { CatalogPersistenceLive, CatalogReposLive, layer } from '../src/layers.js';
import { catalogPgFromEnv, CatalogSqlLive } from '../src/repos/pg.js';
import { ComponentRepo } from '../src/repos/ComponentRepo.js';
import { EdgeRepo } from '../src/repos/EdgeRepo.js';
import { EntityRepo } from '../src/repos/EntityRepo.js';
import { SpecimenRepo } from '../src/repos/SpecimenRepo.js';
import { SpecimenRpcsLive } from '../src/rpc/SpecimenRpcs.js';
import { CatalogConfigLayer } from '../src/schemas/config.js';
import { ClassComponent, COMPONENT_KINDS, KindComponent } from '../src/schemas/components.js';
import { EDGE_RELS } from '../src/schemas/edges.js';
import { trustComponentId, trustEdgeId, trustEntityRef } from '../src/schemas/identifiers.js';
import { ENTITY_KINDS } from '../src/schemas/provenance.js';
import { SpecimenRpcs } from '../src/rpc/SpecimenRpcs.js';
import { statusOf } from '../src/schemas/specimen.js';

const modelsDir = join(dirname(fileURLToPath(import.meta.url)), '../src/models');

const pgUnavailable = (cause: unknown): Error => {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new Error(
    `ECS tests need Postgres at SPECIMENDB_PG_* (default 127.0.0.1:5434). ${detail}`,
    { cause },
  );
};

const ecsLayer = (assetsRoot: string) =>
  CatalogReposLive.pipe(
    Layer.provideMerge(CatalogSqlLive),
    Layer.provide(CatalogConfigLayer({ pg: catalogPgFromEnv(), assetsRoot })),
  );

const mixLayer = (assetsRoot: string) =>
  SpecimenRpcsLive.pipe(
    Layer.provideMerge(SpecimenRepo.layer),
    Layer.provideMerge(CatalogReposLive),
    Layer.provideMerge(CatalogPersistenceLive),
    Layer.provide(CatalogConfigLayer({ pg: catalogPgFromEnv(), assetsRoot })),
  );

const runWith = (makeLayer: (assetsRoot: string) => Layer.Layer<never, unknown, never>) =>
  async (program: Effect.Effect<unknown, unknown, never>) => {
    const root = await mkdtemp(join(tmpdir(), 'specimendb-ecs-'));
    try {
      await Effect.runPromise(
        Effect.scoped(program).pipe(Effect.provide(makeLayer(join(root, 'assets')))) as Effect.Effect<unknown>,
      );
    } catch (cause) {
      throw pgUnavailable(cause);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  };

const runEcs = runWith(ecsLayer);
const runMix = runWith(mixLayer);

const runCatalog = async (program: Effect.Effect<unknown, unknown, never>) => {
  const root = await mkdtemp(join(tmpdir(), 'specimendb-ecs-rpc-'));
  try {
    await Effect.runPromise(
      Effect.scoped(program).pipe(
        Effect.provide(
          layer({
            pg: catalogPgFromEnv(),
            assetsRoot: join(root, 'assets'),
          }),
        ),
      ) as Effect.Effect<unknown>,
    );
  } catch (cause) {
    throw pgUnavailable(cause);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe('ECS model DDL stays aligned with schema literals', () => {
  it('entities / components / edges CHECK lists cover the schema consts', async () => {
    const entityDdl = await readFile(join(modelsDir, 'EntityModel.ddl.ts'), 'utf8');
    for (const kind of ENTITY_KINDS) {
      expect(entityDdl).toContain(`'${kind}'`);
    }
    const componentDdl = await readFile(join(modelsDir, 'ComponentModel.ddl.ts'), 'utf8');
    for (const kind of COMPONENT_KINDS) {
      expect(componentDdl).toContain(`'${kind}'`);
    }
    const edgeDdl = await readFile(join(modelsDir, 'EdgeModel.ddl.ts'), 'utf8');
    for (const rel of EDGE_RELS) {
      expect(edgeDdl).toContain(`'${rel}'`);
    }
  });
});

describe('ECS tables', () => {
  it('migrates entities / components.entity_id / edges and drops leftover specimens', async () => {
    await runEcs(
      Effect.gen(function* () {
        const sql = yield* SqlClient;
        const tables = yield* sql<{ table_name: string }>`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name IN ('entities', 'components', 'edges', 'specimens', 'lab_activities')
        `;
        const names = tables.map((row) => row.table_name).sort();
        expect(names).toEqual(['components', 'edges', 'entities']);

        const columns = yield* sql<{ column_name: string }>`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'components'
          ORDER BY column_name
        `;
        expect(columns.map((row) => row.column_name)).toEqual([
          'attached_at',
          'entity_id',
          'id',
          'kind',
          'payload',
        ]);
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('stores activity on entities, not a lab_activities table', async () => {
    await runEcs(
      Effect.gen(function* () {
        const entities = yield* EntityRepo;
        const ref = trustEntityRef(`gbg:activity:${randomUUID()}`);
        const createdAt = new Date().toISOString();
        const row = yield* entities.insert({
          id: ref,
          kind: 'activity',
          createdAt,
        });
        expect(row.kind).toBe('activity');
        expect(row.id).toBe(ref);
        const found = yield* entities.findById(ref);
        expect(Option.isSome(found)).toBe(true);
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('appends edges and rejects mutate', async () => {
    await runEcs(
      Effect.gen(function* () {
        const edges = yield* EdgeRepo;
        const sql = yield* SqlClient;
        const src = trustEntityRef(`gbg:specimen:${randomUUID()}`);
        const dst = trustEntityRef(`gbg:sheet:S01@pr58`);
        const appended = yield* edges.append({
          id: trustEdgeId(randomUUID()),
          src,
          rel: 'depicts',
          dst,
          payload: {},
          at: new Date().toISOString(),
        });
        expect(appended.rel).toBe('depicts');
        const listed = yield* edges.findBySrc(src);
        expect(listed.some((edge) => edge.id === appended.id)).toBe(true);

        const rejected = yield* sql`
          UPDATE edges SET rel = ${'used'} WHERE id = ${appended.id}
        `.pipe(
          Effect.as(false),
          Effect.orElseSucceed(() => true),
        );
        expect(rejected).toBe(true);
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });
});

describe('Intake over ECS', () => {
  it('mints a specimen entity and does not attach Kind/Class/taxon/GPS when they did not arrive', async () => {
    await runCatalog(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SpecimenRpcs);
        const intake = yield* client.Intake({
          bytes: jpegWithoutGps(),
          filename: 'ecs.jpg',
        });
        expect(statusOf(intake)).toBe('raw');
        expect(intake.components.some((c) => c._tag === 'Kind')).toBe(false);
        expect(intake.components.some((c) => c._tag === 'Class')).toBe(false);
        expect(intake.components.some((c) => c._tag === 'Taxon')).toBe(false);
        expect(intake.components.some((c) => c._tag === 'Provenance')).toBe(false);
        expect(intake.components.some((c) => c._tag === 'W7')).toBe(false);
        const locality = intake.components.find((c) => c._tag === 'Locality');
        expect(locality?._tag === 'Locality' && locality.state).toBe('unknown');
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });

  it('does not list activity entities as specimens; Kind/Class attach later', async () => {
    await runMix(
      Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SpecimenRpcs);
        const entities = yield* EntityRepo;
        const components = yield* ComponentRepo;
        const intake = yield* client.Intake({
          bytes: jpegWithoutGps(),
          filename: 'listed.jpg',
        });
        const activityRef = trustEntityRef(`gbg:activity:${randomUUID()}`);
        yield* entities.insert({
          id: activityRef,
          kind: 'activity',
          createdAt: new Date().toISOString(),
        });
        const listed = yield* client.List();
        expect(listed.some((row) => row.id === intake.specimenId)).toBe(true);
        expect(listed.every((row) => row.id !== activityRef)).toBe(true);

        const entityId = trustEntityRef(`gbg:specimen:${intake.specimenId}`);
        yield* components.insert({
          id: trustComponentId(randomUUID()),
          entityId,
          kind: 'Kind',
          payload: new KindComponent({ value: 'specimen' }),
          attachedAt: new Date().toISOString(),
        });
        yield* components.insert({
          id: trustComponentId(randomUUID()),
          entityId,
          kind: 'Class',
          payload: new ClassComponent({ value: 'unverified' }),
          attachedAt: new Date().toISOString(),
        });
        const got = yield* client.Get({ specimenId: intake.specimenId });
        expect(got.components.some((c) => c._tag === 'Kind')).toBe(true);
        expect(got.components.some((c) => c._tag === 'Class')).toBe(true);
      }) as Effect.Effect<unknown, unknown, never>,
    );
  });
});
