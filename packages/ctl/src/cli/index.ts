#!/usr/bin/env bun
/**
 * @gbg/ctl CLI - Meta-CLI for creating and managing CTL-based CLIs
 *
 * Commands:
 * - ctl new <name> - Create a new CLI project
 * - ctl add command <name> - Add a command to existing CLI
 * - ctl inspect - Inspect CLI structure and dependencies
 * - ctl health - Run health checks
 *
 * @skill cli/core
 */

import { Args, Command, Options } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { FileSystem, Path } from "@effect/platform"
import { Console, Effect, Layer, Option } from "effect"

import { generateScaffold, createManifest, generateSkillMd, CTL_SKILLS } from "../skills/index.js"
import { Output } from "../core/ports/output.js"
import { ConsoleOutputLayer } from "../adapters/output/console.js"
import { InkOutputLayer } from "../adapters/output/ink.js"
import { startTui, type TuiView } from "../adapters/output/tui.js"
import { AgentOutputLayer, setCommand } from "../adapters/output/agent.js"
import { success, error as agentError, AgentAction } from "../core/domain/agent-output.js"
import { routeCommand, getHelpText } from "../core/services/command-router.js"
import { queryCatalog, type CatalogQuery, type ComponentType } from "../core/services/catalog.js"

// =============================================================================
// SHARED OPTIONS
// =============================================================================

const verboseOption = Options.boolean("verbose").pipe(
  Options.withAlias("v"),
  Options.withDescription("Enable verbose output"),
  Options.withDefault(false)
)

const forceOption = Options.boolean("force").pipe(
  Options.withAlias("f"),
  Options.withDescription("Overwrite existing files"),
  Options.withDefault(false)
)

const agentOption = Options.boolean("agent").pipe(
  Options.withAlias("a"),
  Options.withDescription("Output structured JSON for agent steering"),
  Options.withDefault(false)
)

// =============================================================================
// NEW COMMAND - Create new CLI project
// =============================================================================

const newProjectName = Args.text({ name: "name" }).pipe(
  Args.withDescription("Name of the new CLI project")
)

const templateOption = Options.choice("template", ["minimal", "standard", "full"]).pipe(
  Options.withAlias("t"),
  Options.withDescription("Project template"),
  Options.withDefault("standard" as const)
)

const packageOption = Options.boolean("package").pipe(
  Options.withAlias("p"),
  Options.withDescription("Create as standalone package (vs. integrated)"),
  Options.withDefault(true)
)

const newCommand = Command.make(
  "new",
  { name: newProjectName, template: templateOption, package: packageOption, force: forceOption, verbose: verboseOption },
  ({ name, template, package: isPackage, force, verbose }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      yield* Console.log(`\n🚀 Creating new CTL CLI: ${name}`)
      yield* Console.log(`   Template: ${template}`)
      yield* Console.log(`   Type: ${isPackage ? "standalone package" : "integrated"}`)
      yield* Console.log("")

      // Determine target directory
      const targetDir = isPackage ? name : `./${name}`

      // Check if directory exists
      const exists = yield* fs.exists(targetDir)
      if (exists && !force) {
        yield* Console.error(`❌ Directory '${targetDir}' already exists. Use --force to overwrite.`)
        yield* Console.log("")
        yield* Console.log("SKILL: cli/core")
        yield* Console.log('  Trigger: "CLI project creation"')
        yield* Console.log("  Path: .claude/skills/cli/core/SKILL.md")
        return
      }

      // Create directory structure
      yield* fs.makeDirectory(targetDir, { recursive: true })

      if (verbose) {
        yield* Console.log(`📁 Created ${targetDir}/`)
      }

      // Generate skill scaffold files
      const skillFiles = generateScaffold(name, "0.1.0")

      for (const [filePath, content] of Object.entries(skillFiles)) {
        const fullPath = path.join(targetDir, filePath)
        const dir = path.dirname(fullPath)
        yield* fs.makeDirectory(dir, { recursive: true })
        yield* fs.writeFileString(fullPath, content)
        if (verbose) {
          yield* Console.log(`   ✓ ${filePath}`)
        }
      }

      // Generate package.json
      const packageJson = generatePackageJson(name, template)
      yield* fs.writeFileString(path.join(targetDir, "package.json"), packageJson)
      if (verbose) {
        yield* Console.log(`   ✓ package.json`)
      }

      // Generate main entry point
      const mainTs = generateMainTs(name, template)
      yield* fs.makeDirectory(path.join(targetDir, "src"), { recursive: true })
      yield* fs.writeFileString(path.join(targetDir, "src/index.ts"), mainTs)
      if (verbose) {
        yield* Console.log(`   ✓ src/index.ts`)
      }

      // Generate tsconfig
      yield* fs.writeFileString(path.join(targetDir, "tsconfig.json"), generateTsConfig())
      if (verbose) {
        yield* Console.log(`   ✓ tsconfig.json`)
      }

      yield* Console.log("")
      yield* Console.log(`✅ Created ${name} CLI project`)
      yield* Console.log("")
      yield* Console.log("Next steps:")
      yield* Console.log(`  cd ${targetDir}`)
      yield* Console.log("  bun install")
      yield* Console.log("  bun run dev")
      yield* Console.log("")
      yield* Console.log("SKILL: cli/core")
      yield* Console.log('  Trigger: "CLI command patterns"')
    })
)

