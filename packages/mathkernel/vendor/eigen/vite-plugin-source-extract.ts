/**
 * Vite Plugin: Source Extraction
 *
 * Extracts component source code at build time from ComponentBox usage.
 * Powers the testbed's ability to show source code alongside live components.
 *
 * Usage:
 * ```ts
 * import { sourceExtractPlugin } from './vite-plugin-source-extract'
 *
 * export default defineConfig({
 *   plugins: [sourceExtractPlugin()]
 * })
 * ```
 *
 * Then in your code:
 * ```ts
 * import { sources } from 'virtual:component-sources'
 * // sources is Map<componentId, sourceCode>
 * ```
 */

import type { Plugin } from 'vite'
import * as path from 'path'
import * as fs from 'fs'

// Virtual module ID
const VIRTUAL_MODULE_ID = 'virtual:component-sources'
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID

interface ComponentSource {
  /** Unique identifier */
  id: string
  /** Display label */
  label: string
  /** Extracted JSX source code */
  source: string
  /** Source file path (relative) */
  filePath: string
  /** Line number in source file */
  lineNumber: number
}

interface PluginOptions {
  /** Glob patterns for files to scan (default: src/**\/*Testbed*.tsx) */
  include?: string[]
  /** Glob patterns to exclude */
  exclude?: string[]
}

/**
 * Extract ComponentBox source from a file.
 *
 * Looks for patterns like:
 * <ComponentBox id="some-id" label="Some Label">
 *   <SomeComponent prop="value" />
 * </ComponentBox>
 *
 * Uses regex-based extraction for simplicity. For production AST parsing
 * would be more robust.
 */
function extractComponentBoxSources(
  code: string,
  filePath: string
): ComponentSource[] {
  const sources: ComponentSource[] = []

  // Match ComponentBox with id and label props
  // Pattern: <ComponentBox id="..." label="..." ...>...</ComponentBox>
  const componentBoxRegex =
    /<ComponentBox\s+(?:[^>]*?\s+)?id=["']([^"']+)["']\s+(?:[^>]*?\s+)?label=["']([^"']+)["'][^>]*>([\s\S]*?)<\/ComponentBox>/g

  // Also match without explicit id (uses label as id)
  const componentBoxNoIdRegex =
    /<ComponentBox\s+(?:[^>]*?\s+)?label=["']([^"']+)["'][^>]*>([\s\S]*?)<\/ComponentBox>/g

  let match: RegExpExecArray | null

  // Extract with explicit id
  while ((match = componentBoxRegex.exec(code)) !== null) {
    const [_fullMatch, id, label, children] = match
    const lineNumber = code.slice(0, match.index).split('\n').length

    sources.push({
      id,
      label,
      source: cleanSource(children),
      filePath,
      lineNumber,
    })
  }

  // Extract without explicit id (label becomes id)
  // Skip if already matched by id regex
  componentBoxNoIdRegex.lastIndex = 0
  while ((match = componentBoxNoIdRegex.exec(code)) !== null) {
    const [_fullMatch, label, children] = match
    const id = labelToId(label)

    // Skip if we already have this id
    if (sources.some((s) => s.id === id)) continue

    const lineNumber = code.slice(0, match.index).split('\n').length

    sources.push({
      id,
      label,
      source: cleanSource(children),
      filePath,
      lineNumber,
    })
  }

  return sources
}

/**
 * Convert label to kebab-case id
 */
function labelToId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Clean extracted source code:
 * - Trim whitespace
 * - Normalize indentation
 * - Remove empty lines at start/end
 */
function cleanSource(source: string): string {
  const lines = source.split('\n')

  // Remove empty lines at start and end
  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift()
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop()
  }

  if (lines.length === 0) return ''

  // Find minimum indentation (ignoring empty lines)
  const minIndent = lines.reduce((min, line) => {
    if (line.trim() === '') return min
    const indent = line.match(/^(\s*)/)?.[1].length ?? 0
    return indent < min ? indent : min
  }, Infinity)

  // Remove common indentation
  const normalizedLines = lines.map((line) => {
    if (line.trim() === '') return ''
    return line.slice(minIndent === Infinity ? 0 : minIndent)
  })

  return normalizedLines.join('\n').trim()
}

/**
 * Create the Vite plugin for source extraction
 */
