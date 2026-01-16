# @gbg/ctl Test Plan

**TDD Phase 1: Test Case Design**

Following `@effect/vitest` patterns with `it.effect`, `it.scoped`, and `Layer.mock`.

---

## Module Test Coverage

### 1. `core/` - Command Patterns

| Test Case | Type | Description |
|-----------|------|-------------|
| `verboseOption.default` | unit | Default value is false |
| `verboseOption.withFlag` | unit | Parses `--verbose` correctly |
| `jsonOption.default` | unit | Default value is false |
| `dryRunOption.default` | unit | Default value is false |
| `limitOption.customDefault` | unit | Accepts custom default value |
| `formatOption.choices` | unit | Validates choice constraints |
| `buildHelpText.basic` | unit | Generates USAGE, COMMANDS sections |
| `buildHelpText.withExamples` | unit | Includes examples when provided |
| `buildHelpText.withSkillRef` | unit | Includes SKILL section |
| `createRunner.config` | unit | Creates runner with name/version |
| `runCli.integration` | integration | Full CLI execution pipeline |

### 2. `messaging/` - Agent-Guiding Errors

| Test Case | Type | Description |
|-----------|------|-------------|
| `NotFoundError.message` | unit | Formats with error code, recovery options |
| `NotFoundError.withSkill` | unit | Includes SKILL section when provided |
| `InvalidInputError.message` | unit | Includes expected format, examples |
| `OperationNotAllowedError.message` | unit | Shows current/required state |
| `SkillMissingError.message` | unit | Includes install path, alternatives |
| `StorageError.message` | unit | Shows path, recovery steps |
| `createErrorHandler.routes` | unit | Routes to correct handler by error type |
| `createErrorHandler.default` | unit | Falls back to Console.error |
| `createErrorHandler.unknown` | unit | Handles non-TaggedError errors |
| `formatTable.empty` | unit | Returns "No items found." |
| `formatTable.basic` | unit | Formats columns with headers |
| `formatTable.truncates` | unit | Truncates long values |
| `formatSuccess.basic` | unit | Formats action with details |
| `formatSuccess.withSteps` | unit | Includes numbered next steps |

### 3. `services/` - Effect.Service Patterns

| Test Case | Type | Description |
|-----------|------|-------------|
| `Logger.debug` | unit | Logs at debug level |
| `Logger.info` | unit | Logs at info level |
| `Logger.minLevel` | unit | Respects minimum log level |
| `OutputService.print` | unit | Outputs text |
| `OutputService.json` | unit | Outputs formatted JSON |
| `OutputService.raw` | unit | Writes to stdout directly |
| `FileManager.read` | scoped | Reads file content |
| `FileManager.write` | scoped | Creates directories, writes content |
| `FileManager.exists` | scoped | Returns boolean for file existence |
| `FileManager.ensureDir` | scoped | Creates nested directories |
| `FileManager.remove` | scoped | Deletes files |
| `FileError.format` | unit | Includes path, operation, cause |
| `createStateService.get` | unit | Returns current state |
| `createStateService.set` | unit | Updates state |
| `createStateService.update` | unit | Applies function to state |
| `createStateService.modify` | unit | Extracts value while updating |
| `createAccessors.proxy` | unit | Creates accessor functions |

### 4. `persistence/` - SQLite Patterns

| Test Case | Type | Description |
|-----------|------|-------------|
| `createSqliteLayer.config` | scoped | Creates layer with filename |
| `ensureTable.creates` | scoped | Creates table if not exists |
| `ensureTable.indexes` | scoped | Creates indexes |
| `ensureTable.idempotent` | scoped | Safe to call multiple times |
| `initializeSchema.multiple` | scoped | Initializes multiple tables |
| `runMigrations.createsTable` | scoped | Creates _migrations table |
| `runMigrations.skipsApplied` | scoped | Doesn't reapply migrations |
| `runMigrations.appliesPending` | scoped | Applies new migrations in order |
| `createRepository.config` | unit | Returns tableName and config |
| `withTransaction.commit` | scoped | Commits on success |
| `withTransaction.rollback` | scoped | Rolls back on failure |
| `XDG.paths` | unit | Uses XDG env vars with fallbacks |
| `getAppPaths.structure` | unit | Returns config, db, cache, logs paths |

### 5. `config/` - Configuration Patterns

