/**
 * Shell Logging — Public API.
 *
 * Effect Logger → Tauri IPC → Rust → journald.
 *
 * @example Add to a runtime atom
 * ```ts
 * import { ShellLoggerLive } from '@/lib/getbyshell/logging'
 *
 * export const myRuntimeAtom = Atom.runtime(
 *   Layer.mergeAll(MyService.Default, ShellLoggerLive)
 * )
 * ```
 *
 * @example Provide to an Effect program
 * ```ts
 * import { ShellLoggerDebug } from '@/lib/getbyshell/logging'
 *
 * const traced = myEffect.pipe(
 *   Effect.withSpan('my-operation'),
 *   Effect.provide(ShellLoggerDebug),
 * )
 * ```
 */

export {
  shellLogger,
  shellLoggerBatched,
  shellLoggerImmediate,
  ShellLoggerLive,
  ShellLoggerDebug,
} from './logger'

export type { ShellLogLevel, ShellLogEntry, ShellLogBatch } from './types'
