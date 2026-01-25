/**
 * AlarmModel DDL - Co-located database schema for Alarm entity
 *
 * Includes alarm table, indexes, and graph sync trigger.
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Alarms Table DDL
// =============================================================================

/**
 * Creates the alarms table in the iiot schema.
 *
 * Columns derived from AlarmModel:
 * - id: TEXT PRIMARY KEY (auto-generated AlarmId, e.g., 'ALM-xxxxx')
 * - device_id: TEXT NOT NULL (FK to sensors)
 * - alarm_type: TEXT NOT NULL
 * - severity: TEXT NOT NULL (info, warning, critical, emergency)
 * - message: TEXT (nullable)
 * - triggered_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * - acknowledged_at: TIMESTAMPTZ (nullable)
 * - cleared_at: TIMESTAMPTZ (nullable)
 * - acknowledged_by: TEXT (nullable)
 * - metadata: JSONB DEFAULT '{}'
 */
export const createAlarmsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.alarms (
      id              TEXT PRIMARY KEY DEFAULT 'ALM-' || gen_random_uuid()::TEXT,
      device_id       TEXT NOT NULL,
      alarm_type      TEXT NOT NULL,
      severity        TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'emergency')),
      message         TEXT,
      triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      acknowledged_at TIMESTAMPTZ,
      cleared_at      TIMESTAMPTZ,
      acknowledged_by TEXT,
      metadata        JSONB DEFAULT '{}'
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_alarms_device ON iiot.alarms (device_id, triggered_at DESC)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_alarms_severity ON iiot.alarms (severity, triggered_at DESC)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_alarms_open ON iiot.alarms (triggered_at DESC) WHERE cleared_at IS NULL`
})

// =============================================================================
// Alarm Graph Sync Trigger DDL
// =============================================================================

/**
 * Creates a trigger to sync alarms to the Apache AGE graph.
 * When an alarm is inserted, it creates an alarm node and links it to the sensor.
 */
export const createAlarmGraphTrigger = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create trigger function
  yield* sql.unsafe(`
    CREATE OR REPLACE FUNCTION iiot.alarm_graph_trigger()
    RETURNS TRIGGER AS $func$
    DECLARE
        sql_create TEXT;
        sql_link TEXT;
    BEGIN
        -- Set search_path for EXECUTE context (cypher operators require ag_catalog)
        SET LOCAL search_path = ag_catalog, iiot, public;

        -- Build SQL to create alarm node in graph
        sql_create := format($sql$
            SELECT * FROM cypher('iiot_graph', $$
                CREATE (:alarm {id: %L, alarm_type: %L, severity: %L, timestamp: %L})
            $$) AS (v agtype)
        $sql$, NEW.id, NEW.alarm_type, NEW.severity, NEW.triggered_at::TEXT);

        EXECUTE sql_create;

        -- Build SQL to link alarm to sensor
        sql_link := format($sql$
            SELECT * FROM cypher('iiot_graph', $$
                MATCH (a:alarm {id: %L}), (s:sensor {device_id: %L}) CREATE (a)-[:triggered_by]->(s)
            $$) AS (e agtype)
        $sql$, NEW.id, NEW.device_id);

        EXECUTE sql_link;

        RETURN NEW;
    EXCEPTION WHEN OTHERS THEN
        -- Don't fail insert if graph update fails
        RAISE WARNING 'Failed to update alarm graph: %', SQLERRM;
        RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql
  `)

  // Create trigger
  yield* sql.unsafe(`
    DROP TRIGGER IF EXISTS alarm_graph_sync ON iiot.alarms;
    CREATE TRIGGER alarm_graph_sync
    AFTER INSERT ON iiot.alarms
    FOR EACH ROW EXECUTE FUNCTION iiot.alarm_graph_trigger()
  `)
})
