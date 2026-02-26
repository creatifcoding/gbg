/**
 * Tool manifest section — auto-generated from PiAiToolRuntime.tools.
 * Key: 'tool-manifest', Priority: 100
 *
 * @module harness/prompt/sections/tool-manifest
 */

import type { Tool as PiAiTool } from '@mariozechner/pi-ai'
import type { PromptEntry } from '../types'

/**
 * Build the tool manifest section from the runtime's tool array.
 *
 * Formats each tool's name + description. Also includes the prompt_context
 * API documentation if the promptContextDocs flag is set.
 */
export const makeToolManifestSection = (
  tools: readonly PiAiTool[],
  options?: { promptContextDocs?: string },
): PromptEntry => {
  const lines: string[] = ['In addition to the tools above, you have access to the following capabilities:']

  if (tools.length > 0) {
    lines.push('')
    for (const tool of tools) {
      const desc = tool.description ? ` — ${tool.description.slice(0, 120)}` : ''
      lines.push(`- ${tool.name}${desc}`)
    }
  }

  if (options?.promptContextDocs) {
    lines.push('')
    lines.push(options.promptContextDocs)
  }

  const content = lines.join('\n')
  const sizeBytes = new TextEncoder().encode(content).byteLength

  return {
    key: 'tool-manifest',
    priority: 100,
    content,
    sizeBytes,
  }
}