| Test Case | Type | Description |
|-----------|------|-------------|
| `XDG.config` | unit | Uses XDG_CONFIG_HOME or default |
| `XDG.data` | unit | Uses XDG_DATA_HOME or default |
| `AppPaths.structure` | unit | Contains config, db, cache, logs, skills |
| `AppPathsLive.creates` | unit | Creates layer with app-specific paths |
| `loadConfigFile.notExists` | scoped | Returns empty object if no file |
| `loadConfigFile.invalidJson` | scoped | Returns ConfigLoadError |
| `loadConfigFile.valid` | scoped | Parses and returns config |
| `loadConfigFile.withSchema` | scoped | Validates against schema |
| `saveConfigFile.createsDir` | scoped | Creates parent directories |
| `saveConfigFile.writes` | scoped | Writes formatted JSON |
| `envString.default` | unit | Uses default when env not set |
| `envString.override` | unit | Uses env value when set |
| `envBoolean.parses` | unit | Parses true/false strings |
| `envInteger.parses` | unit | Parses integer strings |
| `envLiteral.validates` | unit | Validates against allowed values |
| `createLayeredConfig.priority` | unit | CLI > Env > File > Defaults |
| `createInitHandler.noForce` | scoped | Fails if config exists |
| `createInitHandler.force` | scoped | Overwrites existing config |

### 6. `skills/` - Skill Reference System

| Test Case | Type | Description |
|-----------|------|-------------|
| `skillRef.creates` | unit | Creates SkillRef with name, trigger |
| `skillRef.withPath` | unit | Includes optional path |
| `CTL_SKILLS.complete` | unit | Has all required skill refs |
| `createManifest.structure` | unit | Contains name, version, skills, deps |
| `createManifest.defaultSkill` | unit | Includes core skill entry |
| `generateSkillMd.frontmatter` | unit | Includes name, description |
| `generateSkillMd.sections` | unit | Has When to Use, Instructions |
| `generateSkillMd.allowedTools` | unit | Includes tools when provided |
| `generateSkillRule.structure` | unit | Has type, enforcement, triggers |
| `formatSkillRef.basic` | unit | Formats SKILL: name |
| `formatSkillRef.withPath` | unit | Includes Path: line |
| `formatSkillRefs.multiple` | unit | Joins with double newlines |
| `generateScaffold.allFiles` | unit | Creates core, errors, manifest |
| `DEFAULT_DISCIPLINE.values` | unit | Has correct defaults |

---

## Test File Structure

```
packages/ctl/
├── test/
│   ├── core.test.ts
│   ├── messaging.test.ts
│   ├── services.test.ts
│   ├── persistence.test.ts
│   ├── config.test.ts
│   ├── skills.test.ts
│   └── cli.integration.test.ts
├── vitest.config.ts
└── package.json (dev deps)
```

---

## Testing Patterns

### Unit Tests (Effect.gen)
```typescript
import { it, describe, expect } from "@effect/vitest"
import { Effect } from "effect"

it.effect("test name", () =>
  Effect.gen(function* () {
    const result = yield* someEffect
    expect(result).toBe(expected)
  })
)
```

### Scoped Tests (SQLite)
```typescript
import { it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { SqliteClient } from "@effect/sql-sqlite-bun"

const TestLayer = SqliteClient.layer({ filename: ":memory:" })

it.scoped("sqlite test", () =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`CREATE TABLE test (id TEXT)`
    // test logic
  }).pipe(Effect.provide(TestLayer))
)
```

### Service Mocking
```typescript
import { Layer } from "effect"

const MockLogger = Layer.succeed(Logger, {
  debug: () => Effect.void,
  info: () => Effect.void,
  warn: () => Effect.void,
  error: () => Effect.void,
})
```

---

## Execution Plan

1. **RED Phase**: Write all failing tests
2. **GREEN Phase**: Fix code to pass tests
3. **REFACTOR Phase**: Clean up while keeping green

Test order (by dependency):
1. `skills.test.ts` - No dependencies
2. `messaging.test.ts` - No dependencies
3. `core.test.ts` - No dependencies
4. `services.test.ts` - Depends on @effect/platform
5. `config.test.ts` - Depends on services
6. `persistence.test.ts` - Depends on @effect/sql-sqlite-bun
7. `cli.integration.test.ts` - Depends on all modules
