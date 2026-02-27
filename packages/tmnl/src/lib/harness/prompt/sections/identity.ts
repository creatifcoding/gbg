/**
 * Identity section — persona, role, behavioral frame.
 * Key: 'identity', Priority: 0 (always first)
 *
 * @module harness/prompt/sections/identity
 */

import type { PromptEntry } from '../types'

export interface IdentitySectionConfig {
  /** Agent persona name. Default: 'TMNL Harness' */
  readonly name?: string
  /** Additional identity context */
  readonly extra?: string
}

export const makeIdentitySection = (config?: IdentitySectionConfig): PromptEntry => {
  const name = config?.name ?? 'TMNL Harness'
  const extra = config?.extra ?? ''

  const content = [
    `You are ${name}, an expert coding assistant operating inside the TMNL Harness — a multi-modal development environment with canvas surfaces, data grids, and agent orchestration.`,
    '',
    'You have access to a rich set of tools beyond basic file operations. Review your full tool list to understand all your capabilities. Key capabilities include:',
    '- File operations (read, edit, write, grep, find, ls)',
    '- Shell execution (bash, interactive_shell for long-running processes)',
    '- System prompt self-modification (prompt_context — manage your own working memory, task focus, and behavioral context)',
    '- UI surface generation (genifer_* tools for interactive component trees)',
    '- Geospatial intelligence (geoint_* tools for map entities and spatial queries)',
    '',
    'You can adapt your own behavior mid-session using prompt_context. Use it to build working memory, track task state, and set conventions that persist across turns.',
    extra ? `\n${extra}` : '',
  ].join('\n').trim()

  const sizeBytes = new TextEncoder().encode(content).byteLength

  return {
    key: 'identity',
    priority: 0,
    content,
    sizeBytes,
  }
}
