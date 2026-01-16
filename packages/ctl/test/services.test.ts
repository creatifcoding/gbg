/**
 * Services Module Tests
 *
 * Tests for Effect.Service patterns
 */

import { describe, it, expect } from "vitest"
import { it as effectIt } from "@effect/vitest"
import { Effect, Layer, Context } from "effect"
import { NodeContext } from "@effect/platform-node"
import { FileSystem } from "@effect/platform"
import {
  Logger,
  LoggerLive,
  OutputService,
  OutputServiceLive,
  FileManager,
  FileManagerLive,
  FileError,
  createStateService,
  mergeLayers,
} from "../src/services/index.js"

describe("Logger", () => {
  effectIt.effect("logs at debug level when minLevel is debug", () =>
    Effect.gen(function* () {
      const logger = yield* Logger
      // Should not throw - just verify it can be called
      yield* logger.debug("test message")
    }).pipe(Effect.provide(LoggerLive("debug")))
  )

  effectIt.effect("logs at info level", () =>
    Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.info("test message")
    }).pipe(Effect.provide(LoggerLive("info")))
  )

  effectIt.effect("logs at warn level", () =>
    Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.warn("test message")
    }).pipe(Effect.provide(LoggerLive("warn")))
  )

  effectIt.effect("logs at error level", () =>
    Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.error("test message")
    }).pipe(Effect.provide(LoggerLive("error")))
  )

  effectIt.effect("respects minimum log level", () =>
    Effect.gen(function* () {
      const logger = yield* Logger
      // When minLevel is "error", debug/info/warn should be no-ops
      yield* logger.debug("should not log")
      yield* logger.info("should not log")
      yield* logger.warn("should not log")
      yield* logger.error("should log")
    }).pipe(Effect.provide(LoggerLive("error")))
  )
})

describe("OutputService", () => {
  effectIt.effect("print outputs text", () =>
    Effect.gen(function* () {
      const output = yield* OutputService
      yield* output.print("Hello, World!")
    }).pipe(Effect.provide(OutputServiceLive))
  )

  effectIt.effect("json outputs formatted JSON", () =>
    Effect.gen(function* () {
      const output = yield* OutputService
      yield* output.json({ key: "value" })
    }).pipe(Effect.provide(OutputServiceLive))
  )

  effectIt.effect("json outputs compact JSON when pretty=false", () =>
    Effect.gen(function* () {
      const output = yield* OutputService
      yield* output.json({ key: "value" }, false)
    }).pipe(Effect.provide(OutputServiceLive))
  )

  effectIt.effect("raw writes directly to stdout", () =>
    Effect.gen(function* () {
      const output = yield* OutputService
      yield* output.raw("raw output")
    }).pipe(Effect.provide(OutputServiceLive))
  )
})

describe("FileManager", () => {
  const TestLayer = Layer.provideMerge(FileManagerLive, NodeContext.layer)

  effectIt.effect("exists returns boolean for file existence", () =>
    Effect.gen(function* () {
      const fm = yield* FileManager
      // Check a known non-existent path
      const exists = yield* fm.exists("/nonexistent/path/xyz123")
      expect(exists).toBe(false)
    }).pipe(Effect.provide(TestLayer))
  )

  effectIt.effect("read fails for non-existent file", () =>
    Effect.gen(function* () {
      const fm = yield* FileManager
      const result = yield* fm.read("/nonexistent/file.txt").pipe(
        Effect.either
      )

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("FileError")
        expect(result.left.operation).toBe("read")
      }
    }).pipe(Effect.provide(TestLayer))
  )

  // Write and ensureDir tests would need a temp directory
  effectIt.scoped("write creates file in temp directory", () =>
    Effect.gen(function* () {
      const fm = yield* FileManager
      const fs = yield* FileSystem.FileSystem

      // Use system temp directory
      const tempDir = `/tmp/ctl-test-${Date.now()}`
      const testFile = `${tempDir}/test.txt`

      yield* fm.write(testFile, "test content")
      const exists = yield* fm.exists(testFile)
      expect(exists).toBe(true)

      const content = yield* fm.read(testFile)
      expect(content).toBe("test content")

      // Cleanup
      yield* fm.remove(testFile)
      yield* fs.remove(tempDir, { recursive: true })
    }).pipe(Effect.provide(TestLayer))
  )
})

describe("FileError", () => {
  it("includes path, operation, and cause", () => {
    const error = FileError("/path/to/file", "read", "ENOENT")

    expect(error._tag).toBe("FileError")
    expect(error.path).toBe("/path/to/file")
    expect(error.operation).toBe("read")
    expect(error.cause).toBe("ENOENT")
  })
})

describe("createStateService", () => {
  interface TestState {
    count: number
  }

  interface TestStateShape {
    readonly get: Effect.Effect<TestState>
    readonly set: (s: TestState) => Effect.Effect<void>
    readonly update: (f: (s: TestState) => TestState) => Effect.Effect<void>
    readonly modify: <A>(f: (s: TestState) => readonly [A, TestState]) => Effect.Effect<A>
  }

  class TestStateService extends Context.Tag("TestState")<
    TestStateService,
    TestStateShape
  >() {}

  const stateService = createStateService(TestStateService, { count: 0 })

  effectIt.effect("get returns current state", () =>
    Effect.gen(function* () {
      const service = yield* stateService.tag
      const state = yield* service.get
      expect(state.count).toBe(0)
    }).pipe(Effect.provide(stateService.live))
  )

  effectIt.effect("set updates state", () =>
    Effect.gen(function* () {
      const service = yield* stateService.tag
      yield* service.set({ count: 5 })
      const state = yield* service.get
      expect(state.count).toBe(5)
    }).pipe(Effect.provide(stateService.live))
  )

  effectIt.effect("update applies function to state", () =>
    Effect.gen(function* () {
      const service = yield* stateService.tag
      yield* service.set({ count: 3 })
      yield* service.update((s) => ({ count: s.count + 2 }))
      const state = yield* service.get
      expect(state.count).toBe(5)
    }).pipe(Effect.provide(stateService.live))
  )

  effectIt.effect("modify extracts value while updating", () =>
    Effect.gen(function* () {
      const service = yield* stateService.tag
      yield* service.set({ count: 10 })
      const oldValue = yield* service.modify((s) => [s.count, { count: s.count + 1 }] as const)
      expect(oldValue).toBe(10)

      const state = yield* service.get
      expect(state.count).toBe(11)
    }).pipe(Effect.provide(stateService.live))
  )
})

describe("mergeLayers", () => {
  it("is exported and is a function", () => {
    expect(mergeLayers).toBeDefined()
    expect(typeof mergeLayers).toBe("function")
  })
})