// =============================================================================
// ADD COMMAND - Add components to existing CLI
// =============================================================================

const addType = Args.choice([
  ["command", "command"],
  ["skill", "skill"],
  ["migration", "migration"],
] as const).pipe(Args.withDescription("Type of component to add"))

const addName = Args.text({ name: "name" }).pipe(Args.withDescription("Name of the component"))

const addCommand = Command.make(
  "add",
  { type: addType, name: addName, verbose: verboseOption },
  ({ type, name, verbose }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      yield* Console.log(`\n📦 Adding ${type}: ${name}`)

      switch (type) {
        case "command": {
          const commandContent = generateCommandTemplate(name)
          const commandPath = `src/commands/${name}.ts`

          const dir = path.dirname(commandPath)
          yield* fs.makeDirectory(dir, { recursive: true })
          yield* fs.writeFileString(commandPath, commandContent)

          yield* Console.log(`   ✓ Created ${commandPath}`)
          yield* Console.log("")
          yield* Console.log("Next: Import and add to your CLI's subcommands")
          yield* Console.log("")
          yield* Console.log("SKILL: cli/core")
          yield* Console.log('  Trigger: "add CLI command"')
          break
        }

        case "skill": {
          const skillContent = generateSkillMd({
            name: `cli/${name}`,
            description: `${name} patterns and guidance`,
            triggers: [name, `${name} help`],
          })
          const skillPath = `skills/${name}/SKILL.md`

          const dir = path.dirname(skillPath)
          yield* fs.makeDirectory(dir, { recursive: true })
          yield* fs.writeFileString(skillPath, skillContent)

          yield* Console.log(`   ✓ Created ${skillPath}`)
          yield* Console.log("")
          yield* Console.log("Next: Update skills/MANIFEST.json to include this skill")
          yield* Console.log("")
          yield* Console.log("SKILL: cli/core")
          yield* Console.log('  Trigger: "add skill"')
          break
        }

        case "migration": {
          const migrationContent = generateMigrationTemplate(name)
          const timestamp = Date.now()
          const migrationPath = `src/migrations/${timestamp}_${name}.ts`

          const dir = path.dirname(migrationPath)
          yield* fs.makeDirectory(dir, { recursive: true })
          yield* fs.writeFileString(migrationPath, migrationContent)

          yield* Console.log(`   ✓ Created ${migrationPath}`)
          yield* Console.log("")
          yield* Console.log("Next: Import migration into your migrations array")
          yield* Console.log("")
          yield* Console.log("SKILL: cli/persistence")
          yield* Console.log('  Trigger: "database migrations"')
          break
        }
      }
    })
)

// =============================================================================
// INSPECT COMMAND - Analyze CLI structure
// =============================================================================

const inspectPathArg = Args.directory({ name: "path" }).pipe(
  Args.withDescription("Path to CLI project"),
  Args.optional
)

