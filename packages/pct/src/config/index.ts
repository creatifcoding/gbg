/**
 * @tmnl/pct/config — application configuration service.
 *
 * Effect-Config-backed; reads from a stacked source chain (env vars,
 * project file, user file, system file, defaults) and exposes the
 * resolved value as a `Context.Reference` so server, client, and CLI
 * all see the same config without re-parsing.
 *
 * @module @tmnl/pct/config
 */

export {
  type PactConfigValue,
  PactConfig,
  PactConfigSchema,
  envFromProcess,
  layer,
  layerFromProvider,
  layerFromValue,
} from "./PactConfig.js"

export {
  type StackOptions,
  CONFIG_FILENAME,
  SYSTEM_CONFIG_PATH,
  findProjectConfig,
  fromJsonFile,
  fromProject,
  fromSystem,
  fromUser,
  stack,
  userConfigPath,
} from "./Sources.js"
