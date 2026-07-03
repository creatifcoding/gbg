/**
 * FileSystem adapter error handling — guard tests.
 *
 * Verifies that node:fs errors (ENOENT, EACCES, etc.) flow through
 * Effect's error channel as PlatformError — NOT as unrecoverable defects.
 *
 * §1  Effect.try wrapping — errors are PlatformError, not defects
 * §2  Errno mapping — ENOENT → NotFound, EACCES → PermissionDenied
 * §3  fs-ops safe wrappers — absorb PlatformError with fallbacks
 * §4  fs-ops typed wrappers — propagate as FileReadError
 * §5  exists() integration — missing paths return false, not crash
 * §6  Metaskill service resilience — inspect/discover don't crash on missing dirs
 */

import { describe, it, expect } from "vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as FS from "effect/FileSystem"
import { NodeFileSystemLayer } from "../src/adapters/filesystem-node"
import * as Fs from "../src/plugins/metaskill-services/fs-ops"
import { FileReadError } from "../src/plugins/metaskill-services/errors"

// ── Test helpers ─────────────────────────────────────────────────

/** Get a FileSystem instance from our Node adapter */
function getFs(): FS.FileSystem {
  return Effect.runSync(
    Effect.provide(Effect.service(FS.FileSystem), NodeFileSystemLayer)
  )
}

/** Run an Effect with our FileSystem layer */
function run<A, E>(eff: Effect.Effect<A, E, FS.FileSystem>): Promise<A> {
  return Effect.runPromise(Effect.provide(eff, NodeFileSystemLayer))
}

const MISSING = "/tmp/absolutely-does-not-exist-" + Date.now()
const MISSING_DIR = MISSING + "/subdir"
const MISSING_FILE = MISSING + "/file.txt"

// ── §1 Effect.try wrapping ───────────────────────────────────────

describe("§1 Effect.try wrapping — errors are PlatformError", () => {
  const fs = getFs()

  it("access on missing path fails with PlatformError, not defect", async () => {
    const result = await Effect.runPromise(
      fs.access(MISSING).pipe(
        Effect.map(() => "ok" as const),
        Effect.catchTag("PlatformError", (e) => Effect.succeed(`caught:${e.reason._tag}`))
      )
    )
    expect(result).toBe("caught:NotFound")
  })

  it("readFile on missing path fails with PlatformError", async () => {
    const result = await Effect.runPromise(
      fs.readFile(MISSING_FILE).pipe(
        Effect.map(() => "ok"),
        Effect.catchTag("PlatformError", (e) => Effect.succeed(`caught:${e.reason._tag}`))
      )
    )
    expect(result).toBe("caught:NotFound")
  })

  it("stat on missing path fails with PlatformError", async () => {
    const result = await Effect.runPromise(
      fs.stat(MISSING).pipe(
        Effect.map(() => "ok"),
        Effect.catchTag("PlatformError", (e) => Effect.succeed(`caught:${e.reason._tag}`))
      )
    )
    expect(result).toBe("caught:NotFound")
  })

  it("readDirectory on missing path fails with PlatformError", async () => {
    const result = await Effect.runPromise(
      fs.readDirectory(MISSING_DIR).pipe(
        Effect.map(() => "ok"),
        Effect.catchTag("PlatformError", (e) => Effect.succeed(`caught:${e.reason._tag}`))
      )
    )
    expect(result).toBe("caught:NotFound")
  })

  it("writeFile to missing parent dir fails with PlatformError", async () => {
    const result = await Effect.runPromise(
      fs.writeFile(MISSING_DIR + "/file.txt", new Uint8Array()).pipe(
        Effect.map(() => "ok"),
        Effect.catchTag("PlatformError", (e) => Effect.succeed(`caught:${e.reason._tag}`))
      )
    )
    expect(result).toBe("caught:NotFound")
  })

  it("copyFile from missing source fails with PlatformError", async () => {
    const result = await Effect.runPromise(
      fs.copyFile(MISSING_FILE, "/tmp/dest.txt").pipe(
        Effect.map(() => "ok"),
        Effect.catchTag("PlatformError", (e) => Effect.succeed(`caught:${e.reason._tag}`))
      )
    )
    expect(result).toBe("caught:NotFound")
  })

  it("rename missing source fails with PlatformError", async () => {
    const result = await Effect.runPromise(
      fs.rename(MISSING_FILE, "/tmp/dest.txt").pipe(
        Effect.map(() => "ok"),
        Effect.catchTag("PlatformError", (e) => Effect.succeed(`caught:${e.reason._tag}`))
      )
    )
    expect(result).toBe("caught:NotFound")
  })

  it("readLink on missing path fails with PlatformError", async () => {
    const result = await Effect.runPromise(
      fs.readLink(MISSING).pipe(
        Effect.map(() => "ok"),
        Effect.catchTag("PlatformError", (e) => Effect.succeed(`caught:${e.reason._tag}`))
      )
    )
    expect(result).toBe("caught:NotFound")
  })

  it("realPath on missing path fails with PlatformError", async () => {
    const result = await Effect.runPromise(
      fs.realPath(MISSING).pipe(
        Effect.map(() => "ok"),
        Effect.catchTag("PlatformError", (e) => Effect.succeed(`caught:${e.reason._tag}`))
      )
    )
    expect(result).toBe("caught:NotFound")
  })
})

