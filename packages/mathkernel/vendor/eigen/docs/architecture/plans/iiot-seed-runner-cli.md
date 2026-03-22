# Implementation Plan: IIoT Seed Runner CLI (via @gbg/ctl)

Generated: 2026-01-25
Updated: 2026-01-25 - **REVISED to use @gbg/ctl framework**

## Goal

Create an Effect CLI-based seed runner (`src/lib/iiot/seed/runner.ts`) using **@gbg/ctl** framework that:
1. Parses CLI arguments for mode, clear, stats-only, and assets-only options
2. Connects to the IIoT database using existing layer patterns
3. Executes the appropriate seeders based on options
4. Reports progress and final statistics

## Changes from Original Plan

| Original | Revised (ctl) |
|----------|---------------|
| Direct `@effect/cli` imports | `@gbg/ctl/core` re-exports |
| `BunRuntime.runMain` | `NodeRuntime.runMain` (ctl default) |
| Manual options definition | ctl utility options |
| Custom error handling | `createErrorHandler` from ctl |

## Research Summary

### @gbg/ctl Framework (packages/ctl)

The `@gbg/ctl` package provides:
- **Re-exports**: `Command`, `Args`, `Options`, `NodeRuntime` from @effect/cli
- **Utility Options**: `verboseOption`, `jsonOption`, `dryRunOption`, `formatOption`
- **Error Handling**: `createErrorHandler`, `NotFoundError`, `StorageError`
- **Output Formatting**: `formatTable`, `formatSuccess`
- **Help Text Builder**: `buildHelpText`

**Import pattern**:
```typescript
import { Command, Options, NodeContext, NodeRuntime, verboseOption } from "@gbg/ctl"
```

### spikectl Reference (packages/spikectl)

Demonstrates full CLI structure using ctl:
```typescript
import { Command } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Console, Effect } from "effect"

const command = Command.make("seed", {}, () => Console.log("..."))

Command.run(command, { name: "cli", version: "1.0.0" })(process.argv).pipe(
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
)
```

### Existing Seed Module (`src/lib/iiot/seed/mock-data.ts`)

Key exports to use:
- `SeedConfig` - Mutable config object with `mode: 'fast' | 'validated'`
- `seedAssets` - Plants → Lines → Machines → Sensors
- `seedMockReadings` - Tier 2 readings (mode-dependent)
- `seedMockAlarms` - Tier 1 alarms via repo
- `seedAll` - Combined seeder
- `clearMockData` - Reset to clean state
- `getDataStats` - Verification counts

### Database Layer (from `src/lib/iiot/__tests__/integration/layer.ts`)

Reusable patterns:
- `TestPgClient` - PgClient.layer for localhost:5433
- `IIoTMigratorLive` - Migration layer
- `IIoTRepositoriesLive` - All repos combined

## Implementation Phases

### Phase 1: CLI Structure using @gbg/ctl

**File to create**: `src/lib/iiot/seed/runner.ts`

**Steps**:

1. Create the file with shebang and ctl imports:
```typescript
#!/usr/bin/env bun
/**
 * IIoT Seed Runner CLI
 *
 * CLI tool for seeding the IIoT database with mock data.
 * Built with @gbg/ctl - Effect CLI Framework
 *
 * Usage:
 *   bun run src/lib/iiot/seed/runner.ts [options]
 *
 * @module
 */

import { Command, Options, NodeContext, NodeRuntime, verboseOption } from "@gbg/ctl"
import { Console, Effect, Layer, Redacted } from "effect"
import { PgClient } from "@effect/sql-pg"
```

2. Define CLI options using ctl patterns:
```typescript
// =============================================================================
// CLI Options (ctl patterns)
// =============================================================================

const modeOption = Options.choice("mode", ["fast", "validated"]).pipe(
  Options.withAlias("m"),
  Options.withDefault("fast"),
  Options.withDescription("Seed mode: fast (generate_series) or validated (repo batch)")
)

const clearOption = Options.boolean("clear").pipe(
  Options.withAlias("c"),
  Options.withDescription("Clear existing mock data before seeding")
)

const statsOption = Options.boolean("stats").pipe(
  Options.withAlias("s"),
  Options.withDescription("Show stats only, don't seed")
)

const assetsOnlyOption = Options.boolean("assets-only").pipe(
  Options.withAlias("a"),
  Options.withDescription("Only seed assets (skip readings and alarms)")
)
```

**Acceptance criteria**:
- [ ] File created with @gbg/ctl imports
- [ ] All 4 CLI options defined with descriptions and aliases
- [ ] Uses ctl utility options where applicable (verboseOption)

### Phase 2: Database Layer Composition

**File**: `src/lib/iiot/seed/runner.ts` (continued)

**Steps**:

