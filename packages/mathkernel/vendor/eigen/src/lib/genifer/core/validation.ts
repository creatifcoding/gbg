/**
 * @fileoverview Field validation system with Effect
 *
 * Uses Effect for:
 * - Composable validation pipelines
 * - Error accumulation (all errors vs first error)
 * - Async validation support
 * - Integration with visibility conditions
 *
 * ALL functions return Effects!
 */

import { Effect } from "effect"
import type { DataModel } from "./schemas"
import { ValidationCheck, ValidationConfig } from "./schemas"
import { resolveDynamicValue } from "./path"
import { evaluateLogicExpression } from "./visibility"

// =============================================================================
// Types
// =============================================================================

/** Validation function signature - returns Effect */
export type ValidationFunction = (
  value: unknown,
  args?: Record<string, unknown>
) => Effect.Effect<boolean, never>

/** Sync validation function (for built-ins) */
export type SyncValidationFunction = (
  value: unknown,
  args?: Record<string, unknown>
) => boolean

/** Validation check result */
export interface ValidationCheckResult {
  readonly fn: string
  readonly valid: boolean
  readonly message: string
}

/** Full validation result */
export interface ValidationResult {
  readonly valid: boolean
  readonly errors: readonly string[]
  readonly checks: readonly ValidationCheckResult[]
}

/** Context for running validation */
export interface ValidationContext {
  readonly value: unknown
  readonly dataModel: DataModel
  readonly customFunctions?: Record<string, SyncValidationFunction>
  readonly authState?: { isSignedIn: boolean }
}

// =============================================================================
// Built-in Validation Functions
// =============================================================================

export const builtInValidationFunctions: Record<string, SyncValidationFunction> = {
  /**
   * Check if value is not null, undefined, or empty string
   */
  required: (value: unknown) => {
    if (value === null || value === undefined) return false
    if (typeof value === "string") return value.trim().length > 0
    if (Array.isArray(value)) return value.length > 0
    return true
  },

  /**
   * Check if value is a valid email address
   */
  email: (value: unknown) => {
    if (typeof value !== "string") return false
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  },

  /**
   * Check minimum string length
   */
  minLength: (value: unknown, args?: Record<string, unknown>) => {
    if (typeof value !== "string") return false
    const min = args?.["min"]
    if (typeof min !== "number") return false
    return value.length >= min
  },

  /**
   * Check maximum string length
   */
  maxLength: (value: unknown, args?: Record<string, unknown>) => {
    if (typeof value !== "string") return false
    const max = args?.["max"]
    if (typeof max !== "number") return false
    return value.length <= max
  },

  /**
   * Check if string matches a regex pattern
   */
  pattern: (value: unknown, args?: Record<string, unknown>) => {
    if (typeof value !== "string") return false
    const pattern = args?.["pattern"]
    if (typeof pattern !== "string") return false
    try {
      return new RegExp(pattern).test(value)
    } catch {
      return false
    }
  },

  /**
   * Check minimum numeric value
   */
  min: (value: unknown, args?: Record<string, unknown>) => {
    if (typeof value !== "number") return false
    const min = args?.["min"]
    if (typeof min !== "number") return false
    return value >= min
  },

  /**
   * Check maximum numeric value
   */
  max: (value: unknown, args?: Record<string, unknown>) => {
    if (typeof value !== "number") return false
    const max = args?.["max"]
    if (typeof max !== "number") return false
    return value <= max
  },

  /**
   * Check if value is a number
   */
  numeric: (value: unknown) => {
    if (typeof value === "number") return !isNaN(value)
    if (typeof value === "string") return !isNaN(parseFloat(value))
    return false
  },

  /**
   * Check if value is a valid URL
   */
  url: (value: unknown) => {
    if (typeof value !== "string") return false
    try {
      new URL(value)
      return true
    } catch {
      return false
    }
  },

  /**
   * Check if value matches another field
   */
  matches: (value: unknown, args?: Record<string, unknown>) => {
    const other = args?.["other"]
    return value === other
  },

  /**
   * Check if value is in a list
   */
  oneOf: (value: unknown, args?: Record<string, unknown>) => {
    const options = args?.["options"]
    if (!Array.isArray(options)) return false
    return options.includes(value)
  },

  /**
   * Check if value is a valid phone number (basic)
   */
  phone: (value: unknown) => {
    if (typeof value !== "string") return false
    return /^[\d\s\-+()]{7,}$/.test(value)
  },

  /**
   * Check if value is alphanumeric
   */
  alphanumeric: (value: unknown) => {
    if (typeof value !== "string") return false
    return /^[a-zA-Z0-9]+$/.test(value)
  }
}

// =============================================================================
// Validation Execution
// =============================================================================

/**
 * Run a single validation check - returns Effect
 */
export const runValidationCheck = (
  check: ValidationCheck,
  ctx: ValidationContext
): Effect.Effect<ValidationCheckResult, never> =>
  Effect.gen(function* () {
    const { value, dataModel, customFunctions } = ctx

    // Resolve args
    const resolvedArgs: Record<string, unknown> = {}
    if (check.args) {
      for (const [key, argValue] of Object.entries(check.args)) {
        resolvedArgs[key] = yield* resolveDynamicValue(argValue, dataModel)
      }
    }

    // Find the validation function
    const fn = builtInValidationFunctions[check.fn] ?? customFunctions?.[check.fn]

    if (!fn) {
      console.warn(`Unknown validation function: ${check.fn}`)
      return {
        fn: check.fn,
        valid: true, // Don't fail on unknown functions
        message: check.message
      }
    }

    const valid = fn(value, resolvedArgs)

    return {
      fn: check.fn,
      valid,
      message: check.message
    }
  })

