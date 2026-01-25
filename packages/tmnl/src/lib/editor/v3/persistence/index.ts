/**
 * Editor Persistence Layer
 *
 * SQLite-based persistence for file mappings, recent documents,
 * and document metadata caching.
 *
 * @module editor/v3/persistence
 */

// Models
export {
  FileMappingModel,
  RecentDocumentModel,
  DocumentMetadataCacheModel,
} from './models';

// Repositories
export {
  FileMappingRepo,
  FileMappingRepoLive,
  RecentDocumentRepo,
  RecentDocumentRepoLive,
  DocumentMetadataCacheRepo,
  DocumentMetadataCacheRepoLive,
  AllRepositoriesLive,
  type FileMappingRepository,
  type RecentDocumentRepository,
  type DocumentMetadataCacheRepository,
} from './repositories';

// Migrations
export {
  runMigrations,
  getCurrentVersion,
  dropAllTables,
  resetDatabase,
} from './migrations';

// Layers
export {
  SqliteClientLive,
  SqliteClientTest,
  EditorPersistenceLive,
  EditorPersistenceTest,
  getDataDir,
  getDatabasePath,
} from './layer';

// Helpers
export {
  SqliteBoolean,
  NullableJsonFromString,
  NullableJsonFromStringTyped,
} from './sqlite-helpers';
