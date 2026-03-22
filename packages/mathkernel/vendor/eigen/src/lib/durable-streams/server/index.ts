/**
 * Durable Streams Server
 *
 * Effect-native durable streams server with HttpApi, SQLite persistence,
 * and EventLog observability.
 *
 * @module @gbg/tmnl/durable-streams/server
 */

// Models & Schemas
export * from './models'

// Persistence Layer
export {
  DurableStreamTestLayer,
  DurableStreamPersistenceLayer,
  SqliteMemoryLayer,
  SqliteFileLayer,
  getDbPath,
  DB_DIR,
  DEFAULT_DB_PATH,
} from './persistence'

// Repositories
export {
  StreamRepositoryTag,
  StreamEntryRepositoryTag,
  StreamRepositoryLive,
  StreamEntryRepositoryLive,
  AllRepositoriesLive,
  type StreamRepository,
  type StreamEntryRepository,
} from './repositories'

// Service
export {
  StreamStoreTag,
  StreamStoreLive,
  StreamStoreFullLayer,
  StreamNotFoundError,
  StreamExistsError,
  StreamStoreError,
  type StreamStore,
} from './service'

// API
export {
  DurableStreamsApi,
  StreamsApi,
  HealthApi,
  StreamNotFound,
  StreamExists,
  InternalError,
} from './api'

// Handlers
export {
  StreamsHandlersLive,
  HealthHandlersLive,
  DurableStreamsApiLive,
} from './handlers'

// Events
export {
  StreamCreated,
  StreamDeleted,
  StreamAppended,
  StreamRead,
  StreamError,
  DurableStreamEvents,
} from './events'