const inspectCommand = Command.make(
  "inspect",
  { path: inspectPathArg, verbose: verboseOption },
  ({ path: targetPath, verbose }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const pathSvc = yield* Path.Path

      const projectPath = Option.getOrElse(targetPath, () => ".")

      yield* Console.log(`\n🔍 Inspecting CLI at: ${projectPath}`)
      yield* Console.log("")

      // Check for package.json
      const pkgPath = pathSvc.join(projectPath, "package.json")
      const hasPkg = yield* fs.exists(pkgPath)

      if (!hasPkg) {
        yield* Console.error("❌ No package.json found. Not a valid CLI project.")
        yield* Console.log("")
        yield* Console.log("SKILL: cli/core")
        yield* Console.log('  Trigger: "create CLI project"')
        return
      }

      const pkgContent = yield* fs.readFileString(pkgPath)
      const pkg = JSON.parse(pkgContent)

      yield* Console.log(`📦 Package: ${pkg.name}@${pkg.version}`)
      yield* Console.log("")

      // Check for skills
      const skillsPath = pathSvc.join(projectPath, "skills")
      const hasSkills = yield* fs.exists(skillsPath)

      if (hasSkills) {
        yield* Console.log("📚 Skills:")
        const skillDirs = yield* fs.readDirectory(skillsPath)
        for (const dir of skillDirs) {
          const skillMdPath = pathSvc.join(skillsPath, dir, "SKILL.md")
          const hasSkillMd = yield* fs.exists(skillMdPath)
          if (hasSkillMd) {
            yield* Console.log(`   ✓ ${dir}`)
          }
        }
      } else {
        yield* Console.log("⚠️  No skills/ directory found")
        yield* Console.log("")
        yield* Console.log("SKILL: cli/core")
        yield* Console.log('  Trigger: "add skill"')
      }

      yield* Console.log("")

      // Check for commands
      const commandsPath = pathSvc.join(projectPath, "src/commands")
      const hasCommands = yield* fs.exists(commandsPath)

      if (hasCommands) {
        yield* Console.log("⚡ Commands:")
        const commandFiles = yield* fs.readDirectory(commandsPath)
        for (const file of commandFiles) {
          if (file.endsWith(".ts")) {
            yield* Console.log(`   ✓ ${file.replace(".ts", "")}`)
          }
        }
      }

      yield* Console.log("")

      // Check dependencies
      yield* Console.log("📦 Dependencies:")
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      const ctlDeps = ["@gbg/ctl", "@effect/cli", "@effect/platform", "effect"]

      for (const dep of ctlDeps) {
        if (deps[dep]) {
          yield* Console.log(`   ✓ ${dep}: ${deps[dep]}`)
        } else {
          yield* Console.log(`   ⚠️  ${dep}: missing`)
        }
      }

      yield* Console.log("")
    })
)

// =============================================================================
// HEALTH COMMAND - Run diagnostics
// =============================================================================

