/**
 * @fileoverview genifer Domain Catalogs
 *
 * Primary export: coreVantaCatalog (16 VANTA-grounded core components)
 * Legacy alias: coreDomainCatalog (for backward compat during migration)
 *
 * @module genifer/catalog
 */

export { coreVantaCatalog, coreVantaCatalog as coreDomainCatalog, CORE_ENTRIES } from "./core"
export type { CatalogEntry, PropSpec, ClassNamePolicy, SpacingToken, PolicyGroup, Intent, ExtendedIntent, ComponentCategory } from "./types"
export { DEFAULT_POLICIES } from "./types"
export { filterClassName, classPassesPolicy, POLICY_GROUPS } from "./className"
export { SurfaceProvider, useSurface, classifyDensity } from "./context.js"
export type { SurfaceDensity, SurfaceTier, SurfaceConstraint } from "./context.js"
export { clampColumns } from "./density"
