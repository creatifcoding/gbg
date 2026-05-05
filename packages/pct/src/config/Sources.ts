/**
 * Configuration sources — discovery and stacking.
 *
 * Defines WHERE config can come from and the precedence among them.
 * Each source returns either:
 *   - a `ConfigProvider` populated with values from that source, OR
 *   - an empty provider (when the file is absent) so `orElse` falls
 *     through cleanly to the next source.
 *
 * # Precedence (highest wins, per-key)
 *
 *   1. Process environment variables (PCT_*)
 *   2. Explicit `--config <path>` (CLI flag)
 *   3. Project-local: nearest `pact.config.json` walking up from cwd
 *   4. User-level:    $XDG_CONFIG_HOME/pact/config.json
 *   5. System-level:  /etc/pact/config.json
 *   6. Built-in defaults (Reference.defaultValue)
 *
 * # Per-key resolution
 *
 * Each level may supply a *partial* config. `ConfigProvider.orElse`
 * queries each in order; the first to return a value for a given
 * path wins. Unspecified keys fall through to defaults.
 *
 * # `--config` semantics
 *
 * When supplied: REPLACES sources 3-5 entirely. Env still applies
 * on top. This is the "I told you exactly which file to use" mode.
 *
 * # Project-local discovery
 *
 * Walks up from cwd, stopping at:
 *   - first `pact.config.json` found (success)
 *   - first directory containing `.git` (project root reached)
 *   - filesystem root (no project config)
 *
 * @module @tmnl/pct/config/Sources
 */

import * as ConfigProvider from "effect-v4/ConfigProvider"
import * as Effect from "effect-v4/Effect"
import * as FileSystem from "effect-v4/FileSystem"
import * as Option from "effect-v4/Option"
import * as Path from "effect-v4/Path"
import * as Str from "effect-v4/String"

// ─── Path transformation ───────────────────────────────────────────────────

/**
 * Transform a Config path into the env-var name space:
 *   1. prepend "PCT"
 *   2. uppercase each string segment, replacing non-alphanumeric with `_`
 *
 * Done inline (rather than via ConfigProvider.constantCase + nested)
 * because `ConfigProvider.orElse` uses `self.get` (raw) and bypasses
 * `mapInput`/`prefix`. Baking the transformation into a custom
 * provider's `get` function is the only way to survive `orElse`.
 */
const envPathFor = (path: ConfigProvider.Path): ConfigProvider.Path => [
  "PCT",
  ...path.map((seg) => (typeof seg === "number" ? seg : Str.constantCase(seg))),
]

// ─── Constants ──────────────────────────────────────────────────────────────

export const CONFIG_FILENAME = "pact.config.json"

/**
 * Empty provider — yields nothing for every path. Used when a source
 * is absent so `orElse` falls through cleanly.
 */
const emptyProvider: ConfigProvider.ConfigProvider =
  ConfigProvider.fromUnknown({})

/**
 * Built-in default values — the lowest-precedence source in the chain.
 *
 * Every key required by `PactConfigSchema` MUST appear here so that
 * decoding always succeeds even when no other source is present.
 * Keep in sync with `PactConfig.defaultValue` (used when no layer is
 * installed at all).
 */
export const DEFAULTS_PROVIDER: ConfigProvider.ConfigProvider =
  ConfigProvider.fromUnknown({
    node: {},
    server: { port: 8080, host: "127.0.0.1" },
    client: { baseUrl: "http://localhost:8080" },
  })

// ─── File loaders ───────────────────────────────────────────────────────────

/**
 * Load a single JSON file as a ConfigProvider. Returns an empty
 * provider if the file doesn't exist (so caller can chain via orElse
 * without special-casing absence).
 *
 * Failures other than absence (e.g. malformed JSON, permission denied)
 * surface as typed `PlatformError` / synthetic Error.
 */
export const fromJsonFile = (
  filePath: string,
): Effect.Effect<
  ConfigProvider.ConfigProvider,
  Error,
  FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const exists = yield* fs.exists(filePath)
    if (!exists) return emptyProvider

    const contents = yield* fs.readFileString(filePath).pipe(
      Effect.mapError(
        (cause) =>
          new Error(`pact.config: failed to read ${filePath}: ${cause}`),
      ),
    )

    const parsed = yield* Effect.try({
      try: () => JSON.parse(contents) as unknown,
      catch: (cause) =>
        new Error(
          `pact.config: invalid JSON in ${filePath}: ${String(cause)}`,
        ),
    })

    return ConfigProvider.fromUnknown(parsed)
  })

// ─── Project-local discovery ────────────────────────────────────────────────

const isProjectRootMarker = (
  fs: FileSystem.FileSystem,
  dir: string,
  path: Path.Path,
): Effect.Effect<boolean, never> =>
  fs
    .exists(path.join(dir, ".git"))
    .pipe(Effect.catchCause(() => Effect.succeed(false)))

/**
 * Walk up from `startDir` looking for `pact.config.json`. Stops at:
 *   - first match (returns Some(absolutePath))
 *   - first dir containing `.git` (returns None — repo root reached
 *     without finding config)
 *   - filesystem root (returns None)
 *
 * Pure search; does not read the file.
 */
