/**
 * @module plugins/metaskill-services/frontmatter-service
 *
 * FrontmatterService — read and mutate YAML frontmatter in skill docs.
 *
 * Deps: SkillConfig, FileSystem
 *
 * Read: safe (probe) — frontmatter() never fails
 * Write: typed — setFrontmatter() propagates FileReadError
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Context from "effect/Context"
import { FileSystem } from "effect/FileSystem"
import { join, relative } from "node:path"
import { SkillConfig } from "./skill-config.js"
import { FileReadError } from "./errors.js"
import * as Fs from "./fs-ops.js"

// ── Shape ────────────────────────────────────────────────────────

export interface FrontmatterMap {
  [file: string]: Record<string, string>
}

export interface FrontmatterServiceShape {
  readonly frontmatter: (name: string) => Effect.Effect<FrontmatterMap>
  readonly setFrontmatter: (path: string, field: string, value: string) => Effect.Effect<void, FileReadError>
}

// ── Service ──────────────────────────────────────────────────────

export class FrontmatterService extends Context.Service<FrontmatterService, FrontmatterServiceShape>()(
  "@gbg/codemode-metaskill/FrontmatterService"
) {}

// ── Layer ────────────────────────────────────────────────────────

export const FrontmatterServiceLive = Layer.effect(
  FrontmatterService,
  Effect.gen(function*() {
    const config = yield* SkillConfig
    const fs = yield* FileSystem

    return FrontmatterService.of({
      frontmatter: (name) => Effect.gen(function*() {
        const dir = join(config.skillsDir, name)
        const files = yield* Fs.findMd(fs, dir)
        const result: FrontmatterMap = {}
        for (const f of files) {
          const content = yield* Fs.readFileSafe(fs, f)
          const fm = Fs.parseFrontmatter(content.split("\n"))
          if (Object.keys(fm).length > 0) result[relative(dir, f)] = fm
        }
        return result
      }),

      setFrontmatter: (path, field, value) => Effect.gen(function*() {
        const abs = path.startsWith("/") ? path : join(config.cwd, path)
        const content = yield* Fs.readFile(fs, abs)
        const lines = content.split("\n")

        let newContent: string
        if (lines[0]?.trim() === "---") {
          const endIdx = lines.slice(1).findIndex(l => l.trim() === "---")
          if (endIdx !== -1) {
            const fmLines = lines.slice(1, endIdx + 1)
            const existing = fmLines.findIndex(l => l.startsWith(`${field}:`))
            if (existing !== -1) {
              fmLines[existing] = `${field}: ${value}`
            } else {
              fmLines.push(`${field}: ${value}`)
            }
            newContent = ["---", ...fmLines, "---", ...lines.slice(endIdx + 2)].join("\n")
          } else {
            newContent = ["---", `${field}: ${value}`, "---", "", ...lines].join("\n")
          }
        } else {
          newContent = ["---", `${field}: ${value}`, "---", "", ...lines].join("\n")
        }
        yield* Fs.writeFile(fs, abs, newContent)
      }),
    })
  }),
)
