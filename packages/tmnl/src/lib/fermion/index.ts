/**
 * @file Fermion - Schema-Driven Atom.family Library
 * @module @tmnl/fermion
 *
 * Fermion provides a type-safe, schema-driven approach to creating
 * memoized atom families with Effect-based CRUD operations.
 *
 * The name "Fermion" comes from the fundamental particles that obey
 * the Pauli exclusion principle - no two fermions can share the same
 * quantum state. This maps to Atom.family memoization where each key
 * gets exactly one atom.
 *
 * @example Basic Usage
 * ```ts
 * import { Schema, Effect, Duration } from "effect"
 * import * as Fermion from "@/lib/fermion"
 * import { useAtomValue } from "@effect-atom/atom-react"
 *
 * // 1. Define schema
 * const UserSchema = Schema.Struct({
 *   id: Schema.String.pipe(Schema.brand("UserId")),
 *   name: Schema.NonEmptyString,
 *   email: Schema.String,
 * })
 *
 * // 2. Build family
 * const userFamily = Fermion.fromSchema(UserSchema)
 *   .withKey("id")
 *   .withFetch((id) =>
 *     Effect.tryPromise(() => fetch(`/api/users/${id}`).then(r => r.json()))
 *   )
 *   .withTTL(Duration.minutes(5))
 *   .build()
 *
 * // 3. Use in React
 * function UserProfile({ userId }: { userId: string }) {
 *   const userResult = useAtomValue(userFamily(userId))
 *
 *   useEffect(() => {
 *     userFamily.fetch(userId).pipe(Effect.runPromise)
 *   }, [userId])
 *
 *   return Result.match(userResult, {
 *     onInitial: () => <Loading />,
 *     onSuccess: (user) => <div>{user.name}</div>,
 *     onFailure: (error) => <Error error={error} />,
 *   })
 * }
 * ```
 *
 * @example Composite Keys
 * ```ts
 * const OrderSchema = Schema.Struct({
 *   userId: Schema.String.pipe(Schema.brand("UserId")),
 *   orderId: Schema.String.pipe(Schema.brand("OrderId")),
 *   items: Schema.Array(OrderItemSchema),
 * })
 *
 * const orderFamily = Fermion.fromSchema(OrderSchema)
 *   .withCompositeKey(["userId", "orderId"])
 *   .withFetch(({ userId, orderId }) =>
 *     Effect.tryPromise(() =>
 *       fetch(`/api/users/${userId}/orders/${orderId}`).then(r => r.json())
 *     )
 *   )
 *   .build()
 *
 * // Usage
 * const orderAtom = orderFamily({ userId: "u-1", orderId: "o-42" })
 * ```
 *
 * @example With Service Layers
 * ```ts
 * const userFamily = Fermion.fromSchema(UserSchema)
 *   .withKey("id")
 *   .withFetch((id) =>
 *     Effect.gen(function* () {
 *       const api = yield* UserApi
 *       return yield* api.fetchUser(id)
 *     })
 *   )
 *   .provideLayer(UserApiLive)
 *   .provideLayer(HttpClient.layer)
 *   .build()
 * ```
 */

// ============================================================================
// Main Builder API
// ============================================================================

export {
  fromSchema,
  make,
  FermionBuilder,
} from "./Fermion"

// ============================================================================
// Types
// ============================================================================

export type {
  Fermion,
  FermionConfig,
  KeyOf,
  KeyType,
  CompositeKeyType,
} from "./types"

// ============================================================================
// Algebra
// ============================================================================

export {
  type FermionAlgebra,
  makeFermionAlgebraTag,
  FermionAlgebraService,
  makeAlgebra,
  composeAlgebra,
  withHooks,
} from "./algebra"

// ============================================================================
// Interpreters
// ============================================================================

export {
  // Effect-based
  fromFunctions,
  fromFetch,
  fromCrud,
  // Memory-based
  makeMemoryAlgebra,
  makeSimpleMemoryAlgebra,
  NotFoundError,
} from "./interpreters"

// ============================================================================
// Internal Utilities (for advanced usage)
// ============================================================================

export {
  makeCompositeKey,
  extractKey,
  serializeKey,
  isCompositeKey,
} from "./internal/keys"

export { FermionTypeId } from "./internal/symbols"