export const findProjectConfig = (
  startDir: string,
): Effect.Effect<
  Option.Option<string>,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    let dir = path.resolve(startDir)
    // Bound the walk: at most filesystem-depth iterations, but
    // realistically `< 30` for any sensible layout.
    for (let i = 0; i < 64; i++) {
      const candidate = path.join(dir, CONFIG_FILENAME)
      const found = yield* fs
        .exists(candidate)
        .pipe(Effect.catchCause(() => Effect.succeed(false)))
      if (found) return Option.some(candidate)

      const atRoot = yield* isProjectRootMarker(fs, dir, path)
      if (atRoot) return Option.none()

      const parent = path.dirname(dir)
      if (parent === dir) return Option.none() // hit filesystem root
      dir = parent
    }
    return Option.none()
  })

/**
 * Project-local provider. Discovers via `findProjectConfig` from
 * `cwd`; loads if found, empty provider otherwise.
 */
export const fromProject = (
  cwd: string,
): Effect.Effect<
  ConfigProvider.ConfigProvider,
  Error,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const found = yield* findProjectConfig(cwd)
    if (Option.isNone(found)) return emptyProvider
    return yield* fromJsonFile(found.value)
  })

// ─── User-level discovery ───────────────────────────────────────────────────

/**
 * XDG-compliant user config path:
 *   $XDG_CONFIG_HOME/pact/config.json  (if XDG_CONFIG_HOME set)
 *   $HOME/.config/pact/config.json     (otherwise)
 *
 * Returns `None` if neither env var resolves to a usable home.
 */
export const userConfigPath = (
  env: ReadonlyMap<string, string>,
): Effect.Effect<Option.Option<string>, never, Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path
    const xdg = env.get("XDG_CONFIG_HOME")
    if (xdg !== undefined && xdg !== "") {
      return Option.some(path.join(xdg, "pact", "config.json"))
    }
    const home = env.get("HOME")
    if (home !== undefined && home !== "") {
      return Option.some(path.join(home, ".config", "pact", "config.json"))
    }
    return Option.none()
  })

/**
 * User-level provider. Looks at XDG-compliant location.
 */
export const fromUser = (
  env: ReadonlyMap<string, string>,
): Effect.Effect<
  ConfigProvider.ConfigProvider,
  Error,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const found = yield* userConfigPath(env)
    if (Option.isNone(found)) return emptyProvider
    return yield* fromJsonFile(found.value)
  })

// ─── System-level ───────────────────────────────────────────────────────────

export const SYSTEM_CONFIG_PATH = "/etc/pact/config.json"

export const fromSystem = (): Effect.Effect<
  ConfigProvider.ConfigProvider,
  Error,
  FileSystem.FileSystem
> => fromJsonFile(SYSTEM_CONFIG_PATH)

// ─── Stacking ───────────────────────────────────────────────────────────────

export interface StackOptions {
  /** Working directory for project-local discovery. Defaults to `process.cwd()`. */
  readonly cwd?: string
  /** Process env (string-keyed). Used both for env-var lookups and HOME/XDG. */
  readonly env?: ReadonlyMap<string, string>
  /**
   * Explicit config path (from `--config` CLI flag). When set:
   *   - replaces project/user/system file lookups
   *   - env vars still apply on top
   */
  readonly explicitFile?: string
}

/**
 * Build the stacked ConfigProvider per the precedence rules above.
 *
 * Returns a single provider. Yielding a `Config<T>` against it
 * performs per-key resolution top-down through the chain.
 */
export const stack = (
  options: StackOptions = {},
): Effect.Effect<
  ConfigProvider.ConfigProvider,
  Error,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const env = options.env ?? new Map<string, string>()
    const cwd = options.cwd ?? "."

    // Build the provider chain bottom-up so we can fold left-to-right
    // with `orElse(next)` calls — env at the head means env wins.
    //
    // The env provider's path transformation (PCT prefix + CONSTANT_CASE)
    // is baked into a custom `make` because ConfigProvider.orElse uses
    // self.get (raw) and bypasses pipe-applied mapInput/prefix.
    const rawEnv = ConfigProvider.fromEnv({ env: Object.fromEntries(env) })
    const envProvider = ConfigProvider.make((path) =>
      rawEnv.get(envPathFor(path)),
    )

    // File chain (in precedence order, head wins per orElse semantics)
    let fileChain: ConfigProvider.ConfigProvider
    if (options.explicitFile !== undefined) {
      // --config replaces project/user/system entirely
      fileChain = yield* fromJsonFile(options.explicitFile)
    } else {
      const project = yield* fromProject(cwd)
      const user = yield* fromUser(env)
      const system = yield* fromSystem()
      // project > user > system
      fileChain = project.pipe(
        ConfigProvider.orElse(user),
        ConfigProvider.orElse(system),
      )
    }

    // env > files > defaults
    return envProvider.pipe(
      ConfigProvider.orElse(fileChain),
      ConfigProvider.orElse(DEFAULTS_PROVIDER),
    )
  })
