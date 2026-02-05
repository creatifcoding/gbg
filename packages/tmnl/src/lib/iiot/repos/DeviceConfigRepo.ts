/**
 * DeviceConfigRepo - Repository for DeviceConfig Entity
 *
 * FDA 21 CFR Part 11 compliant configuration management with:
 * - Version history tracking
 * - Audit log integration (automatic via DB trigger)
 * - Status lifecycle management (draft -> active -> archived)
 * - Approval workflow support
 *
 * Audit logging is automatic via iiot.device_config_audit_trigger() on INSERT/UPDATE.
 * This repo exposes findAuditLog() for compliance reporting.
 *
 * @module
 */

import { Schema, Context, Layer, Effect, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { DeviceConfigId, ConfigStatus } from '../schemas/device-config/schema'
import { DeviceConfigModel } from '../models/device-config/DeviceConfigModel'
import { decodeOptional, decodeRows, decodeFirst, prepareUpdate } from './_decode'

// =============================================================================
// Error Types
// =============================================================================

export type DeviceConfigRepoError = SqlError.SqlError | ParseResult.ParseError

// =============================================================================
// Audit Log Entry Schema
// =============================================================================

/**
 * Schema for audit log entries returned by findAuditLog()
 */
export class AuditLogEntry extends Schema.Class<AuditLogEntry>('AuditLogEntry')({
  id: Schema.String,
  configId: Schema.String,
  action: Schema.Literal('created', 'updated', 'activated', 'archived', 'approved', 'rejected'),
  performedBy: Schema.String,
  performedAt: Schema.DateFromSelf,
  oldStatus: Schema.OptionFromNullOr(Schema.String),
  newStatus: Schema.OptionFromNullOr(Schema.String),
  changeDetails: Schema.OptionFromNullOr(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  reason: Schema.OptionFromNullOr(Schema.String),
}) {}

// =============================================================================
// Repository Interface
// =============================================================================

export interface DeviceConfigRepository {
  /** Find config by ID */
  readonly findById: (id: DeviceConfigId) => Effect.Effect<Option.Option<DeviceConfigModel>, DeviceConfigRepoError>

  /** Find all configs for a target (all versions) */
  readonly findByTarget: (
    targetType: 'sensor' | 'device',
    targetId: string
  ) => Effect.Effect<readonly DeviceConfigModel[], DeviceConfigRepoError>

  /** Find the active config for a target (status = 'active') */
  readonly findActiveConfig: (
    targetType: 'sensor' | 'device',
    targetId: string
  ) => Effect.Effect<Option.Option<DeviceConfigModel>, DeviceConfigRepoError>

  /** Find version history for a target (ordered by version DESC) */
  readonly findVersionHistory: (
    targetType: 'sensor' | 'device',
    targetId: string
  ) => Effect.Effect<readonly DeviceConfigModel[], DeviceConfigRepoError>

  /** Find all configs with a given status */
  readonly findByStatus: (
    status: Schema.Schema.Type<typeof ConfigStatus>
  ) => Effect.Effect<readonly DeviceConfigModel[], DeviceConfigRepoError>

  /** Find all configs */
  readonly findAll: () => Effect.Effect<readonly DeviceConfigModel[], DeviceConfigRepoError>

  /** Query configs with filters */
  readonly query: (params: {
    targetType?: 'sensor' | 'device'
    targetId?: string
    status?: Schema.Schema.Type<typeof ConfigStatus>
    createdBy?: string
    since?: Date
    limit?: number
  }) => Effect.Effect<readonly DeviceConfigModel[], DeviceConfigRepoError>

  /** Insert a new config (starts as draft, version 1) */
  readonly insert: (config: typeof DeviceConfigModel.insert.Type) => Effect.Effect<DeviceConfigModel, DeviceConfigRepoError>

  /** Update an existing config */
  readonly update: (
    config: Partial<typeof DeviceConfigModel.update.Type> & { id: typeof DeviceConfigModel.update.Type['id'] }
  ) => Effect.Effect<DeviceConfigModel, DeviceConfigRepoError>

  /** Activate a config (set status='active', archive previous active) */
  readonly activate: (id: DeviceConfigId, approvedBy: string) => Effect.Effect<DeviceConfigModel, DeviceConfigRepoError>

  /** Archive a config (set status='archived') */
  readonly archive: (id: DeviceConfigId, reason: string) => Effect.Effect<DeviceConfigModel, DeviceConfigRepoError>

  /** Reject a config (set status='rejected') */
  readonly reject: (
    id: DeviceConfigId,
    reason: string,
    rejectedBy: string
  ) => Effect.Effect<DeviceConfigModel, DeviceConfigRepoError>

  /** Delete a config */
  readonly delete: (id: DeviceConfigId) => Effect.Effect<void, SqlError.SqlError>

  /** Find audit log entries for a config (FDA compliance) */
  readonly findAuditLog: (configId: DeviceConfigId) => Effect.Effect<readonly AuditLogEntry[], DeviceConfigRepoError>
}

// =============================================================================
// Repository Tag
// =============================================================================

export class DeviceConfigRepo extends Context.Tag('iiot/DeviceConfigRepo')<
  DeviceConfigRepo,
  DeviceConfigRepository
>() {}

// =============================================================================
// Column Mapping Helper
// =============================================================================

/** SELECT clause with snake_case -> camelCase mapping */
const SELECT_COLUMNS = `
  id,
  target_type AS "targetType",
  target_id AS "targetId",
  version,
  status,
  config,
  sample_rate_ms AS "sampleRateMs",
  thresholds,
  created_by AS "createdBy",
  created_at AS "createdAt",
  updated_by AS "updatedBy",
  updated_at AS "updatedAt",
  approved_by AS "approvedBy",
  approved_at AS "approvedAt",
  change_reason AS "changeReason",
  previous_version_id AS "previousVersionId"
`

// =============================================================================
// Repository Implementation
// =============================================================================

export const DeviceConfigRepoLive = Layer.effect(
  DeviceConfigRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const findById = (id: DeviceConfigId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${sql.unsafe(SELECT_COLUMNS)}
          FROM iiot.device_configs
          WHERE id = ${id}
          LIMIT 1
        `
        return yield* decodeOptional(DeviceConfigModel)(rows)
      })

    const findByTarget = (targetType: 'sensor' | 'device', targetId: string) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${sql.unsafe(SELECT_COLUMNS)}
          FROM iiot.device_configs
          WHERE target_type = ${targetType}
            AND target_id = ${targetId}
          ORDER BY version DESC
        `
        return yield* decodeRows(DeviceConfigModel)(rows)
      })

    const findActiveConfig = (targetType: 'sensor' | 'device', targetId: string) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${sql.unsafe(SELECT_COLUMNS)}
          FROM iiot.device_configs
          WHERE target_type = ${targetType}
            AND target_id = ${targetId}
            AND status = 'active'
          LIMIT 1
        `
        return yield* decodeOptional(DeviceConfigModel)(rows)
      })

    const findVersionHistory = (targetType: 'sensor' | 'device', targetId: string) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${sql.unsafe(SELECT_COLUMNS)}
          FROM iiot.device_configs
          WHERE target_type = ${targetType}
            AND target_id = ${targetId}
          ORDER BY version DESC
        `
        return yield* decodeRows(DeviceConfigModel)(rows)
      })

    const findByStatus = (status: Schema.Schema.Type<typeof ConfigStatus>) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${sql.unsafe(SELECT_COLUMNS)}
          FROM iiot.device_configs
          WHERE status = ${status}
          ORDER BY created_at DESC
        `
        return yield* decodeRows(DeviceConfigModel)(rows)
      })

    const findAll = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${sql.unsafe(SELECT_COLUMNS)}
          FROM iiot.device_configs
          ORDER BY created_at DESC
        `
        return yield* decodeRows(DeviceConfigModel)(rows)
      })

    const query = (params: {
      targetType?: 'sensor' | 'device'
      targetId?: string
      status?: Schema.Schema.Type<typeof ConfigStatus>
      createdBy?: string
      since?: Date
      limit?: number
    }) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${sql.unsafe(SELECT_COLUMNS)}
          FROM iiot.device_configs
          WHERE 1=1
            AND (${params.targetType ?? null}::text IS NULL OR target_type = ${params.targetType ?? null})
            AND (${params.targetId ?? null}::text IS NULL OR target_id = ${params.targetId ?? null})
            AND (${params.status ?? null}::text IS NULL OR status = ${params.status ?? null})
            AND (${params.createdBy ?? null}::text IS NULL OR created_by = ${params.createdBy ?? null})
            AND (${params.since ?? null}::timestamp IS NULL OR created_at >= ${params.since ?? null})
          ORDER BY created_at DESC
          LIMIT ${params.limit ?? 1000}
        `
        return yield* decodeRows(DeviceConfigModel)(rows)
      })

    const insert = (config: typeof DeviceConfigModel.insert.Type) =>
      Effect.gen(function* () {
        // Extract Option values for nullable fields
        const sampleRateMsValue = Option.getOrNull(config.sampleRateMs)
        const thresholdsValue = Option.getOrNull(config.thresholds)
        const updatedByValue = Option.getOrNull(config.updatedBy)
        const updatedAtValue = Option.getOrNull(config.updatedAt)
        const approvedByValue = Option.getOrNull(config.approvedBy)
        const approvedAtValue = Option.getOrNull(config.approvedAt)
        const changeReasonValue = Option.getOrNull(config.changeReason)
        const previousVersionIdValue = Option.getOrNull(config.previousVersionId)

        const rows = yield* sql`
          INSERT INTO iiot.device_configs (
            target_type,
            target_id,
            version,
            status,
            config,
            sample_rate_ms,
            thresholds,
            created_by,
            updated_by,
            updated_at,
            approved_by,
            approved_at,
            change_reason,
            previous_version_id
          )
          VALUES (
            ${config.targetType},
            ${config.targetId},
            ${config.version},
            ${config.status},
            ${config.config},
            ${sampleRateMsValue},
            ${thresholdsValue},
            ${config.createdBy},
            ${updatedByValue},
            ${updatedAtValue},
            ${approvedByValue},
            ${approvedAtValue},
            ${changeReasonValue},
            ${previousVersionIdValue}
          )
          RETURNING ${sql.unsafe(SELECT_COLUMNS)}
        `
        return yield* decodeFirst(DeviceConfigModel)(rows)
      })

    const update = (
      config: Partial<typeof DeviceConfigModel.update.Type> & { id: typeof DeviceConfigModel.update.Type['id'] }
    ) =>
      Effect.gen(function* () {
        // Prepare update object (handles Option -> null/value conversion)
        const changes = prepareUpdate(config)

        // Map camelCase to snake_case for SQL
        const snakeCaseChanges: Record<string, unknown> = {}
        const camelToSnake: Record<string, string> = {
          id: 'id',
          targetType: 'target_type',
          targetId: 'target_id',
          version: 'version',
          status: 'status',
          config: 'config',
          sampleRateMs: 'sample_rate_ms',
          thresholds: 'thresholds',
          createdBy: 'created_by',
          createdAt: 'created_at',
          updatedBy: 'updated_by',
          updatedAt: 'updated_at',
          approvedBy: 'approved_by',
          approvedAt: 'approved_at',
          changeReason: 'change_reason',
          previousVersionId: 'previous_version_id',
        }

        for (const [key, value] of Object.entries(changes)) {
          const snakeKey = camelToSnake[key] ?? key
          snakeCaseChanges[snakeKey] = value
        }

        const rows = yield* sql`
          UPDATE iiot.device_configs
          SET ${sql.update(snakeCaseChanges, ['id'])}
          WHERE id = ${config.id}
          RETURNING ${sql.unsafe(SELECT_COLUMNS)}
        `
        return yield* decodeFirst(DeviceConfigModel)(rows)
      })

    const activate = (id: DeviceConfigId, approvedBy: string) =>
      Effect.gen(function* () {
        // First, get the config to find target info
        const configOpt = yield* findById(id)

        return yield* Option.match(configOpt, {
          onNone: () => Effect.fail(new SqlError.SqlError({ message: `Config not found: ${id}` })),
          onSome: (config) =>
            Effect.gen(function* () {
              // Archive any currently active config for this target (in same transaction)
              yield* sql`
                UPDATE iiot.device_configs
                SET status = 'archived',
                    updated_at = NOW(),
                    updated_by = ${approvedBy},
                    change_reason = 'Superseded by version activation'
                WHERE target_type = ${config.targetType}
                  AND target_id = ${config.targetId}
                  AND status = 'active'
                  AND id != ${id}
              `

              // Activate the requested config
              const rows = yield* sql`
                UPDATE iiot.device_configs
                SET status = 'active',
                    approved_by = ${approvedBy},
                    approved_at = NOW(),
                    updated_at = NOW()
                WHERE id = ${id}
                RETURNING ${sql.unsafe(SELECT_COLUMNS)}
              `
              return yield* decodeFirst(DeviceConfigModel)(rows)
            }),
        })
      })

    const archive = (id: DeviceConfigId, reason: string) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          UPDATE iiot.device_configs
          SET status = 'archived',
              change_reason = ${reason},
              updated_at = NOW()
          WHERE id = ${id}
          RETURNING ${sql.unsafe(SELECT_COLUMNS)}
        `

        if (rows.length === 0) {
          return yield* Effect.fail(new SqlError.SqlError({ message: `Config not found: ${id}` }))
        }

        return yield* decodeFirst(DeviceConfigModel)(rows)
      })

    const reject = (id: DeviceConfigId, reason: string, rejectedBy: string) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          UPDATE iiot.device_configs
          SET status = 'rejected',
              change_reason = ${reason},
              updated_by = ${rejectedBy},
              updated_at = NOW()
          WHERE id = ${id}
          RETURNING ${sql.unsafe(SELECT_COLUMNS)}
        `

        if (rows.length === 0) {
          return yield* Effect.fail(new SqlError.SqlError({ message: `Config not found: ${id}` }))
        }

        return yield* decodeFirst(DeviceConfigModel)(rows)
      })

    const del = (id: DeviceConfigId) =>
      sql`DELETE FROM iiot.device_configs WHERE id = ${id}`.pipe(Effect.asVoid)

    const findAuditLog = (configId: DeviceConfigId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            id,
            config_id AS "configId",
            action,
            performed_by AS "performedBy",
            performed_at AS "performedAt",
            old_status AS "oldStatus",
            new_status AS "newStatus",
            change_details AS "changeDetails",
            reason
          FROM iiot.device_config_audit_log
          WHERE config_id = ${configId}
          ORDER BY performed_at DESC
        `
        return yield* decodeRows(AuditLogEntry)(rows)
      })

    return {
      findById,
      findByTarget,
      findActiveConfig,
      findVersionHistory,
      findByStatus,
      findAll,
      query,
      insert,
      update,
      activate,
      archive,
      reject,
      delete: del,
      findAuditLog,
    } satisfies DeviceConfigRepository
  })
)
