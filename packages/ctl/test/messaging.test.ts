/**
 * Messaging Module Tests
 *
 * Tests for agent-guiding errors and output formatting
 */

import { describe, it, expect, vi } from "vitest"
import { it as effectIt } from "@effect/vitest"
import { Effect, Console } from "effect"
import {
  ErrorCode,
  NotFoundError,
  InvalidInputError,
  OperationNotAllowedError,
  SkillMissingError,
  StorageError,
  createErrorHandler,
  formatTable,
  formatSuccess,
} from "../src/messaging/index.js"

describe("ErrorCode", () => {
  it("has all expected error codes", () => {
    expect(ErrorCode.NOT_FOUND).toBe("NOT_FOUND")
    expect(ErrorCode.INVALID_INPUT).toBe("INVALID_INPUT")
    expect(ErrorCode.CONFLICT).toBe("CONFLICT")
    expect(ErrorCode.PERMISSION).toBe("PERMISSION")
    expect(ErrorCode.DEPENDENCY).toBe("DEPENDENCY")
    expect(ErrorCode.NETWORK).toBe("NETWORK")
    expect(ErrorCode.SKILL_MISSING).toBe("SKILL_MISSING")
    expect(ErrorCode.INTERNAL).toBe("INTERNAL")
  })
})

describe("NotFoundError", () => {
  it("formats message with error code and recovery options", () => {
    const error = new NotFoundError({
      resource: "Session",
      id: "abc123",
      suggestion: "Check the session ID and try again",
      recoveryOptions: [
        { description: "List sessions", command: "rs list" },
        { description: "Create new session", command: "rs new" },
      ],
    })

    expect(error.message).toContain("[NOT_FOUND]")
    expect(error.message).toContain("Session")
    expect(error.message).toContain("abc123")
    expect(error.message).toContain("AGENT GUIDANCE:")
    expect(error.message).toContain("RECOVERY OPTIONS:")
    expect(error.message).toContain("rs list")
    expect(error.message).toContain("rs new")
  })

  it("includes SKILL section when provided", () => {
    const error = new NotFoundError({
      resource: "Session",
      id: "abc123",
      suggestion: "Check the session ID",
      recoveryOptions: [],
      skill: {
        name: "cli/persistence",
        trigger: "SQLite storage",
      },
    })

    expect(error.message).toContain("SKILL: cli/persistence")
    expect(error.message).toContain("SQLite storage")
  })
})

describe("InvalidInputError", () => {
  it("includes expected format and examples", () => {
    const error = new InvalidInputError({
      field: "status",
      value: "invalid",
      expected: "One of: open, closed, in_progress",
      examples: ["open", "closed", "in_progress"],
    })

    expect(error.message).toContain("[INVALID_INPUT]")
    expect(error.message).toContain("status")
    expect(error.message).toContain("invalid")
    expect(error.message).toContain("EXPECTED:")
    expect(error.message).toContain("VALID EXAMPLES:")
    expect(error.message).toContain("open")
  })

  it("includes skill when provided", () => {
    const error = new InvalidInputError({
      field: "status",
      value: "invalid",
      expected: "One of: open, closed",
      examples: ["open", "closed"],
      skill: {
        name: "cli/core",
        trigger: "CLI patterns",
      },
    })

    expect(error.message).toContain("SKILL: cli/core")
  })
})

describe("OperationNotAllowedError", () => {
  it("shows current and required state", () => {
    const error = new OperationNotAllowedError({
      operation: "archive session",
      reason: "Session has uncommitted changes",
      currentState: "modified",
      requiredState: "clean",
      recoveryOptions: [{ description: "Commit changes", command: "rs commit" }],
    })

    expect(error.message).toContain("[PERMISSION]")
    expect(error.message).toContain("archive session")
    expect(error.message).toContain("CURRENT STATE: modified")
    expect(error.message).toContain("REQUIRED STATE: clean")
    expect(error.message).toContain("RECOVERY:")
  })
})

describe("SkillMissingError", () => {
  it("includes install path and alternatives", () => {
    const error = new SkillMissingError({
      skillName: "cli/custom",
      operation: "custom command",
      installPath: ".claude/skills/custom/",
      alternativeSkills: ["cli/core", "cli/messaging"],
    })

    expect(error.message).toContain("[SKILL_MISSING]")
    expect(error.message).toContain("cli/custom")
    expect(error.message).toContain("custom command")
    expect(error.message).toContain("INSTALL:")
    expect(error.message).toContain(".claude/skills/custom/")
    expect(error.message).toContain("ALTERNATIVE SKILLS:")
    expect(error.message).toContain("cli/core")
  })
})

