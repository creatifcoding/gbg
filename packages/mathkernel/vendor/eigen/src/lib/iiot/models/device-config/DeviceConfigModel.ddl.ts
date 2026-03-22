/**
 * DeviceConfigModel DDL - Co-located database schema for DeviceConfig entity
 *
 * Includes device_configs table, indexes, and audit trigger.
 * Supports FDA 21 CFR Part 11 compliance with version history.
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Device Configs Table DDL
// =============================================================================

/**
 * Creates the device_configs table in the iiot schema.
 *
 * Columns derived from DeviceConfigModel:
 * - id: TEXT PRIMARY KEY (auto-generated DeviceConfigId, e.g., 'CFG-xxxxx')
 * - target_type: TEXT NOT NULL ('sensor' or 'device')
 * - target_id: TEXT NOT NULL (SensorId or DeviceId)
 * - version: INTEGER NOT NULL (positive, starts at 1)
 * - status: TEXT NOT NULL (draft, active, archived, rejected)
 * - config: JSONB NOT NULL (configuration data)
 * - created_by: TEXT NOT NULL
 * - created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * - ... optional fields for audit trail
 */
export const createDeviceConfigsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.device_configs (
      id                  TEXT PRIMARY KEY DEFAULT 'CFG-' || gen_random_uuid()::TEXT,
      target_type         TEXT NOT NULL CHECK (target_type IN ('sensor', 'device')),
      target_id           TEXT NOT NULL,
      version             INTEGER NOT NULL CHECK (version > 0),
      status              TEXT NOT NULL CHECK (status IN ('draft', 'active', 'archived', 'rejected')),
      config              JSONB NOT NULL DEFAULT '{}',
      sample_rate_ms      INTEGER CHECK (sample_rate_ms IS NULL OR sample_rate_ms > 0),
      thresholds          JSONB,
      created_by          TEXT NOT NULL,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by          TEXT,
      updated_at          TIMESTAMPTZ,
      approved_by         TEXT,
      approved_at         TIMESTAMPTZ,
      change_reason       TEXT,
      previous_version_id TEXT REFERENCES iiot.device_configs(id),

      -- Ensure only one active config per target
      CONSTRAINT unique_active_config UNIQUE (target_type, target_id, status)
        DEFERRABLE INITIALLY DEFERRED
    )
  `

  // Note: The UNIQUE constraint with DEFERRABLE allows atomic activation
  // (archive old + activate new in same transaction)

  // Indexes for common query patterns
  yield* sql`CREATE INDEX IF NOT EXISTS idx_device_configs_target ON iiot.device_configs (target_type, target_id, version DESC)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_device_configs_status ON iiot.device_configs (status, created_at DESC)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_device_configs_active ON iiot.device_configs (target_type, target_id) WHERE status = 'active'`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_device_configs_version_chain ON iiot.device_configs (previous_version_id) WHERE previous_version_id IS NOT NULL`
})

// =============================================================================
// Device Config Audit Log DDL
// =============================================================================

/**
 * Creates the device_config_audit_log table for FDA 21 CFR Part 11 compliance.
 * Records all changes to device configurations.
 */
export const createDeviceConfigAuditLog = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.device_config_audit_log (
      id              TEXT PRIMARY KEY DEFAULT 'AUD-' || gen_random_uuid()::TEXT,
      config_id       TEXT NOT NULL REFERENCES iiot.device_configs(id),
      action          TEXT NOT NULL CHECK (action IN ('created', 'updated', 'activated', 'archived', 'approved', 'rejected')),
      performed_by    TEXT NOT NULL,
      performed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      old_status      TEXT,
      new_status      TEXT,
      change_details  JSONB,
      reason          TEXT
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_device_config_audit_config ON iiot.device_config_audit_log (config_id, performed_at DESC)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_device_config_audit_action ON iiot.device_config_audit_log (action, performed_at DESC)`
})

// =============================================================================
// Device Config Audit Trigger DDL
// =============================================================================

/**
 * Creates a trigger to automatically log changes to device_configs.
 */
export const createDeviceConfigAuditTrigger = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`
    CREATE OR REPLACE FUNCTION iiot.device_config_audit_trigger()
    RETURNS TRIGGER AS $func$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        INSERT INTO iiot.device_config_audit_log (config_id, action, performed_by, new_status, reason)
        VALUES (NEW.id, 'created', NEW.created_by, NEW.status, NEW.change_reason);
      ELSIF TG_OP = 'UPDATE' THEN
        -- Log status changes
        IF OLD.status IS DISTINCT FROM NEW.status THEN
          INSERT INTO iiot.device_config_audit_log (config_id, action, performed_by, old_status, new_status, reason)
          VALUES (
            NEW.id,
            CASE
              WHEN NEW.status = 'active' THEN 'activated'
              WHEN NEW.status = 'archived' THEN 'archived'
              WHEN NEW.status = 'rejected' THEN 'rejected'
              ELSE 'updated'
            END,
            COALESCE(NEW.updated_by, NEW.approved_by, 'system'),
            OLD.status,
            NEW.status,
            NEW.change_reason
          );
        -- Log approval
        ELSIF NEW.approved_by IS NOT NULL AND OLD.approved_by IS NULL THEN
          INSERT INTO iiot.device_config_audit_log (config_id, action, performed_by, new_status)
          VALUES (NEW.id, 'approved', NEW.approved_by, NEW.status);
        -- Log other updates
        ELSIF OLD.config IS DISTINCT FROM NEW.config OR OLD.thresholds IS DISTINCT FROM NEW.thresholds THEN
          INSERT INTO iiot.device_config_audit_log (config_id, action, performed_by, change_details, reason)
          VALUES (
            NEW.id,
            'updated',
            COALESCE(NEW.updated_by, 'system'),
            jsonb_build_object('old_config', OLD.config, 'new_config', NEW.config),
            NEW.change_reason
          );
        END IF;
      END IF;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql
  `)

  yield* sql.unsafe(`
    DROP TRIGGER IF EXISTS device_config_audit ON iiot.device_configs;
    CREATE TRIGGER device_config_audit
    AFTER INSERT OR UPDATE ON iiot.device_configs
    FOR EACH ROW EXECUTE FUNCTION iiot.device_config_audit_trigger()
  `)
})
