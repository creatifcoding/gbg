/**
 * @tmnl/tsingou-operators — Custom d2ts Operators
 *
 * Domain-specific operators for signal processing.
 *
 * @module tsingou-flow/operators
 */

export { windowOperator, createSlidingWindow } from './window'
export { throttleOperator, createRateLimiter } from './throttle'
export {
  validateSignal,
  schemaValidateOperator,
  customSchemaValidateOperator,
} from './schema-validate'
export type { ValidationResult } from './schema-validate'
