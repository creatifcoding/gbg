/**
 * Dataplane Persistence Tests
 *
 * Phase 6 tests for SQLite persistence:
 * - Repository CRUD operations
 * - Model converters
 * - DataplanePersistenceService operations
 *
 * Run with: bun test src/lib/dataplane/persistence/__tests__/persistence.bun.test.ts
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { Effect, Option, Layer } from 'effect';
import { SqliteClient } from '@effect/sql-sqlite-bun';

import {
  LinkPortModel,
  LinkModel,
  PlaneModel,
} from '../models';
import {
  LinkPortRepo,
  LinkRepo,
  PlaneRepo,
  AllDataplaneRepositoriesLive,
} from '../repositories';
import {
  DataplanePersistenceService,
  DataplanePersistenceLive,
} from '../DataplanePersistenceService';
import { runMigrations, dropAllTables } from '../../../editor/v3/persistence/migrations';
import type { PortId, LinkId, PlaneId, BlockId } from '../../schemas/link';

// =============================================================================
// Test Layer Setup
// =============================================================================

const SqliteTestLayer = SqliteClient.layer({ filename: ':memory:' });

const TestLayerWithRepos = AllDataplaneRepositoriesLive.pipe(
  Layer.tap(() => runMigrations),
  Layer.provide(SqliteTestLayer)
);

const TestLayerWithService = DataplanePersistenceLive.pipe(
  Layer.tap(() => runMigrations),
  Layer.provide(SqliteTestLayer)
);

// Helper to run Effect with repos
const runWithRepos = <A, E>(
  effect: Effect.Effect<A, E, LinkPortRepo | LinkRepo | PlaneRepo>
) => Effect.runPromise(effect.pipe(Effect.provide(TestLayerWithRepos)));

// Helper to run Effect with persistence service
const runWithService = <A, E>(
  effect: Effect.Effect<A, E, DataplanePersistenceService>
) => Effect.runPromise(effect.pipe(Effect.provide(TestLayerWithService)));

// =============================================================================
// LinkPortRepository Tests
// =============================================================================

describe('LinkPortRepository', () => {
  const testPortId = 'port-test-001' as PortId;
  const testBlockId = 'block-test-001' as BlockId;

  test('insert: creates new port', async () => {
    await runWithRepos(
      Effect.gen(function* () {
        const repo = yield* LinkPortRepo;

        const port = yield* repo.insert(
          LinkPortModel.insert.make({
            id: testPortId,
            blockId: testBlockId,
            direction: 'out',
            dataType: 'table',
            position: 'right',
            label: 'Test Output',
            parentBlockId: null,
          })
        );

        expect(port.id).toBe(testPortId);
        expect(port.blockId).toBe(testBlockId);
        expect(port.direction).toBe('out');
        expect(port.dataType).toBe('table');
        expect(port.position).toBe('right');
        expect(port.label).toBe('Test Output');
      })
    );
  });

  test('findById: returns port when exists', async () => {
    await runWithRepos(
      Effect.gen(function* () {
        const repo = yield* LinkPortRepo;

        // Insert first
        yield* repo.insert(
          LinkPortModel.insert.make({
            id: testPortId,
            blockId: testBlockId,
            direction: 'in',
            dataType: 'json',
            position: 'left',
            label: null,
            parentBlockId: null,
          })
        );

        // Find
        const found = yield* repo.findById(testPortId);
        expect(Option.isSome(found)).toBe(true);
        if (Option.isSome(found)) {
          expect(found.value.id).toBe(testPortId);
          expect(found.value.direction).toBe('in');
        }
      })
    );
  });

  test('findById: returns None when not exists', async () => {
    await runWithRepos(
      Effect.gen(function* () {
        const repo = yield* LinkPortRepo;
        const found = yield* repo.findById('nonexistent-port' as PortId);
        expect(Option.isNone(found)).toBe(true);
      })
    );
  });

  test('listAll: returns all ports', async () => {
    await runWithRepos(
      Effect.gen(function* () {
        const repo = yield* LinkPortRepo;

        // Insert multiple
        yield* repo.insert(
          LinkPortModel.insert.make({
            id: 'port-1' as PortId,
            blockId: testBlockId,
            direction: 'in',
            dataType: 'table',
            position: 'left',
            label: null,
            parentBlockId: null,
          })
        );
        yield* repo.insert(
          LinkPortModel.insert.make({
            id: 'port-2' as PortId,
            blockId: testBlockId,
            direction: 'out',
            dataType: 'table',
            position: 'right',
            label: null,
            parentBlockId: null,
          })
        );

        const all = yield* repo.listAll();
        expect(all.length).toBe(2);
      })
    );
  });

  test('findByBlockId: filters by block', async () => {
    await runWithRepos(
      Effect.gen(function* () {
        const repo = yield* LinkPortRepo;
        const block1 = 'block-1' as BlockId;
        const block2 = 'block-2' as BlockId;

        // Insert ports for different blocks
        yield* repo.insert(
          LinkPortModel.insert.make({
            id: 'port-b1-1' as PortId,
            blockId: block1,
            direction: 'in',
            dataType: 'table',
            position: 'left',
            label: null,
            parentBlockId: null,
          })
        );
        yield* repo.insert(
          LinkPortModel.insert.make({
            id: 'port-b1-2' as PortId,
            blockId: block1,
            direction: 'out',
            dataType: 'table',
            position: 'right',
            label: null,
            parentBlockId: null,
          })
        );
        yield* repo.insert(
          LinkPortModel.insert.make({
            id: 'port-b2-1' as PortId,
            blockId: block2,
            direction: 'in',
            dataType: 'json',
            position: 'top',
            label: null,
            parentBlockId: null,
          })
        );

        const block1Ports = yield* repo.findByBlockId(block1);
        expect(block1Ports.length).toBe(2);

        const block2Ports = yield* repo.findByBlockId(block2);
        expect(block2Ports.length).toBe(1);
      })
    );
  });

  test('delete: removes port', async () => {
    await runWithRepos(
      Effect.gen(function* () {
        const repo = yield* LinkPortRepo;

        yield* repo.insert(
          LinkPortModel.insert.make({
            id: testPortId,
            blockId: testBlockId,
            direction: 'out',
            dataType: 'table',
            position: 'right',
            label: null,
            parentBlockId: null,
          })
        );

        yield* repo.delete(testPortId);

        const found = yield* repo.findById(testPortId);
        expect(Option.isNone(found)).toBe(true);
      })
    );
  });
});

// =============================================================================
// LinkRepository Tests
// =============================================================================

describe('LinkRepository', () => {
  const testLinkId = 'link-test-001' as LinkId;
  const sourcePortId = 'port-source' as PortId;
  const targetPortId = 'port-target' as PortId;

  test('insert: creates new link', async () => {
    await runWithRepos(
      Effect.gen(function* () {
        const portRepo = yield* LinkPortRepo;
        const linkRepo = yield* LinkRepo;

        // Create ports first (foreign key constraints)
        yield* portRepo.insert(
          LinkPortModel.insert.make({
            id: sourcePortId,
            blockId: 'block-1' as BlockId,
            direction: 'out',
            dataType: 'table',
            position: 'right',
            label: null,
            parentBlockId: null,
          })
        );
        yield* portRepo.insert(
          LinkPortModel.insert.make({
            id: targetPortId,
            blockId: 'block-2' as BlockId,
            direction: 'in',
            dataType: 'table',
            position: 'left',
            label: null,
            parentBlockId: null,
          })
        );

        const link = yield* linkRepo.insert(
          LinkModel.insert.make({
            id: testLinkId,
            sourcePort: sourcePortId,
            targetPort: targetPortId,
            direction: 'unidirectional',
            relationship: 'pipe',
            transform: 'map(x => x.value)',
            metadataJson: null,
          })
        );

        expect(link.id).toBe(testLinkId);
        expect(link.sourcePort).toBe(sourcePortId);
        expect(link.targetPort).toBe(targetPortId);
        expect(link.direction).toBe('unidirectional');
        expect(link.relationship).toBe('pipe');
        expect(link.transform).toBe('map(x => x.value)');
      })
    );
  });

  test('findBySourcePort: filters by source', async () => {
    await runWithRepos(
      Effect.gen(function* () {
        const portRepo = yield* LinkPortRepo;
        const linkRepo = yield* LinkRepo;

        // Setup ports
        yield* portRepo.insert(
          LinkPortModel.insert.make({
            id: 'p1' as PortId,
            blockId: 'b1' as BlockId,
            direction: 'out',
            dataType: 'table',
            position: 'right',
            label: null,
            parentBlockId: null,
          })
        );
        yield* portRepo.insert(
          LinkPortModel.insert.make({
            id: 'p2' as PortId,
            blockId: 'b2' as BlockId,
            direction: 'in',
            dataType: 'table',
            position: 'left',
            label: null,
            parentBlockId: null,
          })
        );
        yield* portRepo.insert(
          LinkPortModel.insert.make({
            id: 'p3' as PortId,
            blockId: 'b3' as BlockId,
            direction: 'in',
            dataType: 'table',
            position: 'left',
            label: null,
            parentBlockId: null,
          })
        );

        // Create links from p1
        yield* linkRepo.insert(
          LinkModel.insert.make({
            id: 'link-1' as LinkId,
            sourcePort: 'p1' as PortId,
            targetPort: 'p2' as PortId,
            direction: 'unidirectional',
            relationship: 'pipe',
            transform: null,
            metadataJson: null,
          })
        );
        yield* linkRepo.insert(
          LinkModel.insert.make({
            id: 'link-2' as LinkId,
            sourcePort: 'p1' as PortId,
            targetPort: 'p3' as PortId,
            direction: 'unidirectional',
            relationship: 'mirror',
            transform: null,
            metadataJson: null,
          })
        );

        const fromP1 = yield* linkRepo.findBySourcePort('p1' as PortId);
        expect(fromP1.length).toBe(2);
      })
    );
  });
});

// =============================================================================
// PlaneRepository Tests
// =============================================================================

describe('PlaneRepository', () => {
  const testPlaneId = 'plane-test-001' as PlaneId;

  test('insert: creates new plane', async () => {
    await runWithRepos(
      Effect.gen(function* () {
        const repo = yield* PlaneRepo;

        const plane = yield* repo.insert(
          PlaneModel.insert.make({
            id: testPlaneId,
            name: 'Data Bus Alpha',
            parentPlaneId: null,
            portIdsJson: JSON.stringify(['port-1', 'port-2']),
            metadataJson: JSON.stringify({ color: 'cyan' }),
          })
        );

        expect(plane.id).toBe(testPlaneId);
        expect(plane.name).toBe('Data Bus Alpha');
        expect(JSON.parse(plane.portIdsJson)).toEqual(['port-1', 'port-2']);
      })
    );
  });

  test('nested planes: parent-child relationship', async () => {
    await runWithRepos(
      Effect.gen(function* () {
        const repo = yield* PlaneRepo;

        // Create parent
        const parent = yield* repo.insert(
          PlaneModel.insert.make({
            id: 'plane-parent' as PlaneId,
            name: 'Parent Plane',
            parentPlaneId: null,
            portIdsJson: '[]',
            metadataJson: null,
          })
        );

        // Create child
        const child = yield* repo.insert(
          PlaneModel.insert.make({
            id: 'plane-child' as PlaneId,
            name: 'Child Plane',
            parentPlaneId: parent.id,
            portIdsJson: '[]',
            metadataJson: null,
          })
        );

        expect(child.parentPlaneId).toBe(parent.id);

        // Find by parent
        const children = yield* repo.findByParentId(parent.id);
        expect(children.length).toBe(1);
        expect(children[0].id).toBe(child.id);
      })
    );
  });
});

// =============================================================================
// DataplanePersistenceService Tests
// =============================================================================

describe('DataplanePersistenceService', () => {
  test('savePort + loadAllPorts: roundtrip', async () => {
    await runWithService(
      Effect.gen(function* () {
        const service = yield* DataplanePersistenceService;

        // Save a port via the service
        yield* service.savePort({
          id: 'port-svc-1' as PortId,
          blockId: 'block-1' as BlockId,
          direction: 'out',
          dataType: 'table',
          position: 'right',
          label: 'Output 1',
        });

        yield* service.savePort({
          id: 'port-svc-2' as PortId,
          blockId: 'block-1' as BlockId,
          direction: 'in',
          dataType: 'json',
          position: 'left',
        });

        // Load all
        const ports = yield* service.loadPorts();
        expect(ports.length).toBe(2);

        // Verify schema structure
        const port1 = ports.find((p) => p.id === 'port-svc-1');
        expect(port1).toBeDefined();
        expect(port1?.label).toBe('Output 1');
        expect(port1?.direction).toBe('out');
      })
    );
  });

  test('saveLink + loadAllLinks: roundtrip', async () => {
    await runWithService(
      Effect.gen(function* () {
        const service = yield* DataplanePersistenceService;

        // Save ports first
        yield* service.savePort({
          id: 'p1' as PortId,
          blockId: 'b1' as BlockId,
          direction: 'out',
          dataType: 'table',
          position: 'right',
        });
        yield* service.savePort({
          id: 'p2' as PortId,
          blockId: 'b2' as BlockId,
          direction: 'in',
          dataType: 'table',
          position: 'left',
        });

        // Save link
        yield* service.saveLink({
          id: 'link-svc-1' as LinkId,
          sourcePort: 'p1' as PortId,
          targetPort: 'p2' as PortId,
          direction: 'unidirectional',
          relationship: 'pipe',
          transform: 'filter(x => x.active)',
        });

        // Load all
        const links = yield* service.loadLinks();
        expect(links.length).toBe(1);
        expect(links[0].transform).toBe('filter(x => x.active)');
        expect(links[0].relationship).toBe('pipe');
      })
    );
  });

  test('savePlane + loadAllPlanes: roundtrip with portIds', async () => {
    await runWithService(
      Effect.gen(function* () {
        const service = yield* DataplanePersistenceService;

        yield* service.savePlane({
          id: 'plane-svc-1' as PlaneId,
          name: 'Main Bus',
          portIds: ['port-a' as PortId, 'port-b' as PortId],
          metadata: { priority: 'high' },
        });

        const planes = yield* service.loadPlanes();
        expect(planes.length).toBe(1);
        expect(planes[0].name).toBe('Main Bus');
        expect(planes[0].portIds).toEqual(['port-a', 'port-b']);
        expect(planes[0].metadata?.priority).toBe('high');
      })
    );
  });

  test('deletePort: removes from database', async () => {
    await runWithService(
      Effect.gen(function* () {
        const service = yield* DataplanePersistenceService;

        yield* service.savePort({
          id: 'port-del' as PortId,
          blockId: 'b1' as BlockId,
          direction: 'out',
          dataType: 'table',
          position: 'right',
        });

        yield* service.deletePort('port-del' as PortId);

        const ports = yield* service.loadPorts();
        expect(ports.length).toBe(0);
      })
    );
  });

  test('clearAll: removes everything', async () => {
    await runWithService(
      Effect.gen(function* () {
        const service = yield* DataplanePersistenceService;

        // Add data
        yield* service.savePort({
          id: 'p1' as PortId,
          blockId: 'b1' as BlockId,
          direction: 'out',
          dataType: 'table',
          position: 'right',
        });
        yield* service.savePlane({
          id: 'plane-1' as PlaneId,
          name: 'Bus',
          portIds: [],
        });

        // Clear
        yield* service.clearAll();

        // Verify empty
        const ports = yield* service.loadPorts();
        const planes = yield* service.loadPlanes();
        expect(ports.length).toBe(0);
        expect(planes.length).toBe(0);
      })
    );
  });
});
