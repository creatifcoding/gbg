/**
 * @module plugins/metaskill-services/util-service
 *
 * UtilService — discover and execute skill utility scripts.
 *
 * Deps: SkillConfig, FileSystem
 *
 * Discovery: safe (probe) — [] if utils/ missing
 * Execution: contains result — exitCode captures failure, no thrown errors
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Context from "effect/Context"
import { FileSystem } from "effect/FileSystem"
import { join } from "node:path"
import { exec } from "node:child_process"
import { SkillConfig } from "./skill-config.js"
import * as Fs from "./fs-ops.js"
import type { UtilInfo, UtilResult } from "./types.js"

// ── Shape ────────────────────────────────────────────────────────

export interface UtilServiceShape {
  readonly utils: Effect.Effect<UtilInfo[]>
  readonly runUtil: (utilName: string, skillName: string) => Effect.Effect<UtilResult>
}

// ── Service ──────────────────────────────────────────────────────

export class UtilService extends Context.Service<UtilService, UtilServiceShape>()(
  "@gbg/codemode-metaskill/UtilService"
) {}

// ── Layer ────────────────────────────────────────────────────────

export const UtilServiceLive = Layer.effect(
  UtilService,
  Effect.gen(function*() {
    const config = yield* SkillConfig
    const fs = yield* FileSystem
    const utilsDir = join(config.metaskillDir, "utils")

    return UtilService.of({
      utils: Effect.gen(function*() {
        const dirExists = yield* Fs.exists(fs, utilsDir)
        if (!dirExists) return []

        const entries = yield* Fs.readDirSafe(fs, utilsDir)
        const mdFiles = entries.filter(f => f.endsWith(".md"))

        return yield* Effect.all(mdFiles.map(f =>
          Fs.readFileSafe(fs, join(utilsDir, f)).pipe(
            Effect.map(content => {
              const desc = content.split("\n").find(l => l.startsWith("description:"))
              return {
                name: f.replace(".md", ""),
                file: f,
                description: desc?.replace("description:", "").trim() ?? "",
              }
            }),
          )
        ))
      }),

      runUtil: (utilName, skillName) => Effect.gen(function*() {
        const utilPath = join(utilsDir, `${utilName}.md`)
        const utilExists = yield* Fs.exists(fs, utilPath)
        if (!utilExists) {
          return { util: utilName, skill: skillName, output: `Util not found: ${utilName}`, exitCode: 1 }
        }

        const content = yield* Fs.readFileSafe(fs, utilPath)
        const codeMatch = content.match(/```(?:bash|sh)\n([\s\S]*?)```/)
        if (!codeMatch) {
          return { util: utilName, skill: skillName, output: "No executable code block found", exitCode: 1 }
        }

        const cmd = codeMatch[1].trim().replace(/\$SKILL/g, skillName)
        return yield* Effect.promise(() => new Promise<UtilResult>((resolve) => {
          exec(cmd, { cwd: config.cwd, encoding: "utf-8", timeout: 15000 }, (err: any, stdout, stderr) => {
            resolve({
              util: utilName,
              skill: skillName,
              output: `${stdout ?? ""}${stderr ?? ""}`.trim(),
              exitCode: err?.code ?? err?.status ?? 0,
            })
          })
        }))
      }),
    })
  }),
)
