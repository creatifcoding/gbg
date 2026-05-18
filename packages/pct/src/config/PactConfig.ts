/**
 * PactConfig — the application-level configuration service.
 *
 * Built on Effect v4's Config + ConfigProvider primitives.
 *
 * # Source stacking
 *
 * See `Sources.ts` for the full precedence model. Briefly:
 *
 *   env > --config FILE > project > user > system > defaults
 *
 * # Schema sections
 *
 *   - `node`     — public URL the local node advertises
 *   - `identity` — local root identity provider for `pact serve`
 *   - `server`   — port + bind host for `pact serve`
 *   - `client`   — default baseUrl for the CLI's HTTP calls
 *   - `federation` — Flow B peer polling controls for `pact serve`
 *   - `journal`  — EventJournal backend selection
 *   - `lnk`      — Durable Streams backend selection for mounted LNK routes
 *
 * # Service shape
 *
 * Exposed as `PactConfig` — a `Context.Reference` resolved through
 * the active stacked ConfigProvider. Consumers `yield* PactConfig`
 * and get a fully-decoded `PactConfigValue`.
 *
 * @module @tmnl/pct/config/PactConfig
 */

import * as Config from "effect-v4/Config"
import * as ConfigProvider from "effect-v4/ConfigProvider"
import * as Context from "effect-v4/Context"
import * as Effect from "effect-v4/Effect"
import * as FileSystem from "effect-v4/FileSystem"
import * as Layer from "effect-v4/Layer"
import * as Path from "effect-v4/Path"
import * as Schema from "effect-v4/Schema"

import * as Sources from "./Sources.js"

// ─── Schema ─────────────────────────────────────────────────────────────────

/**
 * The config file's expected shape.
 *
 * Example pact.config.json:
 * ```json
 * {
 *   "node":   { "url": "https://pct.example.com" },
 *   "identity": { "root": { "provider": "file", "filePath": ".pct/identity/root.identity" } },
 *   "server": { "port": 8080, "host": "127.0.0.1" },
 *   "client": { "baseUrl": "http://localhost:8080" },
 *   "federation": {
 *     "enabled": true,
 *     "pollIntervalMs": 5000,
 *     "peers": ["http://peer-a:8080"]
 *   },
 *   "journal": { "backend": "memory" },
 *   "lnk": { "backend": "in-memory" }
 * }
 * ```
 *
 * Equivalent env vars (highest precedence):
 *   PCT_NODE_URL=https://pct.example.com
 *   PCT_IDENTITY_ROOT_PROVIDER=file
 *   PCT_IDENTITY_ROOT_FILE_PATH=.pct/identity/root.identity
 *   PCT_SERVER_PORT=8080
 *   PCT_SERVER_HOST=127.0.0.1
 *   PCT_CLIENT_BASE_URL=http://localhost:8080
 *   PCT_FEDERATION_ENABLED=true
 *   PCT_FEDERATION_POLL_INTERVAL_MS=5000
 *   PCT_FEDERATION_PEERS_0=http://peer-a:8080
 *   PCT_FEDERATION_EVENT_LOG_REMOTE_ENABLED=true
 *   PCT_FEDERATION_EVENT_LOG_REMOTE_PEERS_0=http://peer-a:8080
 *   PCT_JOURNAL_BACKEND=memory
 *   PCT_JOURNAL_DATABASE=pct-registry
 *   PCT_JOURNAL_ENTRY_TABLE=pct_event_journal
 *   PCT_JOURNAL_REMOTES_TABLE=pct_event_remotes
 *   PCT_LNK_BACKEND=in-memory
 *   PCT_LNK_NATS_SUBJECT_ROOT=_tmnl.lnk.stream
 */
