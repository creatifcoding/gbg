/**
 * OPC Memory Service
 *
 * Integration with OPC learning/memory system for storing and recalling
 * spike learnings across sessions.
 *
 * @skill spikectl/core
 */

import { Context, Effect, Layer } from "effect"

// =============================================================================
// Configuration
// =============================================================================

const OPC_DIR = process.env.CLAUDE_PROJECT_DIR ? `${process.env.CLAUDE_PROJECT_DIR}/opc` : null

// =============================================================================
// Service Interface
// =============================================================================

export interface OpcMemoryService {
  readonly query: (query: string, k?: number) => Effect.Effect<string[]>
  readonly store: (params: {
    sessionId: string
    type: string
    content: string
    context: string
    tags: string[]
    confidence?: string
  }) => Effect.Effect<boolean>
  readonly isAvailable: () => boolean
}

// =============================================================================
// Service Tag
// =============================================================================

export class OpcMemory extends Context.Tag("spikectl/OpcMemory")<
  OpcMemory,
  OpcMemoryService
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

export const OpcMemoryLive = Layer.succeed(OpcMemory, {
  isAvailable: () => OPC_DIR !== null,

  query: (query: string, k: number = 3): Effect.Effect<string[]> =>
    Effect.gen(function* () {
      if (!OPC_DIR) {
        return []
      }

      const { execSync } = yield* Effect.promise(() => import("node:child_process"))

      return yield* Effect.try(() => {
        const result = execSync(
          `cd ${OPC_DIR} && PYTHONPATH=. uv run python scripts/core/recall_learnings.py --query "${query.replace(/"/g, '\\"')}" --k ${k} --text-only`,
          { encoding: "utf-8", timeout: 10000 }
        )
        const lines = result.split("\n").filter((l) => l.trim() && !l.startsWith("━"))
        return lines.slice(0, 5)
      }).pipe(Effect.catchAll(() => Effect.succeed([])))
    }),

  store: (params): Effect.Effect<boolean> =>
    Effect.gen(function* () {
      if (!OPC_DIR) {
        return false
      }

      const { execSync } = yield* Effect.promise(() => import("node:child_process"))

      return yield* Effect.try(() => {
        const tagsArg = params.tags.join(",")
        const cmd = `cd ${OPC_DIR} && PYTHONPATH=. uv run python scripts/core/store_learning.py \
          --session-id "${params.sessionId}" \
          --type "${params.type}" \
          --content "${params.content.replace(/"/g, '\\"')}" \
          --context "${params.context.replace(/"/g, '\\"')}" \
          --tags "${tagsArg}" \
          --confidence ${params.confidence || "medium"}`

        execSync(cmd, { encoding: "utf-8", timeout: 10000 })
        return true
      }).pipe(Effect.catchAll(() => Effect.succeed(false)))
    }),
})
