#!/usr/bin/env bun
/**
 * spikectl CLI
 *
 * Hypothesis-driven debugging tool with autopoietic learning.
 * Built with @gbg/ctl - Effect CLI Framework
 *
 * Commands:
 *   run <file>           Execute a spike file
 *   list                 List spike files
 *   init <name>          Generate spike config JSON template
 *   new <name>           Generate simple spike template
 *   new --config <file>  Generate spike from config JSON
 *   learn <file>         Extract learnings from completed spike
 *   suggest "<error>"    Get hypothesis suggestions for error
 *   stats                View pattern statistics
 *
 * @skill spikectl/core
 */

import { Command } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Console, Effect } from "effect"
import {
  runCommand,
  listCommand,
  initCommand,
  newCommand,
  learnCommand,
  suggestCommand,
  statsCommand,
} from "./commands/index.js"

// =============================================================================
// ROOT COMMAND
// =============================================================================

const helpText = `spikectl - Hypothesis-driven debugging (Autopoietic)

Commands:
  run <file>           Execute a spike file
  list                 List spike files
  init <name>          Generate spike config JSON template
  new <name>           Generate simple spike template
  new --config <file>  Generate spike from config JSON

  learn <file>         Extract learnings from completed spike
  suggest "<error>"    Get hypothesis suggestions for error
  stats                View pattern statistics
  stats --evolve       Evolve templates based on success rates

Examples:
  spikectl list
  spikectl new datetime-binding
  spikectl init sqlite-issue
  spikectl new --config spike-sqlite-issue.config.json
  spikectl run scripts/spike-datetime-binding.ts --verbose

  # Autopoietic workflow
  spikectl suggest "SQLITE_CONSTRAINT: NOT NULL"
  spikectl learn scripts/spike-datetime.ts --fix "Use DateTimeInsert"
  spikectl stats

Use --help with any command for more details.`

const spikectlCommand = Command.make("spikectl", {}, () =>
  Console.log(helpText)
).pipe(
  Command.withDescription("Hypothesis-driven debugging CLI with autopoietic learning"),
  Command.withSubcommands([
    runCommand,
    listCommand,
    initCommand,
    newCommand,
    learnCommand,
    suggestCommand,
    statsCommand,
  ])
)

// =============================================================================
// RUN
// =============================================================================

const cli = Command.run(spikectlCommand, {
  name: "spikectl",
  version: "0.1.0",
})

cli(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain)
