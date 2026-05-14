/**
 * @module filesystem-node
 *
 * Minimal Node.js FileSystem layer for Effect v4.
 *
 * Same pattern as sqlite-node.ts: we can't use @effect/platform-node (v3)
 * with effect-v4 alias, so we roll a minimal impl wrapping node:fs.
 *
 * CRITICAL: All methods use Effect.try (not Effect.sync!) so that
 * thrown node:fs errors (ENOENT, EACCES, etc.) flow through the
 * Effect error channel as PlatformError — not as unrecoverable defects.
 *
 * The upstream fs-ops.ts layer then catches these via:
 *   Effect.catchTag("PlatformError", ...) → safe fallback or domain error
 */

import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as FS from "effect-v4/FileSystem"
import { PlatformError, systemError } from "effect-v4/PlatformError"
import * as NFS from "node:fs"
import * as Path from "node:path"
import * as OS from "node:os"

/**
 * Map Node.js errno codes → Effect SystemError reason tags.
 * Same mapping as @effect/platform-node-shared.
 */
type SystemErrorTag =
  | "AlreadyExists" | "BadResource" | "Busy" | "InvalidData"
  | "NotFound" | "PermissionDenied" | "TimedOut" | "UnexpectedEof"
  | "Unknown" | "WouldBlock" | "WriteZero"

function errnoToReason(code: string | undefined): SystemErrorTag {
  switch (code) {
    case "ENOENT": return "NotFound"
    case "EACCES": return "PermissionDenied"
    case "EEXIST": return "AlreadyExists"
    case "EISDIR": return "BadResource"
    case "ENOTDIR": return "BadResource"
    case "EBUSY": return "Busy"
    case "ELOOP": return "BadResource"
    case "EPERM": return "PermissionDenied"
    default: return "Unknown"
  }
}

/**
 * Wrap a sync node:fs call → Effect that fails with PlatformError on throw.
 *
 * Effect.try catches thrown exceptions and maps them through `catch:`.
 * This ensures ENOENT, EACCES, etc. become typed PlatformError values
 * on the error channel — recoverable via Effect.catchTag("PlatformError", ...).
 *
 * CRITICAL: Without this, Effect.sync turns throws into DEFECTS
 * which are uncatchable by catchTag("PlatformError"). The entire
 * fs-ops.ts safe-wrapper layer depends on errors being on the
 * error channel, not the defect channel.
 */
function tryFs<A>(method: string, fn: () => A): Effect.Effect<A, PlatformError> {
  return Effect.try({
    try: fn,
    catch: (err: unknown) => {
      const e = err as NodeJS.ErrnoException
      return systemError({
        _tag: errnoToReason(e.code),
        module: "FileSystem",
        method,
        pathOrDescriptor: e.path ?? "",
        description: e.message ?? String(err),
        syscall: e.syscall ?? method,
      })
    },
  })
}

const impl = FS.make({
  access: (path) =>
    tryFs("access", () => { NFS.accessSync(path) }),

  readFile: (path) =>
    tryFs("readFile", () => new Uint8Array(NFS.readFileSync(path))),

  writeFile: (path, data) =>
    tryFs("writeFile", () => { NFS.writeFileSync(path, data) }),

  stat: (path) =>
    tryFs("stat", () => {
      const s = NFS.statSync(path)
      return {
        type: s.isDirectory() ? 'Directory' as const : 'File' as const,
        size: FS.Size(s.size),
        mtime: s.mtime, atime: s.atime, birthtime: s.birthtime,
        dev: s.dev, ino: s.ino, mode: s.mode, nlink: s.nlink,
        uid: s.uid, gid: s.gid, rdev: s.rdev, blksize: s.blksize, blocks: s.blocks,
      }
    }),

  remove: (path, opts) =>
    tryFs("remove", () => { NFS.rmSync(path, { recursive: true, force: true }) }),

  makeDirectory: (path, opts) =>
    tryFs("makeDirectory", () => { NFS.mkdirSync(path, { recursive: opts?.recursive ?? false }) }),

  copyFile: (from, to) =>
    tryFs("copyFile", () => { NFS.copyFileSync(from, to) }),

  readDirectory: (path, opts) =>
    tryFs("readDirectory", () => NFS.readdirSync(path, { recursive: opts?.recursive ?? false }) as string[]),

  rename: (from, to) =>
    tryFs("rename", () => { NFS.renameSync(from, to) }),

  truncate: (path, len) =>
    tryFs("truncate", () => { NFS.truncateSync(path, len ?? 0) }),

  chmod: (path, mode) =>
    tryFs("chmod", () => { NFS.chmodSync(path, mode) }),

  chown: (path, uid, gid) =>
    tryFs("chown", () => { NFS.chownSync(path, uid, gid) }),

  utimes: (path, atime, mtime) =>
    tryFs("utimes", () => { NFS.utimesSync(path, atime, mtime) }),

  link: (from, to) =>
    tryFs("link", () => { NFS.linkSync(from, to) }),

  symlink: (from, to) =>
    tryFs("symlink", () => { NFS.symlinkSync(from, to) }),

  readLink: (path) =>
    tryFs("readLink", () => NFS.readlinkSync(path)),

  realPath: (path) =>
    tryFs("realPath", () => NFS.realpathSync(path)),

  makeTempDirectory: () =>
    tryFs("makeTempDirectory", () => NFS.mkdtempSync(Path.join(OS.tmpdir(), 'rlm-'))),

  makeTempFile: () =>
    tryFs("makeTempFile", () => {
      const dir = NFS.mkdtempSync(Path.join(OS.tmpdir(), 'rlm-'))
      const file = Path.join(dir, 'tmpfile')
      NFS.writeFileSync(file, '')
      return file
    }),

  // Not needed for export/import — stub
  open: () => Effect.fail(systemError({
    _tag: "Unknown",
    module: "FileSystem", method: "open",
    pathOrDescriptor: "", description: "open not implemented in minimal Node adapter",
    syscall: "open",
  })) as any,
  watch: () => { throw new Error('FileSystem.watch not implemented in minimal Node adapter') },
})

/**
 * Node.js FileSystem layer for Effect v4.
 *
 * Usage:
 *   import { NodeFileSystemLayer } from "./filesystem-node.js"
 *   const AppLayer = ExportServiceLive.pipe(Layer.provide(NodeFileSystemLayer))
 */
export const NodeFileSystemLayer: Layer.Layer<FS.FileSystem> =
  Layer.succeed(FS.FileSystem, impl)
