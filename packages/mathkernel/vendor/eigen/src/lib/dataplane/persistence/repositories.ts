/**
 * @fileoverview SQLite Repositories for Dataplane Persistence
 *
 * Uses @effect/sql Model.makeRepository for typed CRUD.
 *
 * @module dataplane/persistence/repositories
 */

import { Model, SqlClient } from '@effect/sql';
import { SqlError } from '@effect/sql/SqlError';
import { Context, Effect, Layer, Option } from 'effect';

import type { PortId, LinkId, PlaneId, BlockId } from '../schemas/link';
import { LinkPortModel, LinkModel, PlaneModel } from './models';

// =============================================================================
// Repository Types
// =============================================================================

export interface LinkPortRepository {
  readonly insert: (
    insert: typeof LinkPortModel.insert.Type
  ) => Effect.Effect<LinkPortModel, SqlError>;
  readonly findById: (
    id: PortId
  ) => Effect.Effect<Option.Option<LinkPortModel>, SqlError>;
  readonly delete: (id: PortId) => Effect.Effect<void, SqlError>;

  // Custom queries
  readonly listAll: () => Effect.Effect<readonly LinkPortModel[], SqlError>;
  readonly findByBlockId: (
    blockId: BlockId
  ) => Effect.Effect<readonly LinkPortModel[], SqlError>;
  readonly upsert: (
    port: typeof LinkPortModel.insert.Type
  ) => Effect.Effect<LinkPortModel, SqlError>;
}

export interface LinkRepository {
  readonly insert: (
    insert: typeof LinkModel.insert.Type
  ) => Effect.Effect<LinkModel, SqlError>;
  readonly findById: (
    id: LinkId
  ) => Effect.Effect<Option.Option<LinkModel>, SqlError>;
  readonly delete: (id: LinkId) => Effect.Effect<void, SqlError>;

  // Custom queries
  readonly listAll: () => Effect.Effect<readonly LinkModel[], SqlError>;
  readonly findByPort: (
    portId: PortId
  ) => Effect.Effect<readonly LinkModel[], SqlError>;
  readonly findBySourcePort: (
    portId: PortId
  ) => Effect.Effect<readonly LinkModel[], SqlError>;
  readonly findByTargetPort: (
    portId: PortId
  ) => Effect.Effect<readonly LinkModel[], SqlError>;
  readonly upsert: (
    link: typeof LinkModel.insert.Type
  ) => Effect.Effect<LinkModel, SqlError>;
}

export interface PlaneRepository {
  readonly insert: (
    insert: typeof PlaneModel.insert.Type
  ) => Effect.Effect<PlaneModel, SqlError>;
  readonly findById: (
    id: PlaneId
  ) => Effect.Effect<Option.Option<PlaneModel>, SqlError>;
  readonly delete: (id: PlaneId) => Effect.Effect<void, SqlError>;

  // Custom queries
  readonly listAll: () => Effect.Effect<readonly PlaneModel[], SqlError>;
  readonly findByParentId: (
    parentId: PlaneId
  ) => Effect.Effect<readonly PlaneModel[], SqlError>;
  readonly upsert: (
    plane: typeof PlaneModel.insert.Type
  ) => Effect.Effect<PlaneModel, SqlError>;
  readonly updatePortIds: (
    id: PlaneId,
    portIdsJson: string
  ) => Effect.Effect<void, SqlError>;
}

// =============================================================================
// Context Tags
// =============================================================================

export class LinkPortRepo extends Context.Tag('tmnl/dataplane/LinkPortRepo')<
  LinkPortRepo,
  LinkPortRepository
>() {}

export class LinkRepo extends Context.Tag('tmnl/dataplane/LinkRepo')<
  LinkRepo,
  LinkRepository
>() {}

export class PlaneRepo extends Context.Tag('tmnl/dataplane/PlaneRepo')<
  PlaneRepo,
  PlaneRepository
>() {}

// =============================================================================
// Repository Implementations
// =============================================================================

/**
 * Live implementation of LinkPortRepository.
 */
export const LinkPortRepoLive = Layer.effect(
  LinkPortRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    // Base repository from Model
    const baseRepo = yield* Model.makeRepository(LinkPortModel, {
      tableName: 'dataplane_ports',
      idColumn: 'id',
      spanPrefix: 'LinkPortRepo',
    });

    const listAll = (): Effect.Effect<readonly LinkPortModel[], SqlError> =>
      sql<LinkPortModel>`SELECT * FROM dataplane_ports ORDER BY createdAt DESC`;

    const findByBlockId = (
      blockId: BlockId
    ): Effect.Effect<readonly LinkPortModel[], SqlError> =>
      sql<LinkPortModel>`SELECT * FROM dataplane_ports WHERE blockId = ${blockId}`;

    const upsert = (
      port: typeof LinkPortModel.insert.Type
    ): Effect.Effect<LinkPortModel, SqlError> =>
      Effect.gen(function* () {
        const existing = yield* baseRepo.findById(port.id);

        if (Option.isSome(existing)) {
          yield* sql`
            UPDATE dataplane_ports
            SET blockId = ${port.blockId},
                direction = ${port.direction},
                dataType = ${port.dataType},
                position = ${port.position},
                label = ${port.label ?? null},
                parentBlockId = ${port.parentBlockId ?? null},
                updatedAt = ${new Date().toISOString()}
            WHERE id = ${port.id}
          `;
          const updated = yield* baseRepo.findById(port.id);
          return Option.getOrThrow(updated);
        } else {
          return yield* baseRepo.insert(port);
        }
      });

    return {
      ...baseRepo,
      listAll,
      findByBlockId,
      upsert,
    } satisfies LinkPortRepository;
  })
);