// ── §2 Errno mapping ─────────────────────────────────────────────

describe("§2 Errno mapping", () => {
  const fs = getFs()

  it("ENOENT → NotFound", async () => {
    const result = await Effect.runPromise(
      fs.access(MISSING).pipe(
        Effect.catchTag("PlatformError", (e) => Effect.succeed(e.reason._tag))
      )
    )
    expect(result).toBe("NotFound")
  })

  it("PlatformError has correct _tag", async () => {
    const result = await Effect.runPromise(
      fs.access(MISSING).pipe(
        Effect.catchTag("PlatformError", (e) => Effect.succeed(e._tag))
      )
    )
    expect(result).toBe("PlatformError")
  })

  it("PlatformError reason has description", async () => {
    const result = await Effect.runPromise(
      fs.access(MISSING).pipe(
        Effect.catchTag("PlatformError", (e) => Effect.succeed(e.reason.description ?? ""))
      )
    )
    expect(result).toContain("ENOENT")
  })
})

// ── §3 fs-ops safe wrappers ──────────────────────────────────────

describe("§3 fs-ops safe wrappers — absorb PlatformError", () => {
  const fs = getFs()

  it("exists() returns false for missing path", async () => {
    const result = await Effect.runPromise(Fs.exists(fs, MISSING))
    expect(result).toBe(false)
  })

  it("stat() returns null for missing path", async () => {
    const result = await Effect.runPromise(Fs.stat(fs, MISSING))
    expect(result).toBeNull()
  })

  it("readFileSafe() returns '' for missing file", async () => {
    const result = await Effect.runPromise(Fs.readFileSafe(fs, MISSING_FILE))
    expect(result).toBe("")
  })

  it("readHead() returns '' for missing file", async () => {
    const result = await Effect.runPromise(Fs.readHead(fs, MISSING_FILE))
    expect(result).toBe("")
  })

  it("readLinesSafe() returns [] for missing file", async () => {
    const result = await Effect.runPromise(Fs.readLinesSafe(fs, MISSING_FILE))
    expect(result).toEqual([])
  })

  it("readDirSafe() returns [] for missing dir", async () => {
    const result = await Effect.runPromise(Fs.readDirSafe(fs, MISSING_DIR))
    expect(result).toEqual([])
  })

  it("writeFileSafe() silently succeeds for missing parent dir", async () => {
    // Should not throw — absorbs error
    await Effect.runPromise(Fs.writeFileSafe(fs, MISSING_DIR + "/file.txt", "data"))
  })

  it("mkDirSafe() silently succeeds for bad path", async () => {
    // Should not throw
    await Effect.runPromise(Fs.mkDirSafe(fs, MISSING_DIR))
  })
})

// ── §4 fs-ops typed wrappers ─────────────────────────────────────

