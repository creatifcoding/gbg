/**
 * learn command - Extract learnings from completed spike
 *
 * Persists spike patterns and fixes to SQLite database for autopoietic learning.
 *
 * @skill spikectl/core
 */

import { Args, Command, Options } from "@effect/cli"
import { Effect, Console, Option } from "effect"
import * as path from "node:path"
import * as fs from "node:fs/promises"
import { extractHypothesesFromContent, deriveDomainFromContent } from "../services/generators.js"
import { PatternStore, makePatternStoreLayer, StorageError, APP_PATHS } from "../services/pattern-store.js"
import type { SpikePattern, SpikeFix } from "../schemas/index.js"

const learnFile = Args.text({ name: "file" }).pipe(
  Args.withDescription("Path to completed spike file to extract learnings from")
)

const fixDescription = Options.text("fix").pipe(
  Options.withAlias("f"),
  Options.optional,
  Options.withDescription("Description of the fix that was applied")
)

const rootCauseOpt = Options.text("cause").pipe(
  Options.withAlias("c"),
  Options.optional,
  Options.withDescription("Root cause of the issue")
)

const errorSignatureOpt = Options.text("error").pipe(
  Options.withAlias("e"),
  Options.optional,
  Options.withDescription("Error signature pattern (regex) for future matching")
)

const tagsOpt = Options.text("tags").pipe(
  Options.withAlias("t"),
  Options.optional,
  Options.withDescription("Comma-separated tags for searchability")
)

export const learnCommand = Command.make(
  "learn",
  { learnFile, fixDescription, rootCauseOpt, errorSignatureOpt, tagsOpt },
  ({ learnFile, fixDescription, rootCauseOpt, errorSignatureOpt, tagsOpt }) =>
    Effect.gen(function* () {
      yield* Console.log(``)
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      yield* Console.log(`🧠 LEARNING EXTRACTION: ${learnFile}`)
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

      // 1. Read spike file
      const content = yield* Effect.promise(() => fs.readFile(learnFile, "utf-8")).pipe(
        Effect.mapError(() => `Could not read spike file: ${learnFile}`)
      )

      // 2. Extract spike metadata
      const hypotheses = extractHypothesesFromContent(content)
      const domain = deriveDomainFromContent(content)

      // 3. Derive pattern ID from filename
      const filename = path.basename(learnFile, ".ts")
      const patternId = filename.replace(/^(spike-|diagnose-)/, "")

      yield* Console.log(``)
      yield* Console.log(`📊 PATTERN IDENTIFIED:`)
      yield* Console.log(`   ID: ${patternId}`)
      yield* Console.log(`   Domain: ${domain}`)
      yield* Console.log(`   Hypotheses found: ${hypotheses.length}`)

      const fixText = Option.getOrElse(fixDescription, () => "")
      const rootCause = Option.getOrElse(rootCauseOpt, () => fixText ? "See fix description" : "")
      const errorSignature = Option.getOrElse(errorSignatureOpt, () => patternId)
      const tags = Option.getOrElse(tagsOpt, () => domain).split(",").map(t => t.trim()).filter(Boolean)

      if (fixText) {
        // Persist to pattern store
        const store = yield* PatternStore

        // Check if pattern exists
        const existing = yield* store.findPattern(patternId)
        const now = new Date().toISOString().split("T")[0]

        const fix: SpikeFix = {
          rootCause,
          fix: fixText,
          appliedAt: now,
        }

        if (existing) {
          // Record success on existing pattern
          yield* store.recordSuccess(patternId, fix)
          yield* Console.log(``)
          yield* Console.log(`✅ SUCCESS RECORDED:`)
          yield* Console.log(`   Pattern: ${patternId}`)
          yield* Console.log(`   Success count: ${existing.successCount + 1}`)
        } else {
          // Create new pattern
          const pattern: SpikePattern = {
            id: patternId,
            errorSignature,
            domain,
            hypothesisTemplate: hypotheses.map((h, i) => ({
              id: `H${i + 1}`,
              description: h,
              claim: h,
            })),
            successCount: 1,
            failureCount: 0,
            lastUsed: now,
            fixes: [fix],
            tags,
          }
          yield* store.upsertPattern(pattern)
          yield* Console.log(``)
          yield* Console.log(`✅ NEW PATTERN CREATED:`)
          yield* Console.log(`   ID: ${patternId}`)
          yield* Console.log(`   Error signature: ${errorSignature}`)
          yield* Console.log(`   Domain: ${domain}`)
          yield* Console.log(`   Tags: ${tags.join(", ")}`)
        }

        yield* Console.log(``)
        yield* Console.log(`📝 FIX RECORDED:`)
        yield* Console.log(`   "${fixText}"`)
        yield* Console.log(``)
        yield* Console.log(`💾 Persisted to: ${APP_PATHS.db}`)
      } else {
        yield* Console.log(``)
        yield* Console.log(`📝 TO RECORD A FIX:`)
        yield* Console.log(`   spikectl learn ${learnFile} --fix "description of what fixed it"`)
        yield* Console.log(``)
        yield* Console.log(`📝 ADVANCED OPTIONS:`)
        yield* Console.log(`   --cause "root cause"        # What caused the issue`)
        yield* Console.log(`   --error "regex pattern"     # Error signature for matching`)
        yield* Console.log(`   --tags "tag1,tag2"          # Searchable tags`)
      }

      yield* Console.log(``)
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    }).pipe(
      Effect.catchTag("StorageError", (e: StorageError) =>
        Console.error(`❌ Storage error (${e.operation}): ${e.cause}`)
      ),
      Effect.provide(makePatternStoreLayer())
    )
).pipe(Command.withDescription("Extract learnings from a completed spike"))
