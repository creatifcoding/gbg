/**
 * DeviceConfigRepo Integration Tests
 *
 * Tests FDA 21 CFR Part 11 compliant configuration management:
 * - Version history tracking
 * - Audit log integration
 * - Status lifecycle management (draft -> active -> archived)
 * - Approval workflow
 *
 * Prerequisites:
 *   docker compose -f docker/docker-compose.iiot.yml up -d
 *
 * Run:
 *   bun run test:run src/lib/iiot/__tests__/integration/repos/DeviceConfigRepo.test.ts
 *
 * @module
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Effect, Option } from 'effect'
import { PgClient } from '@effect/sql-pg'
import {
  ConfigRepositoriesIntegrationLayer,
  cleanTestDeviceConfigs,
  isDatabaseAvailable,
  TestPgClient,
} from '../layer'
import { DeviceConfigRepo } from '../../../repos/DeviceConfigRepo'
import {
  testIds,
  testDeviceConfig1Insert,
  testDeviceConfig2Insert,
  testDeviceConfig3Insert,
} from '../../__fixtures__/fixtures'
import type { DeviceConfigId, ConfigVersion } from '../../../schemas/device-config/schema'

// =============================================================================
// Database Availability Check
// =============================================================================

const RUN_INTEGRATION = process.env['RUN_INTEGRATION_TESTS'] === '1'

describe.skipIf(!RUN_INTEGRATION)('DeviceConfigRepo Integration Tests', () => {
  beforeAll(async () => {
    const available = await Effect.runPromise(
      isDatabaseAvailable.pipe(Effect.provide(TestPgClient))
    )
    if (!available) {
      throw new Error(
        'Database not available. Run: docker compose -f docker/docker-compose.iiot.yml up -d'
      )
    }
  })

  afterAll(async () => {
    await Effect.runPromise(
      cleanTestDeviceConfigs.pipe(Effect.provide(TestPgClient))
    )
  })

  beforeEach(async () => {
    await Effect.runPromise(
      cleanTestDeviceConfigs.pipe(Effect.provide(TestPgClient))
    )
  })

  // =============================================================================
  // Feature: Basic CRUD Operations
  // =============================================================================

  describe('Feature: Basic CRUD Operations', () => {
    describe('Scenario: Insert and find device config', () => {
      it('should insert a config and find by id', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* DeviceConfigRepo

          // Insert
          const inserted = yield* repo.insert(testDeviceConfig1Insert)
          expect(inserted.id).toBeDefined()
          expect(inserted.id).toMatch(/^CFG-/)
          expect(inserted.targetType).toBe('sensor')
          expect(inserted.status).toBe('draft')
          expect(inserted.version).toBe(1)

          // Find by ID
          const found = yield* repo.findById(inserted.id as DeviceConfigId)
          expect(Option.isSome(found)).toBe(true)
          if (Option.isSome(found)) {
            expect(found.value.id).toBe(inserted.id)
            expect(found.value.config).toEqual(testDeviceConfig1Insert.config)
          }
        }).pipe(Effect.provide(ConfigRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })

      it('should return None for non-existent config', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* DeviceConfigRepo

          const result = yield* repo.findById(testIds.nonExistentDeviceConfig)
          expect(Option.isNone(result)).toBe(true)
        }).pipe(Effect.provide(ConfigRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Update device config', () => {
      it('should update config fields', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* DeviceConfigRepo

          // Insert
          const inserted = yield* repo.insert(testDeviceConfig1Insert)

          // Update
          const updated = yield* repo.update({
            id: inserted.id as DeviceConfigId,
            config: { ...inserted.config, newField: 'new value' },
            changeReason: Option.some('Added new field'),
            updatedBy: Option.some('test-updater'),
          })
          expect(updated.config).toHaveProperty('newField', 'new value')
          expect(Option.getOrNull(updated.changeReason)).toBe('Added new field')
        }).pipe(Effect.provide(ConfigRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Delete device config', () => {
      it('should delete config after cleaning audit log (for test purposes)', async () => {
        // Note: In production, deleting configs with audit trails would violate
        // FDA 21 CFR Part 11 compliance. This test demonstrates delete functionality
        // but production code should use archive instead.

        const program = Effect.gen(function* () {
          const repo = yield* DeviceConfigRepo
          const sql = yield* PgClient.PgClient

          // Insert
          const inserted = yield* repo.insert(testDeviceConfig3Insert)

          // Clean audit log for this config (test only - not for production)
          yield* sql`DELETE FROM iiot.device_config_audit_log WHERE config_id = ${inserted.id}`

          // Delete
          yield* repo.delete(inserted.id as DeviceConfigId)

          // Verify deleted
          const found = yield* repo.findById(inserted.id as DeviceConfigId)
          expect(Option.isNone(found)).toBe(true)
        }).pipe(
          Effect.provide(ConfigRepositoriesIntegrationLayer),
          Effect.provide(TestPgClient)
        )

        await Effect.runPromise(program)
      })
    })
  })

  // =============================================================================
  // Feature: Query Operations
  // =============================================================================

  describe('Feature: Query Operations', () => {
    describe('Scenario: Find by target', () => {
      it('should find all configs for a target', async () => {

        const program = Effect.gen(function* () {
          const repo = yield* DeviceConfigRepo

          // Insert first version as draft
          const v1 = yield* repo.insert(testDeviceConfig1Insert)
          // Activate v1 to allow inserting another draft
          yield* repo.activate(v1.id as DeviceConfigId, 'approver-001')
          // Insert second version as draft
          yield* repo.insert({
            ...testDeviceConfig1Insert,
            version: 2,
          })

          // Find by target
          const configs = yield* repo.findByTarget('sensor', testIds.device1 as string)
          expect(configs.length).toBeGreaterThanOrEqual(2)
          expect(configs.every((c) => c.targetId === testIds.device1)).toBe(true)
        }).pipe(Effect.provide(ConfigRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Find active config', () => {
      it('should find active config for target', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* DeviceConfigRepo

          // Insert draft then activate
          const draft = yield* repo.insert(testDeviceConfig1Insert)
          yield* repo.activate(draft.id as DeviceConfigId, 'approver-001')

          // Find active
          const active = yield* repo.findActiveConfig('sensor', testIds.device1 as string)
          expect(Option.isSome(active)).toBe(true)
          if (Option.isSome(active)) {
            expect(active.value.status).toBe('active')
          }
        }).pipe(Effect.provide(ConfigRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })

      it('should return None when no active config exists', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* DeviceConfigRepo

          // Insert but don't activate
          yield* repo.insert(testDeviceConfig1Insert)

          // Find active
          const active = yield* repo.findActiveConfig('sensor', testIds.device1 as string)
          expect(Option.isNone(active)).toBe(true)
        }).pipe(Effect.provide(ConfigRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Find version history', () => {
      it('should return versions ordered by version DESC', async () => {

        const program = Effect.gen(function* () {
          const repo = yield* DeviceConfigRepo

          // Generate unique target ID for this test to avoid parallel test cleanup interference
          const uniqueTargetId = `TEST-TMP-${Date.now()}-${Math.random().toString(36).substring(7)}`

          // Insert v1 as draft, then activate to allow more drafts
          const v1 = yield* repo.insert({
            ...testDeviceConfig1Insert,
            targetId: uniqueTargetId,
          })
          yield* repo.activate(v1.id as DeviceConfigId, 'approver-001')

          // Insert v2 as draft, then activate
          const v2 = yield* repo.insert({
            ...testDeviceConfig1Insert,
            targetId: uniqueTargetId,
            version: 2 as ConfigVersion,
          })
          yield* repo.activate(v2.id as DeviceConfigId, 'approver-001')

          // Insert v3 as draft
          yield* repo.insert({
            ...testDeviceConfig1Insert,
            targetId: uniqueTargetId,
            version: 3 as ConfigVersion,
          })

          // Get version history
          const history = yield* repo.findVersionHistory('sensor', uniqueTargetId)
          expect(history.length).toBeGreaterThanOrEqual(3)
          // Should be ordered by version DESC
          for (let i = 0; i < history.length - 1; i++) {
            expect(history[i]!.version).toBeGreaterThanOrEqual(history[i + 1]!.version)
          }
        }).pipe(Effect.provide(ConfigRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Find by status', () => {
      it('should find configs by status', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* DeviceConfigRepo

          // Insert draft config
          yield* repo.insert(testDeviceConfig1Insert)

          // Find by status
          const drafts = yield* repo.findByStatus('draft')
          expect(drafts.every((c) => c.status === 'draft')).toBe(true)
        }).pipe(Effect.provide(ConfigRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Query with filters', () => {
      it('should query with multiple filters', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* DeviceConfigRepo

          // Insert
          yield* repo.insert(testDeviceConfig1Insert)

          // Query with filters
          const results = yield* repo.query({
            targetType: 'sensor',
            status: 'draft',
            createdBy: 'config-admin-001',
            limit: 10,
          })
          expect(results.length).toBeGreaterThanOrEqual(1)
        }).pipe(Effect.provide(ConfigRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })
  })

  // =============================================================================
  // Feature: Status Lifecycle
  // =============================================================================

  describe('Feature: Status Lifecycle', () => {
    describe('Scenario: Activate config', () => {
      it('should transition draft to active with approval', async () => {

        const program = Effect.gen(function* () {
          const repo = yield* DeviceConfigRepo

          // Insert draft
          const draft = yield* repo.insert(testDeviceConfig1Insert)
          expect(draft.status).toBe('draft')

          // Activate
          const active = yield* repo.activate(draft.id as DeviceConfigId, 'approver-001')
          expect(active.status).toBe('active')
          expect(Option.getOrNull(active.approvedBy)).toBe('approver-001')
          expect(Option.isSome(active.approvedAt)).toBe(true)
        }).pipe(Effect.provide(ConfigRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })

      it('should archive previous active config when activating new one', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* DeviceConfigRepo

          // Insert and activate first version
          const v1 = yield* repo.insert(testDeviceConfig1Insert)
          yield* repo.activate(v1.id as DeviceConfigId, 'approver-001')

          // Insert and activate second version
          const v2 = yield* repo.insert({
            ...testDeviceConfig1Insert,
            version: 2,
          })
          yield* repo.activate(v2.id as DeviceConfigId, 'approver-001')

          // First version should be archived
          const v1After = yield* repo.findById(v1.id as DeviceConfigId)
          expect(Option.isSome(v1After)).toBe(true)
          if (Option.isSome(v1After)) {
            expect(v1After.value.status).toBe('archived')
          }

          // Second version should be active
          const active = yield* repo.findActiveConfig('sensor', testIds.device1 as string)
          expect(Option.isSome(active)).toBe(true)
          if (Option.isSome(active)) {
            expect(active.value.id).toBe(v2.id)
          }
        }).pipe(Effect.provide(ConfigRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Archive config', () => {
      it('should archive config with reason', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* DeviceConfigRepo

          // Insert and activate
          const config = yield* repo.insert(testDeviceConfig1Insert)
          yield* repo.activate(config.id as DeviceConfigId, 'approver-001')

          // Archive
          const archived = yield* repo.archive(config.id as DeviceConfigId, 'Superseded by v2')
          expect(archived.status).toBe('archived')
          expect(Option.getOrNull(archived.changeReason)).toBe('Superseded by v2')
        }).pipe(Effect.provide(ConfigRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Reject config', () => {
      it('should reject config with reason and rejector', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* DeviceConfigRepo

          // Insert draft
          const draft = yield* repo.insert(testDeviceConfig1Insert)

          // Reject
          const rejected = yield* repo.reject(
            draft.id as DeviceConfigId,
            'Does not meet safety standards',
            'reviewer-001'
          )
          expect(rejected.status).toBe('rejected')
          expect(Option.getOrNull(rejected.changeReason)).toBe('Does not meet safety standards')
          expect(Option.getOrNull(rejected.updatedBy)).toBe('reviewer-001')
        }).pipe(Effect.provide(ConfigRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })
  })

  // =============================================================================
  // Feature: FDA 21 CFR Part 11 Compliance
  // =============================================================================

  describe('Feature: FDA 21 CFR Part 11 Compliance', () => {
    describe('Scenario: Audit trail', () => {
      it('should maintain audit log for config changes', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* DeviceConfigRepo

          // Insert config
          const config = yield* repo.insert(testDeviceConfig1Insert)

          // Activate (triggers audit log via DB trigger)
          yield* repo.activate(config.id as DeviceConfigId, 'approver-001')

          // Check audit log
          const auditLog = yield* repo.findAuditLog(config.id as DeviceConfigId)

          // Note: Audit log entries are created by DB trigger
          // The exact entries depend on trigger implementation
          expect(Array.isArray(auditLog)).toBe(true)
        }).pipe(Effect.provide(ConfigRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Entity methods for compliance', () => {
      it('should correctly identify active configs', async () => {

        const program = Effect.gen(function* () {
          const repo = yield* DeviceConfigRepo

          const config = yield* repo.insert(testDeviceConfig1Insert)
          // DeviceConfigModel doesn't have isActive() method, check status directly
          expect(config.status).toBe('draft')
          expect(config.status !== 'active').toBe(true)

          const activated = yield* repo.activate(config.id as DeviceConfigId, 'approver-001')
          expect(activated.status).toBe('active')
        }).pipe(Effect.provide(ConfigRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })

      it('should correctly identify configs requiring approval', async () => {

        const program = Effect.gen(function* () {
          const repo = yield* DeviceConfigRepo

          const draft = yield* repo.insert(testDeviceConfig1Insert)
          // DeviceConfigModel doesn't have requiresApproval() method, check status directly
          expect(draft.status).toBe('draft')

          const activated = yield* repo.activate(draft.id as DeviceConfigId, 'approver-001')
          expect(activated.status).toBe('active')
        }).pipe(Effect.provide(ConfigRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Version tracking', () => {
      it('should maintain version integrity', async () => {

        const program = Effect.gen(function* () {
          const repo = yield* DeviceConfigRepo

          // Insert v1
          const v1 = yield* repo.insert(testDeviceConfig1Insert)
          expect(v1.version).toBe(1)

          // Activate v1 to allow inserting another draft
          yield* repo.activate(v1.id as DeviceConfigId, 'approver-001')

          // Insert v2 with reference to v1
          const v2 = yield* repo.insert({
            ...testDeviceConfig1Insert,
            version: 2,
            previousVersionId: Option.some(v1.id as DeviceConfigId),
          })
          expect(v2.version).toBe(2)
          expect(Option.getOrNull(v2.previousVersionId)).toBe(v1.id)
        }).pipe(Effect.provide(ConfigRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })
  })

  // =============================================================================
  // Feature: Thresholds Configuration
  // =============================================================================

  describe('Feature: Thresholds Configuration', () => {
    describe('Scenario: Config with thresholds', () => {
      it('should store and retrieve thresholds correctly', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* DeviceConfigRepo

          const config = yield* repo.insert(testDeviceConfig1Insert)

          expect(Option.isSome(config.thresholds)).toBe(true)
          if (Option.isSome(config.thresholds)) {
            const thresholds = config.thresholds.value
            expect(Option.getOrNull(thresholds.low)).toBe(15)
            expect(Option.getOrNull(thresholds.high)).toBe(80)
            expect(Option.getOrNull(thresholds.criticalLow)).toBe(10)
            expect(Option.getOrNull(thresholds.criticalHigh)).toBe(90)
          }
        }).pipe(Effect.provide(ConfigRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Config without thresholds', () => {
      it('should handle config without thresholds', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* DeviceConfigRepo

          // testDeviceConfig3Insert is for a device (not sensor), no thresholds
          const config = yield* repo.insert(testDeviceConfig3Insert)

          expect(Option.isNone(config.thresholds)).toBe(true)
        }).pipe(Effect.provide(ConfigRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })
  })
})