describe("§4 fs-ops typed wrappers — propagate as FileReadError", () => {
  const fs = getFs()

  it("readFile() fails with FileReadError for missing file", async () => {
    const result = await Effect.runPromise(
      Fs.readFile(fs, MISSING_FILE).pipe(
        Effect.map(() => "ok"),
        Effect.catch((e) => Effect.succeed(e._tag))
      )
    )
    expect(result).toBe("FileReadError")
  })

  it("readLines() fails with FileReadError for missing file", async () => {
    const result = await Effect.runPromise(
      Fs.readLines(fs, MISSING_FILE).pipe(
        Effect.map(() => "ok"),
        Effect.catch((e) => Effect.succeed(e._tag))
      )
    )
    expect(result).toBe("FileReadError")
  })

  it("writeFile() fails with FileReadError for deeply missing parent", async () => {
    // Use a unique path that can't have been created by prior tests
    const deepMissing = "/tmp/no-exist-write-test-" + Date.now() + "/a/b/c/file.txt"
    const result = await Effect.runPromise(
      Fs.writeFile(fs, deepMissing, "data").pipe(
        Effect.map(() => "ok"),
        Effect.catch((e) => Effect.succeed(e._tag))
      )
    )
    expect(result).toBe("FileReadError")
  })

  it("FileReadError carries the path", async () => {
    const result = await Effect.runPromise(
      Fs.readFile(fs, MISSING_FILE).pipe(
        Effect.catch((e) => Effect.succeed((e as FileReadError).path))
      )
    )
    expect(result).toBe(MISSING_FILE)
  })
})

// ── §5 exists() integration ──────────────────────────────────────

describe("§5 exists() integration — built-in FS.exists", () => {
  it("FS.exists returns false for missing path (not crash)", async () => {
    // Use unique path that can't exist from prior tests
    const unique = "/tmp/no-exist-test-exists-" + Date.now()
    const result = await run(
      Effect.gen(function*() {
        const fs = yield* FS.FileSystem
        return yield* fs.exists(unique)
      })
    )
    expect(result).toBe(false)
  })

  it("FS.exists returns true for /tmp", async () => {
    const result = await run(
      Effect.gen(function*() {
        const fs = yield* FS.FileSystem
        return yield* fs.exists("/tmp")
      })
    )
    expect(result).toBe(true)
  })

  it("FS.exists on nested missing path returns false", async () => {
    const result = await run(
      Effect.gen(function*() {
        const fs = yield* FS.FileSystem
        return yield* fs.exists("/tmp/nonexistent/deeply/nested/path")
      })
    )
    expect(result).toBe(false)
  })
})

// ── §6 Metaskill service resilience ──────────────────────────────

describe("§6 Metaskill service resilience", () => {
  const fs = getFs()

  it("findMd returns [] for missing dir", async () => {
    const result = await Effect.runPromise(Fs.findMd(fs, MISSING_DIR))
    expect(result).toEqual([])
  })

  it("hasFrontmatter returns false for missing file", async () => {
    const result = await Effect.runPromise(Fs.hasFrontmatter(fs, MISSING_FILE))
    expect(result).toBe(false)
  })

  it("accessing utils/ dir that doesn't exist returns false via exists()", async () => {
    // This is the exact scenario from the bug report
    const skillDir = MISSING + "/skills/agent-context-isolation"
    const result = await Effect.runPromise(Fs.exists(fs, skillDir + "/utils"))
    expect(result).toBe(false)
  })

  it("readDirSafe on missing utils/ returns [] not crash", async () => {
    const skillDir = MISSING + "/skills/some-skill"
    const result = await Effect.runPromise(Fs.readDirSafe(fs, skillDir + "/utils"))
    expect(result).toEqual([])
  })

  it("stat on missing references/ returns null not crash", async () => {
    const skillDir = MISSING + "/skills/some-skill"
    const result = await Effect.runPromise(Fs.stat(fs, skillDir + "/references"))
    expect(result).toBeNull()
  })

  it("readFileSafe on missing SKILL.md returns '' not crash", async () => {
    const result = await Effect.runPromise(Fs.readFileSafe(fs, MISSING + "/SKILL.md"))
    expect(result).toBe("")
  })
})