export const PactConfigSchema = Schema.Struct({
  node: Schema.Struct({
    /** Optional public URL the node advertises in its Manifest. */
    url: Schema.optional(Schema.String),
  }),
  identity: Schema.Struct({
    root: Schema.Struct({
      /** Local root identity provider. `file` is stable across restarts. */
      provider: Schema.Literals(["ephemeral", "file"]),
      /** File path for `file` provider; defaults in serve if omitted. */
      filePath: Schema.optional(Schema.String),
    }),
  }),
  server: Schema.Struct({
    /** TCP port to bind. */
    port: Schema.Int,
    /** Bind interface; default 127.0.0.1. */
    host: Schema.String,
  }),
  client: Schema.Struct({
    /** Default base URL for `pact registry status`, `pact publish`. */
    baseUrl: Schema.String,
  }),
  federation: Schema.Struct({
    /** Enable Flow B manifest/delta federation in `pact serve`. */
    enabled: Schema.Boolean,
    /** Peer polling interval in milliseconds. */
    pollIntervalMs: Schema.Int,
    /** Peer base URLs to add when the server starts. */
    peers: Schema.Array(Schema.String),
    /** Flow C EventLogRemote peer registration. */
    eventLogRemote: Schema.Struct({
      enabled: Schema.Boolean,
      peers: Schema.Array(Schema.String),
    }),
  }),
  journal: Schema.Struct({
    /**
     * EventJournal backend.
     *
     * - `memory`: tests/dev only
     * - `indexeddb`: runtimes with IndexedDB
     * - `postgres`: Effect-smol SqlEventJournal over a provided pg SqlClient
     */
    backend: Schema.Literals(["memory", "indexeddb", "postgres"]),
    /** Optional database name for indexeddb backend. */
    database: Schema.optional(Schema.String),
    /** SQL entry table name for postgres backend. */
    entryTable: Schema.optional(Schema.String),
    /** SQL remote sequence table name for postgres backend. */
    remotesTable: Schema.optional(Schema.String),
  }),
  lnk: Schema.Struct({
    /** Durable Streams backend for mounted LNK routes. */
    backend: Schema.Literals(["in-memory", "nats-bridge"]),
    /** Options for the future MSH-backed NatsBridgeWire. */
    nats: Schema.Struct({
      subjectRoot: Schema.optional(Schema.String),
      streamNamePrefix: Schema.optional(Schema.String),
      metadataBucket: Schema.optional(Schema.String),
      consumerNamePrefix: Schema.optional(Schema.String),
    }),
  }),
})

export type PactConfigValue = typeof PactConfigSchema.Type

/**
 * The Effect-Config-aware view of the schema. Yielding this in an
 * `Effect.gen` resolves through the active `ConfigProvider`.
 *
 * No path prefix here — the `Sources.stack` provider already nests
 * env vars under `PCT_*` and file roots assume a top-level shape.
 */
const PactConfigValueRef = Config.schema(PactConfigSchema)

// ─── Service tag ────────────────────────────────────────────────────────────

const DEFAULTS: PactConfigValue = {
  node: {},
  identity: { root: { provider: "ephemeral" } },
  server: { port: 8080, host: "127.0.0.1" },
  client: { baseUrl: "http://localhost:8080" },
  federation: {
    enabled: false,
    pollIntervalMs: 5000,
    peers: [],
    eventLogRemote: { enabled: false, peers: [] },
  },
  journal: { backend: "memory" },
  lnk: { backend: "in-memory", nats: {} },
}

/**
 * `Context.Reference` for the resolved config value.
 *
 * Reference (vs Service): no fallback layer required at the call site —
 * if no layer provides it, consumers receive `defaultValue` (sane
 * localhost defaults). In practice every entry-point installs one of
 * the `layer*` constructors below.
 */
export const PactConfig = Context.Reference<PactConfigValue>(
  "@tmnl/pct/config/PactConfig",
  { defaultValue: () => DEFAULTS },
)
export type PactConfig = typeof PactConfig

// ─── Layers ────────────────────────────────────────────────────────────────

/**
 * Layer that loads config from the full source stack:
 *
 *   env > --config FILE > project > user > system > defaults
 *
 * See `Sources.stack` for details.
 */
export const layer = (
  options: Sources.StackOptions = {},
): Layer.Layer<
  never,
  Error | Config.ConfigError,
  FileSystem.FileSystem | Path.Path
> =>
  Layer.effect(PactConfig)(
    Effect.gen(function* () {
      const provider = yield* Sources.stack(options)
      return yield* PactConfigValueRef.parse(provider)
    }),
  )

/**
 * Layer that resolves `PactConfig` from an explicit ConfigProvider.
 *
 * The supplied provider is automatically chained over the built-in
 * defaults (lowest precedence) so it doesn't have to spell out every
 * key. Useful for tests where you want to inject a partial provider
 * via `ConfigProvider.fromUnknown({ server: { port: 9999 } })`.
 */
export const layerFromProvider = (
  provider: ConfigProvider.ConfigProvider,
): Layer.Layer<never, Config.ConfigError> =>
  Layer.effect(PactConfig)(
    PactConfigValueRef.parse(
      provider.pipe(ConfigProvider.orElse(Sources.DEFAULTS_PROVIDER)),
    ),
  )

/**
 * Layer that provides an explicit `PactConfigValue` directly.
 *
 * For tests and programmatic embedding where the config is known at
 * compile time.
 */
export const layerFromValue = (
  value: PactConfigValue,
): Layer.Layer<never> => Layer.succeed(PactConfig)(value)

/**
 * Convenience: read the current process env into a Map suitable for
 * `Sources.stack({ env })`. Caller responsibility to populate; this
 * is just the canonical conversion.
 */
export const envFromProcess = (): ReadonlyMap<string, string> => {
  const m = new Map<string, string>()
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") m.set(k, v)
  }
  return m
}
