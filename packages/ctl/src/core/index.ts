/**
 * @gbg/ctl/core - Command definition patterns for Effect CLI
 *
 * Re-exports @effect/cli with additional utilities and patterns.
 *
 * @skill cli/core
 */

import { Args, Command, Options } from "@effect/cli"
import { Console, Effect, Option, pipe } from "effect"

// =============================================================================
// RE-EXPORTS
// =============================================================================

export { Args, Command, Options } from "@effect/cli"
export { NodeContext, NodeRuntime } from "@effect/platform-node"

// Domain schemas, ports, and services
export * from "./domain/index.js"
export * from "./ports/index.js"
export * from "./services/index.js"

// =============================================================================
// COMMAND BUILDER UTILITIES
// =============================================================================

/**
 * Standard verbose option with alias
 */
export const verboseOption = Options.boolean("verbose").pipe(
  Options.withAlias("v"),
  Options.withDefault(false),
  Options.withDescription("Enable verbose output")
)

/**
 * Standard JSON output option
 */
export const jsonOption = Options.boolean("json").pipe(
  Options.withAlias("j"),
  Options.withDefault(false),
  Options.withDescription("Output as JSON")
)

/**
 * Agent mode option - outputs structured CtlAgentOutput for steering framework
 */
export const agentOption = Options.boolean("agent").pipe(
  Options.withAlias("a"),
  Options.withDefault(false),
  Options.withDescription("Output structured CtlAgentOutput JSON for agent steering")
)

/**
 * Standard dry-run option
 */
export const dryRunOption = Options.boolean("dry-run").pipe(
  Options.withDefault(false),
  Options.withDescription("Show what would happen without making changes")
)

/**
 * Standard limit option for list commands
 */
export const limitOption = (defaultValue: number = 20) =>
  Options.integer("limit").pipe(
    Options.withAlias("n"),
    Options.withDefault(defaultValue),
    Options.withDescription(`Maximum number of results (default: ${defaultValue})`)
  )

/**
 * Standard format choice option
 */
export const formatOption = <T extends readonly [string, ...string[]]>(
  choices: T,
  defaultChoice: T[number]
) =>
  Options.choice("format", choices).pipe(
    Options.withAlias("f"),
    Options.withDefault(defaultChoice as T[number]),
    Options.withDescription(`Output format: ${choices.join(", ")}`)
  )

// =============================================================================
// HELP TEXT BUILDERS
// =============================================================================

export interface HelpConfig {
  name: string
  version: string
  description: string
  commands: Array<{ name: string; description: string }>
  globalOptions?: Array<{ flag: string; description: string }>
  examples?: Array<{ command: string; description: string }>
  skillRef?: string
}

/**
 * Build standardized help text for a CLI
 */
export const buildHelpText = (config: HelpConfig): string => {
  const lines: string[] = []

  lines.push(`${config.name} v${config.version} - ${config.description}`)
  lines.push("")
  lines.push("USAGE:")
  lines.push(`  ${config.name} <command> [options]`)
  lines.push("")
  lines.push("COMMANDS:")

  const maxCmdLen = Math.max(...config.commands.map((c) => c.name.length))
  for (const cmd of config.commands) {
    lines.push(`  ${cmd.name.padEnd(maxCmdLen + 2)} ${cmd.description}`)
  }

  if (config.globalOptions?.length) {
    lines.push("")
    lines.push("GLOBAL OPTIONS:")
    const maxOptLen = Math.max(...config.globalOptions.map((o) => o.flag.length))
    for (const opt of config.globalOptions) {
      lines.push(`  ${opt.flag.padEnd(maxOptLen + 2)} ${opt.description}`)
    }
  }

  if (config.examples?.length) {
    lines.push("")
    lines.push("EXAMPLES:")
    for (const ex of config.examples) {
      lines.push(`  ${ex.command}`)
      lines.push(`    ${ex.description}`)
    }
  }

  if (config.skillRef) {
    lines.push("")
    lines.push(`SKILL: ${config.skillRef}`)
  }

  lines.push("")
  lines.push("AGENT USAGE:")
  lines.push("  Use --json for parseable output. Error codes in brackets are machine-readable.")

  return lines.join("\n")
}

// =============================================================================
// RUNNER UTILITIES
// =============================================================================

export interface RunConfig {
  name: string
  version: string
}

/**
 * Create a CLI runner with standard configuration
 */
export const createRunner = <Name extends string, R, E, A>(
  command: Command.Command<Name, R, E, A>,
  config: RunConfig
) =>
  Command.run(command, {
    name: config.name,
    version: config.version,
  })

/**
 * Standard program entry point
 */
export const runCli = <Name extends string, R, E, A>(
  command: Command.Command<Name, R, E, A>,
  config: RunConfig,
  handleError?: (e: unknown) => Effect.Effect<void>
) =>
  pipe(
    Effect.sync(() => process.argv),
    Effect.flatMap(createRunner(command, config)),
    handleError ? Effect.catchAll(handleError) : (e) => e
  )
