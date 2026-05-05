/**
 * Config precedence tests.
 *
 * Verifies the operational precedent: env > --config FILE > project
 * > user > system > defaults. Each test isolates one rung of the
 * precedence ladder and proves it overrides the rungs below.
 *
 * Uses a hand-built in-memory FileSystem layer so tests don't touch
 * disk and are fully deterministic. Avoids the platform-bun /
 * platform-node-shared install dance entirely.
 */

import { describe, expect, it } from "vitest"
import * as ConfigProvider from "effect-v4/ConfigProvider"
import * as Effect from "effect-v4/Effect"
import * as FileSystem from "effect-v4/FileSystem"
import * as Layer from "effect-v4/Layer"
import * as Path from "effect-v4/Path"

import * as Config from "../src/config/PactConfig.js"
import * as Sources from "../src/config/Sources.js"

// ─── In-memory FileSystem layer ─────────────────────────────────────────────

/**
 * Build a `FileSystem.FileSystem` layer backed by a fixed map of
 * absolute paths → file contents. All test cases dictate exactly
 * which paths exist; everything else returns NotFound.
 *
 * Implements the minimum surface our config code actually calls:
 * `exists`, `readFileString`. The rest of the FileSystem interface
 * fails with NotFound (sufficient for these tests).
 */
const inMemoryFs = (
  files: ReadonlyMap<string, string>,
  dirs: ReadonlySet<string> = new Set(),
): Layer.Layer<FileSystem.FileSystem> => {
  const fs = FileSystem.makeNoop({
    exists: (path) =>
      Effect.succeed(files.has(path) || dirs.has(path)),
    readFileString: (path) => {
      const contents = files.get(path)
      if (contents !== undefined) return Effect.succeed(contents)
      return Effect.fail(
        // PlatformError shape — sufficient for our error path
        new Error(`ENOENT: ${path}`) as never,
      )
    },
  })
  return Layer.succeed(FileSystem.FileSystem)(fs)
}