const healthCommand = Command.make(
  "health",
  { verbose: verboseOption, agent: agentOption },
  ({ verbose, agent }) => {
    // Dynamic layer selection based on --agent flag
    if (agent) {
      setCommand("health")
    }
    // Use ConsoleOutputLayer by default (Ink can cause crashes in some environments)
    const outputLayer = agent ? AgentOutputLayer : ConsoleOutputLayer

    return Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const output = yield* Output

      const checks: Array<{ name: string; status: "pass" | "warn" | "fail"; message: string }> = []
      let issues = 0
      let warnings = 0

      // Check package.json
      const hasPkg = yield* fs.exists("package.json")
      if (hasPkg) {
        checks.push({ name: "package.json", status: "pass", message: "exists" })

        const content = yield* fs.readFileString("package.json")
        const pkg = JSON.parse(content)

        // Check for @gbg/ctl dependency
        const deps = { ...pkg.dependencies, ...pkg.devDependencies }
        if (deps["@gbg/ctl"]) {
          checks.push({ name: "@gbg/ctl dependency", status: "pass", message: "found" })
        } else {
          checks.push({ name: "@gbg/ctl dependency", status: "warn", message: "not in dependencies" })
          warnings++
        }
      } else {
        checks.push({ name: "package.json", status: "fail", message: "not found" })
        issues++
      }

      // Check skills directory
      const hasSkills = yield* fs.exists("skills")
      if (hasSkills) {
        checks.push({ name: "skills/", status: "pass", message: "exists" })

        const hasManifest = yield* fs.exists("skills/MANIFEST.json")
        if (hasManifest) {
          checks.push({ name: "skills/MANIFEST.json", status: "pass", message: "exists" })
        } else {
          checks.push({ name: "skills/MANIFEST.json", status: "warn", message: "missing" })
          warnings++
        }

        const hasCoreSkill = yield* fs.exists("skills/core/SKILL.md")
        if (hasCoreSkill) {
          checks.push({ name: "skills/core/SKILL.md", status: "pass", message: "exists" })
        } else {
          checks.push({ name: "skills/core/SKILL.md", status: "warn", message: "missing (recommended)" })
          warnings++
        }
      } else {
        checks.push({ name: "skills/", status: "fail", message: "not found" })
        issues++
      }

      // Check src directory
      const hasSrc = yield* fs.exists("src")
      if (hasSrc) {
        checks.push({ name: "src/", status: "pass", message: "exists" })
      } else {
        checks.push({ name: "src/", status: "fail", message: "not found" })
        issues++
      }

      // Build result data
      const result = {
        healthy: issues === 0,
        checks,
        summary: { issues, warnings, passed: checks.filter(c => c.status === "pass").length },
      }

      // Output based on mode
      if (agent) {
        // Structured agent output
        if (issues === 0) {
          yield* output.agentOutput(success("health", result, {
            suggestedSkills: warnings > 0 ? ["cli/core"] : [],
          }))
        } else {
          yield* output.agentOutput(agentError("health", {
            code: "HEALTH_CHECK_FAILED",
            message: `${issues} issue(s) found`,
            suggestion: "Run 'ctl new' to create a proper project structure",
            skill: "cli/core",
          }))
        }
      } else {
        // Human-readable output
        yield* output.text("\n🏥 CTL Health Check")
        yield* output.text("=".repeat(40))
        yield* output.text("")

        for (const check of checks) {
          const icon = check.status === "pass" ? "✓" : check.status === "warn" ? "⚠️ " : "❌"
          yield* output.text(`${icon} ${check.name}: ${check.message}`)
        }

        yield* output.text("")
        yield* output.text("=".repeat(40))

        if (issues === 0 && warnings === 0) {
          yield* output.success("All checks passed!")
        } else {
          yield* output.text(`📊 Results: ${issues} issue(s), ${warnings} warning(s)`)
          if (issues > 0) {
            yield* output.text("")
            yield* output.text("SKILL: cli/core")
            yield* output.text('  Trigger: "fix CLI issues"')
          }
        }
        yield* output.text("")
      }
    }).pipe(
      Effect.provide(Layer.merge(NodeContext.layer, outputLayer))
    )
  }
)

// =============================================================================
// DISCOVER COMMAND - Project discovery
// =============================================================================

