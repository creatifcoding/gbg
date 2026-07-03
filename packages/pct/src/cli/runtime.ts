/**
 * In-package CLI runtime — minimal Stdio/FileSystem/Path/Terminal
 * /ChildProcessSpawner provider for `pact` invocations.
 *
 * # Why not @effect/platform-bun?
 *
 * The published `@effect/platform-*` packages import from `"effect/..."`
 * (the bare name). In this monorepo, `effect` resolves globally to v3
 * (3.19.18) via root `overrides`, while v4 lives at the `effect`
 * alias. Forcing nested-resolution overrides for platform-bun proved
 * fragile, so we wire the platform services here directly — using
 * effect's own constructors (`FileSystem.make`, `Stdio.make`, etc.)
 * — which is what `@effect/platform-bun` does internally anyway, just
 * without the alias mismatch.
 *
 * # What this provides
 *
 *   - `Stdio`              — args from `process.argv`, stdout/stderr
 *                            wrapping `process.stdout` / `process.stderr`
 *   - `FileSystem`         — `node:fs/promises`-backed implementation
 *                            (only the methods PCT actually uses)
 *   - `Path`               — `Path.layer` (POSIX, built into effect)
 *   - `Terminal`           — non-interactive stub (errors on prompt)
 *   - `ChildProcessSpawner` — non-spawning stub (errors on use)
 *
 * The full surface is sufficient for `Command.run` to execute its
 * help-doc + arg-parsing + handler-dispatch flow on a real terminal.
 *
 * @module @tmnl/pct/cli/runtime
 */

import * as fsPromises from "node:fs/promises"
import { constants as fsConstants } from "node:fs"

import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as PlatformError from "effect/PlatformError"
import * as Sink from "effect/Sink"
import * as Stdio from "effect/Stdio"
import * as Stream from "effect/Stream"
import * as Terminal from "effect/Terminal"
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner"

// ─── FileSystem (node:fs/promises-backed) ───────────────────────────────────

/**
 * Map a Node FS error to an Effect `PlatformError`. Maps `ENOENT`
 * specifically since `FileSystem.make` derives `exists` from `access`
 * by catching the `NotFound` case.
 */
const platformErrorFromNode = (
  module: string,
  method: string,
  pathStr: string,
  cause: unknown,
): PlatformError.PlatformError => {
  const code = (cause as { code?: string } | null)?.code
  return new PlatformError.PlatformError(
    new PlatformError.SystemError({
      _tag: code === "ENOENT" ? "NotFound" : "Unknown",
      module,
      method,
      pathOrDescriptor: pathStr,
      cause,
    }),
  )
}