/**
 * Run all validation checks for a field - returns Effect
 */
export const runValidation = (
  config: ValidationConfig,
  ctx: ValidationContext
): Effect.Effect<ValidationResult, never> =>
  Effect.gen(function* () {
    // Check if validation is enabled
    if (config.enabled) {
      const enabled = yield* evaluateLogicExpression(config.enabled, {
        dataModel: ctx.dataModel,
        authState: ctx.authState
      })
      if (!enabled) {
        return { valid: true, errors: [], checks: [] }
      }
    }

    // Run each check
    const checks: ValidationCheckResult[] = []
    const errors: string[] = []

    for (const check of config.checks) {
      const result = yield* runValidationCheck(check, ctx)
      checks.push(result)
      if (!result.valid) {
        errors.push(result.message)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      checks
    }
  })

/**
 * Run validation (sync version for immediate feedback)
 */
export const runValidationSync = (
  config: ValidationConfig,
  ctx: ValidationContext
): ValidationResult => Effect.runSync(runValidation(config, ctx))

/**
 * Run all validations and accumulate errors - returns Effect
 */
export const runAllValidations = (
  configs: Array<{ path: string; config: ValidationConfig; value: unknown }>,
  dataModel: DataModel,
  customFunctions?: Record<string, SyncValidationFunction>
): Effect.Effect<Map<string, ValidationResult>, never> =>
  Effect.gen(function* () {
    const results = new Map<string, ValidationResult>()

    for (const { path, config, value } of configs) {
      const result = yield* runValidation(config, {
        value,
        dataModel,
        customFunctions
      })
      results.set(path, result)
    }

    return results
  })

// =============================================================================
// Validation Helpers (Builder Pattern - returns Effects)
// =============================================================================

export const checkBuilder = {
  required: (message = "This field is required"): Effect.Effect<ValidationCheck, never> =>
    Effect.succeed(new ValidationCheck({ fn: "required", message })),

  email: (message = "Invalid email address"): Effect.Effect<ValidationCheck, never> =>
    Effect.succeed(new ValidationCheck({ fn: "email", message })),

  minLength: (min: number, message?: string): Effect.Effect<ValidationCheck, never> =>
    Effect.succeed(new ValidationCheck({
      fn: "minLength",
      args: { min } as any,
      message: message ?? `Must be at least ${min} characters`
    })),

  maxLength: (max: number, message?: string): Effect.Effect<ValidationCheck, never> =>
    Effect.succeed(new ValidationCheck({
      fn: "maxLength",
      args: { max } as any,
      message: message ?? `Must be at most ${max} characters`
    })),

  pattern: (pattern: string, message = "Invalid format"): Effect.Effect<ValidationCheck, never> =>
    Effect.succeed(new ValidationCheck({
      fn: "pattern",
      args: { pattern } as any,
      message
    })),

  min: (min: number, message?: string): Effect.Effect<ValidationCheck, never> =>
    Effect.succeed(new ValidationCheck({
      fn: "min",
      args: { min } as any,
      message: message ?? `Must be at least ${min}`
    })),

  max: (max: number, message?: string): Effect.Effect<ValidationCheck, never> =>
    Effect.succeed(new ValidationCheck({
      fn: "max",
      args: { max } as any,
      message: message ?? `Must be at most ${max}`
    })),

  url: (message = "Invalid URL"): Effect.Effect<ValidationCheck, never> =>
    Effect.succeed(new ValidationCheck({ fn: "url", message })),

  matches: (otherPath: string, message = "Fields must match"): Effect.Effect<ValidationCheck, never> =>
    Effect.succeed(new ValidationCheck({
      fn: "matches",
      args: { other: { path: otherPath } } as any,
      message
    })),

  oneOf: (options: unknown[], message = "Invalid selection"): Effect.Effect<ValidationCheck, never> =>
    Effect.succeed(new ValidationCheck({
      fn: "oneOf",
      args: { options } as any,
      message
    })),

  phone: (message = "Invalid phone number"): Effect.Effect<ValidationCheck, never> =>
    Effect.succeed(new ValidationCheck({ fn: "phone", message })),

  alphanumeric: (message = "Must be alphanumeric"): Effect.Effect<ValidationCheck, never> =>
    Effect.succeed(new ValidationCheck({ fn: "alphanumeric", message })),

  numeric: (message = "Must be a number"): Effect.Effect<ValidationCheck, never> =>
    Effect.succeed(new ValidationCheck({ fn: "numeric", message }))
}

/**
 * Build a validation config - returns Effect
 */
export const validationBuilder = {
  /** Create validation config with checks */
  withChecks: (checks: ValidationCheck[]): Effect.Effect<ValidationConfig, never> =>
    Effect.succeed(new ValidationConfig({ checks })),

  /** Create validation config with checks and validateOn */
  withValidateOn: (
    checks: ValidationCheck[],
    validateOn: "change" | "blur" | "submit"
  ): Effect.Effect<ValidationConfig, never> =>
    Effect.succeed(new ValidationConfig({ checks, validateOn }))
}
