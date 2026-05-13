/**
 * @module plugins/metaskill-services/skill-discovery
 *
 * SkillDiscovery — discovers and classifies skills in the workspace.
 *
 * Deps: SkillConfig, FileSystem
 *
 * All reads are safe (probes) — discovery never fails, just returns empty.
 */

import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Context from "effect-v4/Context"
import { FileSystem } from "effect-v4/FileSystem"
import { join, relative } from "node:path"
import { SkillConfig } from "./skill-config.js"
import * as Fs from "./fs-ops.js"
import type { SkillInfo, SkillType } from "./types.js"

// ── Shape ────────────────────────────────────────────────────────

export interface SkillDiscoveryShape {
  readonly discover: Effect.Effect<SkillInfo[]>
  readonly info: (name: string) => Effect.Effect<SkillInfo>
}

// ── Service ──────────────────────────────────────────────────────

export class SkillDiscovery extends Context.Service<SkillDiscovery, SkillDiscoveryShape>()(
  "@gbg/codemode-metaskill/SkillDiscovery"
) {}

// ── Helpers ──────────────────────────────────────────────────────

function classifySkill(_fileCount: number, hasUtils: boolean, hasRefs: boolean): SkillType {
  if (hasUtils) return "operational"
  if (hasRefs) return "reference"
  return "leaf"
}

// ── Layer ────────────────────────────────────────────────────────

export const SkillDiscoveryLive = Layer.effect(
  SkillDiscovery,
  Effect.gen(function*() {
    const config = yield* SkillConfig
    const fs = yield* FileSystem

    const infoFor = (name: string): Effect.Effect<SkillInfo> =>
      Effect.gen(function*() {
        const dir = join(config.skillsDir, name)
        const files = yield* Fs.findMd(fs, dir)
        const rels = files.map(f => relative(dir, f))
        const head = yield* Fs.readHead(fs, join(dir, "SKILL.md"))
        const hasUtils = yield* Fs.exists(fs, join(dir, "utils"))
        const hasRefs = rels.some(f => f.startsWith("references/"))
        return {
          name,
          path: dir,
          type: classifySkill(files.length, hasUtils, hasRefs),
          governed: head.includes("governed-by: metaskill"),
          fileCount: files.length,
          files: rels,
          hasChangelog: yield* Fs.exists(fs, join(dir, "CHANGELOG.md")),
          hasGraph: yield* Fs.exists(fs, join(dir, "GRAPH.md")),
          hasUtils,
          hasRefs,
          hasTemplate: yield* Fs.exists(fs, join(dir, "TEMPLATE.md")),
        }
      })

    return SkillDiscovery.of({
      discover: Effect.gen(function*() {
        const dirExists = yield* Fs.exists(fs, config.skillsDir)
        if (!dirExists) return []

        const entries = yield* Fs.readDirSafe(fs, config.skillsDir)
        const dirs: string[] = []
        for (const entry of entries) {
          const info = yield* Fs.stat(fs, join(config.skillsDir, entry))
          if (info && info.type === "Directory") dirs.push(entry)
        }

        const skills = yield* Effect.all(dirs.sort().map(name => infoFor(name)))
        return skills as unknown as SkillInfo[]
      }),

      info: (name) => infoFor(name),
    })
  }),
)