1. Define the database connection layer (matches integration test):
```typescript
// =============================================================================
// Database Layer (matches integration test configuration)
// =============================================================================

const transformResultNames = (columnName: string): string =>
  columnName.replace(/_([a-z])/g, (_, char) => char.toUpperCase())

const SeedPgClient = PgClient.layer({
  host: "localhost",
  port: 5433,
  database: "iiot_mock",
  username: "iiot",
  password: Redacted.make("iiot_dev"),
  maxConnections: 5,
  transformResultNames,
})
```

2. Compose the full seed layer:
```typescript
import { IIoTMigratorLive } from "../migrations/runner"
import { IIoTRepositoriesLive } from "../repos"

const SeedMigratorLive = IIoTMigratorLive.pipe(Layer.provide(SeedPgClient))
const SeedPgClientWithMigrations = Layer.merge(SeedPgClient, SeedMigratorLive)

const FullSeedLayer = Layer.merge(
  SeedPgClientWithMigrations,
  IIoTRepositoriesLive.pipe(Layer.provide(SeedPgClientWithMigrations))
)
```

**Acceptance criteria**:
- [ ] `SeedPgClient` defined with correct connection parameters
- [ ] `FullSeedLayer` composes PgClient + Migrator + Repos

### Phase 3: Command Handler Implementation

**Steps**:

1. Import seed functions and create mode configurator:
```typescript
import {
  SeedConfig,
  type SeedMode,
  seedAssets,
  seedAll,
  clearMockData,
  getDataStats,
} from "./mock-data"

const configureSeedMode = (mode: SeedMode): Effect.Effect<void> =>
  Effect.sync(() => {
    ;(SeedConfig as { mode: SeedMode }).mode = mode
  }).pipe(Effect.tap(() => Effect.log(`Seed mode configured: ${mode}`)))
```

2. Create the main command:
```typescript
const seedCommand = Command.make(
  "seed",
  { mode: modeOption, clear: clearOption, stats: statsOption, assetsOnly: assetsOnlyOption, verbose: verboseOption },
  ({ mode, clear, stats, assetsOnly, verbose }) =>
    Effect.gen(function* () {
      yield* Console.log("")
      yield* Console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      yield* Console.log("🏭 IIoT SEED RUNNER (via @gbg/ctl)")
      yield* Console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

      if (verbose) {
        yield* Console.log(`Configuration:`)
        yield* Console.log(`  Mode: ${mode}`)
        yield* Console.log(`  Clear: ${clear}`)
        yield* Console.log(`  Stats only: ${stats}`)
        yield* Console.log(`  Assets only: ${assetsOnly}`)
      }
      yield* Console.log("")

      // Stats-only mode
      if (stats) {
        yield* Console.log("📊 Current data statistics:")
        const dataStats = yield* getDataStats
        yield* Console.log(`  Readings: ${dataStats.readings.toLocaleString()}`)
        yield* Console.log(`  Alarms: ${dataStats.alarms.toLocaleString()}`)
        yield* Console.log("")
        yield* Console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        return
      }

      // Configure and execute
      yield* configureSeedMode(mode as SeedMode)

      if (clear) {
        yield* Console.log("🗑️  Clearing existing mock data...")
        yield* clearMockData
        yield* Console.log("")
      }

      if (assetsOnly) {
        yield* Console.log("🌱 Seeding assets only...")
        yield* seedAssets
      } else {
        yield* Console.log("🌱 Seeding all mock data...")
        yield* seedAll
      }

      // Final stats
      yield* Console.log("")
      yield* Console.log("📊 Final data statistics:")
      const finalStats = yield* getDataStats
      yield* Console.log(`  Readings: ${finalStats.readings.toLocaleString()}`)
      yield* Console.log(`  Alarms: ${finalStats.alarms.toLocaleString()}`)
      yield* Console.log("")
      yield* Console.log("✅ Seed complete!")
      yield* Console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    })
).pipe(Command.withDescription("Seed the IIoT database with mock data"))
```

**Acceptance criteria**:
- [ ] Handler respects all flags (--stats, --clear, --assets-only, --verbose)
- [ ] Handler sets SeedConfig.mode before running seeders
- [ ] Handler shows progress and final statistics

### Phase 4: CLI Assembly with ctl Patterns

**Steps**:

1. Assemble and run using ctl patterns:
```typescript
// =============================================================================
// CLI Assembly (ctl pattern)
// =============================================================================

const cli = Command.run(seedCommand, {
  name: "iiot-seed",
  version: "1.0.0",
})

// =============================================================================
// Main Entry Point
// =============================================================================

cli(process.argv).pipe(
  Effect.provide(FullSeedLayer),
  Effect.provide(NodeContext.layer),
  Effect.catchAllDefect((defect) =>
    Effect.gen(function* () {
      yield* Console.error("")
      yield* Console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      yield* Console.error("❌ SEED FAILED")
      yield* Console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      yield* Console.error("")
      yield* Console.error(`Error: ${String(defect)}`)
      yield* Console.error("")
      yield* Console.error("Troubleshooting:")
      yield* Console.error("  1. Ensure database is running: docker compose -f docker/docker-compose.iiot.yml up -d")
      yield* Console.error("  2. Check connection: localhost:5433, database: iiot_mock")
      yield* Console.error("")
      return yield* Effect.fail(defect)
    })
  ),
  NodeRuntime.runMain
)
```

