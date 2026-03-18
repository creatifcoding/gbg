/**
 * @tmnl/entity — EntityContext
 *
 * Global provider for identity and tenancy context.
 * Set once at app boot, read by every `.create()` call.
 *
 * ```ts
 * // At boot / login
 * EntityContext.set({
 *   userId:         'user-42',
 *   tenantId:       'tenant-alpha',
 *   sourceId:       'api',
 *   classification: 'SECRET',
 * })
 *
 * // Now every .create() auto-fills from context
 * const todo = Todo.create({ text: 'Buy milk', completed: false })
 * // todo.createdBy === 'user-42'
 * // todo.tenantId  === 'tenant-alpha'
 * ```
 *
 * @since 0.1.0
 * @module
 */

import type { Classification } from './meta.js'

// ─── Shape ───────────────────────────────────────────────────

export interface EntityContextShape {
  /** Current user/agent/system identity */
  readonly userId: string
  /** Multi-tenant isolation key */
  readonly tenantId: string
  /** Reference to a user-defined SourceDefinition (e.g. 'analyst', 'sensor-003', 'import-batch-42') */
  readonly sourceId: string
  /** Default classification for new entities */
  readonly classification: Classification
}

// ─── Defaults ────────────────────────────────────────────────

const DEFAULT_CONTEXT: EntityContextShape = {
  userId:         '',
  tenantId:       '',
  sourceId:       'system',
  classification: 'UNCLASSIFIED',
}

// ─── Singleton ───────────────────────────────────────────────

let _ctx: EntityContextShape = { ...DEFAULT_CONTEXT }

/**
 * Global entity context provider.
 *
 * Domain code never touches this — it's set by infrastructure
 * (auth middleware, app bootstrap, test setup) and consumed
 * automatically by `Entity.withMeta(...).create()`.
 */
export const EntityContext = {
  /**
   * Set context fields. Merges with existing — partial updates OK.
   *
   * ```ts
   * EntityContext.set({ userId: 'agent-007', tenantId: 'mi6' })
   * ```
   */
  set(ctx: Partial<EntityContextShape>): void {
    _ctx = { ..._ctx, ...ctx }
  },

  /**
   * Read the current context snapshot.
   * Returns a copy — mutations don't affect the singleton.
   */
  get(): EntityContextShape {
    return { ..._ctx }
  },

  /**
   * Reset to defaults. Use in test teardown.
   */
  reset(): void {
    _ctx = { ...DEFAULT_CONTEXT }
  },
} as const
