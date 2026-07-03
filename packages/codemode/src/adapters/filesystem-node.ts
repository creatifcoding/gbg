/**
 * @module filesystem-node
 *
 * Minimal Node.js FileSystem layer for Effect v4.
 *
 * IMPORTANT: this adapter uses node:fs/promises. The metaskill extension runs
 * in pi's extension host; synchronous filesystem scans here used to stall the
 * entire TUI while `ms.inspect()`, `ms.audit()`, etc. walked skill trees.
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as FS from "effect/FileSystem"
import { PlatformError, systemError } from "effect/PlatformError"
import * as NFS from "node:fs/promises"
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

/** Wrap an async node:fs call → Effect failure with PlatformError on reject. */
function tryFs<A>(method: string, fn: () => Promise<A>): Effect.Effect<A, PlatformError> {
  return Effect.tryPromise({
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
    tryFs("access", async () => { await NFS.access(path) }),

  readFile: (path) =>
    tryFs("readFile", async () => new Uint8Array(await NFS.readFile(path))),

  writeFile: (path, data) =>
    tryFs("writeFile", async () => { await NFS.writeFile(path, data) }),

  stat: (path) =>
    tryFs("stat", async () => {
      const s = await NFS.stat(path)
      return {
        type: s.isDirectory() ? 'Directory' as const : 'File' as const,
        size: FS.Size(s.size),
        mtime: s.mtime, atime: s.atime, birthtime: s.birthtime,
        dev: s.dev, ino: s.ino, mode: s.mode, nlink: s.nlink,
        uid: s.uid, gid: s.gid, rdev: s.rdev, blksize: s.blksize, blocks: s.blocks,
      }
    }),

  remove: (path, opts) =>
    tryFs("remove", async () => { await NFS.rm(path, { recursive: true, force: true }) }),

  makeDirectory: (path, opts) =>
    tryFs("makeDirectory", async () => { await NFS.mkdir(path, { recursive: opts?.recursive ?? false }) }),

  copyFile: (from, to) =>
    tryFs("copyFile", async () => { await NFS.copyFile(from, to) }),

  readDirectory: (path, opts) =>
    tryFs("readDirectory", async () => await NFS.readdir(path, { recursive: opts?.recursive ?? false }) as string[]),

  rename: (from, to) =>
    tryFs("rename", async () => { await NFS.rename(from, to) }),

  truncate: (path, len) =>
    tryFs("truncate", async () => { await NFS.truncate(path, len ?? 0) }),

  chmod: (path, mode) =>
    tryFs("chmod", async () => { await NFS.chmod(path, mode) }),

  chown: (path, uid, gid) =>
    tryFs("chown", async () => { await NFS.chown(path, uid, gid) }),

  utimes: (path, atime, mtime) =>
    tryFs("utimes", async () => { await NFS.utimes(path, atime, mtime) }),

  link: (from, to) =>
    tryFs("link", async () => { await NFS.link(from, to) }),

  symlink: (from, to) =>
    tryFs("symlink", async () => { await NFS.symlink(from, to) }),

  readLink: (path) =>
    tryFs("readLink", async () => await NFS.readlink(path)),

  realPath: (path) =>
    tryFs("realPath", async () => await NFS.realpath(path)),

  makeTempDirectory: () =>
    tryFs("makeTempDirectory", async () => await NFS.mkdtemp(Path.join(OS.tmpdir(), 'rlm-'))),

  makeTempFile: () =>
    tryFs("makeTempFile", async () => {
      const dir = await NFS.mkdtemp(Path.join(OS.tmpdir(), 'rlm-'))
      const file = Path.join(dir, 'tmpfile')
      await NFS.writeFile(file, '')
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

/** Node.js FileSystem layer for Effect v4. */
export const NodeFileSystemLayer: Layer.Layer<FS.FileSystem> =
  Layer.succeed(FS.FileSystem, impl)
