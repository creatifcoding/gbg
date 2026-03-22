#!/usr/bin/env bun
/**
 * iiot-seed CLI
 *
 * CLI tool for seeding the IIoT database with mock data.
 * Built with @gbg/ctl - Effect CLI Framework
 *
 * Usage:
 *   bun run src/lib/iiot/seed/ctl/src/index.ts [command] [options]
 *
 * Commands:
 *   seed      Seed the database (default)
 *   stats     Show current data statistics
 *   clear     Clear mock data
 *
 * @skill iiot-seed/core
 */

import { Command, Options, verboseOption, NodeContext, NodeRuntime } from '@gbg/ctl'
import { Console, Effect, Layer, Redacted } from 'effect'
import { PgClient } from '@effect/sql-pg'

import { IIoTMigratorLive } from '../../../migrations/runner'
import { IIoTRepositoriesLive } from '../../../repos'
import {
  SeedConfig,
  type SeedMode,
  seedAssets,
  seedAll,
  clearMockData,
  getDataStats,
} from '../../mock-data'

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
// Shared Options
// =============================================================================

const modeOption = Options.choice('mode', ['fast', 'validated']).pipe(
  Options.withAlias('m'),
  Options.withDefault('fast'),
  Options.withDescription('Seed mode: fast (generate_series) or validated (repo batch)')
)

// =============================================================================
// Helper Effects
// =============================================================================

const configureSeedMode = (mode: SeedMode): Effect.Effect<void> =>
  Effect.sync(() => {
    ;(SeedConfig as { mode: SeedMode }).mode = mode
  }).pipe(Effect.tap(() => Effect.log(`Seed mode configured: ${mode}`)))

const printBanner = Effect.gen(function* () {
  yield* Console.log('')
  yield* Console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  yield* Console.log('🏭 IIoT SEED CLI (via @gbg/ctl)')
  yield* Console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
})

const printStats = Effect.gen(function* () {
  yield* Console.log('')
  yield* Console.log('📊 Data statistics:')
  const stats = yield* getDataStats
  yield* Console.log(`  Readings: ${stats.readings.toLocaleString()}`)
  yield* Console.log(`  Alarms: ${stats.alarms.toLocaleString()}`)
})

const printFooter = Effect.gen(function* () {
  yield* Console.log('')
  yield* Console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
})

// =============================================================================
// Commands
// =============================================================================

/**
 * stats command - Show current data statistics
 */
const statsCommand = Command.make(
  'stats',
  { verbose: verboseOption },
  ({ verbose }) =>
    Effect.gen(function* () {
      yield* printBanner
      if (verbose) {
        yield* Console.log('Querying database...')
      }
      yield* printStats
      yield* printFooter
    })
).pipe(Command.withDescription('Show current data statistics'))

/**
 * clear command - Clear all mock data
 */
const clearCommand = Command.make(
  'clear',
  { verbose: verboseOption },
  ({ verbose }) =>
    Effect.gen(function* () {
      yield* printBanner
      yield* Console.log('')
      yield* Console.log('🗑️  Clearing mock data...')
      yield* clearMockData
      if (verbose) {
        yield* printStats
      }
      yield* Console.log('')
      yield* Console.log('✅ Mock data cleared!')
      yield* printFooter
    })
).pipe(Command.withDescription('Clear all mock data'))

/**
 * seed command - Seed the database with mock data
 */
const assetsOnlyOption = Options.boolean('assets-only').pipe(
  Options.withAlias('a'),
  Options.withDescription('Only seed assets (skip readings and alarms)')
)

const clearOption = Options.boolean('clear').pipe(
  Options.withAlias('c'),
  Options.withDescription('Clear existing mock data before seeding')
)

const seedCommand = Command.make(
  'seed',
  { mode: modeOption, assetsOnly: assetsOnlyOption, clear: clearOption, verbose: verboseOption },
  ({ mode, assetsOnly, clear, verbose }) =>
    Effect.gen(function* () {
      yield* printBanner

      if (verbose) {
        yield* Console.log('')
        yield* Console.log('Configuration:')
        yield* Console.log(`  Mode: ${mode}`)
        yield* Console.log(`  Assets only: ${assetsOnly}`)
        yield* Console.log(`  Clear first: ${clear}`)
      }

      yield* configureSeedMode(mode as SeedMode)

      if (clear) {
        yield* Console.log('')
        yield* Console.log('🗑️  Clearing existing mock data...')
        yield* clearMockData
      }

      yield* Console.log('')
      if (assetsOnly) {
        yield* Console.log('🌱 Seeding assets only...')
        yield* seedAssets
      } else {
        yield* Console.log('🌱 Seeding all mock data...')
        yield* seedAll
      }

      yield* printStats
      yield* Console.log('')
      yield* Console.log('✅ Seed complete!')
      yield* printFooter
    })
).pipe(Command.withDescription('Seed the IIoT database with mock data'))

// =============================================================================
// Root Command
// =============================================================================

const iiotSeedCommand = Command.make('iiot-seed').pipe(
  Command.withDescription('IIoT Seed CLI - Database seeding tool built with @gbg/ctl'),
  Command.withSubcommands([seedCommand, statsCommand, clearCommand])
)

// =============================================================================
// CLI Assembly
// =============================================================================

const cli = Command.run(iiotSeedCommand, {
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
      yield* Console.error('❌ COMMAND FAILED')
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