**Acceptance criteria**:
- [ ] CLI runs with `bun run src/lib/iiot/seed/runner.ts`
- [ ] Database errors show troubleshooting hints
- [ ] Exit codes are correct

### Phase 5: Add package.json Script

**File to modify**: `package.json`

```json
{
  "scripts": {
    "seed:iiot": "bun run src/lib/iiot/seed/runner.ts"
  }
}
```

**Acceptance criteria**:
- [ ] `bun run seed:iiot` works as shorthand
- [ ] `bun run seed:iiot --help` shows usage

### Phase 6: Integration Test

**Manual verification**:
```bash
# Help
bun run seed:iiot --help

# Stats only
bun run seed:iiot --stats

# Assets only
bun run seed:iiot --assets-only --verbose

# Full seed with clear
bun run seed:iiot --clear --mode validated --verbose

# Fast mode (default)
bun run seed:iiot
```

**Database verification**:
```bash
docker exec iiot-mock-db psql -U iiot -d iiot_mock -c "SELECT COUNT(*) FROM iiot.sensor_readings;"
docker exec iiot-mock-db psql -U iiot -d iiot_mock -c "SELECT COUNT(*) FROM iiot.alarms;"
```

**Acceptance criteria**:
- [ ] --help shows all options
- [ ] --stats returns counts without seeding
- [ ] --assets-only skips readings/alarms
- [ ] --clear clears before seeding
- [ ] --mode validated uses repo.insertBatch
- [ ] --verbose shows configuration

## Complete Implementation