export function sourceExtractPlugin(options: PluginOptions = {}): Plugin {
  const {
    include = ['src/**/*Testbed*.tsx', 'src/components/testbed/**/*.tsx'],
    exclude = ['**/*.test.*', '**/*.spec.*', '**/node_modules/**'],
  } = options

  // Source map: id -> ComponentSource
  const sourceMap = new Map<string, ComponentSource>()

  // Track which files we've scanned
  const scannedFiles = new Set<string>()

  return {
    name: 'vite-plugin-source-extract',
    enforce: 'pre',

    buildStart() {
      // Clear state on build start
      sourceMap.clear()
      scannedFiles.clear()
    },

    configureServer() {
      // Eagerly scan testbed files so sources exist before virtual module is requested
      // This fixes the race condition where virtual:component-sources is imported
      // before any testbed files are transformed
      const walkDir = (dir: string, files: string[] = []): string[] => {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          if (entry.isDirectory() && !entry.name.includes('node_modules')) {
            walkDir(fullPath, files)
          } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
            files.push(fullPath)
          }
        }
        return files
      }

      const srcDir = path.join(process.cwd(), 'src')
      if (!fs.existsSync(srcDir)) return

      const allFiles = walkDir(srcDir)

      for (const file of allFiles) {
        const relativePath = path.relative(process.cwd(), file)

        const shouldInclude = include.some((pattern) =>
          matchGlob(relativePath, pattern)
        )
        const shouldExclude = exclude.some((pattern) =>
          matchGlob(relativePath, pattern)
        )

        if (shouldInclude && !shouldExclude && !scannedFiles.has(file)) {
          scannedFiles.add(file)
          const code = fs.readFileSync(file, 'utf-8')
          const sources = extractComponentBoxSources(code, relativePath)
          for (const source of sources) {
            sourceMap.set(source.id, source)
          }
        }
      }

      console.log(
        `[source-extract] Pre-scanned ${sourceMap.size} component sources`
      )
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID
      }
      return undefined
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        // Generate virtual module with extracted sources
        const sourcesObj = Object.fromEntries(sourceMap)
        return `export const sources = ${JSON.stringify(sourcesObj, null, 2)};
export const getSource = (id) => sources[id]?.source ?? null;
export const getSourceMeta = (id) => sources[id] ?? null;
export default sources;`
      }
      return undefined
    },

    transform(code, id) {
      // Only process files matching include patterns
      const relativePath = path.relative(process.cwd(), id)

      // Check if file matches include patterns
      const shouldInclude = include.some((pattern) =>
        matchGlob(relativePath, pattern)
      )

      // Check if file matches exclude patterns
      const shouldExclude = exclude.some((pattern) =>
        matchGlob(relativePath, pattern)
      )

      if (!shouldInclude || shouldExclude) {
        return null
      }

      // Skip if already scanned
      if (scannedFiles.has(id)) {
        return null
      }
      scannedFiles.add(id)

      // Extract sources from this file
      const sources = extractComponentBoxSources(code, relativePath)

      // Add to source map
      for (const source of sources) {
        if (sourceMap.has(source.id)) {
          console.warn(
            `[vite-plugin-source-extract] Duplicate component id: ${source.id} in ${relativePath}`
          )
        }
        sourceMap.set(source.id, source)
      }

      // Don't transform the code, just extract
      return null
    },

    // Hot update: re-scan file on change
    async handleHotUpdate({ file, read }) {
      const relativePath = path.relative(process.cwd(), file)

      const fileMatches = include.some((pattern) =>
        matchGlob(relativePath, pattern)
      )

      if (fileMatches) {
        // Remove old entries from this file
        for (const [id, source] of sourceMap) {
          if (source.filePath === relativePath) {
            sourceMap.delete(id)
          }
        }

        // Re-scan
        scannedFiles.delete(file)
        const code = await read()
        const sources = extractComponentBoxSources(code, relativePath)
        for (const source of sources) {
          sourceMap.set(source.id, source)
        }
      }
    },
  }
}

/**
 * Simple glob matching (supports * and **)
 */
function matchGlob(path: string, pattern: string): boolean {
  // Convert glob to regex
  const regexPattern = pattern
    .replace(/\*\*/g, '{{DOUBLE_STAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{DOUBLE_STAR}}/g, '.*')
    .replace(/\//g, '\\/')

  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(path)
}

export type { ComponentSource, PluginOptions }
