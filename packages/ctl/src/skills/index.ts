/**
 * @gbg/ctl/skills - Skill reference system for agent-guiding CLIs
 *
 * Skills in @gbg/ctl follow Claude Code's pattern:
 * - Skills are MARKDOWN DOCUMENTATION consumed by the LLM
 * - Skills are REFERENCED in error messages to guide agents
 * - Skills are BUNDLED with CLIs in a skills/ directory
 *
 * The CLI doesn't "load" skills programmatically - it references them
 * so agents know where to find guidance.
 *
 * ## Directory Structure
 *
 * ```
 * my-cli/
 * ├── src/
 * ├── skills/           # Bundled skills (documentation)
 * │   ├── core/
 * │   │   └── SKILL.md
 * │   ├── commands/
 * │   │   └── SKILL.md
 * │   └── errors/
 * │       └── SKILL.md
 * └── package.json
 * ```
 *
 * ## How Skills Work
 *
 * 1. Error occurs in CLI
 * 2. Error message includes: `SKILL: cli/errors`
 * 3. Agent reads skills/errors/SKILL.md
 * 4. Agent follows guidance to resolve issue
 *
 * @skill cli/skills
 */

// =============================================================================
// SKILL REFERENCE (for error messages)
// =============================================================================

/**
 * Reference to a skill that can help with an error/operation
 */
export interface SkillRef {
  /** Skill name (e.g., "cli/core", "cli/errors") */
  readonly name: string
  /** Trigger phrase that would invoke this skill */
  readonly trigger: string
  /** Optional path hint for where to find the skill */
  readonly path?: string
}

/**
 * Create a skill reference for use in error messages
 */
export const skillRef = (name: string, trigger: string, path?: string): SkillRef => ({
  name,
  trigger,
  path,
})

// =============================================================================
// BUNDLED SKILL PATHS
// =============================================================================

/**
 * Standard skill paths for CLIs built with @gbg/ctl
 */
export const CTL_SKILLS = {
  core: skillRef("cli/core", "CLI command patterns", ".claude/skills/cli/core/SKILL.md"),
  persistence: skillRef("cli/persistence", "SQLite storage", ".claude/skills/cli/persistence/SKILL.md"),
  messaging: skillRef("cli/messaging", "error messages", ".claude/skills/cli/messaging/SKILL.md"),
  services: skillRef("cli/services", "Effect.Service", ".claude/skills/cli/services/SKILL.md"),
  config: skillRef("cli/config", "CLI configuration", ".claude/skills/cli/config/SKILL.md"),
} as const

// =============================================================================
// SKILL MANIFEST (for CLI packages)
// =============================================================================

/**
 * Manifest describing skills bundled with a CLI
 */
export interface SkillManifest {
  /** CLI name */
  readonly name: string
  /** CLI version */
  readonly version: string
  /** Skills bundled with this CLI */
  readonly skills: readonly SkillEntry[]
  /** Skills this CLI depends on (from @gbg/ctl) */
  readonly dependencies?: readonly string[]
}

export interface SkillEntry {
  /** Skill name (e.g., "my-cli/core") */
  readonly name: string
  /** Brief description */
  readonly description: string
  /** Path relative to package root */
  readonly path: string
  /** Keywords that trigger this skill */
  readonly triggers?: readonly string[]
}

/**
 * Generate a skill manifest for a new CLI
 */
export const createManifest = (name: string, version: string): SkillManifest => ({
  name,
  version,
  skills: [
    {
      name: `${name}/core`,
      description: `Core patterns and commands for ${name}`,
      path: `skills/core/SKILL.md`,
      triggers: [name, `${name} help`, `${name} usage`],
    },
  ],
  dependencies: ["cli/core", "cli/messaging", "cli/persistence"],
})

// =============================================================================
// SKILL TEMPLATE GENERATION
// =============================================================================

export interface SkillTemplateConfig {
  readonly name: string
  readonly description: string
  readonly triggers?: readonly string[]
  readonly allowedTools?: readonly string[]
}

/**
 * Generate SKILL.md content following Claude Code format
 */
