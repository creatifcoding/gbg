/**
 * @module test/_node-fs-layer
 *
 * Minimal Node FileSystem Layer for tests.
 *
 * Uses FileSystem.make() to build a real node:fs-backed implementation
 * covering the subset our metaskill services use:
 *   access, readFile, readDirectory, writeFile, makeDirectory, stat, open, remove
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { FileSystem, make as makeFileSystem } from "effect/FileSystem"
import { systemError, badArgument, type PlatformError } from "effect/PlatformError"
import * as NFS from "node:fs"
import * as Path from "node:path"

const handleErrno = (method: string, pathOrDescriptor?: string | number) => (err: unknown): PlatformError => {
  const nodeErr = err as NodeJS.ErrnoException
  const reason = nodeErr.code === "ENOENT" ? "NotFound" as const
    : nodeErr.code === "EACCES" ? "PermissionDenied" as const
    : nodeErr.code === "EEXIST" ? "AlreadyExists" as const
    : "Unknown" as const
  return systemError({
    _tag: reason,
    module: "FileSystem",
    method,
    pathOrDescriptor,
    description: nodeErr.message,
  })
}

const nodeFs: Parameters<typeof FileSystem.make>[0] = {
  access: (path, _options) => Effect.try({
    try: () => { NFS.accessSync(path); },
    catch: handleErrno("access", path),
  }),

  readFile: (path) => Effect.try({
    try: () => new Uint8Array(NFS.readFileSync(path)),
    catch: handleErrno("readFile", path),
  }),

  readDirectory: (path, options) => Effect.try({
    try: () => {
      if (options?.recursive) {
        return NFS.readdirSync(path, { recursive: true }).map(String)
      }
      return NFS.readdirSync(path).map(String)
    },
    catch: handleErrno("readDirectory", path),
  }),

  writeFile: (path, data, _options) => Effect.try({
    try: () => { NFS.writeFileSync(path, data); },
    catch: handleErrno("writeFile", path),
  }),

  makeDirectory: (path, options) => Effect.try({
    try: () => { NFS.mkdirSync(path, { recursive: options?.recursive }); },
    catch: handleErrno("makeDirectory", path),
  }),

  stat: (path) => Effect.try({
    try: () => {
      const s = NFS.statSync(path)
      return {
        type: s.isDirectory() ? "Directory"
          : s.isFile() ? "File"
          : s.isSymbolicLink() ? "SymbolicLink"
          : "Unknown",
        mtime: s.mtime,
        atime: s.atime,
        birthtime: s.birthtime,
        dev: s.dev,
        ino: s.ino,
        mode: s.mode,
        nlink: s.nlink,
        uid: s.uid,
        gid: s.gid,
        rdev: s.rdev,
        size: BigInt(s.size) as any,
        blksize: BigInt(s.blksize ?? 0) as any,
        blocks: BigInt(s.blocks ?? 0) as any,
      } as any
    },
    catch: handleErrno("stat", path),
  }),

  readLink: (path) => Effect.try({
    try: () => NFS.readlinkSync(path),
    catch: handleErrno("readLink", path),
  }),

  realPath: (path) => Effect.try({
    try: () => NFS.realpathSync(path),
    catch: handleErrno("realPath", path),
  }),

  rename: (oldPath, newPath) => Effect.try({
    try: () => { NFS.renameSync(oldPath, newPath); },
    catch: handleErrno("rename", oldPath),
  }),

  remove: (path, options) => Effect.try({
    try: () => { NFS.rmSync(path, { recursive: options?.recursive, force: options?.force ?? true }); },
    catch: handleErrno("remove", path),
  }),

  copy: (src, dst, options) => Effect.try({
    try: () => {
      if (NFS.statSync(src).isDirectory()) {
        NFS.cpSync(src, dst, { recursive: true })
      } else {
        NFS.copyFileSync(src, dst)
      }
    },
    catch: handleErrno("copy", src),
  }),

  copyFile: (src, dst) => Effect.try({
    try: () => { NFS.copyFileSync(src, dst); },
    catch: handleErrno("copyFile", src),
  }),

  chmod: (path, mode) => Effect.try({
    try: () => { NFS.chmodSync(path, mode); },
    catch: handleErrno("chmod", path),
  }),

  chown: (path, uid, gid) => Effect.try({
    try: () => { NFS.chownSync(path, uid, gid); },
    catch: handleErrno("chown", path),
  }),

  link: (from, to) => Effect.try({
    try: () => { NFS.linkSync(from, to); },
    catch: handleErrno("link", from),
  }),

  symlink: (from, to) => Effect.try({
    try: () => { NFS.symlinkSync(from, to); },
    catch: handleErrno("symlink", from),
  }),

  truncate: (path, length) => Effect.try({
    try: () => { NFS.truncateSync(path, Number(length ?? 0)); },
    catch: handleErrno("truncate", path),
  }),

  utimes: (path, atime, mtime) => Effect.try({
    try: () => { NFS.utimesSync(path, atime, mtime); },
    catch: handleErrno("utimes", path),
  }),

  makeTempDirectory: (_options) => Effect.try({
    try: () => NFS.mkdtempSync(Path.join(require("node:os").tmpdir(), "effect-fs-")),
    catch: handleErrno("makeTempDirectory"),
  }),

  makeTempDirectoryScoped: (_options) => Effect.acquireRelease(
    Effect.try({
      try: () => NFS.mkdtempSync(Path.join(require("node:os").tmpdir(), "effect-fs-")),
      catch: handleErrno("makeTempDirectoryScoped"),
    }),
    (dir) => Effect.sync(() => { try { NFS.rmSync(dir, { recursive: true }); } catch {} }),
  ),

  makeTempFile: (_options) => Effect.try({
    try: () => {
      const dir = NFS.mkdtempSync(Path.join(require("node:os").tmpdir(), "effect-fs-"))
      const file = Path.join(dir, "tmp")
      NFS.writeFileSync(file, "")
      return file
    },
    catch: handleErrno("makeTempFile"),
  }),

  makeTempFileScoped: (_options) => Effect.acquireRelease(
    Effect.try({
      try: () => {
        const dir = NFS.mkdtempSync(Path.join(require("node:os").tmpdir(), "effect-fs-"))
        const file = Path.join(dir, "tmp")
        NFS.writeFileSync(file, "")
        return file
      },
      catch: handleErrno("makeTempFileScoped"),
    }),
    (file) => Effect.sync(() => { try { NFS.unlinkSync(file); } catch {} }),
  ),

  open: (_path, _options) => Effect.fail(badArgument({ module: "FileSystem", method: "open", description: "Not implemented in test adapter" })) as any,

  watch: (_path) => { throw new Error("Not implemented in test adapter") },
}

export const NodeFileSystemLayer: Layer.Layer<FileSystem> = Layer.succeed(
  FileSystem,
  makeFileSystem(nodeFs),
)
