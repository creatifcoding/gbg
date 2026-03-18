/**
 * @module plugins/metaskill-services/protocol-service
 *
 * ProtocolService — extract and list protocol sections from SKILL.md.
 *
 * Deps: SkillConfig, FileSystem
 *
 * All reads safe (probe) — protocols returns [] if SKILL.md missing.
 */

import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as ServiceMap from "effect-v4/ServiceMap"
import { FileSystem } from "effect-v4/FileSystem"
import { join } from "node:path"
import { SkillConfig } from "./skill-config.js"
import * as Fs from "./fs-ops.js"

// ── Shape ────────────────────────────────────────────────────────

export interface ProtocolServiceShape {
  readonly protocol: (key: string) => Effect.Effect<string>
  readonly protocols: Effect.Effect<string[]>
}

// ── Service ──────────────────────────────────────────────────────

export class ProtocolService extends ServiceMap.Service<ProtocolService, ProtocolServiceShape>()(
  "@gbg/codemode-metaskill/ProtocolService"
) {}

// ── Layer ────────────────────────────────────────────────────────

export const ProtocolServiceLive = Layer.effect(
  ProtocolService,
  Effect.gen(function*() {
    const config = yield* SkillConfig
    const fs = yield* FileSystem
    const skillMd = join(config.metaskillDir, "SKILL.md")

    const parseProtocols = (): Effect.Effect<Map<string, string>> =>
      Fs.readFileSafe(fs, skillMd).pipe(
        Effect.map(content => {
          const lines = content.split("\n")
          const protocols = new Map<string, string>()
          let currentKey = ""
          let currentBody: string[] = []

          for (const line of lines) {
            const match = line.match(/^#{2,4}\s+(§\s+[\w:./-]+)/)
            if (match) {
              if (currentKey) protocols.set(currentKey, currentBody.join("\n").trim())
              currentKey = match[1]
              currentBody = []
            } else if (currentKey) {
              currentBody.push(line)
            }
          }
          if (currentKey) protocols.set(currentKey, currentBody.join("\n").trim())
          return protocols
        }),
      )

    return ProtocolService.of({
      protocol: (key) => parseProtocols().pipe(
        Effect.map(protocols => protocols.get(key) ?? `Protocol not found: ${key}`),
      ),
      protocols: parseProtocols().pipe(
        Effect.map(protocols => Array.from(protocols.keys())),
      ),
    })
  }),
)
