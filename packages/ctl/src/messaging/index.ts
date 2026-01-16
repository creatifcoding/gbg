/**
 * @gbg/ctl/messaging - Agent-guiding errors and output formatting
 *
 * Provides TaggedError patterns with recovery guidance and skill triggers.
 *
 * @skill cli/messaging
 */

import { Data, Effect } from "effect"
import { Console } from "effect"

// =============================================================================
// ERROR CODES
// =============================================================================

export const ErrorCode = {
  NOT_FOUND: "NOT_FOUND",
  INVALID_INPUT: "INVALID_INPUT",
  CONFLICT: "CONFLICT",
  PERMISSION: "PERMISSION",
  DEPENDENCY: "DEPENDENCY",
  NETWORK: "NETWORK",
  SKILL_MISSING: "SKILL_MISSING",
  INTERNAL: "INTERNAL",
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

// =============================================================================
// BASE ERROR INTERFACES
// =============================================================================

export interface RecoveryOption {
  readonly description: string
  readonly command: string
}

export interface SkillReference {
  readonly name: string
  readonly trigger: string
}

// =============================================================================
// TAGGED ERRORS WITH AGENT GUIDANCE
// =============================================================================

/**
 * Resource not found error with recovery guidance
 */
export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly resource: string
  readonly id: string
  readonly suggestion: string
  readonly recoveryOptions: readonly RecoveryOption[]
  readonly skill?: SkillReference
}> {
  override get message() {
    const lines = [
      `[${ErrorCode.NOT_FOUND}] ${this.resource} '${this.id}' not found.`,
      "",
      `AGENT GUIDANCE: ${this.suggestion}`,
      "",
      "RECOVERY OPTIONS:",
      ...this.recoveryOptions.map((r, i) => `  ${i + 1}. ${r.description}: ${r.command}`),
    ]

    if (this.skill) {
      lines.push("", `SKILL: ${this.skill.name}`, `  Trigger: "${this.skill.trigger}"`)
    }

    return lines.join("\n")
  }
}

/**
 * Invalid input error with expected format
 */
export class InvalidInputError extends Data.TaggedError("InvalidInputError")<{
  readonly field: string
  readonly value: string
  readonly expected: string
  readonly examples: readonly string[]
  readonly skill?: SkillReference
}> {
  override get message() {
    const lines = [
      `[${ErrorCode.INVALID_INPUT}] Invalid value for '${this.field}': "${this.value}"`,
      "",
      `EXPECTED: ${this.expected}`,
      "",
      "VALID EXAMPLES:",
      ...this.examples.map((e) => `  - ${e}`),
      "",
      "FIX: Provide a value matching the expected format.",
    ]

    if (this.skill) {
      lines.push("", `SKILL: ${this.skill.name}`, `  Trigger: "${this.skill.trigger}"`)
    }

    return lines.join("\n")
  }
}

/**
 * Operation not allowed due to state
 */
export class OperationNotAllowedError extends Data.TaggedError("OperationNotAllowedError")<{
  readonly operation: string
  readonly reason: string
  readonly currentState: string
  readonly requiredState: string
  readonly recoveryOptions: readonly RecoveryOption[]
  readonly skill?: SkillReference
}> {
  override get message() {
    const lines = [
      `[${ErrorCode.PERMISSION}] Cannot ${this.operation}.`,
      "",
      `REASON: ${this.reason}`,
      `CURRENT STATE: ${this.currentState}`,
      `REQUIRED STATE: ${this.requiredState}`,
      "",
      "RECOVERY:",
      ...this.recoveryOptions.map((r, i) => `  ${i + 1}. ${r.description}: ${r.command}`),
    ]

    if (this.skill) {
      lines.push("", `SKILL: ${this.skill.name}`, `  Trigger: "${this.skill.trigger}"`)
    }

    return lines.join("\n")
  }
}

/**
 * Missing skill error - guides agent to find/load skill
 */
export class SkillMissingError extends Data.TaggedError("SkillMissingError")<{
  readonly skillName: string
  readonly operation: string
  readonly installPath?: string
  readonly alternativeSkills?: readonly string[]
}> {
  override get message() {
    const lines = [
      `[${ErrorCode.SKILL_MISSING}] Skill '${this.skillName}' required for '${this.operation}'.`,
      "",
      "AGENT GUIDANCE: This operation requires a skill that is not loaded.",
    ]

    if (this.installPath) {
      lines.push("", "INSTALL:", `  Copy skill to: ${this.installPath}`)
    }

    if (this.alternativeSkills?.length) {
      lines.push("", "ALTERNATIVE SKILLS:", ...this.alternativeSkills.map((s) => `  - ${s}`))
    }

    lines.push(
      "",
      "RECOVERY:",
      "  1. Load the required skill",
      `  2. Retry the operation: ${this.operation}`
    )

    return lines.join("\n")
  }
}