/**
 * Live implementation of LinkRepository.
 */
export const LinkRepoLive = Layer.effect(
  LinkRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    // Base repository from Model
    const baseRepo = yield* Model.makeRepository(LinkModel, {
      tableName: 'dataplane_links',
      idColumn: 'id',
      spanPrefix: 'LinkRepo',
    });

    const listAll = (): Effect.Effect<readonly LinkModel[], SqlError> =>
      sql<LinkModel>`SELECT * FROM dataplane_links ORDER BY createdAt DESC`;

    const findByPort = (
      portId: PortId
    ): Effect.Effect<readonly LinkModel[], SqlError> =>
      sql<LinkModel>`
        SELECT * FROM dataplane_links
        WHERE sourcePort = ${portId} OR targetPort = ${portId}
      `;

    const findBySourcePort = (
      portId: PortId
    ): Effect.Effect<readonly LinkModel[], SqlError> =>
      sql<LinkModel>`
        SELECT * FROM dataplane_links
        WHERE sourcePort = ${portId}
      `;

    const findByTargetPort = (
      portId: PortId
    ): Effect.Effect<readonly LinkModel[], SqlError> =>
      sql<LinkModel>`
        SELECT * FROM dataplane_links
        WHERE targetPort = ${portId}
      `;

    const upsert = (
      link: typeof LinkModel.insert.Type
    ): Effect.Effect<LinkModel, SqlError> =>
      Effect.gen(function* () {
        const existing = yield* baseRepo.findById(link.id);

        if (Option.isSome(existing)) {
          yield* sql`
            UPDATE dataplane_links
            SET sourcePort = ${link.sourcePort},
                targetPort = ${link.targetPort},
                direction = ${link.direction},
                relationship = ${link.relationship},
                transform = ${link.transform ?? null},
                metadataJson = ${link.metadataJson ?? null},
                updatedAt = ${new Date().toISOString()}
            WHERE id = ${link.id}
          `;
          const updated = yield* baseRepo.findById(link.id);
          return Option.getOrThrow(updated);
        } else {
          return yield* baseRepo.insert(link);
        }
      });

    return {
      ...baseRepo,
      listAll,
      findByPort,
      findBySourcePort,
      findByTargetPort,
      upsert,
    } satisfies LinkRepository;
  })
);

/**
 * Live implementation of PlaneRepository.
 */
export const PlaneRepoLive = Layer.effect(
  PlaneRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    // Base repository from Model
    const baseRepo = yield* Model.makeRepository(PlaneModel, {
      tableName: 'dataplane_planes',
      idColumn: 'id',
      spanPrefix: 'PlaneRepo',
    });

    const listAll = (): Effect.Effect<readonly PlaneModel[], SqlError> =>
      sql<PlaneModel>`SELECT * FROM dataplane_planes ORDER BY createdAt DESC`;

    const findByParentId = (
      parentId: PlaneId
    ): Effect.Effect<readonly PlaneModel[], SqlError> =>
      sql<PlaneModel>`SELECT * FROM dataplane_planes WHERE parentPlaneId = ${parentId}`;

    const upsert = (
      plane: typeof PlaneModel.insert.Type
    ): Effect.Effect<PlaneModel, SqlError> =>
      Effect.gen(function* () {
        const existing = yield* baseRepo.findById(plane.id);

        if (Option.isSome(existing)) {
          yield* sql`
            UPDATE dataplane_planes
            SET name = ${plane.name},
                parentPlaneId = ${plane.parentPlaneId ?? null},
                portIdsJson = ${plane.portIdsJson},
                metadataJson = ${plane.metadataJson ?? null},
                updatedAt = ${new Date().toISOString()}
            WHERE id = ${plane.id}
          `;
          const updated = yield* baseRepo.findById(plane.id);
          return Option.getOrThrow(updated);
        } else {
          return yield* baseRepo.insert(plane);
        }
      });

    const updatePortIds = (
      id: PlaneId,
      portIdsJson: string
    ): Effect.Effect<void, SqlError> =>
      sql`
        UPDATE dataplane_planes
        SET portIdsJson = ${portIdsJson},
            updatedAt = ${new Date().toISOString()}
        WHERE id = ${id}
      `.pipe(Effect.asVoid);

    return {
      ...baseRepo,
      listAll,
      findByParentId,
      upsert,
      updatePortIds,
    } satisfies PlaneRepository;
  })
);

// =============================================================================
// Combined Layer
// =============================================================================

/**
 * All dataplane repository layers combined.
 * Requires SqlClient to be provided.
 */
export const AllDataplaneRepositoriesLive = Layer.mergeAll(
  LinkPortRepoLive,
  LinkRepoLive,
  PlaneRepoLive
);
