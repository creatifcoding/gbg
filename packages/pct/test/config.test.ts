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
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"

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
      Effect.service(Config.PactConfig).pipe(
        Effect.provide(
          Config.layerFromProvider(ConfigProvider.fromUnknown({})),
        ),
      ),
    )
    expect(result.server.port).toBe(8080)
    expect(result.server.host).toBe("127.0.0.1")
    expect(result.client.baseUrl).toBe("http://localhost:8080")
    expect(result.identity).toEqual({
      root: { provider: "ephemeral" },
    })
    expect(result.federation).toEqual({
      enabled: false,
      pollIntervalMs: 5000,
      peers: [],
      eventLogRemote: { enabled: false, peers: [] },
    })
    expect(result.natsControl).toEqual({
      mode: "auto",
      subjectRoot: "pct.v1",
      serviceName: "pct-control-plane",
      serviceVersion: "0.1.0",
      serviceDescription: "PCT NATS control plane",
    })
    expect(result.lnk).toEqual({ backend: "in-memory", nats: {}, msh: {} })
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
      Effect.service(Config.PactConfig).pipe(
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
      Effect.service(Config.PactConfig).pipe(
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
      Effect.service(Config.PactConfig).pipe(
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
      Effect.service(Config.PactConfig).pipe(
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

  it("federation config reads file values and env array overrides", async () => {
    const files = new Map([
      [
        "/workspace/pact.config.json",
        JSON.stringify({
          server: { port: 9090, host: "0.0.0.0" },
          client: { baseUrl: "http://from-file:9090" },
          node: {},
          federation: {
            enabled: false,
            pollIntervalMs: 1500,
            peers: ["http://file-peer:9090"],
          },
        }),
      ],
    ])
    const dirs = new Set(["/workspace/.git"])

    const result = await Effect.runPromise(
      Effect.service(Config.PactConfig).pipe(
        Effect.provide(
          Config.layer({
            cwd: "/workspace/nested",
            env: new Map([
              ["PCT_FEDERATION_ENABLED", "true"],
              ["PCT_FEDERATION_PEERS_0", "http://env-peer-a:8080"],
              ["PCT_FEDERATION_PEERS_1", "http://env-peer-b:8080"],
            ]),
          }),
        ),
        Effect.provide(PlatformLayer(files, dirs)),
      ),
    )

    expect(result.federation.enabled).toBe(true)
    expect(result.federation.pollIntervalMs).toBe(1500)
    expect(result.federation.peers).toEqual([
      "http://env-peer-a:8080",
      "http://env-peer-b:8080",
    ])
  })

  it("eventlog remote federation config reads env peer arrays", async () => {
    const result = await Effect.runPromise(
      Effect.service(Config.PactConfig).pipe(
        Effect.provide(
          Config.layer({
            cwd: "/workspace/nested",
            env: new Map([
              ["PCT_FEDERATION_EVENT_LOG_REMOTE_ENABLED", "true"],
              ["PCT_FEDERATION_EVENT_LOG_REMOTE_PEERS_0", "http://peer-a:8080"],
              ["PCT_FEDERATION_EVENT_LOG_REMOTE_PEERS_1", "http://peer-b:8080"],
            ]),
          }),
        ),
        Effect.provide(PlatformLayer(new Map(), new Set(["/workspace/.git"]))),
      ),
    )

    expect(result.federation.eventLogRemote.enabled).toBe(true)
    expect(result.federation.eventLogRemote.peers).toEqual([
      "http://peer-a:8080",
      "http://peer-b:8080",
    ])
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
      Effect.service(Config.PactConfig).pipe(
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
      Effect.service(Config.PactConfig).pipe(
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
      Effect.service(Config.PactConfig).pipe(
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

  it("identity config supports file provider and env overrides", async () => {
    const files = new Map([
      [
        "/workspace/pact.config.json",
        JSON.stringify({
          server: { port: 9090, host: "127.0.0.1" },
          client: { baseUrl: "http://from-file:9090" },
          node: {},
          identity: {
            root: { provider: "ephemeral" },
          },
        }),
      ],
    ])
    const dirs = new Set(["/workspace/.git"])

    const result = await Effect.runPromise(
      Effect.service(Config.PactConfig).pipe(
        Effect.provide(
          Config.layer({
            cwd: "/workspace/nested",
            env: new Map([
              ["PCT_IDENTITY_ROOT_PROVIDER", "file"],
              ["PCT_IDENTITY_ROOT_FILE_PATH", ".pct/test.identity"],
            ]),
          }),
        ),
        Effect.provide(PlatformLayer(files, dirs)),
      ),
    )

    expect(result.identity.root.provider).toBe("file")
    expect(result.identity.root.filePath).toBe(".pct/test.identity")
  })

  it("journal config supports postgres table options and env overrides", async () => {
    const files = new Map([
      [
        "/workspace/pact.config.json",
        JSON.stringify({
          server: { port: 9090, host: "127.0.0.1" },
          client: { baseUrl: "http://from-file:9090" },
          node: {},
          journal: {
            backend: "memory",
            entryTable: "file_entries",
          },
        }),
      ],
    ])
    const dirs = new Set(["/workspace/.git"])

    const result = await Effect.runPromise(
      Effect.service(Config.PactConfig).pipe(
        Effect.provide(
          Config.layer({
            cwd: "/workspace/nested",
            env: new Map([
              ["PCT_JOURNAL_BACKEND", "postgres"],
              ["PCT_JOURNAL_REMOTES_TABLE", "env_remotes"],
            ]),
          }),
        ),
        Effect.provide(PlatformLayer(files, dirs)),
      ),
    )

    expect(result.journal.backend).toBe("postgres")
    expect(result.journal.entryTable).toBe("file_entries")
    expect(result.journal.remotesTable).toBe("env_remotes")
  })

  it("lnk backend config supports msh-bridge plus legacy nats alias overrides", async () => {
    const files = new Map([
      [
        "/workspace/pact.config.json",
        JSON.stringify({
          server: { port: 9090, host: "127.0.0.1" },
          client: { baseUrl: "http://from-file:9090" },
          node: {},
          lnk: {
            backend: "in-memory",
            nats: { metadataBucket: "FILE_BUCKET" },
            msh: { streamNamePrefix: "FILE_STREAM", servers: "ws://file.example:9222" },
          },
        }),
      ],
    ])
    const dirs = new Set(["/workspace/.git"])

    const result = await Effect.runPromise(
      Effect.service(Config.PactConfig).pipe(
        Effect.provide(
          Config.layer({
            cwd: "/workspace/nested",
            env: new Map([
              ["PCT_LNK_BACKEND", "msh-bridge"],
              ["PCT_LNK_NATS_SUBJECT_ROOT", "_legacy.lnk.stream"],
              ["PCT_LNK_MSH_SUBJECT_ROOT", "_test.lnk.stream"],
              ["PCT_LNK_MSH_SHARD_COUNT", "8"],
            ]),
          }),
        ),
        Effect.provide(PlatformLayer(files, dirs)),
      ),
    )

    expect(result.lnk.backend).toBe("msh-bridge")
    expect(result.lnk.nats.metadataBucket).toBe("FILE_BUCKET")
    expect(result.lnk.nats.subjectRoot).toBe("_legacy.lnk.stream")
    expect(result.lnk.msh.streamNamePrefix).toBe("FILE_STREAM")
    expect(result.lnk.msh.servers).toBe("ws://file.example:9222")
    expect(result.lnk.msh.subjectRoot).toBe("_test.lnk.stream")
    expect(result.lnk.msh.shardCount).toBe(8)
  })

  it("nats control config reads file values and env overrides", async () => {
    const files = new Map([
      [
        "/workspace/pact.config.json",
        JSON.stringify({
          server: { port: 9090, host: "127.0.0.1" },
          client: { baseUrl: "http://from-file:9090" },
          node: {},
          natsControl: {
            mode: "disabled",
            subjectRoot: "pct.file",
            serviceName: "pct-file-control",
            serviceVersion: "0.2.0",
            serviceDescription: "file description",
            servers: "ws://file.example:9222",
          },
        }),
      ],
    ])
    const dirs = new Set(["/workspace/.git"])

    const result = await Effect.runPromise(
      Effect.service(Config.PactConfig).pipe(
        Effect.provide(
          Config.layer({
            cwd: "/workspace/nested",
            env: new Map([
              ["PCT_NATS_CONTROL_MODE", "enabled"],
              ["PCT_NATS_CONTROL_SUBJECT_ROOT", "pct.env"],
              ["PCT_NATS_CONTROL_NAME", "pct-env-connection"],
              ["PCT_NATS_CONTROL_RECONNECT", "false"],
            ]),
          }),
        ),
        Effect.provide(PlatformLayer(files, dirs)),
      ),
    )

    expect(result.natsControl.mode).toBe("enabled")
    expect(result.natsControl.subjectRoot).toBe("pct.env")
    expect(result.natsControl.serviceName).toBe("pct-file-control")
    expect(result.natsControl.serviceVersion).toBe("0.2.0")
    expect(result.natsControl.serviceDescription).toBe("file description")
    expect(result.natsControl.servers).toBe("ws://file.example:9222")
    expect(result.natsControl.name).toBe("pct-env-connection")
    expect(result.natsControl.reconnect).toBe(false)
  })

  it("lnk backend config still accepts nats-bridge as legacy alias", async () => {
    const result = await Effect.runPromise(
      Effect.service(Config.PactConfig).pipe(
        Effect.provide(
          Config.layer({
            cwd: "/workspace/nested",
            env: new Map([["PCT_LNK_BACKEND", "nats-bridge"]]),
          }),
        ),
        Effect.provide(PlatformLayer(new Map(), new Set(["/workspace/.git"]))),
      ),
    )

    expect(result.lnk.backend).toBe("nats-bridge")
  })

  it("missing file is not fatal: falls through to defaults", async () => {
    // No project, user, or system config files exist
    const result = await Effect.runPromise(
      Effect.service(Config.PactConfig).pipe(
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
      Effect.service(Config.PactConfig).pipe(
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
