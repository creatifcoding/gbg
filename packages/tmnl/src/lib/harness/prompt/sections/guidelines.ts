/**
 * Guidelines section — conditional behavioral rules.
 * Key: 'guidelines', Priority: 200
 *
 * Rules are conditionally assembled based on which tools are active.
 *
 * @module harness/prompt/sections/guidelines
 */

import type { Tool as PiAiTool } from '@mariozechner/pi-ai'
import type { PromptEntry } from '../types'

export const makeGuidelinesSection = (tools: readonly PiAiTool[]): PromptEntry => {
  const toolNames = new Set(tools.map((t) => t.name))
  const rules: string[] = []

  // Core guidelines (always present)
  rules.push('- Be concise and direct in your responses')
  rules.push('- Show file paths clearly when working with files')

  // Conditional on read tool
  if (toolNames.has('read')) {
    rules.push('- Use read to examine files before editing. Do not guess file contents')
  }

  // Conditional on edit tool
  if (toolNames.has('edit')) {
    rules.push('- Use edit for precise changes (old text must match exactly)')
    rules.push('- Use write only for new files or complete rewrites')
  }

  // Conditional on bash tool
  if (toolNames.has('bash')) {
    rules.push('- Use bash for file operations like ls, rg, find')
    rules.push('- Prefer rg (ripgrep) over grep for code search')
  }

  // Conditional on grep tool
  if (toolNames.has('grep')) {
    rules.push('- Grep before cutting — verify all usages before removing imports or code')
  }

  const content = `Guidelines:\n${rules.join('\n')}`
  const sizeBytes = new TextEncoder().encode(content).byteLength

  return {
    key: 'guidelines',
    priority: 200,
    content,
    sizeBytes,
  }
}