const discoverCommand = Command.make(
  "discover",
  { verbose: verboseOption, agent: agentOption },
  ({ verbose, agent }) => {
    if (agent) {
      setCommand("discover")
    }
    const outputLayer = agent ? AgentOutputLayer : ConsoleOutputLayer

    return Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const pathSvc = yield* Path.Path
      const output = yield* Output

      const cwd = process.cwd()

      // Find CTL.md walking up directories
      let configPath: string | null = null
      let currentDir = cwd
      const root = pathSvc.parse(cwd).root

      while (currentDir !== root) {
        for (const name of ["CTL.md", "ctl.md", ".ctl.md"]) {
          const candidate = pathSvc.join(currentDir, name)
          const exists = yield* fs.exists(candidate)
          if (exists) {
            configPath = candidate
            break
          }
        }
        if (configPath) break
        currentDir = pathSvc.dirname(currentDir)
      }

      const projectRoot = configPath ? pathSvc.dirname(configPath) : cwd

      // Discover skills
      const skills: string[] = []
      for (const skillDir of ["skills", ".claude/skills"]) {
        const skillPath = pathSvc.join(projectRoot, skillDir)
        const exists = yield* fs.exists(skillPath)
        if (exists) {
          const entries = yield* fs.readDirectory(skillPath)
          for (const entry of entries) {
            const entryPath = pathSvc.join(skillPath, entry)
            const stat = yield* fs.stat(entryPath)
            if (stat.type === "Directory") {
              const skillMd = pathSvc.join(entryPath, "SKILL.md")
              const hasSkill = yield* fs.exists(skillMd)
              if (hasSkill) skills.push(entry)
            }
          }
        }
      }

      // Read package.json
      const pkgPath = pathSvc.join(projectRoot, "package.json")
      const hasPkg = yield* fs.exists(pkgPath)
      let pkgInfo: { name?: string; version?: string; scripts?: string[] } | null = null
      if (hasPkg) {
        const content = yield* fs.readFileString(pkgPath)
        const pkg = JSON.parse(content)
        pkgInfo = {
          name: pkg.name,
          version: pkg.version,
          scripts: pkg.scripts ? Object.keys(pkg.scripts) : [],
        }
      }

      const result = {
        projectRoot,
        configPath,
        discovered: configPath !== null,
        skills,
        package: pkgInfo,
      }

      if (agent) {
        yield* output.agentOutput(
          success("discover", result, {
            suggestedSkills: skills.length > 0 ? skills.slice(0, 3) : ["cli/core"],
            steering: configPath ? "complete" : "continue",
          })
        )
      } else {
        yield* output.text("\n🔍 Project Discovery")
        yield* output.text("=".repeat(40))
        yield* output.text("")
        yield* output.text(`📁 Project Root: ${projectRoot}`)
        yield* output.text(`📄 CTL.md: ${configPath ?? "not found"}`)
        yield* output.text("")

        if (pkgInfo) {
          yield* output.text(`📦 Package: ${pkgInfo.name}@${pkgInfo.version}`)
          if (pkgInfo.scripts && pkgInfo.scripts.length > 0) {
            yield* output.text(`📜 Scripts: ${pkgInfo.scripts.slice(0, 5).join(", ")}${pkgInfo.scripts.length > 5 ? "..." : ""}`)
          }
        }

        if (skills.length > 0) {
          yield* output.text("")
          yield* output.text("🎯 Discovered Skills:")
          for (const skill of skills) {
            yield* output.text(`   ✓ ${skill}`)
          }
        }

        yield* output.text("")

        if (!configPath) {
          yield* output.text("💡 Tip: Create a CTL.md file to configure your project")
          yield* output.text("")
          yield* output.text("SKILL: cli/core")
          yield* output.text('  Trigger: "create CTL.md"')
        }
      }
    }).pipe(
      Effect.provide(Layer.merge(NodeContext.layer, outputLayer))
    )
  }
)

// =============================================================================
// HELP COMMAND - Enhanced command discovery
// =============================================================================

const helpQueryArg = Args.text({ name: "query" }).pipe(
  Args.withDescription("Search query to find commands"),
  Args.optional
)

const helpCommand = Command.make(
  "help",
  { query: helpQueryArg, agent: agentOption },
  ({ query, agent }) => {
    if (agent) {
      setCommand("help")
    }
    const outputLayer = agent ? AgentOutputLayer : ConsoleOutputLayer

    return Effect.gen(function* () {
      const output = yield* Output

      const queryValue = Option.getOrNull(query)

      if (queryValue) {
        // Route query to matching commands
        const matches = yield* routeCommand(queryValue)

        if (agent) {
          const actions = matches.slice(0, 5).map((m) =>
            new AgentAction({
              name: m.command.name,
              description: m.command.description,
              command: m.command.command,
              category: m.command.safe ? "query" : "invoke",
              priority: m.confidence > 0.8 ? "high" : "normal",
            })
          )

          yield* output.agentOutput(
            success("help", {
              query: queryValue,
              matches: matches.slice(0, 5).map((m) => ({
                name: m.command.name,
                command: m.command.command,
                confidence: m.confidence,
                matchedKeywords: m.matchedKeywords,
              })),
            }, {
              actions,
              steering: matches.length > 0 ? "continue" : "await_input",
            })
          )
        } else {
          yield* output.text(`\n🔍 Searching for: "${queryValue}"`)
          yield* output.text("")

          if (matches.length === 0) {
            yield* output.text("No matching commands found.")
            yield* output.text("")
            yield* output.text("Try: ctl help (to see all commands)")
          } else {
            yield* output.text(`Found ${matches.length} matching command(s):`)
            yield* output.text("")

            for (const match of matches.slice(0, 5)) {
              const confidence = Math.round(match.confidence * 100)
              const icon = confidence >= 80 ? "✓" : confidence >= 50 ? "◐" : "○"
              yield* output.text(`  ${icon} ${match.command.command.padEnd(25)} ${match.command.description}`)
              yield* output.text(`    Confidence: ${confidence}% | Keywords: ${match.matchedKeywords.join(", ")}`)
              yield* output.text("")
            }

            if (matches.length > 0 && matches[0].confidence >= 0.8) {
              yield* output.text("💡 Best match: " + matches[0].command.command)
            }
          }
        }
      } else {
        // Show all commands
        if (agent) {
          const helpText = getHelpText()
          yield* output.agentOutput(
            success("help", {
              commands: helpText,
            }, {
              steering: "complete",
            })
          )
        } else {
          yield* output.text("")
          yield* output.text(getHelpText())
        }
      }
    }).pipe(
      Effect.provide(Layer.merge(NodeContext.layer, outputLayer))
    )
  }
)

