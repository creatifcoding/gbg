/**
 * @module portability
 *
 * RLM Store export/import — the image is portable.
 *
 * Three export formats:
 *   1. JSON dump — human-readable, git-friendly, selective by collection/glob
 *   2. SQLite file copy — byte-perfect image backup
 *   3. Procedures-only bundle — shareable library file
 *
 * Import modes:
 *   - merge (default): upsert — existing keys updated, new keys added
 *   - replace: wipe target collection(s) first, then load
 *
 * The SQLite DB IS the Lisp image. This module makes it transferable.
 */

import { copyFileSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { StoreApi } from './api.ts'

// ── Types ────────────────────────────────────────────────────────

export interface ExportOptions {
  /** Output file path (required) */
  path: string
  /** Format: 'json' | 'sqlite' | 'procedures' (default: inferred from extension) */
  format?: 'json' | 'sqlite' | 'procedures'
  /** Collection glob filter — only export matching collections (json/procedures only) */
  collections?: string
  /** Pretty-print JSON (default: true) */
  pretty?: boolean
}

export interface ImportOptions {
  /** Input file path (required) */
  path: string
  /** Format: 'json' | 'procedures' (default: inferred from extension) */
  format?: 'json' | 'procedures'
  /** Import mode: 'merge' (default) or 'replace' */
  mode?: 'merge' | 'replace'
}

export interface ExportResult {
  format: string
  path: string
  collections: number
  objects: number
  bytes: number
}

export interface ImportResult {
  format: string
  path: string
  mode: string
  collections: number
  objects: number
  created: number
  updated: number
  skipped: number
}

/** Shape of the JSON export file */
interface JsonExport {
  _format: 'rlm-export-v1'
  _exported: string
  _source: string
  collections: Record<string, JsonExportObject[]>
}

interface JsonExportObject {
  key: string
  data: unknown
  tags: string[]
}

// ── Format Inference ─────────────────────────────────────────────

function inferFormat(path: string, hint?: string): string {
  if (hint) return hint
  if (path.endsWith('.db') || path.endsWith('.sqlite')) return 'sqlite'
  if (path.endsWith('.procs.json')) return 'procedures'
  return 'json'
}

// ── Export ────────────────────────────────────────────────────────

export function createPortabilityApi(
  store: StoreApi,
  dbPath: string,
): { export_: (opts: ExportOptions) => Promise<ExportResult>; import_: (opts: ImportOptions) => Promise<ImportResult> } {

  async function export_(opts: ExportOptions): Promise<ExportResult> {
    const format = inferFormat(opts.path, opts.format)
    const outPath = resolve(opts.path)

    // Ensure parent directory exists
    const dir = dirname(outPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    switch (format) {
      case 'sqlite':
        return exportSqlite(outPath)
      case 'procedures':
        return exportProcedures(outPath, opts.pretty ?? true)
      case 'json':
      default:
        return exportJson(outPath, opts.collections, opts.pretty ?? true)
    }
  }

  async function export