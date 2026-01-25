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

import { Command, Options, NodeContext, NodeRuntime, verboseOption } from '@gbg/ctl'
import { Console, Effect, Layer, Redacted } from 'effect'
import { PgClient } from '@effect/sql-pg'

import { IIoTMigratorLive } from '../migrations/runner'
import { IIoTRepositoriesLive } from '../repos'
import {
  SeedConfig,
  type SeedMode,
  seedAssets,
  seedAll,
  clearMockData,
  getDataStats,
} from './mock-data'

// =============================================================================
// CLI Options
// =============================================================================

const modeOption = Options.choice('mode', ['fast', 'validated']).pipe(
  Options.withAlias('m'),
  Options.withDefault('fast'),
  Options.withDescription('Seed mode: fast (generate_series) or validated (repo batch)')
)

const clearOption = Options.boolean('clear').pipe(
  Options.withAlias('c'),
  Options.withDescription('Clear existing mock data before seeding')
)

const statsOption = Options.boolean('stats').pipe(
  Options.withAlias('s'),
  Options.withDescription('Show stats only, don\'t seed')
)

const assetsOnlyOption = Options.boolean('assets-only').pipe(
  Options.withAlias('a'),
  Options.withDescription('Only seed assets (skip readings and alarms)')
)

// =============================================================================
// Database Layer
// =============================================================================

const transformResultNames = (columnName: string): string =>
  columnName.replace(/_([a-z])/g, (_, char) => char.toUpperCase())

const SeedPgClient = PgClient.layer({
  host: 'localhost',
  port: 5433,
  database: 'iiot_mock',
  username: 'iiot',
  password: Redacted.make('iiot_dev'),
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
  'seed',
  { mode: modeOption, clear: clearOption, stats: statsOption, assetsOnly: assetsOnlyOption, verbose: verboseOption },
  ({ mode, clear, stats, assetsOnly, verbose }) =>
    Effect.gen(function* () {
      yield* Console.log('')
      yield* Console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      yield* Console.log('🏭 IIoT SEED RUNNER (via @gbg/ctl)')
      yield* Console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      if (verbose) {
        yield* Console.log('Configuration:')
        yield* Console.log(`  Mode: ${mode}`)
        yield* Console.log(`  Clear: ${clear}`)
        yield* Console.log(`  Stats only: ${stats}`)
        yield* Console.log(`  Assets only: ${assetsOnly}`)
      }
      yield* Console.log('')

      if (stats) {
        yield* Console.log('📊 Current data statistics:')
        const dataStats = yield* getDataStats
        yield* Console.log(`  Readings: ${dataStats.readings.toLocaleString()}`)
        yield* Console.log(`  Alarms: ${dataStats.alarms.toLocaleString()}`)
        yield* Console.log('')
        yield* Console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        return
      }

      yield* configureSeedMode(mode as SeedMode)

      if (clear) {
        yield* Console.log('🗑️  Clearing existing mock data...')
        yield* clearMockData
        yield* Console.log('')
      }

      if (assetsOnly) {
        yield* Console.log('🌱 Seeding assets only...')
        yield* seedAssets
      } else {
        yield* Console.log('🌱 Seeding all mock data...')
        yield* seedAll
      }

      yield* Console.log('')
      yield* Console.log('📊 Final data statistics:')
      const finalStats = yield* getDataStats
      yield* Console.log(`  Readings: ${finalStats.readings.toLocaleString()}`)
      yield* Console.log(`  Alarms: ${finalStats.alarms.toLocaleString()}`)
      yield* Console.log('')
      yield* Console.log('✅ Seed complete!')
      yield* Console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    })
).pipe(Command.withDescription('Seed the IIoT database with mock data'))

// =============================================================================
// CLI Assembly
// =============================================================================

const cli = Command.run(seedCommand, {
  name: 'iiot-seed',
  version: '1.0.0',
})

// =============================================================================
// Main Entry Point
// =============================================================================

cli(process.argv).pipe(
  Effect.provide(FullSeedLayer),
  Effect.provide(NodeContext.layer),
  Effect.catchAllDefect((defect) =>
    Effect.gen(function* () {
      yield* Console.error('')
      yield* Console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      yield* Console.error('❌ SEED FAILED')
      yield* Console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      yield* Console.error('')
      yield* Console.error(`Error: ${String(defect)}`)
      yield* Console.error('')
      yield* Console.error('Troubleshooting:')
      yield* Console.error('  1. Ensure database is running: docker compose -f docker/docker-compose.iiot.yml up -d')
      yield* Console.error('  2. Check connection: localhost:5433, database: iiot_mock')
      yield* Console.error('  3. Verify migrations have run successfully')
      yield* Console.error('')
      return yield* Effect.fail(defect)
    })
  ),
  NodeRuntime.runMain
)
