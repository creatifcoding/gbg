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
 * Groups tools by category for clarity. Includes full descriptions
 * so the agent understands each tool's capabilities and constraints.
 * Also includes the prompt_context API documentation if provided.
 */
export const makeToolManifestSection = (
  tools: readonly PiAiTool[],
  options?: { promptContextDocs?: string },
): PromptEntry => {
  // Categorize tools for agent comprehension
  const categories: Record<string, PiAiTool[]> = {
    'File Operations': [],
    'Shell & Terminal': [],
    'System Prompt': [],
    'UI Generation': [],
    'Geospatial Intelligence': [],
    'Other': [],
  }

  for (const tool of tools) {
    const name = tool.name
    if (['read', 'Read', 'write', 'Write', 'edit', 'Edit', 'grep', 'Grep', 'find', 'Find', 'ls', 'Ls'].includes(name)) {
      categories['File Operations'].push(tool)
    } else if (['bash', 'Bash', 'interactive_shell'].includes(name)) {
      categories['Shell & Terminal'].push(tool)
    } else if (name === 'prompt_context') {
      categories['System Prompt'].push(tool)
    } else if (name.startsWith('genifer_') || name === 'spawn_panel') {
      categories['UI Generation'].push(tool)
    } else if (name.startsWith('geoint_')) {
      categories['Geospatial Intelligence'].push(tool)
    } else {
      categories['Other'].push(tool)
    }
  }

  const lines: string[] = ['# Available Tools']

  for (const [category, catTools] of Object.entries(categories)) {
    if (catTools.length === 0) continue
    lines.push('')
    lines.push(`## ${category}`)
    for (const tool of catTools) {
      // Use full description (not truncated) so agent knows what each tool does
      const desc = tool.description || 'No description'
      lines.push(`- **${tool.name}**: ${desc}`)
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
