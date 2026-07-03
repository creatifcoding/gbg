/**
 * @module plugins/metaskill-services/skill-mutations
 *
 * SkillMutations — adopt governance and scaffold new skills.
 *
 * Deps: SkillConfig, FileSystem
 *
 * Mutations propagate FileReadError — writes MUST succeed or report failure.
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Context from "effect/Context"
import { FileSystem } from "effect/FileSystem"
import { join } from "node:path"
import { SkillConfig } from "./skill-config.js"
import { FileReadError } from "./errors.js"
import * as Fs from "./fs-ops.js"

// ── Shape ────────────────────────────────────────────────────────

export interface SkillMutationsShape {
  readonly adopt: (name: string) => Effect.Effect<string, FileReadError>
  readonly scaffold: (name: string, opts?: { refs?: boolean }) => Effect.Effect<string[], FileReadError>
}

// ── Service ──────────────────────────────────────────────────────

export class SkillMutations extends Context.Service<SkillMutations, SkillMutationsShape>()(
  "@gbg/codemode-metaskill/SkillMutations"
) {}

// ── Layer ────────────────────────────────────────────────────────

export const SkillMutationsLive = Layer.effect(
  SkillMutations,
  Effect.gen(function*() {
    const config = yield* SkillConfig
    const fs = yield* FileSystem

    return SkillMutations.of({
      adopt: (name) => Effect.gen(function*() {
        const skillMd = join(config.skillsDir, name, "SKILL.md")
        const fileExists = yield* Fs.exists(fs, skillMd)
        if (!fileExists) return `SKILL.md not found for ${name}`

        const content = yield* Fs.readFile(fs, skillMd)
        if (content.includes("governed-by: metaskill")) return `${name} already governed`

        const lines = content.split("\n")
        if (lines[0]?.trim() === "---") {
          const endIdx = lines.slice(1).findIndex(l => l.trim() === "---")
          if (endIdx !== -1) {
            lines.splice(endIdx + 1, 0, "governed-by: metaskill")
            yield* Fs.writeFile(fs, skillMd, lines.join("\n"))
            return `Added governance to ${name}`
          }
        }
        yield* Fs.writeFile(fs, skillMd, `---\ngoverned-by: metaskill\n---\n\n${content}`)
        return `Added governance frontmatter to ${name}`
      }),

      scaffold: (name, opts) => Effect.gen(function*() {
        const dir = join(config.skillsDir, name)
        yield* Fs.mkDir(fs, dir)
        const created: string[] = []

        const skillMd = join(dir, "SKILL.md")
        const skillExists = yield* Fs.exists(fs, skillMd)
        if (!skillExists) {
          yield* Fs.writeFile(fs, skillMd, [
            "---",
            "governed-by: metaskill",
            `description: ${name} skill`,
            "update-strategy: manual",
            "update-trigger: content-change",
            "update-status: current",
            "---",
            "",
            `# ${name}`,
            "",
            "TODO: Add skill description.",
          ].join("\n"))
          created.push("SKILL.md")
        }

        const clMd = join(dir, "CHANGELOG.md")
        const clExists = yield* Fs.exists(fs, clMd)
        if (!clExists) {
          yield* Fs.writeFile(fs, clMd, [
            "---",
            "up: SKILL.md",
            "---",
            "",
            `# ${name} Changelog`,
            "",
            `## ${new Date().toISOString().split("T")[0]}`,
            "- Initial scaffold",
          ].join("\n"))
          created.push("CHANGELOG.md")
        }

        if (opts?.refs) {
          const refsDir = join(dir, "references")
          yield* Fs.mkDir(fs, refsDir)
          const indexMd = join(refsDir, "INDEX.md")
          const indexExists = yield* Fs.exists(fs, indexMd)
          if (!indexExists) {
            yield* Fs.writeFile(fs, indexMd, [
              "---",
              "up: ../SKILL.md",
              "---",
              "",
              "# References",
              "",
              "TODO: Add reference docs.",
            ].join("\n"))
            created.push("references/INDEX.md")
          }
        }

        return created
      }),
    })
  }),
)
