/**
 * @module plugins/metaskill-services/fs-ops
 *
 * FileSystem wrappers that map PlatformError → domain errors.
 *
 * Two flavors:
 *   - Typed: propagate as FileReadError (for operations that SHOULD fail visibly)
 *   - Safe:  absorb with fallback (for optional/probe operations)
 *
 * PlatformError._tag is "PlatformError" with reason: BadArgument | SystemError.
 * We use Effect.catchTag("PlatformError", ...) at the boundary.
 */

import * as Effect from "effect/Effect"
import type { FileSystem } from "effect/FileSystem"
import { join } from "node:path"
import { FileReadError } from "./errors.js"

// ── Safe ops (absorb errors → fallback) ──────────────────────────
// Used for probe/check operations: exists, optional reads, stat

/** Check existence — false on any error */
export const exists = (fs: FileSystem, path: string): Effect.Effect<boolean> =>
  fs.exists(path).pipe(Effect.catchTag("PlatformError", () => Effect.succeed(false)))

/** Stat a path — null on any error */
export const stat = (fs: FileSystem, path: string): Effect.Effect<{ type: string } | null> =>
  fs.stat(path).pipe(
    Effect.map(info => ({ type: info.type })),
    Effect.catchTag("PlatformError", () => Effect.succeed(null)),
  )

/** Read file — "" on any error */
export const readFileSafe = (fs: FileSystem, path: string): Effect.Effect<string> =>
  fs.readFileString(path).pipe(Effect.catchTag("PlatformError", () => Effect.succeed("")))

/** Read first N chars — "" on any error */
export const readHead = (fs: FileSystem, path: string, n = 500): Effect.Effect<string> =>
  fs.readFileString(path).pipe(
    Effect.map(c => c.slice(0, n)),
    Effect.catchTag("PlatformError", () => Effect.succeed("")),
  )

/** Read lines — [] on any error */
export const readLinesSafe = (fs: FileSystem, path: string): Effect.Effect<string[]> =>
  fs.readFileString(path).pipe(
    Effect.map(c => c.split("\n")),
    Effect.catchTag("PlatformError", () => Effect.succeed([] as string[])),
  )

/** List directory — [] on any error */
export const readDirSafe = (fs: FileSystem, path: string, opts?: { recursive?: boolean }): Effect.Effect<string[]> =>
  fs.readDirectory(path, opts).pipe(Effect.catchTag("PlatformError", () => Effect.succeed([] as string[])))

/** Write file — void on error (best-effort) */
export const writeFileSafe = (fs: FileSystem, path: string, data: string): Effect.Effect<void> =>
  fs.writeFileString(path, data).pipe(Effect.catchTag("PlatformError", () => Effect.succeed(undefined as void)))

/** Make directory — void on error (best-effort) */
export const mkDirSafe = (fs: FileSystem, path: string): Effect.Effect<void> =>
  fs.makeDirectory(path, { recursive: true }).pipe(Effect.catchTag("PlatformError", () => Effect.succeed(undefined as void)))

// ── Typed ops (propagate as domain errors) ───────────────────────
// Used for operations that MUST succeed or produce a meaningful error

/** Read file — fail with FileReadError */
export const readFile = (fs: FileSystem, path: string): Effect.Effect<string, FileReadError> =>
  fs.readFileString(path).pipe(
    Effect.mapError((e) => new FileReadError({ path, detail: e.message })),
  )

/** Read lines — fail with FileReadError */
export const readLines = (fs: FileSystem, path: string): Effect.Effect<string[], FileReadError> =>
  fs.readFileString(path).pipe(
    Effect.map(c => c.split("\n")),
    Effect.mapError((e) => new FileReadError({ path, detail: e.message })),
  )

/** Write file — fail with FileReadError */
export const writeFile = (fs: FileSystem, path: string, data: string): Effect.Effect<void, FileReadError> =>
  fs.writeFileString(path, data).pipe(
    Effect.mapError((e) => new FileReadError({ path, detail: e.message })),
  )

/** Make directory — fail with FileReadError */
export const mkDir = (fs: FileSystem, path: string): Effect.Effect<void, FileReadError> =>
  fs.makeDirectory(path, { recursive: true }).pipe(
    Effect.mapError((e) => new FileReadError({ path, detail: e.message })),
  )

// ── Composite helpers ────────────────────────────────────────────

/** Find all .md files recursively under dir */
export const findMd = (fs: FileSystem, dir: string): Effect.Effect<string[]> =>
  Effect.gen(function*() {
    const dirExists = yield* exists(fs, dir)
    if (!dirExists) return []
    const entries = yield* readDirSafe(fs, dir, { recursive: true })
    return entries
      .filter(f => f.endsWith(".md"))
      .map(f => join(dir, f))
  })

/** Check if a file has YAML frontmatter (--- delimited) */
export const hasFrontmatter = (fs: FileSystem, path: string): Effect.Effect<boolean> =>
  readLinesSafe(fs, path).pipe(Effect.map(lines => {
    if (lines[0]?.trim() !== "---") return false
    return lines.slice(1).some(l => l.trim() === "---")
  }))

/** Parse YAML frontmatter into key-value map (pure) */
export const parseFrontmatter = (lines: string[]): Record<string, string> => {
  if (lines[0]?.trim() !== "---") return {}
  const endIdx = lines.slice(1).findIndex(l => l.trim() === "---")
  if (endIdx === -1) return {}
  const result: Record<string, string> = {}
  for (const line of lines.slice(1, endIdx + 1)) {
    const match = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/)
    if (match) result[match[1]] = match[2].trim()
  }
  return result
}
