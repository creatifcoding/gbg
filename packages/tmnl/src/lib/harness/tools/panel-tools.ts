/**
 * Panel Object API tools — panel_eval + arrange_panels.
 *
 * Uses defineTool() declarative registration — zero manual wiring.
 *
 * @module harness/tools/panel-tools
 */

import { Effect } from 'effect'
import { defineTool, optional } from './registry'
import { PanelQueryService } from '@/lib/panels/query/schemas'
import {
  PANEL_EVAL_TOOL_NAME,
  PanelEvalToolSpec,
  executePanelEvalCode,
} from '@/lib/panels/query/panel-eval-tool'
import {
  ARRANGE_PANELS_TOOL_NAME,
  ArrangePanelsToolSpec,
  executeArrangePanels,
  type ArrangePanelsToolParams,
} from '@/lib/panels/layout/arrange-panels-tool'
import { SpatialLayoutService } from '@/lib/panels/layout/SpatialLayoutService'
import { SubscriptionManagerService } from '@/lib/panels/subscriptions/schemas'

// ── panel_eval ──────────────────────────────────────────────

export const panelEvalTool = defineTool({
  name: PANEL_EVAL_TOOL_NAME,
  description: PanelEvalToolSpec.description,
  parameters: PanelEvalToolSpec.parameters,
  concurrentFriendly: true,

  requires: {
    panelQuery: PanelQueryService,
    layout: optional(SpatialLayoutService, SpatialLayoutService.Default),
    subscriptions: optional(SubscriptionManagerService),
  },

  systemPromptSection: {
    title: 'Panel Eval (Codemode)',
    priority: 150,
    content: `## panel_eval — Codemode API

Write JS code that executes against live panel services:
- \`panels.list()\` — enumerate all open panels
- \`panels.get(id)\` — get panel by ID
- \`layout.arrange({ mode, panelIds })\` — spatial arrangement
- \`bindings.connect(sourceId, sinkId, mapping)\` — cross-panel data flow
- \`subscriptions.create({ panelId, mode, interval })\` — autonomous updates

The code runs in a sandboxed context with these namespaces injected.`,
  },

  execute: async (_toolCallId, params, { panelQuery, layout, subscriptions }) => {
    const code = params.code as string | undefined
    if (typeof code !== 'string') {
      return {
        content: [{ type: 'text' as const, text: 'panel_eval requires a `code` parameter (string).' }],
        isError: true,
      }
    }
    const resultText = await Effect.runPromise(
      executePanelEvalCode(code, panelQuery, layout, subscriptions),
    )
    return { content: [{ type: 'text' as const, text: resultText }] }
  },
})

// ── arrange_panels ──────────────────────────────────────────

export const arrangePanelsTool = defineTool({
  name: ARRANGE_PANELS_TOOL_NAME,
  description: ArrangePanelsToolSpec.description,
  parameters: ArrangePanelsToolSpec.parameters,
  concurrentFriendly: true,

  requires: {
    layout: { _optional: false as const, tag: SpatialLayoutService, layer: SpatialLayoutService.Default },
  },

  systemPromptSection: {
    title: 'Arrange Panels',
    priority: 151,
    content: `## arrange_panels — Spatial Layout

Arrange open panels using layout algorithms:
- \`grid\` — even grid distribution
- \`stack\` — vertical/horizontal stack
- \`focus\` — one panel maximized, others minimized
- \`cascade\` — offset cascade (window manager style)

Parameters: \`{ mode, panelIds?, gap?, direction? }\``,
  },

  execute: async (_toolCallId, params, { layout }) => {
    const resultText = await Effect.runPromise(
      executeArrangePanels(params as ArrangePanelsToolParams, layout),
    )
    return { content: [{ type: 'text' as const, text: resultText }] }
  },
})
