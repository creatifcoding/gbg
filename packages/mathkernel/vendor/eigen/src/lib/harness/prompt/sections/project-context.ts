/**
 * Project context section — AGENTS.md / CLAUDE.md walk from CWD → root.
 * Key: 'project-context', Priority: 300
 *
 * Mirrors pi's resource-loader.js loadProjectContextFiles() pattern:
 * walks from the current working directory up to the filesystem root,
 * collecting AGENTS.md and CLAUDE.md files at each level.
 *
 * @module harness/prompt/sections/project-context
 */

import { Effect } from 'effect'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { PromptEntry } from '../types'

/** Filenames to look for at each directory level */
const CONTEXT_FILENAMES = ['AGENTS.md', 'CLAUDE.md'] as const

/**
 * Walk from `startDir` up to the filesystem root, collecting context files.
 * Returns files in root-first order (outermost context first, most specific last).
 */
const collectContextFiles = (startDir: string): Array<{ path: string; content: string }> => {
  const results: Array<{ path: string; content: string }> = []
  let current = path.resolve(startDir)
  const seen = new Set<string>()

  // Walk up until we hit root or a cycle
  while (true) {
    if (seen.has(current)) break
    seen.add(current)

    for (const filename of CONTEXT_FILENAMES) {
      const filePath = path.join(current, filename)
      try {
        const stat = fs.statSync(filePath)
        if (stat.isFile()) {
          const content = fs.readFileSync(filePath, 'utf-8')
          if (content.trim().length > 0) {
            results.push({ path: filePath, content: content.trim() })
          }
        }
      } catch {
        // File doesn't exist at this level — continue
      }
    }

    const parent = path.dirname(current)
    if (parent === current) break // reached root
    current = parent
  }

  // Reverse: root-first order (outermost context first)
  results.reverse()
  return results
}

/**
 * Build the project-context section from AGENTS.md/CLAUDE.md files.
 *
 * Uses Effect.sync since file I/O is fast (small markdown files).
 * Returns null if no context files found.
 */
export const makeProjectContextSection = (cwd: string): Effect.Effect<PromptEntry | null> =>
  Effect.sync(() => {
    const files = collectContextFiles(cwd)

    if (files.length === 0) return null

    const sections = files.map((f) => {
      const relPath = path.relative(cwd, f.path)
      // Use relative path if within CWD tree, otherwise absolute
      const displayPath = relPath.startsWith('..') ? f.path : relPath
      return `## ${displayPath}\n\n${f.content}`
    })

    const content = `# Project Context\n\n${sections.join('\n\n---\n\n')}`
    const sizeBytes = new TextEncoder().encode(content).byteLength

    return {
      key: 'project-context' as const,
      priority: 300,
      content,
      sizeBytes,
    }
  }).pipe(
    Effect.withSpan('tmnl.harness.prompt.sections.project-context', {
      attributes: { 'prompt.cwd': cwd },
    }),
  )
