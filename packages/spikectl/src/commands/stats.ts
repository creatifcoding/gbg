/**
 * stats command - View pattern statistics
 *
 * Displays statistics from SQLite pattern store with optional evolution.
 *
 * @skill spikectl/core
 */

import { Command, Options } from "@effect/cli"
import { Effect } from "effect"
import { PatternStore, makePatternStoreLayer, StorageError, APP_PATHS } from "../services/pattern-store.js"
import {
  section,
  sectionEnd,
  subSection,
  patternTable,
  printKv,
  printList,
  spikeErrorHandler,
  NextSteps,
  type ColumnDef,
} from "../output.js"

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

// Table types
type DomainRow = { domain: string; patterns: number; [key: string]: unknown }
type PatternRow = { status: string; id: string; domain: string; success: string; [key: string]: unknown }
type PerformerRow = { id: string; rate: string; [key: string]: unknown }

const domainColumns: ColumnDef<DomainRow>[] = [
  { key: "domain", header: "Domain" },
  { key: "patterns", header: "Patterns" },
]

const patternColumns: ColumnDef<PatternRow>[] = [
  { key: "status", header: "" },
  { key: "id", header: "Pattern" },
  { key: "domain", header: "Domain" },
  { key: "success", header: "Success %" },
]

const performerColumns: ColumnDef<PerformerRow>[] = [
  { key: "id", header: "Pattern" },
  { key: "rate", header: "Success %" },
]

export const statsCommand = Command.make("stats", { evolve, verbose }, ({ evolve, verbose }) =>
  Effect.gen(function* () {
    yield* section("SPIKE PATTERN STATISTICS", "")

    const store = yield* PatternStore
    const stats = yield* store.getStats()

    if (stats.totalPatterns === 0) {
      yield* subSection("NO DATA", "")
      yield* printKv("Status", "No patterns recorded yet")
      yield* subSection("TO START", "")
      yield* printList(NextSteps.noPatterns())
    } else {
      yield* subSection("SUMMARY", "")
      yield* printKv("Total patterns", String(stats.totalPatterns))
      yield* printKv("Total fixes", String(stats.totalFixes))
      yield* printKv("Avg success rate", `${(stats.avgSuccessRate * 100).toFixed(1)}%`)

      if (stats.topDomains.length > 0) {
        yield* subSection("TOP DOMAINS", "")
        const domainRows: DomainRow[] = stats.topDomains.map(({ domain, count }) => ({
          domain,
          patterns: count,
        }))
        yield* patternTable(domainRows, domainColumns)
      }

      if (stats.recentPatterns.length > 0) {
        yield* subSection("RECENT PATTERNS", "")
        const patternRows: PatternRow[] = stats.recentPatterns.map((pattern) => {
          const rate = store.successRate(pattern)
          const rateStr = `${(rate * 100).toFixed(0)}%`
          const emoji = rate >= 0.7 ? "OK" : rate >= 0.4 ? "--" : "!!"
          return {
            status: emoji,
            id: pattern.id,
            domain: pattern.domain,
            success: rateStr,
          }
        })
        yield* patternTable(patternRows, patternColumns)

        if (verbose) {
          yield* subSection("PATTERN DETAILS", "")
          for (const pattern of stats.recentPatterns) {
            yield* printKv(pattern.id, "")
            yield* printKv("  Error", pattern.errorSignature)
            yield* printKv("  Uses", `${pattern.successCount + pattern.failureCount} (${pattern.successCount} success, ${pattern.failureCount} fail)`)
            if (pattern.fixes.length > 0) {
              yield* printKv("  Last fix", `"${pattern.fixes[0].fix}"`)
            }
          }
        }
      }

      if (evolve) {
        yield* subSection("EVOLUTION ANALYSIS", "")

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
          yield* printKv("LOW PERFORMERS", "(consider pruning)")
          const lowRows: PerformerRow[] = lowPerformers.map(p => ({
            id: p.id,
            rate: `${(store.successRate(p) * 100).toFixed(0)}%`,
          }))
          yield* patternTable(lowRows, performerColumns)
        }

        if (highPerformers.length > 0) {
          yield* printKv("HIGH PERFORMERS", "(promote as templates)")
          const highRows: PerformerRow[] = highPerformers.map(p => ({
            id: p.id,
            rate: `${(store.successRate(p) * 100).toFixed(0)}%`,
          }))
          yield* patternTable(highRows, performerColumns)
        }

        if (lowPerformers.length === 0 && highPerformers.length === 0) {
          yield* printKv("Status", "Need more data for evolution (patterns need 3+ uses)")
        }
      }
    }

    yield* printKv("Database", APP_PATHS.db)
    yield* sectionEnd()
  }).pipe(
    Effect.catchTag("StorageError", (e: StorageError) => spikeErrorHandler(e)),
    Effect.provide(makePatternStoreLayer())
  )
).pipe(Command.withDescription("Show pattern statistics and optionally evolve templates"))
