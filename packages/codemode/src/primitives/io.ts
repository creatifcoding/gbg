/**
 * @module primitives/io
 *
 * Effect v4 service for file/shell I/O primitives.
 *
 * Replaces raw node:fs/child_process calls with Effect-backed implementations:
 *   - read/write route through Effect.FileSystem for DI + typed errors
 *   - sh uses child_process.exec asynchronously so shell commands don't freeze pi
 *
 * All three go through ManagedRuntime.runPromise — making them async.
 * This changes function coloring: read/write/sh are now async (must await).
 *
 * Canonical v4 patterns used:
 *   - `yield* FileSystem` (service resolution)
 *   - `fs.readFileString(path)` / `fs.writeFileString(path, content)` (v4 API)
 *   - `fs.makeDirectory(dir, { recursive: true })` (parent dir creation)
 *   - `Effect.tryPromise` for wrapping async operations with typed errors
 *   - `Effect.catchTag("PlatformError", ...)` for absorbing mkdir EEXIST
 *
 * NOTE on sh(): The canonical v4 approach for process execution is
 * ChildProcess.make + ChildProcessSpawner (effect/unstable/process).
 * However, NodeChildProcessSpawner lives in @effect/platform-node-shared
 * which has peer dep issues with our npm-aliased effect. We use async
 * child_process.exec instead: same shell semantics, no event-loop freeze.
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as ManagedRuntime from "effect/ManagedRuntime"
import { FileSystem } from "effect/FileSystem"
import { join, dirname } from "node:path"
import { exec } from "node:child_process"

// ── Types ────────────────────────────────────────────────────────

export interface IoApi {
  /** Read a file (cwd-relative or absolute). Returns content as string. */
  read(path: string): Promise<string>

  /** Write a file (cwd-relative or absolute, auto-creates parent dirs). */
  write(path: string, content: string): Promise<void>

  /**
   * Execute a shell command (cwd-scoped, 15s timeout).
   * Returns stdout on success, stdout+stderr on failure.
   */
  sh(cmd: string): Promise<string>

  /** Dispose the ManagedRuntime */
  dispose(): Promise<void>
}

// ── Factory ──────────────────────────────────────────────────────

/**
 * Create IO primitives backed by Effect FileSystem + async shell execution.
 *
 * @param cwd - Working directory for relative paths and shell commands
 * @param fsLayer - Effect Layer providing FileSystem (e.g. NodeFileSystemLayer)
 */
export function createIoApi(cwd: string, fsLayer: Layer.Layer<FileSystem>): IoApi {
  const runtime = ManagedRuntime.make(fsLayer)

  const resolvePath = (path: string): string =>
    path.startsWith("/") ? path : join(cwd, path)

  // ── read ─────────────────────────────────────────────────────

  const read = (path: string): Promise<string> =>
    runtime.runPromise(
      Effect.gen(function*() {
        const fs = yield* FileSystem
        return yield* fs.readFileString(resolvePath(path))
      })
    )

  // ── write ────────────────────────────────────────────────────

  const write = (path: string, content: string): Promise<void> =>
    runtime.runPromise(
      Effect.gen(function*() {
        const fs = yield* FileSystem
        const abs = resolvePath(path)
        // Ensure parent directory exists (absorb EEXIST)
        yield* fs.makeDirectory(dirname(abs), { recursive: true }).pipe(
          Effect.catchTag("PlatformError", () => Effect.void)
        )
        yield* fs.writeFileString(abs, content)
      })
    )

  // ── sh ───────────────────────────────────────────────────────
  //
  // NOTE: Canonical v4 would use ChildProcess.make + ChildProcessSpawner.
  // We can't use @effect/platform-node-shared (peer dep mismatch with
  // npm-aliased effect). Instead: async child_process.exec — typed result
  // discipline without blocking the extension host event loop.

  const sh = (cmd: string): Promise<string> =>
    runtime.runPromise(
      Effect.tryPromise({
        try: () => new Promise<string>((resolve) => {
          exec(cmd, { cwd, encoding: "utf-8", timeout: 15000 }, (_err, stdout, stderr) => {
            resolve(`${stdout ?? ""}${stderr ?? ""}`.trim())
          })
        }),
        catch: (err: unknown) => ({ _tag: "ShellError" as const, output: String(err) }),
      }).pipe(
        Effect.catch((e: { _tag: "ShellError"; output: string }) => Effect.succeed(e.output))
      )
    )

  // ── dispose ──────────────────────────────────────────────────

  const dispose = (): Promise<void> => runtime.dispose()

  return { read, write, sh, dispose }
}
