#!/usr/bin/env bun
/**
 * Read-only dirty workspace classifier for PCT/LNK/MSH hardening lanes.
 *
 * It summarizes git status by package, porcelain status, risk class, and likely
 * lane ownership. It never stages, writes, or mutates the workspace.
 */

import { spawnSync } from "node:child_process"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

interface DirtyEntry {
  readonly status: string
  readonly statusKind: string
  readonly path: string
  readonly packageName: string
  readonly risk: RiskClass
  readonly lane: LaneOwner
}

type RiskClass =
  | "root-shared-owner-required"
  | "runtime-state"
  | "package-delete"
  | "submodule-drift"
  | "pct-hardening-docs"
  | "pct-implementation"
  | "msh-substrate"
  | "lnk-bridge"
  | "other-package"
  | "other"

type LaneOwner =
  | "workspace-root-owner-required"
  | "local-runtime-ignore-review"
  | "package-deletion-owner-required"
  | "submodule-owner-required"
  | "pct-hardening-docs"
  | "pct-implementation"
  | "msh-substrate"
  | "lnk-bridge"
  | "unrelated-or-unknown"

interface Args {
  readonly json: boolean
  readonly maxDetails: number
  readonly help: boolean
}

const scriptDir = dirname(fileURLToPath(import.meta.url))
const pctRoot = resolve(scriptDir, "..")

const usage = `Usage:
  bun scripts/workspace-dirty-report.ts [--json] [--max-details <n>]

Examples:
  bun run workspace:dirty-report
  bun scripts/workspace-dirty-report.ts --json
  bun scripts/workspace-dirty-report.ts --max-details 200
`

const parseArgs = (argv: ReadonlyArray<string>): Args => {
  let json = false
  let maxDetails = 120
  let help = false

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
    if (arg === "--max-details") {
      const value = argv[index + 1]
      if (value === undefined) throw new Error("--max-details requires a number")
      const parsed = Number.parseInt(value, 10)
      if (!Number.isFinite(parsed) || parsed < 0) throw new Error("--max-details must be a non-negative integer")
      maxDetails = parsed
      index += 1
      continue
    }
    throw new Error(`unknown argument: ${arg}`)
  }

  return { json, maxDetails, help }
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
  path
    .replace(/^"|"$/g, "")
    .replaceAll("\\", "/")

const parsePorcelainLine = (line: string): { status: string; path: string } | null => {
  if (line.length < 4) return null
  const status = line.slice(0, 2)
  const rawPath = line.slice(3)
  const path = normalizePath(rawPath.includes(" -> ") ? rawPath.split(" -> ").at(-1) ?? rawPath : rawPath)
  return { status, path }
}

const statusKind = (status: string): string => {
  if (status === "??") return "untracked"
  if (status.includes("U")) return "conflict"
  if (status.includes("R")) return "renamed"
  if (status.includes("C")) return "copied"
  if (status.includes("A")) return "added"
  if (status.includes("D")) return "deleted"
  if (status.includes("M")) return "modified"
  return "other"
}

const packageNameFor = (path: string): string => {
  const parts = path.split("/")
  if (parts[0] === "packages" && parts[1]) return `packages/${parts[1]}`
  if (parts[0] === "submodules" && parts[1]) return `submodules/${parts[1]}`
  return "<root>"
}

const isRuntimeState = (path: string): boolean =>
  path.includes("/.pi/") ||
  path.startsWith("packages/tmnl/.pi/") ||
  path.includes(".db-shm") ||
  path.includes(".db-wal") ||
  path.includes("/autoresearch.jsonl") ||
  path.includes("/autoresearch.md") ||
  path.includes("/autoresearch.ideas.md") ||
  path.startsWith("packages/pct/.soak-runs/") ||
  path.startsWith("tmp/")

