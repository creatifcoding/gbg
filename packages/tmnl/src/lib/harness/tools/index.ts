/**
 * Tool runtime assembly — collects contributions from all tool modules
 * and builds the unified PiAiToolRuntime Layer.
 *
 * Registration modes:
 *   Declarative (defineTool) — panel_eval, arrange_panels, interactive_shell
 *   Legacy (resolveContribution) — genifer, geoint (complex async service construction)
 *
 * @module harness/tools
 */

import { Effect, HashSet, Layer, Schema } from 'effect'
import { PiAiToolRuntime, ToolName as ToolNameSchema } from '../PiAiToolRuntime'
import { AgentHarnessConfigTag } from '@/lib/agents/AgentHarnessConfig'
import type { ToolContribution, HarnessTool } from './types'
import { createSdkTools } from './sdk-tools'
import { loadExtensionTools } from './extension-tools'
import { resolveGeniferToolContribution } from './genifer-tools'
import { resolveGeointToolContribution } from './geoint-tools'
import { collectTools } from './registry'
import { createExecuteBridge } from './execute-bridge'

// Force side-effect imports — defineTool() calls run at module load
import './shell-tool'
import './panel-tools'

// ── Merge helper ────────────────────────────────────────────

function mergeContributions(
  base: HarnessTool[],
  contributions: readonly ToolContribution[],
): { tools: HarnessTool[]; concurrentFriendly: string[] } {
  const tools = [...base]
  const names = new Set(tools.map((t) => t.name))
  const concurrentFriendly: string[] = []

  for (const contrib of contributions) {
    for (const tool of contrib.tools) {
      if (names.has(tool.name)) {
        console.warn(`[harness] tool '${tool.name}' shadows existing — skipping`)
        continue
      }
      tools.push(tool)
      names.add(tool.name)
    }
    concurrentFriendly.push(...contrib.concurrentFriendly.filter((n) => names.has(n)))
  }

  return { tools, concurrentFriendly }
}

// ── Layer ────────────────────────────────────────────────────

export const PiAiToolRuntimeWithBuiltins = Layer.effect(
  PiAiToolRuntime,
  Effect.gen(function* () {
    const config = yield* AgentHarnessConfigTag

    // 1. Always-available SDK tools
    const sdkTools = createSdkTools(config) as unknown as HarnessTool[]

    // 2. Extension tools (graceful fallback)
    const extensionResult = yield* Effect.tryPromise({
      try: () => loadExtensionTools(config.cwd),
      catch: (error) => error,
    }).pipe(
      Effect.orElseSucceed(() => {
        console.warn('[harness] extension discovery failed, continuing with built-ins only')
        return { tools: [] as HarnessTool[], extensions: [] }
      }),
    )

    // 3. Resolve all tool groups
    //    - Declarative tools via collectTools() (shell, panel_eval, arrange_panels)
    //    - Legacy tools via resolveContribution (genifer, geoint)
    const [registryContrib, geniferContrib, geointContrib] = yield* Effect.all([
      collectTools(),
      resolveGeniferToolContribution,
      resolveGeointToolContribution,
    ])

    // 4. Merge: SDK → extensions → all domain groups (first-registered wins)
    const base = [...sdkTools, ...extensionResult.tools as unknown as HarnessTool[]]
    const { tools, concurrentFriendly } = mergeContributions(base, [
      registryContrib,
      geniferContrib,
      geointContrib,
    ])

    // 5. Build execution bridge
    const toolMap = new Map(tools.map((t) => [t.name, t]))
    const execute = createExecuteBridge(toolMap)

    // 6. Build concurrent-friendly HashSet
    const brandName = (name: string) => Schema.decodeSync(ToolNameSchema)(name)
    const concurrentFriendlySet = HashSet.fromIterable(
      concurrentFriendly.map(brandName),
    )

    return PiAiToolRuntime.of({
      tools: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) as any,
      maxToolRounds: config.maxToolRounds,
      concurrentFriendlyTools: concurrentFriendlySet,
      execute: (toolCall, onStreamChunk, signal) =>
        execute(toolCall, onStreamChunk, signal).pipe(
          Effect.catchTag('PiAiToolRuntimeError', (error) =>
            Effect.succeed({
              role: 'toolResult' as const,
              toolCallId: toolCall.id,
              toolName: toolCall.name,
              content: [{ type: 'text' as const, text: `Tool execution error: ${error.message}` }],
              isError: true,
              timestamp: Date.now(),
            }),
          ),
        ),
    })
  }),
)

// ── Re-exports ──────────────────────────────────────────────

export type { ToolContribution, HarnessTool } from './types'
export { emptyContribution } from './types'
export { defineTool, optional, required, collectTools, clearRegistry, getRegisteredTools } from './registry'
export type { ToolDef, ToolPromptSection, OptionalDep, RequiredDep } from './registry'
