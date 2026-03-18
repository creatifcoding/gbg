/**
 * @module store/index
 *
 * RLM Store v2 — public exports for @tmnl/codemode.
 *
 * Usage:
 *   import { createStoreApi } from "@tmnl/codemode/store"
 *   import { sqliteNodeLayer } from "@tmnl/codemode/adapters/sqlite-node"
 *   const api = createStoreApi(sqliteNodeLayer({ filename: dbPath }))
 */

// API facade (DI via Layer<SqlClient>)
export { createStoreApi } from "./api.js"
export type { StoreApi, FluentQuery, FluentPut } from "./api.js"

// Effect v4 services
export { RlmStore, RlmStoreLive } from "./service.js"
export type { RlmStoreShape, StoredObject, CatalogEntry, QueryFilter, PutOptions } from "./service.js"
export { SearchIndex, SearchIndexLive } from "./search.js"
export type { SearchIndexShape } from "./search.js"
export { DomainRegistry, DomainRegistryLive } from "./domains.js"
export type { DomainRegistryShape } from "./domains.js"

// Schemas
export {
  Namespace, validateNamespace, isSystemNamespace, namespaceMatchesGlob,
  StoreKey, validateKey, isTemporalKey, isCanonicalKey, temporalSuffix,
  ObjectMetaCore, validateMeta,
  DomainConfig, validateDomainConfig,
} from "./schemas.js"

// Builders
export { QueryBuilder, PutBuilder } from "./builders.js"

// Factory meta-patterns (Effect v4 services + dual API facade)
export { createFactoryApi } from "./factories.js"
export type { FactoryApi, CollectionApi, DomainApi, PipelineRunApi, PipelineDefApi } from "./factories.js"
export { CollectionFactory, CollectionFactoryLive } from "./factories.js"
export { DomainFactory, DomainFactoryLive } from "./factories.js"
export { PipelineFactory, PipelineFactoryLive } from "./factories.js"
export { FactoryLive } from "./factories.js"

// Export / Import (Effect v4 FileSystem DI)
export { ExportService, ExportServiceLive } from "./export.js"
export {
  Address, KeyGlob, ExportFormat, ImportMode, ProfileName,
  ExportOptions, ImportOptions, ExportedObject, ExportManifest, ImportResult,
  ProfileRecord, ProfileSummary,
  parseAddress, buildAddress, keyMatchesGlob,
} from "./export.js"
export type { ExportServiceShape } from "./export.js"

// Migrations (Migrator.fromRecord — tracked, transactional)
export { MigrationLayer } from "./migrations.js"

// Stored Procedures (DPA)
export { createProcedureApi, toStorageKey } from "./procedures.js"
export type { ProcedureApi, ProcedureRecord, ProcedureSummary, DefineOptions } from "./procedures.js"