describe("StorageError", () => {
  it("shows path and recovery steps", () => {
    const error = new StorageError({
      operation: "INSERT",
      path: "/path/to/db.sqlite",
      cause: "SQLITE_CONSTRAINT",
    })

    expect(error.message).toContain("[DATABASE_ERROR]")
    expect(error.message).toContain("INSERT failed")
    expect(error.message).toContain("PATH: /path/to/db.sqlite")
    expect(error.message).toContain("DETAILS: SQLITE_CONSTRAINT")
    expect(error.message).toContain("RECOVERY:")
  })
})

describe("createErrorHandler", () => {
  effectIt.effect("routes NotFoundError to handler", () =>
    Effect.gen(function* () {
      let called = false
      const handler = createErrorHandler({
        onNotFound: () => {
          called = true
          return Effect.void
        },
      })

      const error = new NotFoundError({
        resource: "Test",
        id: "123",
        suggestion: "test",
        recoveryOptions: [],
      })

      yield* handler(error)
      expect(called).toBe(true)
    })
  )

  effectIt.effect("routes InvalidInputError to handler", () =>
    Effect.gen(function* () {
      let called = false
      const handler = createErrorHandler({
        onInvalidInput: () => {
          called = true
          return Effect.void
        },
      })

      const error = new InvalidInputError({
        field: "test",
        value: "bad",
        expected: "good",
        examples: ["good"],
      })

      yield* handler(error)
      expect(called).toBe(true)
    })
  )

  effectIt.effect("routes OperationNotAllowedError to handler", () =>
    Effect.gen(function* () {
      let called = false
      const handler = createErrorHandler({
        onOperationNotAllowed: () => {
          called = true
          return Effect.void
        },
      })

      const error = new OperationNotAllowedError({
        operation: "test",
        reason: "test",
        currentState: "a",
        requiredState: "b",
        recoveryOptions: [],
      })

      yield* handler(error)
      expect(called).toBe(true)
    })
  )

  effectIt.effect("routes SkillMissingError to handler", () =>
    Effect.gen(function* () {
      let called = false
      const handler = createErrorHandler({
        onSkillMissing: () => {
          called = true
          return Effect.void
        },
      })

      const error = new SkillMissingError({
        skillName: "test",
        operation: "test",
      })

      yield* handler(error)
      expect(called).toBe(true)
    })
  )

  effectIt.effect("routes StorageError to handler", () =>
    Effect.gen(function* () {
      let called = false
      const handler = createErrorHandler({
        onStorage: () => {
          called = true
          return Effect.void
        },
      })

      const error = new StorageError({
        operation: "test",
        path: "/test",
        cause: "test",
      })

      yield* handler(error)
      expect(called).toBe(true)
    })
  )

  effectIt.effect("routes unknown errors to onUnknown", () =>
    Effect.gen(function* () {
      let called = false
      const handler = createErrorHandler({
        onUnknown: () => {
          called = true
          return Effect.void
        },
      })

      yield* handler(new Error("random error"))
      expect(called).toBe(true)
    })
  )
})

describe("formatTable", () => {
  it("returns 'No items found.' for empty array", () => {
    const result = formatTable([], [{ key: "id", header: "ID" }])
    expect(result).toBe("No items found.")
  })

  it("formats columns with headers", () => {
    const items = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ]
    const columns = [
      { key: "id" as const, header: "ID" },
      { key: "name" as const, header: "Name" },
    ]

    const result = formatTable(items, columns)

    expect(result).toContain("ID")
    expect(result).toContain("Name")
    expect(result).toContain("Alice")
    expect(result).toContain("Bob")
    expect(result).toContain("─")
  })

  it("truncates long values", () => {
    const items = [{ value: "a".repeat(100) }]
    const columns = [{ key: "value" as const, header: "Value", width: 10 }]

    const result = formatTable(items, columns)

    expect(result).toContain("…")
    expect(result.length).toBeLessThan(200)
  })
})

describe("formatSuccess", () => {
  it("formats action with details", () => {
    const result = formatSuccess("Created session", {
      ID: "abc123",
      Status: "open",
    })

    expect(result).toContain("[SUCCESS]")
    expect(result).toContain("Created session")
    expect(result).toContain("ID: abc123")
    expect(result).toContain("Status: open")
  })

  it("includes numbered next steps when provided", () => {
    const result = formatSuccess(
      "Session archived",
      { ID: "abc123" },
      ["Run rs list to see remaining sessions", "Create a new session with rs new"]
    )

    expect(result).toContain("NEXT STEPS:")
    expect(result).toContain("1. Run rs list")
    expect(result).toContain("2. Create a new session")
  })
})
