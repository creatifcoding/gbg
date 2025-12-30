/**
 * @fileoverview DataplanePersistence Service
 *
 * Effect.Service for dataplane state persistence.
 * Enables save/restore of ports, links, and planes to SQLite.
 *
 * @module dataplane/persistence/DataplanePersistenceService
 */

import { Context, Effect, Layer, Schema } from 'effect';

import {
  LinkPort,
  Link,
  Plane,
  type PortId,
  type LinkId,
  type PlaneId,
} from '../schemas/link';
import {
  LinkPortRepo,
  LinkRepo,
  PlaneRepo,
  AllDataplaneRepositoriesLive,
} from './repositories';
import type { LinkPortModel, LinkModel, PlaneModel } from './models';

// =============================================================================
// Error Types
// =============================================================================

export class DataplanePersistenceError extends Schema.TaggedError<DataplanePersistenceError>()(
  'DataplanePersistenceError',
  {
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

// =============================================================================
// Service Interface
// =============================================================================

export interface DataplanePersistenceServiceShape {
  // ---------------------------------------------------------------------------
  // Port Persistence
  // ---------------------------------------------------------------------------

  /**
   * Save a port to SQLite.
   */
  readonly savePort: (
    port: LinkPort
  ) => Effect.Effect<void, DataplanePersistenceError>;

  /**
   * Save all ports to SQLite.
   */
  readonly savePorts: (
    ports: ReadonlyArray<LinkPort>
  ) => Effect.Effect<void, DataplanePersistenceError>;

  /**
   * Load all ports from SQLite.
   */
  readonly loadPorts: () => Effect.Effect<
    ReadonlyArray<LinkPort>,
    DataplanePersistenceError
  >;

  /**
   * Delete a port from SQLite.
   */
  readonly deletePort: (
    id: PortId
  ) => Effect.Effect<void, DataplanePersistenceError>;

  // ---------------------------------------------------------------------------
  // Link Persistence
  // ---------------------------------------------------------------------------

  /**
   * Save a link to SQLite.
   */
  readonly saveLink: (
    link: Link
  ) => Effect.Effect<void, DataplanePersistenceError>;

  /**
   * Save all links to SQLite.
   */
  readonly saveLinks: (
    links: ReadonlyArray<Link>
  ) => Effect.Effect<void, DataplanePersistenceError>;

  /**
   * Load all links from SQLite.
   */
  readonly loadLinks: () => Effect.Effect<
    ReadonlyArray<Link>,
    DataplanePersistenceError
  >;

  /**
   * Delete a link from SQLite.
   */
  readonly deleteLink: (
    id: LinkId
  ) => Effect.Effect<void, DataplanePersistenceError>;

  // ---------------------------------------------------------------------------
  // Plane Persistence
  // ---------------------------------------------------------------------------

  /**
   * Save a plane to SQLite.
   */
  readonly savePlane: (
    plane: Plane
  ) => Effect.Effect<void, DataplanePersistenceError>;

  /**
   * Save all planes to SQLite.
   */
  readonly savePlanes: (
    planes: ReadonlyArray<Plane>
  ) => Effect.Effect<void, DataplanePersistenceError>;

  /**
   * Load all planes from SQLite.
   */
  readonly loadPlanes: () => Effect.Effect<
    ReadonlyArray<Plane>,
    DataplanePersistenceError
  >;

  /**
   * Delete a plane from SQLite.
   */
  readonly deletePlane: (
    id: PlaneId
  ) => Effect.Effect<void, DataplanePersistenceError>;

  // ---------------------------------------------------------------------------
  // Bulk Operations
  // ---------------------------------------------------------------------------

  /**
   * Load all dataplane state from SQLite.
   */
  readonly loadAll: () => Effect.Effect<
    {
      ports: ReadonlyArray<LinkPort>;
      links: ReadonlyArray<Link>;
      planes: ReadonlyArray<Plane>;
    },
    DataplanePersistenceError
  >;

  /**
   * Save all dataplane state to SQLite.
   */
  readonly saveAll: (state: {
    ports: ReadonlyArray<LinkPort>;
    links: ReadonlyArray<Link>;
    planes: ReadonlyArray<Plane>;
  }) => Effect.Effect<void, DataplanePersistenceError>;

  /**
   * Clear all dataplane state from SQLite.
   */
  readonly clearAll: () => Effect.Effect<void, DataplanePersistenceError>;
}

// =============================================================================
// Context Tag
// =============================================================================

export class DataplanePersistenceService extends Context.Tag(
  'tmnl/dataplane/PersistenceService'
)<DataplanePersistenceService, DataplanePersistenceServiceShape>() {}

// =============================================================================
// Model <-> Schema Converters
// =============================================================================

function portModelToSchema(model: LinkPortModel): LinkPort {
  return new LinkPort({
    id: model.id,
    blockId: model.blockId,
    direction: model.direction,
    dataType: model.dataType,
    position: model.position,
    label: model.label ?? undefined,
    parentBlockId: model.parentBlockId ?? undefined,
  });
}

function linkModelToSchema(model: LinkModel): Link {
  return new Link({
    id: model.id,
    sourcePort: model.sourcePort,
    targetPort: model.targetPort,
    direction: model.direction,
    relationship: model.relationship,
    transform: model.transform ?? undefined,
    createdAt: new Date(model.createdAt),
    metadata: model.metadataJson ? JSON.parse(model.metadataJson) : undefined,
  });
}

function planeModelToSchema(model: PlaneModel): Plane {
  return new Plane({
    id: model.id,
    name: model.name,
    parentPlaneId: model.parentPlaneId,
    portIds: JSON.parse(model.portIdsJson) as PortId[],
    createdAt: new Date(model.createdAt),
    metadata: model.metadataJson ? JSON.parse(model.metadataJson) : undefined,
  });
}

// =============================================================================
// Service Implementation
// =============================================================================

export const DataplanePersistenceServiceLive = Layer.effect(
  DataplanePersistenceService,
  Effect.gen(function* () {
    const portRepo = yield* LinkPortRepo;
    const linkRepo = yield* LinkRepo;
    const planeRepo = yield* PlaneRepo;

    // ---------------------------------------------------------------------------
    // Port Persistence
    // ---------------------------------------------------------------------------

    const savePort: DataplanePersistenceServiceShape['savePort'] = (port) =>
      portRepo
        .upsert({
          id: port.id,
          blockId: port.blockId,
          direction: port.direction,
          dataType: port.dataType,
          position: port.position,
          label: port.label ?? null,
          parentBlockId: port.parentBlockId ?? null,
        })
        .pipe(
          Effect.asVoid,
          Effect.mapError(
            (cause) =>
              new DataplanePersistenceError({
                operation: 'savePort',
                message: `Failed to save port: ${port.id}`,
                cause,
              })
          ),
          Effect.withSpan('DataplanePersistence.savePort', {
            attributes: { portId: port.id },
          })
        );

    const savePorts: DataplanePersistenceServiceShape['savePorts'] = (ports) =>
      Effect.forEach(ports, savePort, { concurrency: 'unbounded' }).pipe(
        Effect.asVoid,
        Effect.withSpan('DataplanePersistence.savePorts', {
          attributes: { count: ports.length },
        })
      );

    const loadPorts: DataplanePersistenceServiceShape['loadPorts'] = () =>
      portRepo.listAll().pipe(
        Effect.map((models) => models.map(portModelToSchema)),
        Effect.mapError(
          (cause) =>
            new DataplanePersistenceError({
              operation: 'loadPorts',
              message: 'Failed to load ports',
              cause,
            })
        ),
        Effect.withSpan('DataplanePersistence.loadPorts')
      );

    const deletePort: DataplanePersistenceServiceShape['deletePort'] = (id) =>
      portRepo.delete(id).pipe(
        Effect.mapError(
          (cause) =>
            new DataplanePersistenceError({
              operation: 'deletePort',
              message: `Failed to delete port: ${id}`,
              cause,
            })
        ),
        Effect.withSpan('DataplanePersistence.deletePort', {
          attributes: { portId: id },
        })
      );

    // ---------------------------------------------------------------------------
    // Link Persistence
    // ---------------------------------------------------------------------------

    const saveLink: DataplanePersistenceServiceShape['saveLink'] = (link) =>
      linkRepo
        .upsert({
          id: link.id,
          sourcePort: link.sourcePort,
          targetPort: link.targetPort,
          direction: link.direction,
          relationship: link.relationship,
          transform: link.transform ?? null,
          metadataJson: link.metadata ? JSON.stringify(link.metadata) : null,
        })
        .pipe(
          Effect.asVoid,
          Effect.mapError(
            (cause) =>
              new DataplanePersistenceError({
                operation: 'saveLink',
                message: `Failed to save link: ${link.id}`,
                cause,
              })
          ),
          Effect.withSpan('DataplanePersistence.saveLink', {
            attributes: { linkId: link.id },
          })
        );

    const saveLinks: DataplanePersistenceServiceShape['saveLinks'] = (links) =>
      Effect.forEach(links, saveLink, { concurrency: 'unbounded' }).pipe(
        Effect.asVoid,
        Effect.withSpan('DataplanePersistence.saveLinks', {
          attributes: { count: links.length },
        })
      );

    const loadLinks: DataplanePersistenceServiceShape['loadLinks'] = () =>
      linkRepo.listAll().pipe(
        Effect.map((models) => models.map(linkModelToSchema)),
        Effect.mapError(
          (cause) =>
            new DataplanePersistenceError({
              operation: 'loadLinks',
              message: 'Failed to load links',
              cause,
            })
        ),
        Effect.withSpan('DataplanePersistence.loadLinks')
      );

    const deleteLink: DataplanePersistenceServiceShape['deleteLink'] = (id) =>
      linkRepo.delete(id).pipe(
        Effect.mapError(
          (cause) =>
            new DataplanePersistenceError({
              operation: 'deleteLink',
              message: `Failed to delete link: ${id}`,
              cause,
            })
        ),
        Effect.withSpan('DataplanePersistence.deleteLink', {
          attributes: { linkId: id },
        })
      );

    // ---------------------------------------------------------------------------
    // Plane Persistence
    // ---------------------------------------------------------------------------

    const savePlane: DataplanePersistenceServiceShape['savePlane'] = (plane) =>
      planeRepo
        .upsert({
          id: plane.id,
          name: plane.name,
          parentPlaneId: plane.parentPlaneId ?? null,
          portIdsJson: JSON.stringify(plane.portIds),
          metadataJson: plane.metadata ? JSON.stringify(plane.metadata) : null,
        })
        .pipe(
          Effect.asVoid,
          Effect.mapError(
            (cause) =>
              new DataplanePersistenceError({
                operation: 'savePlane',
                message: `Failed to save plane: ${plane.id}`,
                cause,
              })
          ),
          Effect.withSpan('DataplanePersistence.savePlane', {
            attributes: { planeId: plane.id },
          })
        );

    const savePlanes: DataplanePersistenceServiceShape['savePlanes'] = (
      planes
    ) =>
      Effect.forEach(planes, savePlane, { concurrency: 'unbounded' }).pipe(
        Effect.asVoid,
        Effect.withSpan('DataplanePersistence.savePlanes', {
          attributes: { count: planes.length },
        })
      );

    const loadPlanes: DataplanePersistenceServiceShape['loadPlanes'] = () =>
      planeRepo.listAll().pipe(
        Effect.map((models) => models.map(planeModelToSchema)),
        Effect.mapError(
          (cause) =>
            new DataplanePersistenceError({
              operation: 'loadPlanes',
              message: 'Failed to load planes',
              cause,
            })
        ),
        Effect.withSpan('DataplanePersistence.loadPlanes')
      );

    const deletePlane: DataplanePersistenceServiceShape['deletePlane'] = (id) =>
      planeRepo.delete(id).pipe(
        Effect.mapError(
          (cause) =>
            new DataplanePersistenceError({
              operation: 'deletePlane',
              message: `Failed to delete plane: ${id}`,
              cause,
            })
        ),
        Effect.withSpan('DataplanePersistence.deletePlane', {
          attributes: { planeId: id },
        })
      );

    // ---------------------------------------------------------------------------
    // Bulk Operations
    // ---------------------------------------------------------------------------

    const loadAll: DataplanePersistenceServiceShape['loadAll'] = () =>
      Effect.all({
        ports: loadPorts(),
        links: loadLinks(),
        planes: loadPlanes(),
      }).pipe(Effect.withSpan('DataplanePersistence.loadAll'));

    const saveAll: DataplanePersistenceServiceShape['saveAll'] = (state) =>
      Effect.all([
        savePorts(state.ports),
        saveLinks(state.links),
        savePlanes(state.planes),
      ]).pipe(
        Effect.asVoid,
        Effect.withSpan('DataplanePersistence.saveAll', {
          attributes: {
            portCount: state.ports.length,
            linkCount: state.links.length,
            planeCount: state.planes.length,
          },
        })
      );

    const clearAll: DataplanePersistenceServiceShape['clearAll'] = () =>
      Effect.gen(function* () {
        const ports = yield* portRepo.listAll();
        const links = yield* linkRepo.listAll();
        const planes = yield* planeRepo.listAll();

        yield* Effect.forEach(ports, (p) => portRepo.delete(p.id), {
          concurrency: 'unbounded',
        });
        yield* Effect.forEach(links, (l) => linkRepo.delete(l.id), {
          concurrency: 'unbounded',
        });
        yield* Effect.forEach(planes, (p) => planeRepo.delete(p.id), {
          concurrency: 'unbounded',
        });
      }).pipe(
        Effect.mapError(
          (cause) =>
            new DataplanePersistenceError({
              operation: 'clearAll',
              message: 'Failed to clear dataplane state',
              cause,
            })
        ),
        Effect.withSpan('DataplanePersistence.clearAll')
      );

    return {
      savePort,
      savePorts,
      loadPorts,
      deletePort,
      saveLink,
      saveLinks,
      loadLinks,
      deleteLink,
      savePlane,
      savePlanes,
      loadPlanes,
      deletePlane,
      loadAll,
      saveAll,
      clearAll,
    } satisfies DataplanePersistenceServiceShape;
  })
);

// =============================================================================
// Combined Layer
// =============================================================================

/**
 * Full dataplane persistence layer.
 * Requires SqlClient to be provided.
 */
export const DataplanePersistenceLive = DataplanePersistenceServiceLive.pipe(
  Layer.provide(AllDataplaneRepositoriesLive)
);
