/**
 * suggest command - Get hypothesis suggestions for an error
 *
 * @skill spikectl/core
 */

import { Args, Command, Options } from "@effect/cli"
import { Effect } from "effect"
import {
  section,
  sectionEnd,
  subSection,
  printKv,
  printList,
  emitSteering,
  type OutputMode,
} from "../output.js"

const errorMessage = Args.text({ name: "error" }).pipe(
  Args.withDescription("Error message to analyze for suggestions")
)

const agentMode = Options.boolean("agent").pipe(
  Options.withAlias("a"),
  Options.withDefault(false),
  Options.withDescription("Output structured JSON for agent consumption")
)

const HYPOTHESES = [
  { id: "H1", label: "Data input", claim: "Input data has expected shape and types" },
  { id: "H2", label: "Transformation", claim: "Data transformation produces correct output" },
  { id: "H3", label: "Integration point", claim: "Component accepts transformed data without error" },
  { id: "H4", label: "Full flow", claim: "End-to-end operation completes successfully" },
] as const

export const suggestCommand = Command.make(
  "suggest",
  { errorMessage, agentMode },
  ({ errorMessage, agentMode }) =>
    Effect.gen(function* () {
      const mode: OutputMode = agentMode ? "agent" : "console"

      yield* section("HYPOTHESIS SUGGESTIONS", "")

      yield* printKv("Error", `"${errorMessage}"`, "")

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

      yield* subSection("ANALYSIS", "")
      yield* printKv("Domain", domain)
      yield* printKv("Suggested spike name", suggestedName)

      yield* subSection("SUGGESTED HYPOTHESES", "")
      yield* printList(
        HYPOTHESES.map(h => `${h.id}: ${h.label} - "${h.claim}"`)
      )

      yield* subSection("GENERATE SPIKE", "")
      yield* printList([
        `spikectl init ${suggestedName}`,
        `# Edit config with hypotheses above`,
        `spikectl new --config spike-${suggestedName}.config.json`,
      ])

      yield* sectionEnd()

      // Emit steering message
      yield* emitSteering("suggest", {
        action: "CREATE_SPIKE",
        suggestedName,
        patternMatch: null,
        hypotheses: HYPOTHESES.map(h => ({ id: h.id, claim: h.claim })),
        nextCommand: `spikectl init ${suggestedName}`,
        skills: ["spike-testing"],
      }, mode)
    })
).pipe(Command.withDescription("Suggest hypotheses based on error message"))
