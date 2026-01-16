/**
 * Project Configuration Schema
 *
 * Defines the CTL.md configuration format for project discovery.
 * Projects can define commands, skills, and context for agent steering.
 *
 * @module @gbg/ctl/core/domain/project-config
 */

import { Schema } from "effect"

// =============================================================================
// SKILL REFERENCE
// =============================================================================

/**
 * Reference to a skill that can be invoked
 */
export class SkillRef extends Schema.Class<SkillRef>("SkillRef")({
  /** Skill name (e.g., "cli/core", "build") */
  name: Schema.NonEmptyString,
  /** Trigger phrases that activate this skill */
  triggers: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  /** Path to skill file relative to project root */
  path: Schema.optional(Schema.String),
  /** Whether this skill is auto-invoked on project context */
  autoInvoke: Schema.optionalWith(Schema.Boolean, { default: () => false }),
}) {}

// =============================================================================
// COMMAND DEFINITION
// =============================================================================

/**
 * A command defined in the project
 */
export class CommandDef extends Schema.Class<CommandDef>("CommandDef")({
  /** Command name */
  name: Schema.NonEmptyString,
  /** Human-readable description */
  description: Schema.String,
  /** Full command to execute */
  command: Schema.String,
  /** Aliases for the command */
  aliases: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  /** Associated skill */
  skill: Schema.optional(Schema.String),
  /** Whether command is safe for auto-execution */
  safe: Schema.optionalWith(Schema.Boolean, { default: () => false }),
}) {}

// =============================================================================
// CONTEXT HINT
// =============================================================================

/**
 * Context hint for agent steering
 */
export class ContextHint extends Schema.Class<ContextHint>("ContextHint")({
  /** Context key */
  key: Schema.NonEmptyString,
  /** Context value or description */
  value: Schema.String,
  /** When this context applies */
  when: Schema.optional(Schema.String),
}) {}

// =============================================================================
// PROJECT CONFIG
// =============================================================================

/**
 * Project type classification
 */
export const ProjectType = Schema.Literal(
  "cli",           // CLI application
  "library",       // Reusable library
  "service",       // Backend service
  "app",           // Frontend application
  "monorepo",      // Monorepo root
  "workspace"      // Workspace package
)
export type ProjectType = Schema.Schema.Type<typeof ProjectType>

/**
 * Full project configuration from CTL.md
 */
export class ProjectConfig extends Schema.Class<ProjectConfig>("ProjectConfig")({
  /** Project name */
  name: Schema.NonEmptyString,
  /** Project version */
  version: Schema.optionalWith(Schema.String, { default: () => "0.0.0" }),
  /** Project description */
  description: Schema.optionalWith(Schema.String, { default: () => "" }),
  /** Project type */
  type: Schema.optionalWith(ProjectType, { default: () => "cli" as const }),

  /** Available commands */
  commands: Schema.optionalWith(Schema.Array(CommandDef), { default: () => [] }),
  /** Available skills */
  skills: Schema.optionalWith(Schema.Array(SkillRef), { default: () => [] }),
  /** Context hints for agents */
  context: Schema.optionalWith(Schema.Array(ContextHint), { default: () => [] }),

  /** Build configuration */
  build: Schema.optional(Schema.Struct({
    command: Schema.String,
    output: Schema.optional(Schema.String),
  })),

  /** Test configuration */
  test: Schema.optional(Schema.Struct({
    command: Schema.String,
    pattern: Schema.optional(Schema.String),
  })),

  /** Entry points */
  entry: Schema.optional(Schema.Struct({
    main: Schema.optional(Schema.String),
    cli: Schema.optional(Schema.String),
  })),

  /** Dependencies that matter for context */
  keyDependencies: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
}) {}

// =============================================================================
// PARSING
// =============================================================================

/**
 * Parse CTL.md frontmatter YAML into ProjectConfig
 */
export const parseCtlMd = (content: string): ProjectConfig | null => {
  // Extract YAML frontmatter between --- markers
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (!frontmatterMatch) return null

  try {
    // Simple YAML parsing (for complex cases, use a proper YAML parser)
    const yaml = frontmatterMatch[1]
    const lines = yaml.split("\n")
    const config: Record<string, unknown> = {}
    let currentArray: unknown[] | null = null

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue

      // Array item
      if (trimmed.startsWith("- ") && currentArray) {
        currentArray.push(trimmed.slice(2))
        continue
      }

      // Key-value pair
      const kvMatch = trimmed.match(/^(\w+):\s*(.*)$/)
      if (kvMatch) {
        const [, key, value] = kvMatch
        if (value) {
          config[key] = value
          currentArray = null
        } else {
          // Start of array or nested object
          currentArray = []
          config[key] = currentArray
        }
      }
    }

    return new ProjectConfig({
      name: (config.name as string) || "unknown",
      version: config.version as string,
      description: config.description as string,
      type: config.type as ProjectType,
      keyDependencies: config.keyDependencies as string[],
    })
  } catch {
    return null
  }
}

// =============================================================================
// DEFAULTS
// =============================================================================

/**
 * Create default config for a directory
 */
export const defaultConfig = (name: string): ProjectConfig =>
  new ProjectConfig({
    name,
    version: "0.0.0",
    description: "",
    type: "cli",
  })

/**
 * CTL.md template
 */
export const ctlMdTemplate = (config: ProjectConfig): string => `---
name: ${config.name}
version: ${config.version}
description: ${config.description}
type: ${config.type}
---

# ${config.name}

Project configuration for CTL.

## Commands

Define your project commands here.

## Skills

Reference project-specific skills.

## Context

Add context hints for agent steering.
`
