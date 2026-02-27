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

  // ── Execution discipline ──
  rules.push('- When asked to do something, DO it with tools. Don\'t describe what you\'d do.')
  rules.push('- Complete multi-step tasks without stopping to ask permission between steps.')
  rules.push('- When summarizing your actions, output plain text directly — do NOT use cat or bash to display what you did.')

  // ── File operations ──
  if (toolNames.has('read')) {
    rules.push('- ALWAYS read a file before editing it. Never guess at contents, line numbers, or surrounding code.')
  }
  if (toolNames.has('edit')) {
    rules.push('- Use edit for precise changes. The oldText must match EXACTLY — whitespace, indentation, everything. Read first.')
    rules.push('- Use write only for new files or complete rewrites, never for surgical edits.')
  }
  if (toolNames.has('bash')) {
    rules.push('- Use bash for builds, tests, git, and package management.')
    if (toolNames.has('grep') || toolNames.has('find') || toolNames.has('ls')) {
      rules.push('- Prefer grep/find/ls tools over bash for file exploration — they\'re faster and respect .gitignore.')
    }
  }
  if (toolNames.has('grep')) {
    rules.push('- Grep before cutting — verify all usages of a symbol/import before removing anything.')
  }

  // ── Error handling ──
  rules.push('- If a tool call fails, read the error, diagnose the cause, and fix it. Don\'t just report the error.')
  rules.push('- If an edit fails because oldText didn\'t match, re-read the file and try again with the correct text.')
  rules.push('- If a build/test fails, read the error output, make the fix, and re-run to verify.')

  // ── Quality ──
  rules.push('- After making code changes, verify they compile (tsc, build) when appropriate.')
  rules.push('- When making changes across multiple files, check all of them compile together.')

  const content = `# Guidelines\n\n${rules.join('\n')}`
  const sizeBytes = new TextEncoder().encode(content).byteLength

  return {
    key: 'guidelines',
    priority: 200,
    content,
    sizeBytes,
  }
}
