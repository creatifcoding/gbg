import { registerHypothesisCompatibility } from '../eisenhower/index'

type ExtensionAPI = {
  registerTool: (tool: {
    name: string
    label?: string
    description?: string
    parameters: unknown
    execute: (
      toolCallId: string,
      params: Record<string, unknown>,
      signal: AbortSignal,
      onUpdate?: (update: { content: Array<{ type: string; text: string }> }) => void,
      ctx?: unknown,
    ) => Promise<{ content: Array<{ type: string; text: string }>; details?: unknown; isError?: boolean }>
  }) => void
  registerCommand: (
    name: string,
    command: {
      description?: string
      handler: (
        args: string | undefined,
        ctx: {
          hasUI: boolean
          ui: {
            notify: (message: string, level: 'info' | 'success' | 'warning' | 'error') => void
          }
        },
      ) => Promise<void> | void
    },
  ) => void
}

export default function hypothesisLabExtension(pi: ExtensionAPI) {
  registerHypothesisCompatibility(pi)
}
