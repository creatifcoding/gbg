/**
 * schemaValidate — Schema validation operator.
 *
 * Validates signals against Effect.Schema at the operator level.
 * Rejects invalid entries (filters them out). Logs validation errors.
 *
 * When d2ts is installed, this extends UnaryOperator.
 * For now: pure function using Effect.Schema.decodeUnknownSync.
 *
 * @module tsingou-flow/operators/schema-validate
 */

import { Schema, Either } from 'effect'
import type { BaseSignal } from '../schemas/base-signal'
import { BaseSignal as BaseSignalSchema } from '../schemas/base-signal'

/**
 * Validation result for a single signal.
 */
export interface ValidationResult {
  readonly valid: boolean
  readonly signal: BaseSignal
  readonly errors?: ReadonlyArray<string>
}

/**
 * Validate a signal against BaseSignal schema.
 * Returns the signal if valid, null if invalid.
 */
export const validateSignal = (signal: unknown): ValidationResult => {
  const result = Schema.decodeUnknownEither(BaseSignalSchema)(signal)

  if (Either.isRight(result)) {
    return { valid: true, signal: result.right }
  }

  return {
    valid: false,
    signal: signal as BaseSignal,
    errors: [`Schema validation failed`],
  }
}

/**
 * Create a schema validation operator.
 * Filters a batch of signals, keeping only valid ones.
 *
 * @param onInvalid - Optional callback for invalid signals (logging, metrics)
 *
 * @example
 * ```typescript
 * const validate = schemaValidateOperator({
 *   onInvalid: (result) => console.warn('Invalid signal:', result.errors),
 * })
 * const validSignals = validate(batch)
 * ```
 */
export const schemaValidateOperator = (options?: {
  readonly onInvalid?: (result: ValidationResult) => void
}) => {
  return (signals: ReadonlyArray<unknown>): ReadonlyArray<BaseSignal> => {
    const results: BaseSignal[] = []

    for (const signal of signals) {
      const result = validateSignal(signal)
      if (result.valid) {
        results.push(result.signal)
      } else {
        options?.onInvalid?.(result)
      }
    }

    return results
  }
}

/**
 * Validate signals against a custom schema (for runtime-registered types).
 *
 * @param schema - Effect.Schema to validate against
 * @param onInvalid - Optional callback
 */
export const customSchemaValidateOperator = <A>(
  schema: Schema.Schema<A>,
  onInvalid?: (value: unknown, errors: string[]) => void,
) => {
  return (values: ReadonlyArray<unknown>): ReadonlyArray<A> => {
    const results: A[] = []

    for (const value of values) {
      const result = Schema.decodeUnknownEither(schema)(value)
      if (Either.isRight(result)) {
        results.push(result.right)
      } else {
        onInvalid?.(value, ['Schema validation failed'])
      }
    }

    return results
  }
}