// =============================================================================
// CATALOG COMMAND - Browse component catalog
// =============================================================================

const catalogTypeOption = Options.choice("type", ["command", "adapter", "service", "primitive", "template", "skill"]).pipe(
  Options.withAlias("t"),
  Options.withDescription("Filter by component type"),
  Options.optional
)

const catalogCategoryOption = Options.text("category").pipe(
  Options.withAlias("c"),
  Options.withDescription("Filter by category"),
  Options.optional
)

const catalogSearchArg = Args.text({ name: "search" }).pipe(
  Args.withDescription("Search in name/description"),
  Args.optional
)

const catalogCommand = Command.make(
  "catalog",
  { search: catalogSearchArg, type: catalogTypeOption, category: catalogCategoryOption, agent: agentOption },
  ({ search, type, category, agent }) => {
    if (agent) {
      setCommand("catalog")
    }
    const outputLayer = agent ? AgentOutputLayer : ConsoleOutputLayer

    return Effect.gen(function* () {
      const output = yield* Output

      const query: CatalogQuery = {
        search: Option.getOrUndefined(search),
        type: Option.getOrUndefined(type) as ComponentType | undefined,
        category: Option.getOrUndefined(category),
      }

      const result = yield* queryCatalog(query)

      if (agent) {
        yield* output.agentOutput(
          success("catalog", {
            entries: result.entries.map((e) => ({
              id: e.id,
              name: e.name,
              type: e.type,
              description: e.description,
              category: e.category,
              tags: e.tags,
            })),
            total: result.total,
            query,
          }, {
            steering: "complete",
          })
        )
      } else {
        yield* output.text("\n📚 CTL Component Catalog")
        yield* output.text("=".repeat(40))
        yield* output.text("")

        if (result.entries.length === 0) {
          yield* output.text("No entries found matching your query.")
        } else {
          // Group by type
          const byType = new Map<string, Array<typeof result.entries[number]>>()
          for (const entry of result.entries) {
            const list = byType.get(entry.type) ?? []
            list.push(entry)
            byType.set(entry.type, list)
          }

          for (const [entryType, entries] of byType) {
            yield* output.text(`\n${entryType.toUpperCase()}S:`)
            for (const entry of entries) {
              yield* output.text(`  • ${entry.name.padEnd(25)} ${entry.description}`)
              if (entry.example) {
                yield* output.text(`    Example: ${entry.example}`)
              }
            }
          }
        }

        yield* output.text("")
        yield* output.text(`Total: ${result.total} entries`)
        yield* output.text("")
      }
    }).pipe(
      Effect.provide(Layer.merge(NodeContext.layer, outputLayer))
    )
  }
)

// =============================================================================
// TUI COMMAND - Full terminal UI mode
// =============================================================================

const tuiPageOption = Options.choice("page", ["home", "health", "discover", "logs", "catalog", "settings"]).pipe(
  Options.withAlias("p"),
  Options.withDescription("Initial page to navigate to"),
  Options.withDefault("home" as const)
)

const tuiCommand = Command.make(
  "tui",
  { page: tuiPageOption },
  ({ page }) =>
    Effect.gen(function* () {
      yield* Console.log("Starting CTL TUI mode...")
      yield* Console.log("Note: TUI mode requires a compatible terminal.")
      yield* Console.log("")
      yield* Console.log(`Initial page: ${page}`)
      yield* Console.log("Press Q to quit, use H/E/D/L/C/S to navigate.")
      yield* Console.log("")

      // Start the TUI with initial page
      yield* startTui(page as TuiView)
    }).pipe(Effect.provide(NodeContext.layer))
)

