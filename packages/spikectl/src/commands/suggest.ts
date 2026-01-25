/**
 * suggest command - Get hypothesis suggestions for an error
 *
 * @skill spikectl/core
 */

import { Args, Command } from "@effect/cli"
import { Effect, Console } from "effect"

const errorMessage = Args.text({ name: "error" }).pipe(
  Args.withDescription("Error message to analyze for suggestions")
)

export const suggestCommand = Command.make(
  "suggest",
  { errorMessage },
  ({ errorMessage }) =>
    Effect.gen(function* () {
      yield* Console.log(``)
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      yield* Console.log(`🔮 HYPOTHESIS SUGGESTIONS`)
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      yield* Console.log(``)
      yield* Console.log(`Error: "${errorMessage}"`)

      // Derive suggested name from error
      const suggestedName = errorMessage.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)

      // Basic domain detection
      const lowerError = errorMessage.toLowerCase()
      let domain = "general"
      if (lowerError.includes("datetime") || lowerError.includes("timestamp")) domain = "datetime"
      else if (lowerError.includes("null") || lowerError.includes("undefined")) domain = "nullability"
      else if (lowerError.includes("type") || lowerError.includes("schema")) domain = "encoding"
      else if (lowerError.includes("sql") || lowerError.includes("database")) domain = "database"
      else if (lowerError.includes("network") || lowerError.includes("fetch")) domain = "network"

      yield* Console.log(``)
      yield* Console.log(`🎯 ANALYSIS:`)
      yield* Console.log(`   Domain: ${domain}`)
      yield* Console.log(`   Suggested spike name: ${suggestedName}`)
      yield* Console.log(``)
      yield* Console.log(`📋 SUGGESTED HYPOTHESES:`)
      yield* Console.log(``)
      yield* Console.log(`   H1: Data input`)
      yield* Console.log(`       Claim: "Input data has expected shape and types"`)
      yield* Console.log(``)
      yield* Console.log(`   H2: Transformation`)
      yield* Console.log(`       Claim: "Data transformation produces correct output"`)
      yield* Console.log(``)
      yield* Console.log(`   H3: Integration point`)
      yield* Console.log(`       Claim: "Component accepts transformed data without error"`)
      yield* Console.log(``)
      yield* Console.log(`   H4: Full flow`)
      yield* Console.log(`       Claim: "End-to-end operation completes successfully"`)
      yield* Console.log(``)
      yield* Console.log(`📝 GENERATE SPIKE:`)
      yield* Console.log(`   spikectl init ${suggestedName}`)
      yield* Console.log(`   # Edit config with hypotheses above`)
      yield* Console.log(`   spikectl new --config spike-${suggestedName}.config.json`)
      yield* Console.log(``)
      yield* Console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

      // Emit steering message
      yield* Console.log(``)
      yield* Console.log(`<!-- SPIKE_STEERING`)
      yield* Console.log(JSON.stringify({
        action: "CREATE_SPIKE",
        suggestedName,
        patternMatch: null,
        hypotheses: [
          { id: "H1", claim: "Input data has expected shape and types" },
          { id: "H2", claim: "Data transformation produces correct output" },
          { id: "H3", claim: "Component accepts transformed data without error" },
          { id: "H4", claim: "End-to-end operation completes successfully" },
        ],
        nextCommand: `spikectl init ${suggestedName}`,
        skills: ["spike-testing"],
      }))
      yield* Console.log(`-->`)
    })
).pipe(Command.withDescription("Suggest hypotheses based on error message"))
