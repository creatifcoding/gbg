/**
 * Project Discovery Service
 *
 * Discovers and parses CTL.md project configuration files.
 * Walks up directory tree to find project root.
 *
 * @module @gbg/ctl/core/services/project-discovery
 */

import { Context, Effect, Layer } from "effect"
import { FileSystem, Path } from "@effect/platform"
import {
  ProjectConfig,
  SkillRef,
  CommandDef,
  parseCtlMd,
  defaultConfig,
} from "../domain/project-config.js"

// =============================================================================
// DISCOVERY RESULT
// =============================================================================

/**
 * Result of project discovery
 */
export interface DiscoveryResult {
  /** Path to CTL.md file (if found) */
  readonly configPath: string | null
  /** Parsed project config */
  readonly config: ProjectConfig
  /** Project root directory */
  readonly projectRoot: string
  /** Whether config was found or generated */
  readonly discovered: boolean
  /** Skills found in skills/ directory */
  readonly discoveredSkills: readonly SkillRef[]
  /** Package.json info (if found) */
  readonly packageJson: {
    name?: string
    version?: string
    scripts?: Record<string, string>
  } | null
}

// =============================================================================
// PROJECT DISCOVERY PORT
// =============================================================================

/**
 * Port for project discovery operations
 */
export interface ProjectDiscoveryPort {
  /**
   * Discover project configuration starting from a directory
   */
  readonly discover: (startDir?: string) => Effect.Effect<
    DiscoveryResult,
    Error,
    FileSystem.FileSystem | Path.Path
  >

  /**
   * Find CTL.md walking up from a directory
   */
  readonly findCtlMd: (startDir: string) => Effect.Effect<
    string | null,
    Error,
    FileSystem.FileSystem | Path.Path
  >

  /**
   * Discover skills in a project
   */
  readonly discoverSkills: (projectRoot: string) => Effect.Effect<
    readonly SkillRef[],
    Error,
    FileSystem.FileSystem | Path.Path
  >

  /**
   * Get commands from package.json scripts
   */
  readonly getPackageCommands: (projectRoot: string) => Effect.Effect<
    readonly CommandDef[],
    Error,
    FileSystem.FileSystem | Path.Path
  >

  /**
   * Inject project context into agent output
   */
  readonly getProjectContext: (config: ProjectConfig) => Record<string, unknown>
}

/**
 * Project discovery service tag
 */
export class ProjectDiscovery extends Context.Tag("ctl/ProjectDiscovery")<
  ProjectDiscovery,
  ProjectDiscoveryPort
>() {}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

const CONFIG_FILES = ["CTL.md", "ctl.md", ".ctl.md"]
const SKILL_DIRS = ["skills", ".claude/skills", ".skills"]

const makeProjectDiscovery = (): ProjectDiscoveryPort => ({
  findCtlMd: (startDir: string) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      let currentDir = startDir
      const root = path.parse(currentDir).root

      while (currentDir !== root) {
        for (const configFile of CONFIG_FILES) {
          const configPath = path.join(currentDir, configFile)
          const exists = yield* fs.exists(configPath)
          if (exists) {
            return configPath
          }
        }
        currentDir = path.dirname(currentDir)
      }

      return null
    }),

  discoverSkills: (projectRoot: string) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const skills: SkillRef[] = []

      for (const skillDir of SKILL_DIRS) {
        const skillPath = path.join(projectRoot, skillDir)
        const exists = yield* fs.exists(skillPath)

        if (exists) {
          const entries = yield* fs.readDirectory(skillPath)

          for (const entry of entries) {
            const entryPath = path.join(skillPath, entry)
            const stat = yield* fs.stat(entryPath)

            if (stat.type === "Directory") {
              // Check for SKILL.md
              const skillMdPath = path.join(entryPath, "SKILL.md")
              const hasSkillMd = yield* fs.exists(skillMdPath)

              if (hasSkillMd) {
                skills.push(
                  new SkillRef({
                    name: entry,
                    path: path.relative(projectRoot, skillMdPath),
                  })
                )
              }
            }
          }
        }
      }

      return skills
    }),

  getPackageCommands: (projectRoot: string) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const commands: CommandDef[] = []

      const pkgPath = path.join(projectRoot, "package.json")
      const exists = yield* fs.exists(pkgPath)

      if (exists) {
        const content = yield* fs.readFileString(pkgPath)
        const pkg = JSON.parse(content)

        if (pkg.scripts) {
          for (const [name] of Object.entries(pkg.scripts)) {
            // Skip internal scripts
            if (name.startsWith("_") || name.startsWith("pre") || name.startsWith("post")) {
              continue
            }

            commands.push(
              new CommandDef({
                name,
                description: `Run ${name} script`,
                command: `bun run ${name}`,
                safe: ["build", "test", "lint", "typecheck", "dev"].includes(name),
              })
            )
          }
        }
      }

      return commands
    }),

  discover: (startDir?: string) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const discovery = makeProjectDiscovery()

      const cwd = startDir ?? process.cwd()
      const configPath = yield* discovery.findCtlMd(cwd)

      let config: ProjectConfig
      let projectRoot: string
      let discovered = false

      if (configPath) {
        // Parse CTL.md
        const content = yield* fs.readFileString(configPath)
        const parsed = parseCtlMd(content)
        config = parsed ?? defaultConfig(path.basename(path.dirname(configPath)))
        projectRoot = path.dirname(configPath)
        discovered = true
      } else {
        // Generate default config from package.json or directory name
        projectRoot = cwd

        // Try to read package.json for name
        const pkgPath = path.join(projectRoot, "package.json")
        const hasPkg = yield* fs.exists(pkgPath)

        if (hasPkg) {
          const pkgContent = yield* fs.readFileString(pkgPath)
          const pkg = JSON.parse(pkgContent)
          config = defaultConfig(pkg.name ?? path.basename(projectRoot))
        } else {
          config = defaultConfig(path.basename(projectRoot))
        }
      }

      // Discover skills
      const discoveredSkills = yield* discovery.discoverSkills(projectRoot)

      // Read package.json
      const pkgPath = path.join(projectRoot, "package.json")
      const hasPkg = yield* fs.exists(pkgPath)
      let packageJson: DiscoveryResult["packageJson"] = null

      if (hasPkg) {
        const pkgContent = yield* fs.readFileString(pkgPath)
        const pkg = JSON.parse(pkgContent)
        packageJson = {
          name: pkg.name,
          version: pkg.version,
          scripts: pkg.scripts,
        }
      }

      return {
        configPath,
        config,
        projectRoot,
        discovered,
        discoveredSkills,
        packageJson,
      } satisfies DiscoveryResult
    }),

  getProjectContext: (config: ProjectConfig) => ({
    project: {
      name: config.name,
      version: config.version,
      type: config.type,
    },
    skills: config.skills.map((s) => s.name),
    commands: config.commands.map((c) => ({
      name: c.name,
      command: c.command,
      safe: c.safe,
    })),
    context: Object.fromEntries(config.context.map((c) => [c.key, c.value])),
  }),
})

// =============================================================================
// LAYER
// =============================================================================

export const ProjectDiscoveryLayer = Layer.succeed(
  ProjectDiscovery,
  makeProjectDiscovery()
)

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Quick discovery from current directory
 */
export const discoverProject = () =>
  Effect.gen(function* () {
    const discovery = yield* ProjectDiscovery
    return yield* discovery.discover()
  })
