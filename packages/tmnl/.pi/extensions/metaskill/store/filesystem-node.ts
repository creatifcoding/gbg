/**
 * @module filesystem-node
 *
 * Minimal Node.js FileSystem layer for Effect v4.
 *
 * Same pattern as sqlite-node.ts: we can't use @effect/platform-node (v3)
 * with effect-v4 alias, so we roll a minimal impl wrapping node:fs.
 *
 * Only implements methods needed by the export/import service.
 * Uses Effect.sync wrapping node:fs sync methods (extension runs in pi's sync sandbox).
 */

import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as FS from "effect-v4/FileSystem"
import * as NFS from "node:fs"
import * as Path from "node:path"
import * as OS from "node:os"

const impl = FS.make({
  access: (path) =>
    Effect.sync(() => { NFS.accessSync(path) }),

  readFile: (path) =>
    Effect.sync(() => new Uint8Array(NFS.readFileSync(path))),

  writeFile: (path, data) =>
    Effect.sync(() => { NFS.writeFileSync(path, data) }),

  stat: (path) =>
    Effect.sync(() => {
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
    Effect.sync(() => { NFS.rmSync(path, { recursive: true, force: true }) }),

  makeDirectory: (path, opts) =>
    Effect.sync(() => { NFS.mkdirSync(path, { recursive: opts?.recursive ?? false }) }),

  copyFile: (from, to) =>
    Effect.sync(() => { NFS.copyFileSync(from, to) }),

  readDirectory: (path) =>
    Effect.sync(() => NFS.readdirSync(path)),

  rename: (from, to) =>
    Effect.sync(() => { NFS.renameSync(from, to) }),

  truncate: (path, len) =>
    Effect.sync(() => { NFS.truncateSync(path, len ?? 0) }),

  chmod: (path, mode) =>
    Effect.sync(() => { NFS.chmodSync(path, mode) }),

  chown: (path, uid, gid) =>
    Effect.sync(() => { NFS.chownSync(path, uid, gid) }),

  utimes: (path, atime, mtime) =>
    Effect.sync(() => { NFS.utimesSync(path, atime, mtime) }),

  link: (from, to) =>
    Effect.sync(() => { NFS.linkSync(from, to) }),

  symlink: (from, to) =>
    Effect.sync(() => { NFS.symlinkSync(from, to) }),

  readLink: (path) =>
    Effect.sync(() => NFS.readlinkSync(path)),

  realPath: (path) =>
    Effect.sync(() => NFS.realpathSync(path)),

  makeTempDirectory: () =>
    Effect.sync(() => NFS.mkdtempSync(Path.join(OS.tmpdir(), 'rlm-'))),

  makeTempFile: () =>
    Effect.sync(() => {
      const dir = NFS.mkdtempSync(Path.join(OS.tmpdir(), 'rlm-'))
      const file = Path.join(dir, 'tmpfile')
      NFS.writeFileSync(file, '')
      return file
    }),

  // Not needed for export/import — stub
  open: () => Effect.fail(new Error('FileSystem.open not implemented in minimal Node adapter')) as any,
  watch: () => { throw new Error('FileSystem.watch not implemented in minimal Node adapter') },
})

/**
 * Node.js FileSystem layer for Effect v4.
 *
 * Usage:
 *   import { NodeFileSystemLayer } from "./filesystem-node.ts"
 *   const AppLayer = ExportServiceLive.pipe(Layer.provide(NodeFileSystemLayer))
 */
export const NodeFileSystemLayer: Layer.Layer<FS.FileSystem> =
  Layer.succeed(FS.FileSystem, impl)
