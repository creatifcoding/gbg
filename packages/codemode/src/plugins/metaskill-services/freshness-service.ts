/**
 * @module plugins/metaskill-services/freshness-service
 *
 * FreshnessService — track update-strategy freshness across skills.
 *
 * Deps: SkillConfig, SkillDiscovery, FileSystem
 *
 * Read: safe (probe) — freshness() never fails
 * Write: typed — setUpdateStatus() propagates FileReadError
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Context from "effect/Context"
import { FileSystem } from "effect/FileSystem"
import { join } from "node:path"
import { SkillConfig } from "./skill-config.js"
import { SkillDiscovery } from "./skill-discovery.js"
import { FileReadError } from "./errors.js"
import * as Fs from "./fs-ops.js"
import type { UpdateStatus, UpdatePolicy, FreshnessReport } from "./types.js"

// ── Shape ────────────────────────────────────────────────────────

export interface FreshnessServiceShape {
  readonly freshness: (name: string) => Effect.Effect<FreshnessReport>
  readonly setUpdateStatus: (path: string, status: UpdateStatus) => Effect.Effect<void, FileReadError>
  readonly freshnessAll: Effect.Effect<{ total: number; current: number; stale: number; pending: number; untracked: number }>
  readonly staleAll: Effect.Effect<UpdatePolicy[]>
}

// ── Service ──────────────────────────────────────────────────────

export class FreshnessService extends Context.Service<FreshnessService, FreshnessServiceShape>()(
  "@gbg/codemode-metaskill/FreshnessService"
) {}

// ── Helpers ──────────────────────────────────────────────────────

const extractPolicy = (fs: FileSystem, path: string, skillName: string): Effect.Effect<UpdatePolicy | null> =>
  Fs.readFileSafe(fs, path).pipe(
    Effect.map(content => {
      const lines = content.split("\n")
      const strategyLine = lines.find(l => l.startsWith("update-strategy:"))
      if (!strategyLine) return null

      const strategy = strategyLine.replace("update-strategy:", "").trim()
      const triggerLine = lines.find(l => l.startsWith("update-trigger:"))
      const trigger = triggerLine?.replace("update-trigger:", "").trim() ?? ""
      const statusLine = lines.find(l => l.startsWith("update-status:"))
      const status = (statusLine?.replace("update-status:", "").trim() ?? "current") as UpdateStatus

      return { file: path, skill: skillName, status, strategy, trigger } as UpdatePolicy & { strategy: string; trigger: string }
    }),
  )

// ── Layer ────────────────────────────────────────────────────────

export const FreshnessServiceLive = Layer.effect(
  FreshnessService,
  Effect.gen(function*() {
    const config = yield* SkillConfig
    const discovery = yield* SkillDiscovery
    const fs = yield* FileSystem

    const freshnessFor = (name: string): Effect.Effect<FreshnessReport> =>
      Effect.gen(function*() {
        const dir = join(config.skillsDir, name)
        const files = yield* Fs.findMd(fs, dir)
        const policies = (yield* Effect.all(
          files.map(f => extractPolicy(fs, f, name))
        )).filter((p): p is NonNullable<typeof p> => p !== null)

        return {
          skill: name,
          total: policies.length,
          current: policies.filter(p => p.status === "current").length,
          stale: policies.filter(p => p.status === "stale").length,
          pending: policies.filter(p => p.status === "pending").length,
          policies,
        }
      })

    return FreshnessService.of({
      freshness: (name) => freshnessFor(name),

      setUpdateStatus: (path, status) => Effect.gen(function*() {
        const abs = path.startsWith("/") ? path : join(config.cwd, path)
        const content = yield* Fs.readFile(fs, abs)
        const updated = content.replace(
          /update-status:\s*\w+/,
          `update-status: ${status}`,
        )
        yield* Fs.writeFile(fs, abs, updated)
      }),

      freshnessAll: Effect.gen(function*() {
        const skills = yield* discovery.discover
        const reports = yield* Effect.all(skills.map(s => freshnessFor(s.name)))
        const totals = reports.reduce((acc, f, i) => {
          acc.total += f.total
          acc.current += f.current
          acc.stale += f.stale
          acc.pending += f.pending
          acc.fileCount += skills[i]?.fileCount ?? 0
          return acc
        }, { total: 0, current: 0, stale: 0, pending: 0, fileCount: 0 })
        return {
          total: totals.total,
          current: totals.current,
          stale: totals.stale,
          pending: totals.pending,
          untracked: totals.fileCount - totals.total,
        }
      }),

      staleAll: Effect.gen(function*() {
        const skills = yield* discovery.discover
        const reports = yield* Effect.all(skills.map(s => freshnessFor(s.name)))
        return reports.flatMap(f => f.policies.filter(p => p.status === "stale"))
      }),
    })
  }),
)
