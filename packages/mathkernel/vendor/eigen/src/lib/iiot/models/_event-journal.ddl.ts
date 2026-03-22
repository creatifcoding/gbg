/**
 * IIoT Event Journal DDL - Partitioned EventLog Tables
 *
 * Creates tables compatible with @effect/sql/SqlEventJournal for IIoT event sourcing.
 * Extended with partitioning by entity_type for optimized query performance.
 *
 * Tables:
 * - iiot.event_journal: Main partitioned event storage (alarm, work_order, equipment, task, approval)
 * - iiot.event_remotes: Remote sync tracking for CRDT-compatible replication
 *
 * @see @effect/sql/SqlEventJournal for base schema
 * @see @effect/experimental/EventJournal for EventLog API
 * @see thoughts/shared/specs/entity-system/04-storage-architecture.md
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Event Journal Table DDL (Partitioned)
// =============================================================================

/**
 * Entity types for partitioning.
 * Maps to ISA-95 domain concepts.
 */
export const ENTITY_TYPES = [
  'alarm',
  'work_order',
  'equipment',
  'task',
  'approval',
] as const

export type EntityType = (typeof ENTITY_TYPES)[number]

/**
 * Creates the main event_journal partitioned table in the iiot schema.
 *
 * Columns:
 * - id: BYTEA for EventJournal entry ID (ULID-based, from @effect/experimental/EventJournal)
 * - sequence_num: BIGSERIAL for ordering within partition
 * - entity_type: VARCHAR(64) for partition key (alarm, work_order, equipment, task, approval)
 * - primary_key: VARCHAR(255) for entity ID (AlarmId, WorkOrderId, MachineId, etc.)
 * - event_tag: VARCHAR(128) for event type (AlarmTriggered, StateChanged, etc.)
 * - payload: JSONB for event data
 * - created_at: TIMESTAMPTZ for event timestamp
 * - identity_id: BYTEA for EventLog identity (CRDT, 16 bytes)
 *
 * The table is partitioned by LIST on entity_type for query optimization.
 * The `id` column stores the ULID-based entry ID from Effect's EventJournal.
 */
export const createEventJournalTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create main partitioned table
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS iiot.event_journal (
      id              BYTEA NOT NULL,
      sequence_num    BIGSERIAL,
      entity_type     VARCHAR(64) NOT NULL,
      primary_key     VARCHAR(255) NOT NULL,
      event_tag       VARCHAR(128) NOT NULL,
      payload         JSONB NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      identity_id     BYTEA NOT NULL,

      PRIMARY KEY (entity_type, sequence_num),
      UNIQUE (entity_type, id)
    ) PARTITION BY LIST (entity_type)
  `)
})

/**
 * Creates partitions for each entity type.
 *
 * Partitions:
 * - iiot.event_journal_alarm: Alarm lifecycle events
 * - iiot.event_journal_work_order: Work order lifecycle events
 * - iiot.event_journal_equipment: Equipment state events
 * - iiot.event_journal_task: Task instance events
 * - iiot.event_journal_approval: Approval request events
 */
export const createEventJournalPartitions = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Alarm partition
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS iiot.event_journal_alarm
    PARTITION OF iiot.event_journal
    FOR VALUES IN ('alarm')
  `)

  // Work Order partition
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS iiot.event_journal_work_order
    PARTITION OF iiot.event_journal
    FOR VALUES IN ('work_order')
  `)

  // Equipment partition
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS iiot.event_journal_equipment
    PARTITION OF iiot.event_journal
    FOR VALUES IN ('equipment')
  `)

  // Task partition
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS iiot.event_journal_task
    PARTITION OF iiot.event_journal
    FOR VALUES IN ('task')
  `)

  // Approval partition
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS iiot.event_journal_approval
    PARTITION OF iiot.event_journal
    FOR VALUES IN ('approval')
  `)
})

// =============================================================================
// Event Journal Identity Table DDL
// =============================================================================

/**
 * Creates the event_journal_identity table for persistent CRDT identity.
 *
 * This table stores the identity ID for each EventJournal node, ensuring
 * that identity persists across restarts. Without this, a restart would
 * generate a new identity, breaking CRDT causality tracking.
 *
 * Columns:
 * - node_name: VARCHAR(255) identifying the node (e.g., "primary", "edge-1")
 * - identity_id: BYTEA for the CRDT identity (16 bytes)
 * - created_at: TIMESTAMPTZ for when identity was first generated
 */
export const createEventJournalIdentityTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.event_journal_identity (
      node_name     VARCHAR(255) PRIMARY KEY,
      identity_id   BYTEA NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
})

// =============================================================================
// Event Remotes Table DDL
// =============================================================================

