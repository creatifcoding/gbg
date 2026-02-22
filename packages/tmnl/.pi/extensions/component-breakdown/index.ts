import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import { Type } from '@sinclair/typebox'
import { Effect, Schema } from 'effect'
import { TreeFormatter } from 'effect/ParseResult'
import {
  generateTemplateBundle,
  renderBundleAsMarkdown,
  type TemplateGenerationDiagnostics,
} from './engine.ts'
import { BreakdownRequest, TemplateBundle } from './schema.ts'
import { runBreakdownQuestionnaireIntake } from './questionnaire-adapter.ts'
import * as Facade from './state/facade.ts'

const decodeRequest = (raw: unknown) => {
  try {
    return Schema.decodeUnknownSync(BreakdownRequest)(raw)
  } catch (error) {
    try {
      const formatted = TreeFormatter.formatErrorSync(error as any)
      throw new Error(formatted)
    } catch {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(message)
    }
  }
}

export async function runTemplateGeneration(
  request: BreakdownRequest,
): Promise<{ bundle: TemplateBundle; diagnostics: TemplateGenerationDiagnostics }> {
  Facade.beginRun(request)

  try {
    const generated = await Effect.runPromise(generateTemplateBundle(request))
    Facade.completeRun(request, generated.bundle)
    return generated
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    Facade.failRun(request, message)
    throw error
  }
}

export default function componentBreakdownExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'component_breakdown_templates',
    label: 'Component Breakdown Templates',
    description: 'Generate reusable UI component breakdown templates (state diagrams, lexicon, precedence matrix, smoke tests).',
    parameters: Type.Object({
      componentName: Type.String({ description: 'Component or surface name' }),
      context: Type.Optional(Type.String({ description: 'Short context for this component' })),
      diagramMode: Type.Optional(Type.Union([
        Type.Literal('compact'),
        Type.Literal('expanded'),
        Type.Literal('both'),
      ])),
      phaseLabels: Type.Optional(Type.Array(Type.String())),
      interactionModes: Type.Optional(Type.Array(Type.String())),
    }),
    async execute(_toolCallId, params) {
      try {
        const request = decodeRequest(params)
        const { bundle, diagnostics } = await runTemplateGeneration(request)
        const text = renderBundleAsMarkdown(bundle, request.diagramMode)

        return {
          content: [{ type: 'text', text }],
          details: {
            bundle: Schema.encodeUnknownSync(TemplateBundle)(bundle),
            diagnostics,
          },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)

        return {
          content: [{ type: 'text', text: `component_breakdown_templates failed: ${message}` }],
          isError: true,
        }
      }
    },
  })

  pi.registerTool({
    name: 'component_breakdown_state',
    label: 'Component Breakdown State',
    description: 'Read extension atom-facade state snapshot for the latest run.',
    parameters: Type.Object({
      view: Type.Optional(Type.Union([Type.Literal('summary'), Type.Literal('full')])),
    }),
    async execute(_toolCallId, params) {
      const state = Facade.snapshot()
      const view = params?.view === 'full' ? 'full' : 'summary'

      const summary = {
        status: state.status,
        runs: state.runs,
        updatedAt: state.updatedAt,
        lastComponentName: state.lastRequest?.componentName,
        hasBundle: Boolean(state.lastBundle),
        lastError: state.lastError,
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(view === 'full' ? state : summary, null, 2) }],
        details: {
          view,
          summary,
          ...(view === 'full' ? { state } : {}),
        },
      }
    },
  })

  pi.registerCommand('component-breakdown', {
    description: 'Interactive component-breakdown intake using questionnaire, then generate templates.',
    handler: async (args, ctx) => {
      try {
        const directName = args?.trim()

        const request = directName
          ? decodeRequest({ componentName: directName, diagramMode: 'both' })
          : await runBreakdownQuestionnaireIntake(ctx)

        const { bundle, diagnostics } = await runTemplateGeneration(request)

        if (ctx.hasUI) {
          ctx.ui.notify(
            `Generated breakdown pack for ${bundle.componentName} (${request.diagramMode})`,
            'success',
          )

          const preview = bundle.compactStateDiagram
            .split('\n')
            .find((line) => line.startsWith('[Idle]'))

          if (preview) {
            ctx.ui.notify(`Preview: ${preview}`, 'info')
          }

          ctx.ui.notify(`Generation span: ${diagnostics.totalDurationMs}ms`, 'info')
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (ctx.hasUI) {
          ctx.ui.notify(`component-breakdown failed: ${message}`, 'error')
        }
      }
    },
  })
}
