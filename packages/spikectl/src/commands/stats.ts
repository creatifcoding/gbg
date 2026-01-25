/**
 * stats command - View pattern statistics
 *
 * Displays statistics from SQLite pattern store with optional evolution.
 *
 * @skill spikectl/core
 */

import { Command, Options } from "@effect/cli"
import { Effect, Console } from "effect"
import { PatternStore, makePatternStoreLayer, StorageError, APP_PATHS } from "../services/pattern-store.js"

const evolve = Options.boolean("evolve").pipe(
  Options.withAlias("e"),
  Options.withDefault(false),
  Options.withDescription("Perform template evolution (prune bad patterns, promote good ones)")
)

const verbose = Options.boolean("verbose").pipe(
  Options.withAlias("v"),
  Options.withDefault(false),
  Options.withDescription("Show detailed pattern information")
)

export const statsCommand = Command.make("stats", { evolve, verbose }, ({ evolve, verbose }) =>
  Effect.gen(function* () {
    yield* Console.log(``)
    yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    yield* Console.log(`📊 SPIKE PATTERN STATISTICS`)
    yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    const store = yield* PatternStore
    const stats = yield* store.getStats()

    if (stats.totalPatterns === 0) {
      yield* Console.log(``)
      yield* Console.log(`ℹ️  No patterns recorded yet.`)
      yield* Console.log(``)
      yield* Console.log(`📝 TO START:`)
      yield* Console.log(`   1. Run a spike: spikectl run <file>`)
      yield* Console.log(`   2. Record learning: spikectl learn <file> --fix "description"`)
    } else {
      yield* Console.log(``)
      yield* Console.log(`📈 SUMMARY:`)
      yield* Console.log(`   Total patterns: ${stats.totalPatterns}`)
      yield* Console.log(`   Total fixes: ${stats.totalFixes}`)
      yield* Console.log(`   Avg success rate: ${(stats.avgSuccessRate * 100).toFixed(1)}%`)

      if (stats.topDomains.length > 0) {
        yield* Console.log(``)
        yield* Console.log(`🏷️  TOP DOMAINS:`)
        for (const { domain, count } of stats.topDomains) {
          yield* Console.log(`   ${domain}: ${count} pattern(s)`)
        }
      }

      if (stats.recentPatterns.length > 0) {
        yield* Console.log(``)
        yield* Console.log(`🕐 RECENT PATTERNS:`)
        for (const pattern of stats.recentPatterns) {
          const rate = store.successRate(pattern)
          const rateStr = (rate * 100).toFixed(0)
          const emoji = rate >= 0.7 ? "✅" : rate >= 0.4 ? "⚡" : "⚠️"
          yield* Console.log(`   ${emoji} ${pattern.id} (${pattern.domain}) - ${rateStr}% success`)

          if (verbose) {
            yield* Console.log(`      Error: ${pattern.errorSignature}`)
            yield* Console.log(`      Uses: ${pattern.successCount + pattern.failureCount} (${pattern.successCount} success, ${pattern.failureCount} fail)`)
            if (pattern.fixes.length > 0) {
              yield* Console.log(`      Last fix: "${pattern.fixes[0].fix}"`)
            }
          }
        }
      }

      if (evolve) {
        yield* Console.log(``)
        yield* Console.log(`🧬 EVOLUTION ANALYSIS:`)

        const patterns = yield* store.listPatterns()
        const lowPerformers = patterns.filter(p => {
          const total = p.successCount + p.failureCount
          return total >= 3 && store.successRate(p) < 0.3
        })
        const highPerformers = patterns.filter(p => {
          const total = p.successCount + p.failureCount
          return total >= 3 && store.successRate(p) >= 0.8
        })

        if (lowPerformers.length > 0) {
          yield* Console.log(``)
          yield* Console.log(`   ⚠️  LOW PERFORMERS (consider pruning):`)
          for (const p of lowPerformers) {
            yield* Console.log(`      - ${p.id}: ${(store.successRate(p) * 100).toFixed(0)}% success`)
          }
        }

        if (highPerformers.length > 0) {
          yield* Console.log(``)
          yield* Console.log(`   ✅ HIGH PERFORMERS (promote as templates):`)
          for (const p of highPerformers) {
            yield* Console.log(`      - ${p.id}: ${(store.successRate(p) * 100).toFixed(0)}% success`)
          }
        }

        if (lowPerformers.length === 0 && highPerformers.length === 0) {
          yield* Console.log(`   ℹ️  Need more data for evolution (patterns need 3+ uses)`)
        }
      }
    }

    yield* Console.log(``)
    yield* Console.log(`💾 Database: ${APP_PATHS.db}`)
    yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  }).pipe(
    Effect.catchTag("StorageError", (e: StorageError) =>
      Console.error(`❌ Storage error (${e.operation}): ${e.cause}`)
    ),
    Effect.provide(makePatternStoreLayer())
  )
).pipe(Command.withDescription("Show pattern statistics and optionally evolve templates"))