/**
 * Database/storage error
 */
export class StorageError extends Data.TaggedError("StorageError")<{
  readonly operation: string
  readonly path: string
  readonly cause: string
  readonly skill?: SkillReference
}> {
  override get message() {
    const lines = [
      `[DATABASE_ERROR] ${this.operation} failed.`,
      "",
      `PATH: ${this.path}`,
      `DETAILS: ${this.cause}`,
      "",
      "RECOVERY:",
      `  1. Check file exists: ls ${this.path}`,
      `  2. Verify permissions: ls -la ${this.path}`,
      "  3. Try reinitializing: <cli> init --force",
    ]

    if (this.skill) {
      lines.push("", `SKILL: ${this.skill.name}`)
    }

    return lines.join("\n")
  }
}

// =============================================================================
// ERROR HANDLER FACTORY
// =============================================================================

export interface ErrorHandlerConfig {
  onNotFound?: (e: NotFoundError) => Effect.Effect<void>
  onInvalidInput?: (e: InvalidInputError) => Effect.Effect<void>
  onOperationNotAllowed?: (e: OperationNotAllowedError) => Effect.Effect<void>
  onSkillMissing?: (e: SkillMissingError) => Effect.Effect<void>
  onStorage?: (e: StorageError) => Effect.Effect<void>
  onUnknown?: (e: unknown) => Effect.Effect<void>
}

/**
 * Create a centralized error handler with customizable behavior
 */
export const createErrorHandler =
  (config: ErrorHandlerConfig = {}) =>
  (e: unknown): Effect.Effect<void> => {
    if (e instanceof NotFoundError) {
      return config.onNotFound?.(e) ?? Console.error(e.message)
    }
    if (e instanceof InvalidInputError) {
      return config.onInvalidInput?.(e) ?? Console.error(e.message)
    }
    if (e instanceof OperationNotAllowedError) {
      return config.onOperationNotAllowed?.(e) ?? Console.error(e.message)
    }
    if (e instanceof SkillMissingError) {
      return config.onSkillMissing?.(e) ?? Console.error(e.message)
    }
    if (e instanceof StorageError) {
      return config.onStorage?.(e) ?? Console.error(e.message)
    }

    // Unknown errors
    const msg = e instanceof Error ? e.message : String(e)
    return (
      config.onUnknown?.(e) ??
      Console.error(`[${ErrorCode.INTERNAL}] Unexpected error: ${msg}`)
    )
  }

// =============================================================================
// OUTPUT FORMATTING
// =============================================================================

export interface ColumnDef<T> {
  readonly key: keyof T
  readonly header: string
  readonly width?: number
}

/**
 * Format data as a table
 */
export const formatTable = <T extends Record<string, unknown>>(
  items: readonly T[],
  columns: readonly ColumnDef<T>[]
): string => {
  if (items.length === 0) {
    return "No items found."
  }

  // Calculate widths
  const widths = columns.map((col) => {
    const maxContent = Math.max(
      col.header.length,
      ...items.map((item) => String(item[col.key] ?? "").length)
    )
    return col.width ?? Math.min(maxContent, 40)
  })

  // Header
  const header = columns.map((col, i) => col.header.padEnd(widths[i])).join("  ")

  const separator = widths.map((w) => "─".repeat(w)).join("──")

  // Rows
  const rows = items.map((item) =>
    columns
      .map((col, i) => {
        const val = String(item[col.key] ?? "")
        return val.length > widths[i] ? val.slice(0, widths[i] - 1) + "…" : val.padEnd(widths[i])
      })
      .join("  ")
  )

  return [header, separator, ...rows].join("\n")
}

/**
 * Format success message with next steps
 */
export const formatSuccess = (
  action: string,
  details: Record<string, string>,
  nextSteps?: readonly string[]
): string => {
  const lines = [`[SUCCESS] ${action}`, ""]

  for (const [key, value] of Object.entries(details)) {
    lines.push(`  ${key}: ${value}`)
  }

  if (nextSteps?.length) {
    lines.push("", "NEXT STEPS:")
    nextSteps.forEach((step, i) => lines.push(`  ${i + 1}. ${step}`))
  }

  return lines.join("\n")
}