const PlatformLayer = (files: ReadonlyMap<string, string>, dirs?: ReadonlySet<string>) =>
  Layer.merge(inMemoryFs(files, dirs), Path.layer)

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Config — Sources stacking", () => {
  it("defaults: when no source supplies anything, returns built-in defaults", async () => {
    const result = await Effect.runPromise(
      Config.PactConfig.asEffect().pipe(
        Effect.provide(
          Config.layerFromProvider(ConfigProvider.fromUnknown({})),
        ),
      ),
    )
    expect(result.server.port).toBe(8080)
    expect(result.server.host).toBe("127.0.0.1")
    expect(result.client.baseUrl).toBe("http://localhost:8080")
  })

  it("project file alone: walks up from cwd to find pact.config.json", async () => {
    // Project root at /workspace; cwd is two levels deeper.
    const files = new Map([
      [
        "/workspace/pact.config.json",
        JSON.stringify({
          server: { port: 9090, host: "0.0.0.0" },
          client: { baseUrl: "http://project-only:9090" },
          node: { url: "https://project.example.com" },
        }),
      ],
    ])
    const dirs = new Set(["/workspace/.git"])

    const result = await Effect.runPromise(
      Config.PactConfig.asEffect().pipe(
        Effect.provide(
          Config.layer({ cwd: "/workspace/nested/deeper", env: new Map() }),
        ),
        Effect.provide(PlatformLayer(files, dirs)),
      ),
    )

    expect(result.server.port).toBe(9090)
    expect(result.client.baseUrl).toBe("http://project-only:9090")
    expect(result.node.url).toBe("https://project.example.com")
  })

  it("project root marker: stops walking at .git, ignores ancestor configs", async () => {
    // Config above the .git boundary — should NOT be picked up
    const files = new Map([
      [
        "/pact.config.json",
        JSON.stringify({
          server: { port: 1111, host: "0.0.0.0" },
          client: { baseUrl: "http://above-git:1111" },
          node: {},
        }),
      ],
    ])
    const dirs = new Set(["/workspace/.git"])

    const result = await Effect.runPromise(
      Config.PactConfig.asEffect().pipe(
        Effect.provide(
          Config.layer({ cwd: "/workspace/nested/deeper", env: new Map() }),
        ),
        Effect.provide(PlatformLayer(files, dirs)),
      ),
    )

    // Falls through to defaults — the above-.git config should be invisible
    expect(result.server.port).toBe(8080)
    expect(result.client.baseUrl).toBe("http://localhost:8080")
  })

  it("user file: picked up via XDG_CONFIG_HOME when no project config", async () => {
    const files = new Map([
      [
        "/home/alice/xdg/pact/config.json",
        JSON.stringify({
          server: { port: 7777, host: "127.0.0.1" },
          client: { baseUrl: "http://user-config:7777" },
          node: {},
        }),
      ],
    ])
    const dirs = new Set(["/work/.git"])

    const result = await Effect.runPromise(
      Config.PactConfig.asEffect().pipe(
        Effect.provide(
          Config.layer({
            cwd: "/work/nested",
            env: new Map([["XDG_CONFIG_HOME", "/home/alice/xdg"]]),
          }),
        ),
        Effect.provide(PlatformLayer(files, dirs)),
      ),
    )
    expect(result.server.port).toBe(7777)
    expect(result.client.baseUrl).toBe("http://user-config:7777")
  })

  it("user file: falls back to $HOME/.config when no XDG_CONFIG_HOME", async () => {
    const files = new Map([
      [
        "/home/alice/.config/pact/config.json",
        JSON.stringify({
          server: { port: 6666, host: "127.0.0.1" },
          client: { baseUrl: "http://home-config:6666" },
          node: {},
        }),
      ],
    ])
    const dirs = new Set(["/work/.git"])

    const result = await Effect.runPromise(
      Config.PactConfig.asEffect().pipe(
        Effect.provide(
          Config.layer({
            cwd: "/work/nested",
            env: new Map([["HOME", "/home/alice"]]),
          }),
        ),
        Effect.provide(PlatformLayer(files, dirs)),
      ),
    )
    expect(result.server.port).toBe(6666)
    expect(result.client.baseUrl).toBe("http://home-config:6666")
  })

  it("env vars override file values per-key", async () => {
    const files = new Map([
      [
        "/workspace/pact.config.json",
        JSON.stringify({
          server: { port: 9090, host: "0.0.0.0" },
          client: { baseUrl: "http://from-file:9090" },
          node: {},
        }),
      ],
    ])
    const dirs = new Set(["/workspace/.git"])

    const result = await Effect.runPromise(
      Config.PactConfig.asEffect().pipe(
        Effect.provide(
          Config.layer({
            cwd: "/workspace/nested",
            env: new Map([
              // env wins over file for client.baseUrl
              ["PCT_CLIENT_BASE_URL", "http://from-env:5555"],
            ]),
          }),
        ),
        Effect.provide(PlatformLayer(files, dirs)),
      ),
    )
    // env-supplied key wins
    expect(result.client.baseUrl).toBe("http://from-env:5555")
    // file-only key still flows through
    expect(result.server.port).toBe(9090)
  })

  it("--config explicitFile replaces project/user/system file lookups", async () => {
    const files = new Map([
      [
        "/workspace/pact.config.json",
        JSON.stringify({
          server: { port: 9090, host: "0.0.0.0" },
          client: { baseUrl: "http://from-project:9090" },
          node: {},
        }),
      ],
      [
        "/tmp/explicit.json",
        JSON.stringify({
          server: { port: 4444, host: "127.0.0.1" },
          client: { baseUrl: "http://from-explicit:4444" },
          node: {},
        }),
      ],
    ])
    const dirs = new Set(["/workspace/.git"])

    const result = await Effect.runPromise(
      Config.PactConfig.asEffect().pipe(
        Effect.provide(
          Config.layer({
            cwd: "/workspace/nested",
            env: new Map(),
            explicitFile: "/tmp/explicit.json",
          }),
        ),
        Effect.provide(PlatformLayer(files, dirs)),
      ),
    )

    // Explicit file wins; project file is bypassed entirely
    expect(result.server.port).toBe(4444)
    expect(result.client.baseUrl).toBe("http://from-explicit:4444")
  })

  it("env still applies on top of --config explicitFile", async () => {
    const files = new Map([
      [
        "/tmp/explicit.json",
        JSON.stringify({
          server: { port: 4444, host: "127.0.0.1" },
          client: { baseUrl: "http://from-explicit:4444" },
          node: {},
        }),
      ],
    ])
    const dirs = new Set<string>()

    const result = await Effect.runPromise(
      Config.PactConfig.asEffect().pipe(
        Effect.provide(
          Config.layer({
            cwd: "/work",
            env: new Map([["PCT_SERVER_PORT", "9999"]]),
            explicitFile: "/tmp/explicit.json",
          }),
        ),
        Effect.provide(PlatformLayer(files, dirs)),
      ),
    )

    // env wins per-key
    expect(result.server.port).toBe(9999)
    // unspecified-by-env keys flow from explicit file
    expect(result.client.baseUrl).toBe("http://from-explicit:4444")
  })

  it("missing file is not fatal: falls through to defaults", async () => {
    // No project, user, or system config files exist
    const result = await Effect.runPromise(
      Config.PactConfig.asEffect().pipe(
        Effect.provide(
          Config.layer({ cwd: "/work", env: new Map() }),
        ),
        Effect.provide(PlatformLayer(new Map(), new Set(["/work/.git"]))),
      ),
    )
    expect(result.server.port).toBe(8080)
    expect(result.client.baseUrl).toBe("http://localhost:8080")
  })

  it("malformed JSON in config file fails with typed Error", async () => {
    const files = new Map([["/tmp/broken.json", "{ this is not json"]])

    const result = await Effect.runPromise(
      Config.PactConfig.asEffect().pipe(
        Effect.provide(
          Config.layer({
            cwd: "/work",
            env: new Map(),
            explicitFile: "/tmp/broken.json",
          }),
        ),
        Effect.provide(PlatformLayer(files)),
        Effect.result,
      ),
    )

    expect(result._tag).toBe("Failure")
    if (result._tag === "Failure") {
      expect(String(result.failure)).toMatch(/invalid JSON/)
    }
  })
})

