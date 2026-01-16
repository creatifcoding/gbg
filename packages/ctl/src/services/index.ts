/**
 * @gbg/ctl/services - Effect.Service patterns for CLI infrastructure
 *
 * Provides service definition patterns and common CLI services.
 *
 * @skill cli/services
 */

import { FileSystem, Path } from "@effect/platform"
import { Context, Effect, Layer, Ref } from "effect"
import { Console } from "effect"

// =============================================================================
// LOGGER SERVICE
// =============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error"

interface LoggerShape {
  readonly debug: (msg: string) => Effect.Effect<void>
  readonly info: (msg: string) => Effect.Effect<void>
  readonly warn: (msg: string) => Effect.Effect<void>
  readonly error: (msg: string) => Effect.Effect<void>
}

export class Logger extends Context.Tag("@gbg/ctl/Logger")<Logger, LoggerShape>() {}

const LOG_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"]

/**
 * Create a logger layer with configurable level
 */
export const LoggerLive = (minLevel: LogLevel = "info") =>
  Layer.succeed(Logger, {
    debug: (msg) =>
      LOG_LEVELS.indexOf("debug") >= LOG_LEVELS.indexOf(minLevel)
        ? Console.log(`[DEBUG] ${msg}`)
        : Effect.void,
    info: (msg) =>
      LOG_LEVELS.indexOf("info") >= LOG_LEVELS.indexOf(minLevel)
        ? Console.log(`[INFO] ${msg}`)
        : Effect.void,
    warn: (msg) =>
      LOG_LEVELS.indexOf("warn") >= LOG_LEVELS.indexOf(minLevel)
        ? Console.warn(`[WARN] ${msg}`)
        : Effect.void,
    error: (msg) =>
      LOG_LEVELS.indexOf("error") >= LOG_LEVELS.indexOf(minLevel)
        ? Console.error(`[ERROR] ${msg}`)
        : Effect.void,
  })

// =============================================================================
// OUTPUT SERVICE
// =============================================================================

interface OutputServiceShape {
  readonly print: (text: string) => Effect.Effect<void>
  readonly json: <T>(data: T, pretty?: boolean) => Effect.Effect<void>
  readonly raw: (text: string) => Effect.Effect<void>
}

export class OutputService extends Context.Tag("@gbg/ctl/OutputService")<
  OutputService,
  OutputServiceShape
>() {}

export const OutputServiceLive = Layer.succeed(OutputService, {
  print: (text) => Console.log(text),
  json: (data, pretty = true) =>
    Console.log(pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data)),
  raw: (text) => Effect.sync(() => { process.stdout.write(text) }),
})

// =============================================================================
// FILE MANAGER SERVICE
// =============================================================================

export interface FileError {
  readonly _tag: "FileError"
  readonly path: string
  readonly operation: string
  readonly cause: string
}

export const FileError = (path: string, operation: string, cause: string): FileError => ({
  _tag: "FileError",
  path,
  operation,
  cause,
})

interface FileManagerShape {
  readonly read: (path: string) => Effect.Effect<string, FileError>
  readonly write: (path: string, content: string) => Effect.Effect<void, FileError>
  readonly exists: (path: string) => Effect.Effect<boolean, FileError>
  readonly ensureDir: (path: string) => Effect.Effect<void, FileError>
  readonly remove: (path: string) => Effect.Effect<void, FileError>
}

export class FileManager extends Context.Tag("@gbg/ctl/FileManager")<
  FileManager,
  FileManagerShape
>() {}

export const FileManagerLive = Layer.effect(
  FileManager,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    return {
      read: (filePath: string) =>
        fs.readFileString(filePath).pipe(
          Effect.mapError((e) => FileError(filePath, "read", e.message))
        ),

      write: (filePath: string, content: string) =>
        Effect.gen(function* () {
          yield* fs.makeDirectory(path.dirname(filePath), { recursive: true }).pipe(
            Effect.catchAll(() => Effect.void)
          )
          yield* fs.writeFileString(filePath, content)
        }).pipe(Effect.mapError((e) => FileError(filePath, "write", String(e)))),

      exists: (filePath: string) =>
        fs.exists(filePath).pipe(
          Effect.mapError((e) => FileError(filePath, "exists", e.message))
        ),

      ensureDir: (dirPath: string) =>
        fs.makeDirectory(dirPath, { recursive: true }).pipe(
          Effect.mapError((e) => FileError(dirPath, "ensureDir", e.message))
        ),

      remove: (filePath: string) =>
        fs.remove(filePath).pipe(
          Effect.mapError((e) => FileError(filePath, "remove", e.message))
        ),
    }
  })
)

// =============================================================================
// STATE SERVICE (with Ref)
// =============================================================================

export interface StateService<S> {
  readonly get: Effect.Effect<S>
  readonly set: (s: S) => Effect.Effect<void>
  readonly update: (f: (s: S) => S) => Effect.Effect<void>
  readonly modify: <A>(f: (s: S) => readonly [A, S]) => Effect.Effect<A>
}

/**
 * Create a stateful service using Ref
 */
export const createStateService = <S>(
  tag: Context.Tag<any, StateService<S>>,
  initial: S
) => ({
  tag,
  live: Layer.effect(
    tag,
    Effect.gen(function* () {
      const ref = yield* Ref.make(initial)
      return {
        get: Ref.get(ref),
        set: (s: S) => Ref.set(ref, s),
        update: (f: (s: S) => S) => Ref.update(ref, f),
        modify: <A>(f: (s: S) => readonly [A, S]) => Ref.modify(ref, f),
      }
    })
  ),
})

// =============================================================================
// SERVICE ACCESSORS PATTERN
// =============================================================================

/**
 * Create accessor functions for a service
 */
export const createAccessors = <S, T extends Record<string, (...args: any[]) => Effect.Effect<any>>>(
  tag: Context.Tag<S, T>
) => {
  type Accessors = {
    [K in keyof T]: T[K] extends (...args: infer A) => Effect.Effect<infer R, infer E>
      ? (...args: A) => Effect.Effect<R, E>
      : never
  }

  return new Proxy({} as Accessors, {
    get: (_, key: string) => {
      return (...args: unknown[]) =>
        Effect.flatMap(tag, (svc) => (svc as any)[key](...args))
    },
  })
}

// =============================================================================
// LAYER COMPOSITION HELPERS
// =============================================================================

/**
 * Merge multiple layers into one
 */
export const mergeLayers = Layer.mergeAll

/**
 * Provide a layer to an effect
 */
export const provideLayer = Effect.provide

// =============================================================================
// RE-EXPORTS
// =============================================================================

export { Console, Context, Effect, Layer, Option, Ref } from "effect"
export { FileSystem, Path } from "@effect/platform"
