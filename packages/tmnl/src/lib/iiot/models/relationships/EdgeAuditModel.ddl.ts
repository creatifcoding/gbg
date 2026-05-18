/** EdgeAuditModel DDL - insert-only audit trail for relationship edge writes. */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

export const createRelationshipEdgeAuditTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.relationship_edge_audit (
      id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      edge_id         TEXT NOT NULL,
      action          TEXT NOT NULL CHECK (action IN ('upsert', 'soft_delete')),
      edge_type       TEXT NOT NULL,
      source_type     TEXT NOT NULL,
      source_id       TEXT NOT NULL,
      target_type     TEXT NOT NULL,
      target_id       TEXT NOT NULL,
      actor           TEXT NOT NULL,
      reason          TEXT,
      descriptor_version INTEGER NOT NULL DEFAULT 1,
      valid_from      TIMESTAMPTZ,
      valid_to        TIMESTAMPTZ,
      metadata        JSONB NOT NULL DEFAULT '{}',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_relationship_edge_audit_edge_id
    ON iiot.relationship_edge_audit (edge_id, created_at DESC)
  `

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_relationship_edge_audit_source
    ON iiot.relationship_edge_audit (source_type, source_id, created_at DESC)
  `

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_relationship_edge_audit_target
    ON iiot.relationship_edge_audit (target_type, target_id, created_at DESC)
  `
})