describe("Config — findProjectConfig", () => {
  it("returns Some when config exists in cwd", async () => {
    const files = new Map([
      ["/work/pact.config.json", "{}"],
    ])
    const dirs = new Set<string>()

    const result = await Effect.runPromise(
      Sources.findProjectConfig("/work").pipe(
        Effect.provide(PlatformLayer(files, dirs)),
      ),
    )
    expect(result._tag).toBe("Some")
    if (result._tag === "Some") {
      expect(result.value).toBe("/work/pact.config.json")
    }
  })

  it("returns Some when config exists in an ancestor", async () => {
    const files = new Map([
      ["/work/pact.config.json", "{}"],
    ])
    const dirs = new Set(["/work/.git"])

    const result = await Effect.runPromise(
      Sources.findProjectConfig("/work/a/b/c").pipe(
        Effect.provide(PlatformLayer(files, dirs)),
      ),
    )
    expect(result._tag).toBe("Some")
    if (result._tag === "Some") {
      expect(result.value).toBe("/work/pact.config.json")
    }
  })

  it("returns None when walk hits .git without finding config", async () => {
    const dirs = new Set(["/work/.git"])
    const result = await Effect.runPromise(
      Sources.findProjectConfig("/work/nested").pipe(
        Effect.provide(PlatformLayer(new Map(), dirs)),
      ),
    )
    expect(result._tag).toBe("None")
  })

  it("returns None when walk reaches filesystem root", async () => {
    // No config, no .git anywhere
    const result = await Effect.runPromise(
      Sources.findProjectConfig("/nowhere/at/all").pipe(
        Effect.provide(PlatformLayer(new Map(), new Set())),
      ),
    )
    expect(result._tag).toBe("None")
  })
})