export const generateSkillMd = (config: SkillTemplateConfig): string => {
  const frontmatter = [
    "---",
    `name: ${config.name}`,
    `description: ${config.description}`,
  ]

  if (config.allowedTools?.length) {
    frontmatter.push(`allowed-tools: [${config.allowedTools.join(", ")}]`)
  }

  frontmatter.push("---")

  const body = `
# ${config.name}

${config.description}

## When to Use

${(config.triggers ?? []).map((t) => `- "${t}"`).join("\n") || "- [Add trigger conditions]"}

## Instructions

[Step-by-step instructions for the agent to follow]

## Patterns

### Pattern 1: [Name]

\`\`\`typescript
// Code example
\`\`\`

## Anti-Patterns

### DON'T: [Anti-pattern name]

[Explanation and correct approach]

## Quick Reference

| Pattern | Use Case |
|---------|----------|
| ... | ... |
`

  return frontmatter.join("\n") + "\n" + body
}

// =============================================================================
// SKILL-RULES.JSON ENTRY
// =============================================================================

export interface SkillRuleEntry {
  readonly type: "domain" | "workflow" | "agent"
  readonly enforcement: "suggest" | "require" | "block"
  readonly priority: "low" | "medium" | "high"
  readonly description: string
  readonly promptTriggers: {
    readonly keywords: readonly string[]
    readonly intentPatterns?: readonly string[]
  }
}

/**
 * Generate a skill-rules.json entry for a skill
 */
export const generateSkillRule = (
  name: string,
  description: string,
  keywords: readonly string[],
  intentPatterns?: readonly string[]
): SkillRuleEntry => ({
  type: "domain",
  enforcement: "suggest",
  priority: "medium",
  description,
  promptTriggers: {
    keywords,
    intentPatterns,
  },
})

// =============================================================================
// SKILL DISCIPLINE CONFIGURATION
// =============================================================================

export type EnforcementLevel = "mandatory" | "warning" | "disabled"

export interface SkillDisciplineConfig {
  /** How strictly to enforce skill references in errors */
  readonly level: EnforcementLevel
  /** Skills that must be present for this CLI */
  readonly requiredSkills?: readonly string[]
  /** Path to skills directory */
  readonly skillsPath?: string
}

/**
 * Default discipline config - suggests skills but doesn't block
 */
export const DEFAULT_DISCIPLINE: SkillDisciplineConfig = {
  level: "warning",
  requiredSkills: ["cli/core", "cli/messaging"],
  skillsPath: "skills/",
}

// =============================================================================
// ERROR MESSAGE SKILL FORMATTING
// =============================================================================

/**
 * Format skill reference for inclusion in error messages
 */
export const formatSkillRef = (ref: SkillRef): string => {
  const lines = [`SKILL: ${ref.name}`]
  lines.push(`  Trigger: "${ref.trigger}"`)
  if (ref.path) {
    lines.push(`  Path: ${ref.path}`)
  }
  return lines.join("\n")
}

/**
 * Format multiple skill references
 */
export const formatSkillRefs = (refs: readonly SkillRef[]): string =>
  refs.map(formatSkillRef).join("\n\n")

// =============================================================================
// CLI SCAFFOLD TEMPLATES
// =============================================================================

/**
 * Files to generate when scaffolding a new CLI's skills
 */
export const SCAFFOLD_FILES = {
  "skills/core/SKILL.md": (name: string) =>
    generateSkillMd({
      name: `${name}/core`,
      description: `Core command patterns for ${name} CLI`,
      triggers: [`${name} help`, `${name} commands`, `how to use ${name}`],
    }),

  "skills/errors/SKILL.md": (name: string) =>
    generateSkillMd({
      name: `${name}/errors`,
      description: `Error handling and recovery for ${name} CLI`,
      triggers: [`${name} error`, `${name} failed`, `fix ${name}`],
    }),

  "skills/MANIFEST.json": (name: string, version: string) =>
    JSON.stringify(createManifest(name, version), null, 2),
}

/**
 * Generate all scaffold files for a new CLI
 */
export const generateScaffold = (
  name: string,
  version: string = "0.1.0"
): Record<string, string> => {
  const files: Record<string, string> = {}

  for (const [path, generator] of Object.entries(SCAFFOLD_FILES)) {
    if (typeof generator === "function") {
      files[path] = generator(name, version)
    }
  }

  return files
}
