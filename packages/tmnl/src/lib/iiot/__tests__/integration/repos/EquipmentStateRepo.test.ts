/**
 * EquipmentStateRepo Integration Tests
 *
 * Tests OEE equipment state CRUD operations and OEE classification.
 *
 * Prerequisites:
 *   docker compose -f docker/docker-compose.iiot.yml up -d
 *
 * Run:
 *   bun run test:run src/lib/iiot/__tests__/integration/repos/EquipmentStateRepo.test.ts
 *
 * @module
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Effect, Option, Layer } from 'effect'
import {
  EquipmentStateRepositoriesIntegrationLayer,
  AssetRepositoriesIntegrationLayer,
  cleanTestEquipmentStates,
  cleanTestAssets,
  isDatabaseAvailable,
  TestPgClient,
  setupTestHierarchy,
} from '../layer'
import { EquipmentStateRepo } from '../../../repos/EquipmentStateRepo'
import { MachineRepo } from '../../../repos/MachineRepo'
import { LineRepo } from '../../../repos/LineRepo'
import { PlantRepo } from '../../../repos/PlantRepo'
import {
  testIds,
  testEquipmentState1Insert,
  testEquipmentState2Insert,
  testEquipmentStatePlannedDowntimeInsert,
  testEquipmentStateUnplannedDowntimeInsert,
  testEquipmentStateSetupInsert,
  testEquipmentStateBlockedInsert,
  testPlant1Insert,
  testLine1Insert,
  testMachine1Insert,
  testMachine2Insert,
} from '../../__fixtures__/fixtures'
import type { EquipmentStateId } from '../../../schemas/equipment-state/schema'

// =============================================================================
// Combined Test Layer
// =============================================================================

const TestLayer = Layer.mergeAll(
  EquipmentStateRepositoriesIntegrationLayer,
  AssetRepositoriesIntegrationLayer
)

// =============================================================================
// Database Availability Check
// =============================================================================

const RUN_INTEGRATION = process.env['RUN_INTEGRATION_TESTS'] === '1'

describe.skipIf(!RUN_INTEGRATION)('EquipmentStateRepo Integration Tests', () => {
  beforeAll(async () => {
    const available = await Effect.runPromise(
      isDatabaseAvailable.pipe(Effect.provide(TestPgClient))
    )
    if (!available) {
      throw new Error(
        'Database not available. Run: docker compose -f docker/docker-compose.iiot.yml up -d'
      )
    }

    // Set up asset hierarchy for FK constraints
    const setup = Effect.gen(function* () {
      const plantRepo = yield* PlantRepo
      const lineRepo = yield* LineRepo
      const machineRepo = yield* MachineRepo

      // Clean first (deletes all TEST-* data including hierarchy)
      yield* cleanTestEquipmentStates
      yield* cleanTestAssets

      // Set up Enterprise + Site + Area for FK constraints (after clean!)
      yield* setupTestHierarchy

      // Insert asset hierarchy
      yield* plantRepo.insert(testPlant1Insert)
      yield* lineRepo.insert(testLine1Insert)
      yield* machineRepo.insert(testMachine1Insert)
      yield* machineRepo.insert(testMachine2Insert)
    }).pipe(Effect.provide(TestLayer))

    await Effect.runPromise(setup)
  })

  afterAll(async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* cleanTestEquipmentStates
        yield* cleanTestAssets
      }).pipe(Effect.provide(TestPgClient))
    )
  })

  beforeEach(async () => {
    await Effect.runPromise(
      cleanTestEquipmentStates.pipe(Effect.provide(TestPgClient))
    )
  })

  // =============================================================================
  // Feature: Basic CRUD Operations
  // =============================================================================

  describe('Feature: Basic CRUD Operations', () => {
    describe('Scenario: Insert and find equipment state', () => {
      it('should insert an equipment state and find by id', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* EquipmentStateRepo

          // Insert
          const inserted = yield* repo.insert(testEquipmentState1Insert)
          // Model.Class doesn't provide _tag like Schema.TaggedClass
          // Verify DB-level fields instead
          expect(inserted.state).toBe('running')
          expect(inserted.machineId).toBe(testIds.machine1)
          expect(Option.getOrNull(inserted.reason)).toBe('production')

          // Find by ID
          const found = yield* repo.findById(inserted.id as EquipmentStateId)
          expect(Option.isSome(found)).toBe(true)
          if (Option.isSome(found)) {
            expect(found.value.id).toBe(inserted.id)
            expect(found.value.state).toBe('running')
          }
        }).pipe(Effect.provide(TestLayer))

        await Effect.runPromise(program)
      })

      it('should return None for non-existent equipment state', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* EquipmentStateRepo

          const result = yield* repo.findById(testIds.nonExistentEquipmentState)
          expect(Option.isNone(result)).toBe(true)
        }).pipe(Effect.provide(TestLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Update equipment state', () => {
      it('should update equipment state fields', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* EquipmentStateRepo

          // Insert
          const inserted = yield* repo.insert(testEquipmentState1Insert)

          // Update
          const updated = yield* repo.update({
            id: inserted.id as EquipmentStateId,
            notes: Option.some('Updated notes'),
            operatorId: Option.some('operator-999'),
          })
          expect(Option.getOrNull(updated.notes)).toBe('Updated notes')
          expect(Option.getOrNull(updated.operatorId)).toBe('operator-999')
        }).pipe(Effect.provide(TestLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Delete equipment state', () => {
      it('should delete equipment state', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* EquipmentStateRepo

          // Insert
          const inserted = yield* repo.insert(testEquipmentState2Insert)

          // Delete
          yield* repo.delete(inserted.id as EquipmentStateId)

          // Verify deleted
          const found = yield* repo.findById(inserted.id as EquipmentStateId)
          expect(Option.isNone(found)).toBe(true)
        }).pipe(Effect.provide(TestLayer))

        await Effect.runPromise(program)
      })
    })
  })

  // =============================================================================
  // Feature: Query Operations
  // =============================================================================

  describe('Feature: Query Operations', () => {
    describe('Scenario: Find by machine', () => {
      it('should find all states for a machine', async () => {

        const program = Effect.gen(function* () {
          const repo = yield* EquipmentStateRepo

          // Insert multiple states for same machine and track their IDs
          const state1 = yield* repo.insert(testEquipmentState1Insert)
          const state2 = yield* repo.insert(testEquipmentState2Insert)
          const insertedIds = new Set([state1.id, state2.id])

          // Find by machine
          const states = yield* repo.findByMachine(testIds.machine1)

          // Verify our inserted states are found
          const foundIds = new Set(states.map((s) => s.id))
          expect(insertedIds.size).toBe(2)
          for (const id of insertedIds) {
            expect(foundIds.has(id)).toBe(true)
          }
          expect(states.every((s) => s.machineId === testIds.machine1)).toBe(true)
        }).pipe(Effect.provide(TestLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Find active states', () => {
      it('should find only states without ended_at', async () => {

        const program = Effect.gen(function* () {
          const repo = yield* EquipmentStateRepo

          // Insert active state
          const active = yield* repo.insert(testEquipmentState1Insert)
          expect(active.isActive()).toBe(true)

          // End the state
          yield* repo.endState(active.id as EquipmentStateId, new Date())

          // Find active (should not include ended state)
          const activeStates = yield* repo.findActive()
          expect(activeStates.every((s) => Option.isNone(s.endedAt))).toBe(true)
        }).pipe(Effect.provide(TestLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Find by state type', () => {
      it('should find states by state type', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* EquipmentStateRepo

          // Insert different state types
          yield* repo.insert(testEquipmentState1Insert) // running
          yield* repo.insert(testEquipmentStateSetupInsert) // setup

          // Find by state
          const running = yield* repo.findByState('running')
          expect(running.every((s) => s.state === 'running')).toBe(true)

          const setup = yield* repo.findByState('setup')
          expect(setup.every((s) => s.state === 'setup')).toBe(true)
        }).pipe(Effect.provide(TestLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Query with filters', () => {
      it('should query with multiple filters', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* EquipmentStateRepo

          // Insert
          yield* repo.insert(testEquipmentState1Insert)

          // Query with filters
          const results = yield* repo.query({
            machineId: testIds.machine1,
            state: 'running',
            onlyActive: true,
            limit: 10,
          })
          expect(results.length).toBeGreaterThanOrEqual(1)
          expect(results.every((s) => s.machineId === testIds.machine1)).toBe(true)
          expect(results.every((s) => s.state === 'running')).toBe(true)
        }).pipe(Effect.provide(TestLayer))

        await Effect.runPromise(program)
      })
    })
  })

  // =============================================================================
  // Feature: End State Operation
  // =============================================================================

  describe('Feature: End State Operation', () => {
    describe('Scenario: End an active state', () => {
      it('should set ended_at timestamp', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* EquipmentStateRepo

          // Insert active state
          const state = yield* repo.insert(testEquipmentState1Insert)
          expect(state.isActive()).toBe(true)
          expect(Option.isNone(state.endedAt)).toBe(true)

          // End the state
          const endTime = new Date()
          const ended = yield* repo.endState(state.id as EquipmentStateId, endTime)
          expect(ended.isActive()).toBe(false)
          expect(Option.isSome(ended.endedAt)).toBe(true)
        }).pipe(Effect.provide(TestLayer))

        await Effect.runPromise(program)
      })

      it('should be idempotent for already ended state', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* EquipmentStateRepo

          // Insert and end
          const state = yield* repo.insert(testEquipmentState1Insert)
          const ended1 = yield* repo.endState(state.id as EquipmentStateId, new Date())

          // End again (idempotent)
          const ended2 = yield* repo.endState(ended1.id as EquipmentStateId, new Date())
          expect(ended2.id).toBe(ended1.id)
          expect(ended2.isActive()).toBe(false)
        }).pipe(Effect.provide(TestLayer))

        await Effect.runPromise(program)
      })
    })
  })

  // =============================================================================
  // Feature: OEE Classification
  // =============================================================================

  describe('Feature: OEE Classification', () => {
    describe('Scenario: Productive state classification', () => {
      it('should classify running state as productive', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* EquipmentStateRepo

          const state = yield* repo.insert(testEquipmentState1Insert)
          expect(state.state).toBe('running')
          expect(state.isProductive()).toBe(true)
          expect(state.isAvailabilityLoss()).toBe(false)
          expect(state.isPerformanceLoss()).toBe(false)
          expect(state.getOeeCategory()).toBe('productive')
        }).pipe(Effect.provide(TestLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Availability loss classification', () => {
      it('should classify planned downtime as availability loss', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* EquipmentStateRepo

          const state = yield* repo.insert(testEquipmentStatePlannedDowntimeInsert)
          expect(state.state).toBe('planned_downtime')
          expect(state.isProductive()).toBe(false)
          expect(state.isAvailabilityLoss()).toBe(true)
          expect(state.isPerformanceLoss()).toBe(false)
          expect(state.getOeeCategory()).toBe('availability_loss')
        }).pipe(Effect.provide(TestLayer))

        await Effect.runPromise(program)
      })

      it('should classify unplanned downtime as availability loss', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* EquipmentStateRepo

          const state = yield* repo.insert(testEquipmentStateUnplannedDowntimeInsert)
          expect(state.state).toBe('unplanned_downtime')
          expect(state.isAvailabilityLoss()).toBe(true)
          expect(state.getOeeCategory()).toBe('availability_loss')
        }).pipe(Effect.provide(TestLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Performance loss classification', () => {
      it('should classify idle state as performance loss', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* EquipmentStateRepo

          const state = yield* repo.insert(testEquipmentState2Insert)
          expect(state.state).toBe('idle')
          expect(state.isProductive()).toBe(false)
          expect(state.isAvailabilityLoss()).toBe(false)
          expect(state.isPerformanceLoss()).toBe(true)
          expect(state.getOeeCategory()).toBe('performance_loss')
        }).pipe(Effect.provide(TestLayer))

        await Effect.runPromise(program)
      })

      it('should classify setup state as performance loss', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* EquipmentStateRepo

          const state = yield* repo.insert(testEquipmentStateSetupInsert)
          expect(state.state).toBe('setup')
          expect(state.isPerformanceLoss()).toBe(true)
          expect(state.getOeeCategory()).toBe('performance_loss')
        }).pipe(Effect.provide(TestLayer))

        await Effect.runPromise(program)
      })

      it('should classify blocked state as performance loss', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* EquipmentStateRepo

          const state = yield* repo.insert(testEquipmentStateBlockedInsert)
          expect(state.state).toBe('blocked')
          expect(state.isPerformanceLoss()).toBe(true)
          expect(state.getOeeCategory()).toBe('performance_loss')
        }).pipe(Effect.provide(TestLayer))

        await Effect.runPromise(program)
      })
    })
  })
})
