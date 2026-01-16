/**
 * @gbg/ctl - Effect CLI Framework
 *
 * A skill-driven CLI framework with agent-guiding errors and SQLite persistence.
 *
 * ## Features
 * - Command patterns via @effect/cli
 * - SQLite persistence via @effect/sql-sqlite-bun
 * - Agent-guiding TaggedErrors with recovery suggestions
 * - Skill loading and dependency system
 * - Layered configuration (CLI > Env > File > Defaults)
 *
 * ## Quick Start
 *
 * ```typescript
 * import { Command, Args, Options, runCli } from "@gbg/ctl/core"
 * import { NotFoundError, createErrorHandler } from "@gbg/ctl/messaging"
 * import { createSqliteLayer } from "@gbg/ctl/persistence"
 * ```
 *
 * @module
 */

// =============================================================================
// CORE - Command patterns
// =============================================================================

export {
  // Re-exports from @effect/cli
  Args,
  Command,
  Options,
  NodeContext,
  NodeRuntime,
  // Utilities
  verboseOption,
  jsonOption,
  dryRunOption,
  limitOption,
  formatOption,
  buildHelpText,
  createRunner,
  runCli,
  type HelpConfig,
  type RunConfig,
} from "./core/index.js"

// =============================================================================
// MESSAGING - Agent-guiding errors and output
// =============================================================================

export {
  // Error codes
  ErrorCode,
  // Tagged errors
  NotFoundError,
  InvalidInputError,
  OperationNotAllowedError,
  SkillMissingError,
  StorageError,
  // Error handling
  createErrorHandler,
  // Output formatting
  formatTable,
  formatSuccess,
  type RecoveryOption,
  type SkillReference,
  type ColumnDef,
  type ErrorHandlerConfig,
} from "./messaging/index.js"

// =============================================================================
// PERSISTENCE - SQLite patterns
// =============================================================================

export {
  // SQLite
  createSqliteLayer,
  SqlClient,
  SqliteClient,
  // Schema utilities
  ensureTable,
  initializeSchema,
  // Migrations
  runMigrations,
  // Repository pattern
  createRepository,
  // Transactions
  withTransaction,
  // Paths
  XDG,
  getAppPaths,
  type SqliteConfig,
  type TableDef,
  type Migration,
  type RepositoryConfig,
  type Repository,
} from "./persistence/index.js"

// =============================================================================
// SERVICES - Effect.Service patterns
// =============================================================================

export {
  // Logger
  Logger,
  LoggerLive,
  // Output
  OutputService,
  OutputServiceLive,
  // FileManager
  FileManager,
  FileManagerLive,
  FileError,
  // State service factory
  createStateService,
  // Accessors
  createAccessors,
  // Layer helpers
  mergeLayers,
  provideLayer,
  // Re-exports
  Console,
  Context,
  Effect,
  Layer,
  Option,
  Ref,
  FileSystem,
  Path,
  type LogLevel,
  type StateService,
} from "./services/index.js"

// =============================================================================
// CONFIG - Configuration patterns
// =============================================================================

export {
  // App paths
  AppPaths,
  AppPathsLive,
  // Config loading
  loadConfigFile,
  saveConfigFile,
  ConfigLoadError,
  // Environment config
  envString,
  envBoolean,
  envInteger,
  envLiteral,
  // Layered config
  createLayeredConfig,
  // Config service factory
  createConfigService,
  ConfigService,
  // Init helper
  createInitHandler,
  // Re-exports
  Config,
  Schema,
  type LayeredConfigOptions,
  type InitConfig,
} from "./config/index.js"

// =============================================================================
// SKILLS - Skill references and scaffolding
// =============================================================================

export {
  // Skill references (for error messages)
  skillRef,
  CTL_SKILLS,
  formatSkillRef,
  formatSkillRefs,
  // Manifest
  createManifest,
  // Templates
  generateSkillMd,
  generateSkillRule,
  generateScaffold,
  SCAFFOLD_FILES,
  // Discipline
  DEFAULT_DISCIPLINE,
  // Types
  type SkillRef,
  type SkillManifest,
  type SkillEntry,
  type SkillTemplateConfig,
  type SkillRuleEntry,
  type SkillDisciplineConfig,
  type EnforcementLevel,
} from "./skills/index.js"
