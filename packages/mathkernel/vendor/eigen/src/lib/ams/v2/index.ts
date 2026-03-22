/**
 * AMS v2: Asset Management System
 *
 * Profile-scoped architecture:
 * - core/  → Shared primitives (identifiers, BFO, provenance)
 * - base/  → Generic AMS CQRS stack
 * - wms/   → Warehouse Management profile
 * - tms/   → Transport Management profile
 *
 * @module @gbg/tmnl/ams/v2
 */

export * as Core from './core'
export * as Base from './base'
export * as WMS from './wms'
export * as TMS from './tms'
