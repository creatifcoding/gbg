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
 *   - `node`     — identity + URL the local node advertises
 *   - `server`   — port + bind host for `pact serve`
 *   - `client`   — default baseUrl for the CLI's HTTP calls
 *   - `federation` — Flow B peer polling controls for `pact serve`
 *   - `journal`  — EventJournal backend selection
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
 *   "server": { "port": 8080, "host": "127.0.0.1" },
 *   "client": { "baseUrl": "http://localhost:8080" },
 *   "federation": {
 *     "enabled": true,
 *     "pollIntervalMs": 5000,
 *     "peers": ["http://peer-a:8080"]
 *   },
 *   "journal": { "backend": "memory" }
 * }
 * ```
 *
 * Equivalent env vars (highest precedence):
 *   PCT_NODE_URL=https://pct.example.com
 *   PCT_SERVER_PORT=8080
 *   PCT_SERVER_HOST=127.0.0.1
 *   PCT_CLIENT_BASE_URL=http://localhost:8080
 *   PCT_FEDERATION_ENABLED=true
 *   PCT_FEDERATION_POLL_INTERVAL_MS=5000
 *   PCT_FEDERATION_PEERS_0=http://peer-a:8080
 *   PCT_JOURNAL_BACKEND=memory
 *   PCT_JOURNAL_DATABASE=pct-registry
 */
export const PactConfigSchema = Schema.Struct({
  node: Schema.Struct({
    /** Optional public URL the node advertises in its Manifest. */
    url: Schema.optional(Schema.String),
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
    /** Enable Flow B manifest-pull federation in `pact serve`. */
    enabled: Schema.Boolean,
    /** Peer polling interval in milliseconds. */
    pollIntervalMs: Schema.Int,
    /** Peer base URLs to add when the server starts. */
    peers: Schema.Array(Schema.String),
  }),
  journal: Schema.Struct({
    /** EventJournal backend. `indexeddb` is for runtimes with IndexedDB. */
    backend: Schema.Literals(["memory", "indexeddb"]),
    /** Optional database name for indexeddb backend. */
    database: Schema.optional(Schema.String),
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
  server: { port: 8080, host: "127.0.0.1" },
  client: { baseUrl: "http://localhost:8080" },
  federation: { enabled: false, pollIntervalMs: 5000, peers: [] },
  journal: { backend: "memory" },
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
