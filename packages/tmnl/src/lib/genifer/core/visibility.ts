/**
 * @fileoverview Visibility evaluation using Effect.Match
 *
 * Evaluates visibility conditions against data model and auth state
 * using exhaustive pattern matching on tagged unions.
 *
 * ALL functions return Effects!
 */

import { Effect, Match, pipe } from "effect"
import type {
  LogicExpression,
  VisibilityCondition,
  DataModel,
  AuthState
} from "./schemas"
import {
  AuthCondition,
  PathCondition,
  EqCondition,
  NeqCondition,
  GtCondition,
  GteCondition,
  LtCondition,
  LteCondition,
  AndCondition,
  OrCondition,
  NotCondition
} from "./schemas"
import { getByPathOrUndefined, resolveDynamicValue } from "./path"

// =============================================================================
// Context
// =============================================================================

export interface VisibilityContext {
  readonly dataModel: DataModel
  readonly authState?: AuthState
}

// =============================================================================
// Logic Expression Evaluation
// =============================================================================

/**
 * Evaluate a logic expression - returns Effect
 */
export const evaluateLogicExpression = (
  expr: LogicExpression,
  ctx: VisibilityContext
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const { dataModel } = ctx

    // Use Match for exhaustive pattern matching
    return yield* pipe(
      Match.value(expr),

      // Path condition - check if truthy
      Match.when(
        (e): e is PathCondition => e._tag === "PathCondition",
        (e) => Effect.gen(function* () {
          const value = yield* getByPathOrUndefined(dataModel, e.path)
          return Boolean(value)
        })
      ),

      // Equality check
      Match.when(
        (e): e is EqCondition => e._tag === "EqCondition",
        (e) => Effect.gen(function* () {
          const left = yield* resolveDynamicValue(e.left, dataModel)
          const right = yield* resolveDynamicValue(e.right, dataModel)
          return left === right
        })
      ),

      // Not equal check
      Match.when(
        (e): e is NeqCondition => e._tag === "NeqCondition",
        (e) => Effect.gen(function* () {
          const left = yield* resolveDynamicValue(e.left, dataModel)
          const right = yield* resolveDynamicValue(e.right, dataModel)
          return left !== right
        })
      ),

      // Greater than
      Match.when(
        (e): e is GtCondition => e._tag === "GtCondition",
        (e) => Effect.gen(function* () {
          const left = yield* resolveDynamicValue(e.left, dataModel)
          const right = yield* resolveDynamicValue(e.right, dataModel)
          return typeof left === "number" && typeof right === "number" && left > right
        })
      ),

      // Greater than or equal
      Match.when(
        (e): e is GteCondition => e._tag === "GteCondition",
        (e) => Effect.gen(function* () {
          const left = yield* resolveDynamicValue(e.left, dataModel)
          const right = yield* resolveDynamicValue(e.right, dataModel)
          return typeof left === "number" && typeof right === "number" && left >= right
        })
      ),

      // Less than
      Match.when(
        (e): e is LtCondition => e._tag === "LtCondition",
        (e) => Effect.gen(function* () {
          const left = yield* resolveDynamicValue(e.left, dataModel)
          const right = yield* resolveDynamicValue(e.right, dataModel)
          return typeof left === "number" && typeof right === "number" && left < right
        })
      ),

      // Less than or equal
      Match.when(
        (e): e is LteCondition => e._tag === "LteCondition",
        (e) => Effect.gen(function* () {
          const left = yield* resolveDynamicValue(e.left, dataModel)
          const right = yield* resolveDynamicValue(e.right, dataModel)
          return typeof left === "number" && typeof right === "number" && left <= right
        })
      ),

      // AND - all conditions must be true (recursive)
      Match.when(
        (e): e is AndCondition => e._tag === "AndCondition",
        (e) => Effect.gen(function* () {
          for (const condition of e.conditions) {
            const result = yield* evaluateLogicExpression(condition, ctx)
            if (!result) return false
          }
          return true
        })
      ),

      // OR - any condition must be true (recursive)
      Match.when(
        (e): e is OrCondition => e._tag === "OrCondition",
        (e) => Effect.gen(function* () {
          for (const condition of e.conditions) {
            const result = yield* evaluateLogicExpression(condition, ctx)
            if (result) return true
          }
          return false
        })
      ),

      // NOT - negate condition (recursive)
      Match.when(
        (e): e is NotCondition => e._tag === "NotCondition",
        (e) => Effect.gen(function* () {
          const result = yield* evaluateLogicExpression(e.condition, ctx)
          return !result
        })
      ),

      Match.exhaustive
    )
  })

