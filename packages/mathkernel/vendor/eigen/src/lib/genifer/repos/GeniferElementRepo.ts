/**
 * GeniferElementRepo — Repository for genifer.elements (leaves-as-graph)
 *
 * @module
 */

import { Context, Effect, Layer, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { GeniferElementModel } from '../models/GeniferElementModel'
import type { GeniferTreeId } from '../models/_common'
import { decodeRows, decodeFirst } from './_decode'

// =============================================================================
// Types
// =============================================================================

export type GeniferElementRepoError = SqlError.SqlError | ParseResult.ParseError

export interface GeniferElementRepository {
  /** Get all elements for a tree (flat list) */
  readonly findByTree: (treeId: GeniferTreeId) => Effect.Effect<readonly GeniferElementModel[], GeniferElementRepoError>
  /** Get subtree rooted at element_key (recursive CTE) */
  readonly findSubtree: (treeId: GeniferTreeId, rootKey: string) => Effect.Effect<readonly GeniferElementModel[], GeniferElementRepoError>
  /** Bulk insert all elements for a tree */
  readonly insertBatch: (treeId: GeniferTreeId, elements: readonly ElementInsert[]) => Effect.Effect<readonly GeniferElementModel[], GeniferElementRepoError>
  /** Delete all elements for a tree (CASCADE handles this, but explicit is nice) */
  readonly deleteByTree: (treeId: GeniferTreeId) => Effect.Effect<void, SqlError.SqlError>
}

export interface ElementInsert {
  readonly elementKey: string
  readonly elementType: string
  readonly props: Record<string, unknown>
  readonly className?: string
  readonly parentKey?: string | null
  readonly children?: readonly string[]
  readonly depth: number
  readonly entrance?: unknown
  readonly role?: string
  readonly ariaLabel?: string
  readonly visible?: unknown
}

// =============================================================================
// Tag
// =============================================================================

export class GeniferElementRepo extends Context.Tag('genifer/ElementRepo')<
  GeniferElementRepo,
  GeniferElementRepository
>() {}

// =============================================================================
// Column select
// =============================================================================

const ELEM_COLS = `
  id,
  tree_id       AS "treeId",
  element_key   AS "elementKey",
  element_type  AS "elementType",
  props,
  class_name    AS "className",
  parent_key    AS "parentKey",
  children,
  depth,
  entrance,
  role,
  aria_label    AS "ariaLabel",
  visible,
  quality_score AS "qualityScore",
  created_at    AS "createdAt"
`

// =============================================================================
// Implementation
// =============================================================================

export const GeniferElementRepoLive = Layer.effect(
  GeniferElementRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const findByTree = (treeId: GeniferTreeId) =>
      Effect.gen(function* () {
        const rows = yield* sql.unsafe(
          `SELECT ${ELEM_COLS} FROM genifer.elements WHERE tree_id = $1 ORDER BY depth ASC, element_key ASC`,
          [treeId]
        )
        return yield* decodeRows(GeniferElementModel)(rows)
      })

    const findSubtree = (treeId: GeniferTreeId, rootKey: string) =>
      Effect.gen(function* () {
        const rows = yield* sql.unsafe(
          `WITH RECURSIVE subtree AS (
            SELECT ${ELEM_COLS}
            FROM genifer.elements
            WHERE tree_id = $1 AND element_key = $2
          UNION ALL
            SELECT
              e.id,
              e.tree_id       AS "treeId",
              e.element_key   AS "elementKey",
              e.element_type  AS "elementType",
              e.props,
              e.class_name    AS "className",
              e.parent_key    AS "parentKey",
              e.children,
              e.depth,
              e.entrance,
              e.role,
              e.aria_label    AS "ariaLabel",
              e.visible,
              e.quality_score AS "qualityScore",
              e.created_at    AS "createdAt"
            FROM genifer.elements e
            INNER JOIN subtree s ON e.parent_key = s."elementKey" AND e.tree_id = $1
          )
          SELECT * FROM subtree ORDER BY depth ASC`,
          [treeId, rootKey]
        )
        return yield* decodeRows(GeniferElementModel)(rows)
      })

    const insertBatch = (treeId: GeniferTreeId, elements: readonly ElementInsert[]) =>
      Effect.gen(function* () {
        if (elements.length === 0) return [] as readonly GeniferElementModel[]

        // Build VALUES clause with parameterized placeholders
        const values: unknown[] = []
        const placeholders: string[] = []
        let idx = 1

        for (const elem of elements) {
          placeholders.push(
            `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`
          )
          values.push(
            treeId,
            elem.elementKey,
            elem.elementType,
            JSON.stringify(elem.props),
            elem.className ?? null,
            elem.parentKey ?? null,
            elem.children ?? [],
            elem.depth,
            elem.entrance ? JSON.stringify(elem.entrance) : null,
            elem.role ?? null,
            elem.ariaLabel ?? null,
          )
        }

        const rows = yield* sql.unsafe(
          `INSERT INTO genifer.elements
            (tree_id, element_key, element_type, props, class_name, parent_key, children, depth, entrance, role, aria_label)
          VALUES ${placeholders.join(', ')}
          RETURNING ${ELEM_COLS}`,
          values
        )
        return yield* decodeRows(GeniferElementModel)(rows)
      })

    const deleteByTree = (treeId: GeniferTreeId) =>
      sql.unsafe(`DELETE FROM genifer.elements WHERE tree_id = $1`, [treeId]).pipe(Effect.asVoid)

    return {
      findByTree,
      findSubtree,
      insertBatch,
      deleteByTree,
    } satisfies GeniferElementRepository
  })
)
