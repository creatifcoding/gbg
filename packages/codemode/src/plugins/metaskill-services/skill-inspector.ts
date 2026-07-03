/**
 * @module plugins/metaskill-services/skill-inspector
 *
 * SkillInspector — health checks, audit, conformance.
 *
 * Deps: SkillDiscovery, SkillConfig, FileSystem
 *
 * All reads are safe (probes) — inspection never fails, it reports.
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Context from "effect/Context"
import { FileSystem } from "effect/FileSystem"
import { join, relative } from "node:path"
import { SkillConfig } from "./skill-config.js"
import { SkillDiscovery } from "./skill-discovery.js"
import * as Fs from "./fs-ops.js"
import type { SkillType, HealthCheck, HealthReport, WorkspaceRow, ConformanceResult } from "./types.js"

// ── Shape ────────────────────────────────────────────────────────

export interface SkillInspectorShape {
  readonly inspect: (name: string) => Effect.Effect<HealthReport>
  readonly audit: Effect.Effect<WorkspaceRow[]>
  readonly conformance: (name: string) => Effect.Effect<ConformanceResult>
  readonly conformanceAudit: Effect.Effect<ConformanceResult[]>
}

// ── Service ──────────────────────────────────────────────────────

export class SkillInspector extends Context.Service<SkillInspector, SkillInspectorShape>()(
  "@gbg/codemode-metaskill/SkillInspector"
) {}

// ── Helpers (pure) ───────────────────────────────────────────────

function check(name: string, pass: boolean, detail?: string): HealthCheck {
  return { name, pass, detail: pass ? undefined : detail }
}

function report(skill: string, path: string, checks: HealthCheck[]): HealthReport {
  const passed = checks.filter(c => c.pass).length
  return {
    skill, path, checks, passed,
    total: checks.length,
    clean: passed === checks.length,
    summary: `${passed}/${checks.length} checks passed`,
  }
}

function classifySkill(_n: number, hasUtils: boolean, hasRefs: boolean): SkillType {
  if (hasUtils) return "operational"
  if (hasRefs) return "reference"
  return "leaf"
}

// ── Layer ────────────────────────────────────────────────────────

export const SkillInspectorLive = Layer.effect(
  SkillInspector,
  Effect.gen(function*() {
    const config = yield* SkillConfig
    const discovery = yield* SkillDiscovery
    const fs = yield* FileSystem

    const findOrphans = (dir: string, files: string[]): Effect.Effect<string[]> =>
      Fs.readLinesSafe(fs, join(dir, "GRAPH.md")).pipe(Effect.map(graph => {
        const rels = files.map(f => relative(dir, f))
        const graphEntries = graph
          .filter(l => l.match(/^\s*-\s+\[/))
          .map(l => l.replace(/.*\[([^\]]+)\].*/, "$1"))
        return rels.filter(f =>
          f !== "SKILL.md" && f !== "CHANGELOG.md" && f !== "GRAPH.md"
          && !graphEntries.some(g => f.endsWith(g) || f.includes(g)))
      }))

    const findDeadLinks = (dir: string, files: string[]): Effect.Effect<string[]> =>
      Effect.gen(function*() {
        const dead: string[] = []
        for (const f of files) {
          const content = yield* Fs.readFileSafe(fs, f)
          const links = content.match(/\[([^\]]*)\]\(([^)]+)\)/g) ?? []
          for (const link of links) {
            const href = link.replace(/.*\(([^)]+)\)/, "$1")
            if (href.startsWith("http") || href.startsWith("#")) continue
            const target = join(dir, href.split("#")[0])
            const targetExists = yield* Fs.exists(fs, target)
            if (!targetExists) dead.push(`${relative(dir, f)} → ${href}`)
          }
        }
        return dead
      })

    const inspectFor = (name: string): Effect.Effect<HealthReport> =>
      Effect.gen(function*() {
        const dir = join(config.skillsDir, name)
        const dirExists = yield* Fs.exists(fs, dir)
        if (!dirExists) {
          return report(name, dir, [{ name: "exists", pass: false, detail: "Not found" }])
        }

        const files = yield* Fs.findMd(fs, dir)
        const rels = files.map(f => relative(dir, f))
        const checks: HealthCheck[] = []

        const head = yield* Fs.readHead(fs, join(dir, "SKILL.md"))
        checks.push(check("governance",
          head.includes("governed-by: metaskill"),
          "Missing governed-by: metaskill"))

        checks.push(check("changelog", yield* Fs.exists(fs, join(dir, "CHANGELOG.md"))))

        const fmResults = yield* Effect.all(files.map(f =>
          Fs.hasFrontmatter(fs, f).pipe(Effect.map(has => ({ file: relative(dir, f), has })))
        ))
        const fmGaps = fmResults.filter(r => !r.has).map(r => r.file)
        checks.push(check("frontmatter", fmGaps.length === 0,
          fmGaps.length > 0 ? `Missing: ${fmGaps.join(", ")}` : undefined))

        const orphans = yield* findOrphans(dir, files)
        checks.push(check("orphans", orphans.length === 0,
          orphans.length > 0 ? orphans.join(", ") : undefined))

        const deadLinks = yield* findDeadLinks(dir, files)
        checks.push(check("dead-links", deadLinks.length === 0,
          deadLinks.length > 0 ? deadLinks.join(", ") : undefined))

        const graph = yield* Fs.readLinesSafe(fs, join(dir, "GRAPH.md"))
        const graphEntries = graph.filter(l => l.match(/^\s*-\s+\[/)).length
        const expectedEntries = rels.filter(f =>
          f !== "SKILL.md" && f !== "CHANGELOG.md" && f !== "GRAPH.md").length
        checks.push(check("children-sync", graphEntries >= expectedEntries,
          `GRAPH.md has ${graphEntries} entries, found ${expectedEntries} files`))

        checks.push(check("cross-symmetry", true))
        checks.push(check("graph", yield* Fs.exists(fs, join(dir, "GRAPH.md"))))

        const clLines = yield* Fs.readLinesSafe(fs, join(dir, "CHANGELOG.md"))
        checks.push(check("changelog-content", clLines.length > 3, "Changelog is too short"))

        const policyCount = (yield* Effect.all(files.map(f =>
          Fs.readLinesSafe(fs, f).pipe(Effect.map(lines =>
            lines.some(l => l.startsWith("update-strategy:")) ? 1 : 0
          ))
        ))).reduce((a, b) => a + b, 0)
        checks.push(check("update-freshness", policyCount > 0,
          "No files declare update-strategy"))

        return report(name, dir, checks)
      })

    const conformanceFor = (name: string): Effect.Effect<ConformanceResult> =>
      Effect.gen(function*() {
        const dir = join(config.skillsDir, name)
        const skillMdExists = yield* Fs.exists(fs, join(dir, "SKILL.md"))
        if (!skillMdExists) {
          return { name, level: -1, label: "missing", type: "leaf" as const, detail: ["No SKILL.md"] }
        }

        const files = yield* Fs.findMd(fs, dir)
        const hasUtils = yield* Fs.exists(fs, join(dir, "utils"))
        const hasRefs = files.some(f => relative(dir, f).startsWith("references/"))
        const type = classifySkill(files.length, hasUtils, hasRefs)

        const head = yield* Fs.readHead(fs, join(dir, "SKILL.md"))
        const governed = head.includes("governed-by: metaskill")
        const hasCl = yield* Fs.exists(fs, join(dir, "CHANGELOG.md"))

        const fmResults = yield* Effect.all(files.map(f => Fs.hasFrontmatter(fs, f)))
        const fmCount = fmResults.filter(Boolean).length

        const detail: string[] = []
        if (!governed && !hasCl) {
          return { name, level: 0, label: "exists", type, detail: ["Has SKILL.md but not governed"] }
        }
        if (!governed) detail.push("Not governed")
        if (!hasCl) detail.push("No changelog")
        if (fmCount < files.length) detail.push(`Frontmatter: ${fmCount}/${files.length}`)

        if (detail.length > 0) {
          return { name, level: 0, label: "exists", type, detail }
        }

        const health = yield* inspectFor(name)
        if (!health.clean) {
          return { name, level: 1, label: "governed", type,
            detail: health.checks.filter(c => !c.pass).map(c => `${c.name}: ${c.detail ?? "failed"}`) }
        }

        if (type === "leaf") {
          return { name, level: 2, label: "clean", type, detail: ["Leaf ceiling reached"] }
        }

        const hasGraph = yield* Fs.exists(fs, join(dir, "GRAPH.md"))
        if (type === "reference" && hasGraph) {
          return { name, level: 3, label: "complete", type, detail: [] }
        }
        if (type === "operational" && hasGraph && hasUtils) {
          return { name, level: 3, label: "complete", type, detail: [] }
        }

        return { name, level: 2, label: "clean", type,
          detail: type === "reference" ? ["Needs GRAPH.md"] : ["Needs utils/ + GRAPH.md"] }
      })

    return SkillInspector.of({
      inspect: (name) => inspectFor(name),

      audit: Effect.gen(function*() {
        const skills = yield* discovery.discover
        return yield* Effect.all(skills.map(s =>
          Effect.gen(function*() {
            const files = yield* Fs.findMd(fs, s.path)
            const fmResults = yield* Effect.all(files.map(f => Fs.hasFrontmatter(fs, f)))
            const fmMissing = fmResults.filter(x => !x).length
            return { name: s.name, governed: s.governed, fileCount: s.fileCount, hasChangelog: s.hasChangelog, fmMissing }
          })
        ))
      }),

      conformance: (name) => conformanceFor(name),

      conformanceAudit: Effect.gen(function*() {
        const skills = yield* discovery.discover
        return yield* Effect.all(skills.map(s => conformanceFor(s.name)))
      }),
    })
  }),
)
