/**
 * Runtime stamp section — current date/time + working directory.
 * Key: 'runtime-stamp', Priority: 900 (always last)
 *
 * Rebuilt on every build() call — always fresh.
 *
 * @module harness/prompt/sections/runtime-stamp
 */

import type { PromptEntry } from '../types'

export const makeRuntimeStampSection = (cwd: string): PromptEntry => {
  const now = new Date()
  const formatted = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const time = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  })

  const content = `Current date and time: ${formatted} at ${time}\nCurrent working directory: ${cwd}`
  const sizeBytes = new TextEncoder().encode(content).byteLength

  return {
    key: 'runtime-stamp',
    priority: 900,
    content,
    sizeBytes,
  }
}
