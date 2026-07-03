#!/usr/bin/env bun
/**
 * Staged-file gate for PCT/LNK/MSH hardening closeout.
 *
 * Default mode is planning: only docs/RFC/hardening runbook paths are allowed.
 * Root/shared files require explicit --allow-root path:owner overrides.
 */

import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

interface StagedEntry {
  readonly status: string
  readonly path: string
  readonly reason: string | null
}

interface Args {
  readonly mode: "planning" | "implementation"
  readonly allowRoot: ReadonlyMap<string, string>
  readonly json: boolean
  readonly help: boolean
}

const scriptDir = dirname(fileURLToPath(import.meta.url))
const pctRoot = resolve(scriptDir, "..")

const rootShared = new Set(["package.json", "bun.lock", ".gitmodules"])

const usage = `Usage:
  bun scripts/check-staged-files.ts [--mode planning|implementation] [--allow-root <path:owner>] [--json]

Examples:
  bun run workspace:staged-gate
  bun scripts/check-staged-files.ts --mode implementation
  bun scripts/check-staged-files.ts --allow-root bun.lock:DependencyLaneOwner
`

const parseArgs = (argv: ReadonlyArray<string>): Args => {
  let mode: Args["mode"] = "planning"
  let json = false
  let help = false
  const allowRoot = new Map<string, string>()

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--help" || arg === "-h") {
      help = true
      continue
    }
    if (arg === "--json") {
      json = true
      continue
    }
    if (arg === "--mode") {
      const value = argv[index + 1]
      if (value !== "planning" && value !== "implementation") {
        throw new Error("--mode must be planning or implementation")
      }
      mode = value
      index += 1
      continue
    }
    if (arg === "--allow-root") {
      const value = argv[index + 1]
      if (value === undefined) throw new Error("--allow-root requires <path:owner>")
      const separator = value.indexOf(":")
      if (separator <= 0 || separator === value.length - 1) {
        throw new Error("--allow-root requires <path:owner>")
      }
      const path = value.slice(0, separator)
      const owner = value.slice(separator + 1)
      if (!rootShared.has(path)) throw new Error(`--allow-root only supports ${[...rootShared].join(", ")}`)
      allowRoot.set(path, owner)
      index += 1
      continue
    }
    throw new Error(`unknown argument: ${arg}`)
  }

  return { mode, allowRoot, json, help }
}

const runGit = (args: ReadonlyArray<string>, cwd = pctRoot): string => {
  const result = spawnSync("git", [...args], { cwd, encoding: "utf8" })
  if (result.status !== 0) {
    const stderr = typeof result.stderr === "string" ? result.stderr : ""
    throw new Error(`git ${args.join(" ")} failed: ${stderr.trim()}`)
  }
  return String(result.stdout).trimEnd()
}

const repoRoot = (): string => runGit(["rev-parse", "--show-toplevel"])

const normalizePath = (path: string): string =>
  path.replace(/^"|"$/g, "").replaceAll("\\", "/")

const parsePorcelainLine = (line: string): StagedEntry | null => {
  if (line.length < 4) return null
  const indexStatus = line[0] ?? " "
  if (indexStatus === " " || indexStatus === "?") return null
  const status = line.slice(0, 2)
  const rawPath = line.slice(3)
  const path = normalizePath(rawPath.includes(" -> ") ? rawPath.split(" -> ").at(-1) ?? rawPath : rawPath)
  return { status, path, reason: null }
}

const isRuntimeState = (path: string): boolean =>
  path.includes("/.pi/") ||
  path.startsWith("packages/tmnl/.pi/") ||
  path.includes(".db-shm") ||
  path.includes(".db-wal") ||
  path.includes("/autoresearch.jsonl") ||
  path.includes("/autoresearch.md") ||
  path.includes("/autoresearch.ideas.md") ||
  path.startsWith("packages/pct/.soak-runs/")

const isPlanningAllowed = (path: string): boolean =>
  path.startsWith("packages/pct/RFC-") ||
  path.startsWith("packages/pct/PCT-LNK-MSH-HARDENING-") ||
  path.startsWith("packages/pct/docs/hardening/") ||
  path === "packages/pct/NATS-INTEGRATION-CLOSEOUT.md" ||
  path === "packages/pct/package.json" ||
  path.startsWith("packages/pct/scripts/") ||
  path.startsWith("packages/msh/docs/") ||
  path === "packages/lnk/NATS-BRIDGE.md"

const violationReason = (entry: StagedEntry, args: Args): string | null => {
  const path = entry.path
  if (rootShared.has(path)) {
    const owner = args.allowRoot.get(path)
    return owner === undefined ? `root/shared file requires explicit owner override: ${path}` : null
  }

  if (path.startsWith("submodules/")) return "submodule drift requires dedicated submodule owner"
  if (isRuntimeState(path)) return "runtime/generated state must not be staged by hardening closeout"
  if (entry.status.includes("D") && (path.startsWith("packages/db/") || path.startsWith("packages/entity/"))) {
    return "package deletion requires dedicated deletion owner"
  }

  if (args.mode === "planning" && !isPlanningAllowed(path)) {
    return "planning mode allows only PCT RFC/hardening docs/scripts and documented MSH/LNK docs linkbacks"
  }

  return null
}

const collectStaged = (repo: string): ReadonlyArray<StagedEntry> => {
  const output = runGit(["-C", repo, "status", "--porcelain=v1"], repo)
  if (output.trim().length === 0) return []
  return output
    .split("\n")
    .map(parsePorcelainLine)
    .filter((entry): entry is StagedEntry => entry !== null)
}

try {
  const args = parseArgs(Bun.argv.slice(2))
  if (args.help) {
    console.log(usage)
    process.exit(0)
  }

  const repo = repoRoot()
  const staged = collectStaged(repo)
  const evaluated = staged.map((entry) => ({ ...entry, reason: violationReason(entry, args) }))
  const violations = evaluated.filter((entry) => entry.reason !== null)
  const allowedRoot = [...args.allowRoot.entries()].map(([path, owner]) => ({ path, owner }))
  const ok = violations.length === 0

  if (args.json) {
    console.log(JSON.stringify({ ok, mode: args.mode, allowedRoot, staged: evaluated, violations }, null, 2))
  } else {
    console.log(`mode: ${args.mode}`)
    console.log(`staged files: ${staged.length}`)
    if (allowedRoot.length > 0) {
      console.log(`root overrides: ${allowedRoot.map((entry) => `${entry.path}:${entry.owner}`).join(", ")}`)
    }
    for (const entry of evaluated) {
      const marker = entry.reason === null ? "✓" : "✗"
      const detail = entry.reason === null ? "" : ` — ${entry.reason}`
      console.log(`${marker} ${entry.status} ${entry.path}${detail}`)
    }
    console.log(`\n${ok ? "PASS" : "FAIL"}: ${staged.length - violations.length}/${staged.length} staged files allowed`)
  }

  if (!ok) process.exit(1)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
