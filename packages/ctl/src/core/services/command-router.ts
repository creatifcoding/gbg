/**
 * Command Router Service
 *
 * Routes user intents to appropriate commands and provides suggestions.
 * Used by agent steering framework for intelligent command discovery.
 *
 * @module @gbg/ctl/core/services/command-router
 */

import { Context, Effect, Layer } from "effect"
import { AgentAction } from "../domain/agent-output.js"

// =============================================================================
// COMMAND METADATA
// =============================================================================

/**
 * Metadata for a registered command
 */
export interface CommandMeta {
  /** Command name */
  readonly name: string
  /** Human-readable description */
  readonly description: string
  /** Full CLI command */
  readonly command: string
  /** Aliases */
  readonly aliases: readonly string[]
  /** Keywords for matching */
  readonly keywords: readonly string[]
  /** Related skills */
  readonly skills: readonly string[]
  /** Whether safe for auto-execution */
  readonly safe: boolean
  /** Category */
  readonly category: "create" | "inspect" | "modify" | "run" | "help"
}

/**
 * Route match result
 */
export interface RouteMatch {
  /** Matched command */
  readonly command: CommandMeta
  /** Match confidence (0-1) */
  readonly confidence: number
  /** Matched keywords */
  readonly matchedKeywords: readonly string[]
}

// =============================================================================
// COMMAND ROUTER PORT
// =============================================================================

export interface CommandRouterPort {
  /**
   * Register a command
   */
  readonly register: (meta: CommandMeta) => void

  /**
   * Get all registered commands
   */
  readonly getCommands: () => readonly CommandMeta[]

  /**
   * Find commands matching a query
   */
  readonly route: (query: string) => readonly RouteMatch[]

  /**
   * Get command by name
   */
  readonly getCommand: (name: string) => CommandMeta | undefined

  /**
   * Get suggested actions for a query
   */
  readonly getSuggestedActions: (query: string) => readonly AgentAction[]

  /**
   * Get commands by category
   */
  readonly getByCategory: (category: CommandMeta["category"]) => readonly CommandMeta[]

  /**
   * Get related commands
   */
  readonly getRelated: (commandName: string) => readonly CommandMeta[]
}

export class CommandRouter extends Context.Tag("ctl/CommandRouter")<
  CommandRouter,
  CommandRouterPort
>() {}

// =============================================================================
// DEFAULT COMMANDS
// =============================================================================

const defaultCommands: CommandMeta[] = [
  {
    name: "health",
    description: "Check CLI health and configuration",
    command: "ctl health",
    aliases: ["check", "status"],
    keywords: ["health", "check", "status", "diagnostic", "config"],
    skills: ["cli/core"],
    safe: true,
    category: "inspect",
  },
  {
    name: "discover",
    description: "Discover project configuration and skills",
    command: "ctl discover",
    aliases: ["find", "scan"],
    keywords: ["discover", "find", "project", "skills", "config", "ctl.md"],
    skills: ["cli/core"],
    safe: true,
    category: "inspect",
  },
  {
    name: "new",
    description: "Create a new CLI project",
    command: "ctl new",
    aliases: ["create", "init"],
    keywords: ["new", "create", "init", "project", "scaffold"],
    skills: ["cli/core"],
    safe: false,
    category: "create",
  },
  {
    name: "add",
    description: "Add a component to existing CLI",
    command: "ctl add",
    aliases: ["generate", "gen"],
    keywords: ["add", "generate", "command", "skill", "migration"],
    skills: ["cli/core"],
    safe: false,
    category: "create",
  },
  {
    name: "inspect",
    description: "Inspect CLI structure and dependencies",
    command: "ctl inspect",
    aliases: ["info", "show"],
    keywords: ["inspect", "info", "structure", "dependencies"],
    skills: ["cli/core"],
    safe: true,
    category: "inspect",
  },
  {
    name: "tui",
    description: "Launch full terminal UI mode",
    command: "ctl tui",
    aliases: ["ui", "dashboard"],
    keywords: ["tui", "ui", "terminal", "dashboard", "interactive"],
    skills: ["cli/core"],
    safe: true,
    category: "run",
  },
]