// =============================================================================
// ROOT COMMAND
// =============================================================================

const ctlCommand = Command.make("ctl").pipe(
  Command.withDescription("CTL - Effect CLI Framework for building skill-driven CLIs"),
  Command.withSubcommands([newCommand, addCommand, inspectCommand, healthCommand, discoverCommand, helpCommand, catalogCommand, tuiCommand])
)

// =============================================================================
// TEMPLATE GENERATORS
// =============================================================================

function generatePackageJson(name: string, template: string): string {
  const pkg: Record<string, unknown> = {
    name,
    version: "0.1.0",
    type: "module",
    main: "dist/index.js",
    bin: {
      [name]: "dist/index.js",
    },
    scripts: {
      build: "tsc",
      dev: "bun run src/index.ts",
      typecheck: "tsc --noEmit",
    },
    dependencies: {
      "@gbg/ctl": "workspace:*",
      "@effect/cli": "^0.53.0",
      "@effect/platform": "^0.76.0",
      "@effect/platform-node": "^0.71.0",
      effect: "^3.12.0",
    },
    devDependencies: {
      "@types/bun": "latest",
      typescript: "^5.7.0",
    },
  }

  if (template === "standard" || template === "full") {
    pkg.dependencies = {
      ...(pkg.dependencies as Record<string, string>),
      "@effect/sql": "^0.30.0",
      "@effect/sql-sqlite-bun": "^0.25.0",
    }
  }

  return JSON.stringify(pkg, null, 2)
}

function generateMainTs(name: string, template: string): string {
  return `#!/usr/bin/env bun
/**
 * ${name} CLI
 *
 * Built with @gbg/ctl - Effect CLI Framework
 *
 * @skill ${name}/core
 */

import { Args, Command, Options, runCli } from "@gbg/ctl/core"
import { Effect } from "@gbg/ctl/services"

// =============================================================================
// OPTIONS
// =============================================================================

const verboseOption = Options.boolean("verbose").pipe(
  Options.withAlias("v"),
  Options.withDescription("Enable verbose output"),
  Options.withDefault(false)
)

// =============================================================================
// COMMANDS
// =============================================================================

const helloName = Args.text({ name: "name" }).pipe(
  Args.withDescription("Name to greet"),
  Args.withDefault("World")
)

const helloCommand = Command.make(
  "hello",
  { name: helloName, verbose: verboseOption },
  ({ name, verbose }) =>
    Effect.gen(function* () {
      if (verbose) {
        yield* Effect.log(\`Greeting \${name}...\`)
      }
      yield* Effect.log(\`Hello, \${name}!\`)
    })
)

// =============================================================================
// ROOT COMMAND
// =============================================================================

const ${name.replace(/-/g, "")}Command = Command.make("${name}").pipe(
  Command.withDescription("${name} CLI - Built with @gbg/ctl"),
  Command.withSubcommands([helloCommand])
)

// =============================================================================
// RUN
// =============================================================================

runCli(${name.replace(/-/g, "")}Command, {
  name: "${name}",
  version: "0.1.0",
})
`
}

function generateTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "bundler",
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
        declaration: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src/**/*"],
    },
    null,
    2
  )
}

function generateCommandTemplate(name: string): string {
  return `/**
 * ${name} command
 *
 * @skill cli/core
 */

import { Args, Command, Options } from "@gbg/ctl/core"
import { Effect } from "@gbg/ctl/services"

const ${name}Command = Command.make(
  "${name}",
  {},
  () =>
    Effect.gen(function* () {
      yield* Effect.log("${name} command executed")
    })
)

export { ${name}Command }
`
}

function generateMigrationTemplate(name: string): string {
  return `/**
 * Migration: ${name}
 */

import type { Migration } from "@gbg/ctl/persistence"
import { Effect } from "@gbg/ctl/services"

export const migration: Migration = {
  version: ${Date.now()},
  description: "${name}",
  up: (sql) =>
    Effect.gen(function* () {
      yield* sql\`
        -- Add your migration SQL here
      \`
    }),
}
`
}

// =============================================================================
// ENTRY POINT
// =============================================================================

const cli = Command.run(ctlCommand, { name: "ctl", version: "0.1.0" })

cli(process.argv).pipe(
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
)