/**
 * Creates the event_remotes table for remote sync tracking.
 *
 * This table follows the @effect/sql/SqlEventJournal pattern for CRDT-compatible
 * distributed event synchronization.
 *
 * Columns:
 * - remote_id: BYTEA identifying the remote EventLog instance (16 bytes)
 * - entry_id: BYTEA referencing the event entry ID (16 bytes)
 * - sequence: INT for ordering within remote
 *
 * Extended with:
 * - last_sync_seq: BIGINT tracking last synchronized sequence number
 * - entity_type: VARCHAR(64) for efficient per-type sync queries
 * - synced_at: TIMESTAMPTZ for sync timestamp
 */
export const createEventRemotesTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Primary remotes table (SqlEventJournal compatible)
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS iiot.event_remotes (
      remote_id       BYTEA NOT NULL,
      entry_id        BYTEA NOT NULL,
      sequence        INT NOT NULL,
      PRIMARY KEY (remote_id, entry_id)
    )
  `)

  /**
   * RESERVED: Extended remotes tracking for per-entity-type sync.
   *
   * Future use cases:
   * - "What's the last sync time for Alarms from Remote X?"
   * - Entity-type-specific sync intervals
   * - Partial sync (only sync Alarms, not WorkOrders)
   *
   * Currently unused - sync state managed via event_remotes table.
   * This table is created for forward compatibility but not yet queried.
   */
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS iiot.event_remotes_sync (
      remote_id       BYTEA PRIMARY KEY,
      last_sync_seq   BIGINT NOT NULL DEFAULT 0,
      entity_type     VARCHAR(64) NOT NULL,
      synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
})

// =============================================================================
// Indexes DDL
// =============================================================================

/**
 * Creates indexes for efficient event queries.
 *
 * Indexes:
 * - idx_event_journal_temporal: (primary_key, created_at DESC) for entity history queries
 * - idx_event_journal_tag: (event_tag, created_at DESC) for event type queries
 * - idx_event_journal_payload_gin: GIN on payload for JSONB path queries
 * - idx_event_journal_identity: (identity_id) for CRDT merge operations
 * - idx_event_remotes_type: (entity_type, synced_at DESC) for sync queries
 */
export const createEventJournalIndexes = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Temporal query index: "What happened to entity X?"
  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_event_journal_temporal
    ON iiot.event_journal (primary_key, created_at DESC)
  `

  // Event tag index: "All AlarmTriggered events"
  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_event_journal_tag
    ON iiot.event_journal (event_tag, created_at DESC)
  `

  // JSONB GIN index for payload queries
  yield* sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_event_journal_payload_gin
    ON iiot.event_journal USING GIN (payload jsonb_path_ops)
  `)

  // Identity index for CRDT merge lookups
  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_event_journal_identity
    ON iiot.event_journal (identity_id)
  `

  // Remotes sync index
  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_event_remotes_type
    ON iiot.event_remotes_sync (entity_type, synced_at DESC)
  `

  // Remotes sequence index for SqlEventJournal compatibility
  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_event_remotes_sequence
    ON iiot.event_remotes (remote_id, sequence)
  `

  // Composite index for conflict detection in writeFromRemote
  // Query: WHERE event_tag = $1 AND primary_key = $2 AND created_at >= $3
  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_event_journal_conflict
    ON iiot.event_journal (event_tag, primary_key, created_at DESC)
  `

  // Anti-join index for withRemoteUncommited
  // Query: WHERE id NOT IN (SELECT entry_id FROM event_remotes WHERE remote_id = $1)
  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_event_remotes_entry
    ON iiot.event_remotes (entry_id)
  `
})

// =============================================================================
// Combined Setup
// =============================================================================

/**
 * Creates all event journal tables and indexes.
 *
 * Order:
 * 1. Main partitioned table
 * 2. Entity type partitions
 * 3. Identity table
 * 4. Remotes tables
 * 5. Indexes
 *
 * Requires: SqlClient.SqlClient (PostgreSQL with iiot schema)
 */
export const createEventJournalSchema = Effect.gen(function* () {
  yield* createEventJournalTable
  yield* createEventJournalPartitions
  yield* createEventJournalIdentityTable
  yield* createEventRemotesTable
  yield* createEventJournalIndexes
})

// =============================================================================
// DDL Drop Functions (for testing/migration)
// =============================================================================

/**
 * Drops all event journal tables.
 *
 * WARNING: This will delete all event data. Use only in test/dev environments.
 */
export const dropEventJournalSchema = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Drop remotes tables
  yield* sql`DROP TABLE IF EXISTS iiot.event_remotes_sync CASCADE`
  yield* sql`DROP TABLE IF EXISTS iiot.event_remotes CASCADE`

  // Drop partitions (CASCADE from parent)
  yield* sql`DROP TABLE IF EXISTS iiot.event_journal CASCADE`
})
