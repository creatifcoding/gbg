/**
 * @module store/index
 *
 * RLM Store v2 — public exports.
 *
 * For the eval sandbox (ms.* API):
 *   import { createStoreApi } from "./store/api.ts"
 *   import { sqliteNodeLayer } from "./store/sqlite-node.ts"
 *   const api = createStoreApi(sqliteNodeLayer({ filename: dbPath }))
 *
 * For Effect v4 service consumers:
 *   import { RlmStore, RlmStoreLive } from "./store/service.ts"
 *   import { SearchIndex, SearchIndexLive } from "./store/search.ts"
 *   import { DomainRegistry, DomainRegistryLive } from "./store/domains.ts"
 */

// API facade (DI via Layer<SqlClient>)
export { createStoreApi } from "./api.ts"
export type { StoreApi, FluentQuery, FluentPut } from "./api.ts"

// Effect v4 services
export { RlmStore, RlmStoreLive } from "./service.ts"
export type { RlmStoreShape, StoredObject, CatalogEntry, QueryFilter, PutOptions } from "./service.ts"
export { SearchIndex, SearchIndexLive } from "./search.ts"
export type { SearchIndexShape } from "./search.ts"
export { DomainRegistry, DomainRegistryLive } from "./domains.ts"
export type { DomainRegistryShape } from "./domains.ts"

// Schemas
export {
  Namespace, validateNamespace, isSystemNamespace, namespaceMatchesGlob,
  StoreKey, validateKey, isTemporalKey, isCanonicalKey, temporalSuffix,
  ObjectMetaCore, validateMeta,
  DomainConfig, validateDomainConfig,
} from "./schemas.ts"

// Builders
export { QueryBuilder } from "./builders.ts"
export { PutBuilder } from "./builders.ts"

// SQLite adapters — pick your backend
export { layer as sqliteNodeLayer } from "./sqlite-node.ts"
// Future: export { layer as sqliteBunLayer } from "./sqlite-bun.ts"