const classify = (status: string, path: string): Pick<DirtyEntry, "risk" | "lane"> => {
  const kind = statusKind(status)

  if (path === "package.json" || path === "bun.lock" || path === ".gitmodules") {
    return { risk: "root-shared-owner-required", lane: "workspace-root-owner-required" }
  }

  if (path.startsWith("submodules/")) {
    return { risk: "submodule-drift", lane: "submodule-owner-required" }
  }

  if (isRuntimeState(path)) {
    return { risk: "runtime-state", lane: "local-runtime-ignore-review" }
  }

  if (kind === "deleted" && (path.startsWith("packages/db/") || path.startsWith("packages/entity/"))) {
    return { risk: "package-delete", lane: "package-deletion-owner-required" }
  }

  if (
    path.startsWith("packages/pct/docs/hardening/") ||
    path.startsWith("packages/pct/RFC-") ||
    path.startsWith("packages/pct/PCT-LNK-MSH-HARDENING-") ||
    path === "packages/pct/NATS-INTEGRATION-CLOSEOUT.md"
  ) {
    return { risk: "pct-hardening-docs", lane: "pct-hardening-docs" }
  }

  if (path.startsWith("packages/pct/")) {
    return { risk: "pct-implementation", lane: "pct-implementation" }
  }

  if (path.startsWith("packages/msh/")) {
    return { risk: "msh-substrate", lane: "msh-substrate" }
  }

  if (path.startsWith("packages/lnk/")) {
    return { risk: "lnk-bridge", lane: "lnk-bridge" }
  }

  if (path.startsWith("packages/")) {
    return { risk: "other-package", lane: "unrelated-or-unknown" }
  }

  return { risk: "other", lane: "unrelated-or-unknown" }
}

const countBy = <K extends string>(entries: ReadonlyArray<DirtyEntry>, key: (entry: DirtyEntry) => K): Record<K, number> => {
  const counts = {} as Record<K, number>
  for (const entry of entries) {
    const value = key(entry)
    counts[value] = (counts[value] ?? 0) + 1
  }
  return counts
}

const renderCounts = (title: string, counts: Record<string, number>): string => {
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return [`## ${title}`, "", "| Value | Count |", "| --- | ---: |", ...rows.map(([value, count]) => `| \`${value}\` | ${count} |`), ""].join("\n")
}

const renderMarkdown = (repo: string, entries: ReadonlyArray<DirtyEntry>, maxDetails: number): string => {
  const shown = entries.slice(0, maxDetails)
  const hidden = Math.max(0, entries.length - shown.length)
  return [
    "# Workspace Dirty Baseline Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Repo: \`${repo}\``,
    `Total dirty entries: ${entries.length}`,
    "",
    renderCounts("By risk class", countBy(entries, (entry) => entry.risk)),
    renderCounts("By likely lane", countBy(entries, (entry) => entry.lane)),
    renderCounts("By package/root bucket", countBy(entries, (entry) => entry.packageName)),
    renderCounts("By porcelain status kind", countBy(entries, (entry) => entry.statusKind)),
    "## Details",
    "",
    `Showing ${shown.length} of ${entries.length} entries${hidden > 0 ? ` (${hidden} hidden; rerun with --max-details ${entries.length})` : ""}.`,
    "",
    "| Status | Kind | Risk | Lane | Package | Path |",
    "| --- | --- | --- | --- | --- | --- |",
    ...shown.map((entry) => `| \`${entry.status}\` | \`${entry.statusKind}\` | \`${entry.risk}\` | \`${entry.lane}\` | \`${entry.packageName}\` | \`${entry.path}\` |`),
    "",
  ].join("\n")
}

const collectEntries = (repo: string): ReadonlyArray<DirtyEntry> => {
  const output = runGit(["-C", repo, "status", "--porcelain=v1", "--untracked-files=all"], repo)
  if (output.trim().length === 0) return []

  return output
    .split("\n")
    .map(parsePorcelainLine)
    .filter((entry): entry is { status: string; path: string } => entry !== null)
    .map(({ status, path }) => {
      const classification = classify(status, path)
      return {
        status,
        statusKind: statusKind(status),
        path,
        packageName: packageNameFor(path),
        ...classification,
      }
    })
}

try {
  const args = parseArgs(Bun.argv.slice(2))
  if (args.help) {
    console.log(usage)
    process.exit(0)
  }

  const repo = repoRoot()
  const entries = collectEntries(repo)
  const summary = {
    generatedAt: new Date().toISOString(),
    repo,
    total: entries.length,
    byRisk: countBy(entries, (entry) => entry.risk),
    byLane: countBy(entries, (entry) => entry.lane),
    byPackage: countBy(entries, (entry) => entry.packageName),
    byStatusKind: countBy(entries, (entry) => entry.statusKind),
    entries,
  }

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    console.log(renderMarkdown(repo, entries, args.maxDetails))
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