// =============================================================================
// IMPLEMENTATION
// =============================================================================

const makeCommandRouter = (): CommandRouterPort => {
  const commands = new Map<string, CommandMeta>()

  // Register default commands
  for (const cmd of defaultCommands) {
    commands.set(cmd.name, cmd)
  }

  const tokenize = (text: string): string[] =>
    text.toLowerCase().split(/\s+/).filter(Boolean)

  const calculateScore = (query: string[], cmd: CommandMeta): { score: number; matched: string[] } => {
    const matched: string[] = []
    let score = 0

    for (const token of query) {
      // Exact name match
      if (cmd.name === token) {
        score += 1.0
        matched.push(token)
        continue
      }

      // Alias match
      if (cmd.aliases.includes(token)) {
        score += 0.9
        matched.push(token)
        continue
      }

      // Keyword match
      if (cmd.keywords.includes(token)) {
        score += 0.7
        matched.push(token)
        continue
      }

      // Partial match in name
      if (cmd.name.includes(token) || token.includes(cmd.name)) {
        score += 0.5
        matched.push(token)
        continue
      }

      // Partial match in keywords
      for (const kw of cmd.keywords) {
        if (kw.includes(token) || token.includes(kw)) {
          score += 0.3
          matched.push(token)
          break
        }
      }
    }

    return { score, matched }
  }

  return {
    register: (meta: CommandMeta) => {
      commands.set(meta.name, meta)
    },

    getCommands: () => Array.from(commands.values()),

    route: (query: string) => {
      const tokens = tokenize(query)
      if (tokens.length === 0) return []

      const matches: RouteMatch[] = []

      for (const cmd of commands.values()) {
        const { score, matched } = calculateScore(tokens, cmd)
        if (score > 0) {
          matches.push({
            command: cmd,
            confidence: Math.min(score / tokens.length, 1),
            matchedKeywords: matched,
          })
        }
      }

      return matches.sort((a, b) => b.confidence - a.confidence)
    },

    getCommand: (name: string) => commands.get(name),

    getSuggestedActions: (query: string) => {
      const matches = makeCommandRouter().route(query)
      return matches.slice(0, 3).map((m) =>
        new AgentAction({
          name: m.command.name,
          description: m.command.description,
          command: m.command.command,
          category: m.command.safe ? "query" : "invoke",
          priority: m.confidence > 0.8 ? "high" : "normal",
        })
      )
    },

    getByCategory: (category: CommandMeta["category"]) =>
      Array.from(commands.values()).filter((c) => c.category === category),

    getRelated: (commandName: string) => {
      const cmd = commands.get(commandName)
      if (!cmd) return []

      return Array.from(commands.values())
        .filter((c) => c.name !== commandName)
        .filter((c) =>
          c.category === cmd.category ||
          c.skills.some((s) => cmd.skills.includes(s)) ||
          c.keywords.some((k) => cmd.keywords.includes(k))
        )
        .slice(0, 3)
    },
  }
}

// =============================================================================
// LAYER
// =============================================================================

export const CommandRouterLayer = Layer.succeed(CommandRouter, makeCommandRouter())

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Quick route from query
 */
export const routeCommand = (query: string) =>
  Effect.sync(() => makeCommandRouter().route(query))

/**
 * Get help text for all commands
 */
export const getHelpText = (): string => {
  const router = makeCommandRouter()
  const cmds = router.getCommands()
  const lines: string[] = ["CTL Commands:", ""]

  const categories = ["inspect", "create", "modify", "run", "help"] as const
  for (const cat of categories) {
    const catCmds = cmds.filter((c) => c.category === cat)
    if (catCmds.length === 0) continue

    lines.push(`${cat.toUpperCase()}:`)
    for (const cmd of catCmds) {
      const aliases = cmd.aliases.length > 0 ? ` (${cmd.aliases.join(", ")})` : ""
      lines.push(`  ${cmd.command.padEnd(20)} ${cmd.description}${aliases}`)
    }
    lines.push("")
  }

  return lines.join("\n")
}