```typescript
#!/usr/bin/env bun
/**
 * IIoT Seed Runner CLI
 *
 * CLI tool for seeding the IIoT database with mock data.
 * Built with @gbg/ctl - Effect CLI Framework
 *
 * Usage:
 *   bun run src/lib/iiot/seed/runner.ts [options]
 *
 * Options:
 *   --mode <fast|validated>  Seed mode (default: fast)
 *   --clear                  Clear existing data first
 *   --stats                  Show stats only, don't seed
 *   --assets-only            Only seed assets (skip readings/alarms)
 *   --verbose                Show detailed configuration
 *
 * Examples:
 *   bun run src/lib/iiot/seed/runner.ts                     # Default: fast mode
 *   bun run src/lib/iiot/seed/runner.ts --mode validated    # Validated mode
 *   bun run src/lib/iiot/seed/runner.ts --clear --verbose   # Clear first, verbose
 *   bun run src/lib/iiot/seed/runner.ts --stats             # Show counts only
 *   bun run src/lib/iiot/seed/runner.ts --assets-only       # Assets hierarchy only
 *
 * @module
 */

import { Command, Options, NodeContext, NodeRuntime, verboseOption } from "@gbg/ctl"
import { Console, Effect, Layer, Redacted } from "effect"
import { PgClient } from "@effect/sql-pg"

import { IIoTMigratorLive } from "../migrations/runner"
import { IIoTRepositoriesLive } from "../repos"
import {
  SeedConfig,
  type SeedMode,
  seedAssets,
  seedAll,
  clearMockData,
  getDataStats,
} from "./mock-data"

// =============================================================================
// CLI Options
// =============================================================================

const modeOption = Options.choice("mode", ["fast", "validated"]).pipe(
  Options.withAlias("m"),
  Options.withDefault("fast"),
  Options.withDescription("Seed mode: fast (generate_series) or validated (repo batch)")
)

const clearOption = Options.boolean("clear").pipe(
  Options.withAlias("c"),
  Options.withDescription("Clear existing mock data before seeding")
)

const statsOption = Options.boolean("stats").pipe(
  Options.withAlias("s"),
  Options.withDescription("Show stats only, don't seed")
)

const assetsOnlyOption = Options.boolean("assets-only").pipe(
  Options.withAlias("a"),
  Options.withDescription("Only seed assets (skip readings and alarms)")
)

// =============================================================================
// Database Layer
// =============================================================================

const transformResultNames = (columnName: string): string =>
  columnName.replace(/_([a-z])/g, (_, char) => char.toUpperCase())

const SeedPgClient = PgClient.layer({
  host: "localhost",
  port: 5433,
  database: "iiot_mock",
  username: "iiot",
  password: Redacted.make("iiot_dev"),
  maxConnections: 5,
  transformResultNames,
})

const SeedMigratorLive = IIoTMigratorLive.pipe(Layer.provide(SeedPgClient))
const SeedPgClientWithMigrations = Layer.merge(SeedPgClient, SeedMigratorLive)

const FullSeedLayer = Layer.merge(
  SeedPgClientWithMigrations,
  IIoTRepositoriesLive.pipe(Layer.provide(SeedPgClientWithMigrations))
)

// =============================================================================
// Seed Mode Configuration
// =============================================================================

const configureSeedMode = (mode: SeedMode): Effect.Effect<void> =>
  Effect.sync(() => {
    ;(SeedConfig as { mode: SeedMode }).mode = mode
  }).pipe(Effect.tap(() => Effect.log(`Seed mode configured: ${mode}`)))

// =============================================================================
// Command Handler
// =============================================================================

const seedCommand = Command.make(
  "seed",
  { mode: modeOption, clear: clearOption, stats: statsOption, assetsOnly: assetsOnlyOption, verbose: verboseOption },
  ({ mode, clear, stats, assetsOnly, verbose }) =>
    Effect.gen(function* () {
      yield* Console.log("")
      yield* Console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      yield* Console.log("🏭 IIoT SEED RUNNER (via @gbg/ctl)")
      yield* Console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

      if (verbose) {
        yield* Console.log(`Configuration:`)
        yield* Console.log(`  Mode: ${mode}`)
        yield* Console.log(`  Clear: ${clear}`)
        yield* Console.log(`  Stats only: ${stats}`)
        yield* Console.log(`  Assets only: ${assetsOnly}`)
      }
      yield* Console.log("")

      if (stats) {
        yield* Console.log("📊 Current data statistics:")
        const dataStats = yield* getDataStats
        yield* Console.log(`  Readings: ${dataStats.readings.toLocaleString()}`)
        yield* Console.log(`  Alarms: ${dataStats.alarms.toLocaleString()}`)
        yield* Console.log("")
        yield* Console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        return
      }

      yield* configureSeedMode(mode as SeedMode)

      if (clear) {
        yield* Console.log("🗑️  Clearing existing mock data...")
        yield* clearMockData
        yield* Console.log("")
      }

      if (assetsOnly) {
        yield* Console.log("🌱 Seeding assets only...")
        yield* seedAssets
      } else {
        yield* Console.log("🌱 Seeding all mock data...")
        yield* seedAll
      }

      yield* Console.log("")
      yield* Console.log("📊 Final data statistics:")
      const finalStats = yield* getDataStats
      yield* Console.log(`  Readings: ${finalStats.readings.toLocaleString()}`)
      yield* Console.log(`  Alarms: ${finalStats.alarms.toLocaleString()}`)
      yield* Console.log("")
      yield* Console.log("✅ Seed complete!")
      yield* Console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    })
).pipe(Command.withDescription("Seed the IIoT database with mock data"))

// =============================================================================
// CLI Assembly
// =============================================================================

const cli = Command.run(seedCommand, {
  name: "iiot-seed",
  version: "1.0.0",
})

// =============================================================================
// Main Entry Point
// =============================================================================

cli(process.argv).pipe(
  Effect.provide(FullSeedLayer),
  Effect.provide(NodeContext.layer),
  Effect.catchAllDefect((defect) =>
    Effect.gen(function* () {
      yield* Console.error("")
      yield* Console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      yield* Console.error("❌ SEED FAILED")
      yield* Console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      yield* Console.error("")
      yield* Console.error(`Error: ${String(defect)}`)
      yield* Console.error("")
      yield* Console.error("Troubleshooting:")
      yield* Console.error("  1. Ensure database is running: docker compose -f docker/docker-compose.iiot.yml up -d")
      yield* Console.error("  2. Check connection: localhost:5433, database: iiot_mock")
      yield* Console.error("  3. Verify migrations have run successfully")
      yield* Console.error("")
      return yield* Effect.fail(defect)
    })
  ),
  NodeRuntime.runMain
)
```

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `src/lib/iiot/seed/runner.ts` | CREATE | Main CLI runner using @gbg/ctl |
| `package.json` | MODIFY | Add `seed:iiot` script alias |

## Research Aids

| Topic | Resource |
|-------|----------|
| @gbg/ctl docs | `packages/ctl/README.md` |
| ctl core exports | `packages/ctl/src/index.ts` |
| spikectl example | `packages/spikectl/src/index.ts` |
| Integration layer | `src/lib/iiot/__tests__/integration/layer.ts` |
| Seed functions | `src/lib/iiot/seed/mock-data.ts` |

## Skills to Invoke

- `/effect-patterns` - Effect.gen, Layer composition
- `/cli-core` - @effect/cli Command, Options patterns
- `/tdd` - Test-driven verification