// =============================================================================
// Visibility Evaluation
// =============================================================================

/**
 * Evaluate a visibility condition - returns Effect
 */
export const evaluateVisibility = (
  condition: VisibilityCondition | undefined,
  ctx: VisibilityContext
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    // No condition = visible
    if (condition === undefined) {
      return true
    }

    // Boolean literal
    if (typeof condition === "boolean") {
      return condition
    }

    // Auth condition
    if (condition instanceof AuthCondition) {
      const isSignedIn = ctx.authState?.isSignedIn ?? false
      if (condition.auth === "signedIn") {
        return isSignedIn
      }
      if (condition.auth === "signedOut") {
        return !isSignedIn
      }
      return false
    }

    // Logic expression
    return yield* evaluateLogicExpression(condition as LogicExpression, ctx)
  })

/**
 * Evaluate visibility (sync version for React rendering)
 */
export const evaluateVisibilitySync = (
  condition: VisibilityCondition | undefined,
  ctx: VisibilityContext
): boolean => Effect.runSync(evaluateVisibility(condition, ctx))

// =============================================================================
// Visibility Helpers (Builder Pattern)
// =============================================================================

export const visibility = {
  /** Always visible */
  always: true as const,

  /** Never visible */
  never: false as const,

  /** Visible when path is truthy - returns Effect */
  when: (path: string): Effect.Effect<PathCondition, never> =>
    Effect.succeed(new PathCondition({ path })),

  /** Visible when signed in */
  signedIn: Effect.succeed(new AuthCondition({ auth: "signedIn" })),

  /** Visible when signed out */
  signedOut: Effect.succeed(new AuthCondition({ auth: "signedOut" })),

  /** AND multiple conditions - returns Effect */
  and: (...conditions: LogicExpression[]): Effect.Effect<AndCondition, never> =>
    Effect.succeed(new AndCondition({ conditions })),

  /** OR multiple conditions - returns Effect */
  or: (...conditions: LogicExpression[]): Effect.Effect<OrCondition, never> =>
    Effect.succeed(new OrCondition({ conditions })),

  /** NOT a condition - returns Effect */
  not: (condition: LogicExpression): Effect.Effect<NotCondition, never> =>
    Effect.succeed(new NotCondition({ condition })),

  /** Equality check - returns Effect */
  eq: (left: unknown, right: unknown): Effect.Effect<EqCondition, never> =>
    Effect.succeed(new EqCondition({ left: left as any, right: right as any })),

  /** Not equal check - returns Effect */
  neq: (left: unknown, right: unknown): Effect.Effect<NeqCondition, never> =>
    Effect.succeed(new NeqCondition({ left: left as any, right: right as any })),

  /** Greater than - returns Effect */
  gt: (left: number | { path: string }, right: number | { path: string }): Effect.Effect<GtCondition, never> =>
    Effect.succeed(new GtCondition({ left: left as any, right: right as any })),

  /** Greater than or equal - returns Effect */
  gte: (left: number | { path: string }, right: number | { path: string }): Effect.Effect<GteCondition, never> =>
    Effect.succeed(new GteCondition({ left: left as any, right: right as any })),

  /** Less than - returns Effect */
  lt: (left: number | { path: string }, right: number | { path: string }): Effect.Effect<LtCondition, never> =>
    Effect.succeed(new LtCondition({ left: left as any, right: right as any })),

  /** Less than or equal - returns Effect */
  lte: (left: number | { path: string }, right: number | { path: string }): Effect.Effect<LteCondition, never> =>
    Effect.succeed(new LteCondition({ left: left as any, right: right as any })),

  /** Path reference helper */
  path: (p: string) => ({ path: p })
}