const fsImpl = FileSystem.make({
  access: (path, options) =>
    Effect.tryPromise({
      try: () => {
        let mode = fsConstants.F_OK
        if (options?.readable) mode |= fsConstants.R_OK
        if (options?.writable) mode |= fsConstants.W_OK
        return fsPromises.access(path, mode)
      },
      catch: (cause) =>
        platformErrorFromNode("FileSystem", "access", path, cause),
    }),
  readFile: (path) =>
    Effect.tryPromise({
      try: () => fsPromises.readFile(path),
      catch: (cause) =>
        platformErrorFromNode("FileSystem", "readFile", path, cause),
    }).pipe(Effect.map((buf) => new Uint8Array(buf))),
  writeFile: (path, data, options) =>
    Effect.tryPromise({
      try: () =>
        fsPromises.writeFile(path, data, {
          flag: options?.flag,
          mode: options?.mode,
        }),
      catch: (cause) =>
        platformErrorFromNode("FileSystem", "writeFile", path, cause),
    }),
  // Stat is occasionally needed; minimal impl
  stat: (path) =>
    Effect.tryPromise({
      try: () => fsPromises.stat(path),
      catch: (cause) =>
        platformErrorFromNode("FileSystem", "stat", path, cause),
    }).pipe(
      Effect.map(
        (s) =>
          ({
            type: s.isFile()
              ? "File"
              : s.isDirectory()
                ? "Directory"
                : s.isSymbolicLink()
                  ? "SymbolicLink"
                  : "Other",
            mtime: { _tag: "Some", value: s.mtime } as never,
            atime: { _tag: "Some", value: s.atime } as never,
            birthtime: { _tag: "Some", value: s.birthtime } as never,
            dev: s.dev,
            ino: s.ino,
            mode: s.mode,
            nlink: s.nlink,
            uid: s.uid,
            gid: s.gid,
            rdev: s.rdev,
            size: BigInt(s.size) as never,
            blksize: BigInt(s.blksize) as never,
            blocks: BigInt(s.blocks) as never,
          }) as never,
      ),
    ),
  readDirectory: (path) =>
    Effect.tryPromise({
      try: () => fsPromises.readdir(path),
      catch: (cause) =>
        platformErrorFromNode("FileSystem", "readDirectory", path, cause),
    }) as never,
  // The remaining methods aren't called by our CLI; provide noop-fail.
  chmod: (path) =>
    Effect.fail(
      platformErrorFromNode(
        "FileSystem",
        "chmod",
        path,
        new Error("not implemented in pct CLI runtime"),
      ),
    ),
  chown: (path) =>
    Effect.fail(
      platformErrorFromNode(
        "FileSystem",
        "chown",
        path,
        new Error("not implemented in pct CLI runtime"),
      ),
    ),
  copy: (path) =>
    Effect.fail(
      platformErrorFromNode(
        "FileSystem",
        "copy",
        path,
        new Error("not implemented in pct CLI runtime"),
      ),
    ),
  copyFile: (path) =>
    Effect.fail(
      platformErrorFromNode(
        "FileSystem",
        "copyFile",
        path,
        new Error("not implemented in pct CLI runtime"),
      ),
    ),
  link: (path) =>
    Effect.fail(
      platformErrorFromNode(
        "FileSystem",
        "link",
        path,
        new Error("not implemented in pct CLI runtime"),
      ),
    ),
  makeDirectory: (path) =>
    Effect.tryPromise({
      try: () => fsPromises.mkdir(path, { recursive: true }),
      catch: (cause) =>
        platformErrorFromNode("FileSystem", "makeDirectory", path, cause),
    }) as never,
  makeTempDirectory: () =>
    Effect.fail(
      platformErrorFromNode(
        "FileSystem",
        "makeTempDirectory",
        "",
        new Error("not implemented in pct CLI runtime"),
      ),
    ),
  makeTempDirectoryScoped: () =>
    Effect.fail(
      platformErrorFromNode(
        "FileSystem",
        "makeTempDirectoryScoped",
        "",
        new Error("not implemented in pct CLI runtime"),
      ),
    ),
  makeTempFile: () =>
    Effect.fail(
      platformErrorFromNode(
        "FileSystem",
        "makeTempFile",
        "",
        new Error("not implemented in pct CLI runtime"),
      ),
    ),
  makeTempFileScoped: () =>
    Effect.fail(
      platformErrorFromNode(
        "FileSystem",
        "makeTempFileScoped",
        "",
        new Error("not implemented in pct CLI runtime"),
      ),
    ),
  open: (path) =>
    Effect.fail(
      platformErrorFromNode(
        "FileSystem",
        "open",
        path,
        new Error("file handles not implemented in pct CLI runtime"),
      ),
    ),
  readLink: (path) =>
    Effect.fail(
      platformErrorFromNode(
        "FileSystem",
        "readLink",
        path,
        new Error("not implemented in pct CLI runtime"),
      ),
    ),
  realPath: (path) =>
    Effect.tryPromise({
      try: () => fsPromises.realpath(path),
      catch: (cause) =>
        platformErrorFromNode("FileSystem", "realPath", path, cause),
    }),
  remove: (path) =>
    Effect.tryPromise({
      try: () => fsPromises.rm(path, { recursive: true, force: true }),
      catch: (cause) =>
        platformErrorFromNode("FileSystem", "remove", path, cause),
    }) as never,
  rename: (oldPath) =>
    Effect.fail(
      platformErrorFromNode(
        "FileSystem",
        "rename",
        oldPath,
        new Error("not implemented in pct CLI runtime"),
      ),
    ),
  symlink: (target) =>
    Effect.fail(
      platformErrorFromNode(
        "FileSystem",
        "symlink",
        target,
        new Error("not implemented in pct CLI runtime"),
      ),
    ),
  truncate: (path) =>
    Effect.fail(
      platformErrorFromNode(
        "FileSystem",
        "truncate",
        path,
        new Error("not implemented in pct CLI runtime"),
      ),
    ),
  utimes: (path) =>
    Effect.fail(
      platformErrorFromNode(
        "FileSystem",
        "utimes",
        path,
        new Error("not implemented in pct CLI runtime"),
      ),
    ),
  watch: (path) =>
    Stream.fail(
      platformErrorFromNode(
        "FileSystem",
        "watch",
        path,
        new Error("not implemented in pct CLI runtime"),
      ),
    ) as never,
})

const fileSystemLayer = Layer.succeed(FileSystem.FileSystem)(fsImpl)

// ─── Stdio (process.argv + process.stdout/stderr) ──────────────────────────

const stdoutSink = Sink.forEach((chunk: string | Uint8Array) =>
  Effect.sync(() => {
    if (typeof chunk === "string") {
      process.stdout.write(chunk)
    } else {
      process.stdout.write(chunk)
    }
  }),
)

const stderrSink = Sink.forEach((chunk: string | Uint8Array) =>
  Effect.sync(() => {
    if (typeof chunk === "string") {
      process.stderr.write(chunk)
    } else {
      process.stderr.write(chunk)
    }
  }),
)

const stdioLayer = Layer.succeed(Stdio.Stdio)(
  Stdio.make({
    // process.argv = [node, script, ...userArgs]; CLI takes user args.
    args: Effect.sync(() => process.argv.slice(2)),
    stdout: () => stdoutSink as never,
    stderr: () => stderrSink as never,
    stdin: Stream.empty as never, // no stdin needed for our commands
  }),
)

// ─── Terminal (non-interactive stub) ────────────────────────────────────────

const terminalLayer = Layer.succeed(Terminal.Terminal)(
  Terminal.make({
    columns: Effect.sync(() => process.stdout.columns ?? 80),
    readInput: Effect.fail(
      new Terminal.QuitError() as never,
    ) as never,
    readLine: Effect.fail(
      new Terminal.QuitError() as never,
    ) as never,
    display: (text: string) =>
      Effect.sync(() => {
        process.stdout.write(text)
      }) as never,
  } as never),
)

// ─── ChildProcessSpawner (non-spawning stub) ────────────────────────────────

const cpsLayer = Layer.succeed(ChildProcessSpawner.ChildProcessSpawner)(
  ChildProcessSpawner.make(() =>
    Effect.die(
      "pct CLI runtime: ChildProcessSpawner is not implemented (no commands spawn processes)",
    ),
  ),
)

// ─── Combined Layer ─────────────────────────────────────────────────────────

/**
 * The full CLI services layer. Provide this to `Command.run`'s
 * resulting Effect and `BunRuntime`-like behavior is achieved.
 */
export const cliRuntimeLayer = Layer.mergeAll(
  fileSystemLayer,
  Path.layer,
  stdioLayer,
  terminalLayer,
  cpsLayer,
)
