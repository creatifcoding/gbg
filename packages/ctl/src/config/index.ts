/**
 * @gbg/ctl/config - Configuration patterns for CLI
 *
 * Provides layered configuration: CLI args > Environment > Config file > Defaults
 *
 * @skill cli/config
 */

import { FileSystem } from "@effect/platform"
import { Config, Context, Effect, Layer, Option } from "effect"
import { Schema } from "effect"

// =============================================================================
// XDG PATHS
// =============================================================================

export const XDG = {
  config: process.env.XDG_CONFIG_HOME ?? `${process.env.HOME}/.config`,
  data: process.env.XDG_DATA_HOME ?? `${process.env.HOME}/.local/share`,
  cache: process.env.XDG_CACHE_HOME ?? `${process.env.HOME}/.cache`,
} as const

// =============================================================================
// APP PATHS SERVICE
// =============================================================================

interface AppPathsShape {
  readonly config: string
  readonly db: string
  readonly cache: string
  readonly logs: string
  readonly skills: string
}

export class AppPaths extends Context.Tag("@gbg/ctl/AppPaths")<AppPaths, AppPathsShape>() {}

/**
 * Create app paths layer for an application
 */
export const AppPathsLive = (appName: string) =>
  Layer.succeed(AppPaths, {
    config: `${XDG.config}/${appName}/config.json`,
    db: `${XDG.data}/${appName}/data.db`,
    cache: `${XDG.cache}/${appName}/`,
    logs: `${XDG.data}/${appName}/logs/`,
    skills: `${XDG.config}/${appName}/skills/`,
  })

// =============================================================================
// CONFIG LOADING
// =============================================================================

export interface ConfigLoadError {
  readonly _tag: "ConfigLoadError"
  readonly path: string
  readonly cause: string
}

export const ConfigLoadError = (path: string, cause: string): ConfigLoadError => ({
  _tag: "ConfigLoadError",
  path,
  cause,
})

/**
 * Load JSON config file with fallback to empty object
 */
export const loadConfigFile = <T>(path: string, schema?: Schema.Schema<T>) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const exists = yield* fs.exists(path)
    if (!exists) {
      return {} as Partial<T>
    }

    const content = yield* fs.readFileString(path).pipe(
      Effect.mapError((e) => ConfigLoadError(path, e.message))
    )

    const json = yield* Effect.try({
      try: () => JSON.parse(content),
      catch: () => ConfigLoadError(path, "Invalid JSON"),
    })

    if (schema) {
      return yield* Schema.decodeUnknown(schema)(json).pipe(
        Effect.mapError((e) => ConfigLoadError(path, `Validation failed: ${e.message}`))
      )
    }

    return json as Partial<T>
  })

/**
 * Save config file
 */
export const saveConfigFile = <T>(path: string, config: T) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const dir = path.substring(0, path.lastIndexOf("/"))

    yield* fs.makeDirectory(dir, { recursive: true }).pipe(Effect.catchAll(() => Effect.void))
    yield* fs.writeFileString(path, JSON.stringify(config, null, 2))
  })

// =============================================================================
// ENVIRONMENT CONFIG
// =============================================================================

/**
 * Load string from environment with optional default
 */
export const envString = (key: string, defaultValue?: string) =>
  defaultValue !== undefined
    ? Config.string(key).pipe(Config.withDefault(defaultValue))
    : Config.string(key)

/**
 * Load boolean from environment with optional default
 */
export const envBoolean = (key: string, defaultValue?: boolean) =>
  defaultValue !== undefined
    ? Config.boolean(key).pipe(Config.withDefault(defaultValue))
    : Config.boolean(key)

/**
 * Load integer from environment with optional default
 */
export const envInteger = (key: string, defaultValue?: number) =>
  defaultValue !== undefined
    ? Config.integer(key).pipe(Config.withDefault(defaultValue))
    : Config.integer(key)

/**
 * Load literal union from environment
 */
export const envLiteral = <T extends readonly [string, ...string[]]>(
  key: string,
  literals: T,
  defaultValue?: T[number]
) =>
  defaultValue !== undefined
    ? Config.literal(...literals)(key).pipe(Config.withDefault(defaultValue as T[number]))
    : Config.literal(...literals)(key)

// =============================================================================
// LAYERED CONFIG PATTERN
// =============================================================================

export interface LayeredConfigOptions<T> {
  readonly envPrefix?: string
  readonly configPath?: string
  readonly defaults: T
  readonly envOverrides?: Partial<Record<keyof T, string>>
}

/**
 * Create a layered configuration loader
 * Priority: CLI args > Environment > Config file > Defaults
 */
export const createLayeredConfig = <T extends Record<string, unknown>>(
  options: LayeredConfigOptions<T>
) =>
  Effect.gen(function* () {
    // Load config file (if path provided)
    const fileConfig = options.configPath
      ? yield* loadConfigFile<Partial<T>>(options.configPath).pipe(
          Effect.catchAll(() => Effect.succeed({} as Partial<T>))
        )
      : ({} as Partial<T>)

    // Merge: defaults < file < env
    const result = { ...options.defaults }

    // Apply file config
    for (const [key, value] of Object.entries(fileConfig)) {
      if (value !== undefined) {
        ;(result as any)[key] = value
      }
    }

    // Apply env overrides
    if (options.envOverrides) {
      for (const [configKey, envKey] of Object.entries(options.envOverrides)) {
        const envValue = process.env[envKey as string]
        if (envValue !== undefined) {
          // Try to parse as JSON for complex types, otherwise use string
          try {
            ;(result as any)[configKey] = JSON.parse(envValue)
          } catch {
            ;(result as any)[configKey] = envValue
          }
        }
      }
    }

    return result
  })

// =============================================================================
// CONFIG SERVICE
// =============================================================================

/**
 * Create a typed config service
 */
export const createConfigService = <T>(tag: Context.Tag<any, ConfigService<T>>) => ({
  tag,
  live: (config: T) =>
    Layer.succeed(
      tag,
      ConfigService.of({
        get: Effect.succeed(config),
        getKey: (key) => Effect.succeed(config[key]),
      })
    ),
})

export interface ConfigService<T> {
  readonly get: Effect.Effect<T>
  readonly getKey: <K extends keyof T>(key: K) => Effect.Effect<T[K]>
}

export const ConfigService = {
  of: <T>(impl: ConfigService<T>): ConfigService<T> => impl,
}

// =============================================================================
// INIT COMMAND HELPER
// =============================================================================

export interface InitConfig<T> {
  readonly appName: string
  readonly defaultConfig: T
  readonly configPath: string
  readonly onSuccess?: (paths: AppPaths) => Effect.Effect<void>
}

/**
 * Create init command logic
 */
export const createInitHandler =
  <T>(initConfig: InitConfig<T>) =>
  (force: boolean) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem

      const exists = yield* fs.exists(initConfig.configPath)
      if (exists && !force) {
        return {
          success: false,
          message: `Config exists at ${initConfig.configPath}. Use --force to overwrite.`,
        }
      }

      // Create directories
      const dir = initConfig.configPath.substring(0, initConfig.configPath.lastIndexOf("/"))
      yield* fs.makeDirectory(dir, { recursive: true }).pipe(Effect.catchAll(() => Effect.void))

      // Write default config
      yield* fs.writeFileString(
        initConfig.configPath,
        JSON.stringify(initConfig.defaultConfig, null, 2)
      )

      return {
        success: true,
        message: `Initialized ${initConfig.appName} configuration at ${initConfig.configPath}`,
      }
    })

// =============================================================================
// RE-EXPORTS
// =============================================================================

export { Config, Schema } from "effect"
