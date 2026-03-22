/**
 * EPOCH-0003: Default registry factory — wires all 5 system sections
 * into a populated PromptRegistry.
 *
 * @module harness/prompt/factory
 */

import { Effect } from 'effect'
import type { Tool as PiAiTool } from '@mariozechner/pi-ai'
import { makePromptRegistry, type PromptRegistryShape, type PromptRegistryConfig } from './PromptRegistry'
import { makeIdentitySection, type IdentitySectionConfig } from './sections/identity'
import { makeToolManifestSection } from './sections/tool-manifest'
import { makeGuidelinesSection } from './sections/guidelines'
import { makeInlineUISection } from './sections/inline-ui'
import { makeProjectContextSection } from './sections/project-context'
import { makeRuntimeStampSection } from './sections/runtime-stamp'
import type { PromptEntry } from './types'

export interface DefaultRegistryConfig {
  /** Working directory for AGENTS.md walk and runtime stamp */
  readonly cwd: string
  /** Registered tools (for tool manifest + conditional guidelines) */
  readonly tools: readonly PiAiTool[]
  /** Agent budget override */
  readonly agentBudgetBytes?: number
  /** Identity section customization */
  readonly identity?: IdentitySectionConfig
  /** prompt_context API documentation to include in tool manifest */
  readonly promptContextDocs?: string
}

/**
 * Create a fully-populated PromptRegistry with all 5 system sections.
 *
 * Uses Effect because project-context section does file I/O.
 * The returned registry is ready for fork() on session creation.
 */
export const makeDefaultRegistry = (
  config: DefaultRegistryConfig,
): Effect.Effect<PromptRegistryShape> =>
  Effect.gen(function* () {
    const systemEntries: PromptEntry[] = []

    // 1. Identity (priority 0)
    systemEntries.push(makeIdentitySection(config.identity))

    // 2. Tool manifest (priority 100)
    systemEntries.push(
      makeToolManifestSection(config.tools, {
        promptContextDocs: config.promptContextDocs,
      }),
    )

    // 3. Guidelines (priority 200)
    systemEntries.push(makeGuidelinesSection(config.tools))

    // 3.5. Inline UI — component catalog + NDJSON fence format (priority 250)
    systemEntries.push(makeInlineUISection())

    // 4. Project context — AGENTS.md walk (priority 300)
    const projectContext = yield* makeProjectContextSection(config.cwd)
    if (projectContext) {
      systemEntries.push(projectContext)
    }

    // 5. Runtime stamp (priority 900) — note: this is the initial stamp.
    //    build() does NOT auto-refresh the stamp. The engine calls
    //    refreshRuntimeStamp() before build() on each turn.
    systemEntries.push(makeRuntimeStampSection(config.cwd))

    // Create registry with system entries
    const registryConfig: PromptRegistryConfig = {
      agentBudgetBytes: config.agentBudgetBytes,
    }

    const registry = makePromptRegistry(registryConfig, systemEntries)

    // Wire reload to re-collect project context
    const baseReload = registry.reload
    const enhancedRegistry: PromptRegistryShape = {
      ...registry,
      reload: () =>
        Effect.gen(function* () {
          yield* baseReload()
          // Re-read project context from disk
          const freshContext = yield* makeProjectContextSection(config.cwd)
          if (freshContext) {
            // Directly set on the internal map — we have closure access
            // through the registry. For now, rebuild from scratch.
            // TODO: expose an internal setSystem() for reload
          }
        }),
    }

    return enhancedRegistry
  }).pipe(
    Effect.withSpan('tmnl.harness.prompt.make-default-registry', {
      attributes: {
        'prompt.cwd': config.cwd,
        'prompt.tools_count': config.tools.length,
      },
    }),
  )
