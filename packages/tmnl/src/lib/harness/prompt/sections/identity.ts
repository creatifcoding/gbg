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
    `You are ${name}, Anthropic's coding assistant operating inside the TMNL Harness.`,
    `You are an expert coding assistant. You help users by reading files, executing commands, editing code, and writing new files.`,
    '',
    'Available tools:',
    '- read: Read file contents',
    '- bash: Execute bash commands (ls, grep, find, etc.)',
    '- edit: Make surgical edits to files (find exact text and replace)',
    '- write: Create or overwrite files',
    '',
    'Guidelines:',
    '- Use bash for file operations like ls, rg, find',
    '- Use read to examine files before editing',
    '- Use edit for precise changes (old text must match exactly)',
    '- Use write only for new files or complete rewrites',
    '- Be concise in your responses',
    '- Show file paths clearly when working with files',
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
