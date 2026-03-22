/**
 * @file Internal symbols for Fermion type branding
 * @module @tmnl/fermion/internal/symbols
 */

/** Type brand symbol for Fermion instances */
export const FermionTypeId: unique symbol = Symbol.for("@tmnl/fermion/Fermion")
export type FermionTypeId = typeof FermionTypeId

/** Type brand symbol for CompositeKey instances */
export const CompositeKeyTypeId: unique symbol = Symbol.for("@tmnl/fermion/CompositeKey")
export type CompositeKeyTypeId = typeof CompositeKeyTypeId
