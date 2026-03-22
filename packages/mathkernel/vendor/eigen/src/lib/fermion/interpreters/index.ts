/**
 * @file Interpreter exports for Fermion
 * @module @tmnl/fermion/interpreters
 */

export { fromFunctions, fromFetch, fromCrud } from "./effect"
export {
  makeMemoryAlgebra,
  makeSimpleMemoryAlgebra,
  NotFoundError,
} from "./memory"
