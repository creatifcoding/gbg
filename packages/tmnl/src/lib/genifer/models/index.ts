/**
 * Genifer Models — Barrel exports
 *
 * @module
 */

// Common types
export * from './_common'

// Infrastructure DDL
export { createGeniferSchema, grantGeniferPermissions } from './_infrastructure.ddl'

// Models
export { GeniferTreeModel } from './GeniferTreeModel'
export { GeniferElementModel } from './GeniferElementModel'
export { GeniferCompositeModel } from './GeniferCompositeModel'
export { GeniferSignalModel } from './GeniferSignalModel'

// DDL
export { createGeniferTreesTable } from './GeniferTreeModel.ddl'
export { createGeniferElementsTable } from './GeniferElementModel.ddl'
export { createGeniferCompositesTable } from './GeniferCompositeModel.ddl'
export { createGeniferSignalsTable, createCompositeRankingsView } from './GeniferSignalModel.ddl'

// Migrations
export { geniferMigrations, geniferMigrationLoader, type GeniferMigrationKey } from './_migrations'
