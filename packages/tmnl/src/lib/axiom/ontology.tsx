/**
 * Ontology - Effect.Service-style factory for ontology definitions
 *
 * Models the entire ontology as an Effect Service with compile-time
 * targets for OSDK, GraphQL, etc.
 *
 * @example
 * ```typescript
 * import { Schema, Effect } from "effect"
 * import { Ontology, ObjectType, Target } from "@/lib/axiom"
 *
 * // Define schemas
 * class Department extends Schema.TaggedClass<Department>()("Department", {
 *   id: Schema.String.pipe(Schema.brand("DepartmentId")),
 *   name: Schema.NonEmptyString,
 * }) {}
 *
 * // Create ontology
 * class MyOntology extends Ontology<MyOntology>()("com.mycompany.", {
 *   objects: {
 *     Department: ObjectType.from(Department, {
 *       primaryKey: "id",
 *       title: "name",
 *     }),
 *   },
 * }) {}
 *
 * // Use in Effect
 * const program = Effect.gen(function* () {
 *   const ontology = yield* MyOntology
 *   console.log(ontology.namespace)
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(MyOntology.Default)))
 * ```
 */

import { Context, Layer } from "effect"
import type { ObjectTypeDef } from "./object-type"
import { resolveLinks, type ResolvedLink } from "./link"

// =============================================================================
// Ontology Configuration
// =============================================================================

/**
 * Configuration for an Ontology definition
 */
export interface OntologyConfig {
  /** Object type definitions */
  readonly objects: Record<string, ObjectTypeDef>
}

// =============================================================================
// OntologyShape - Runtime representation
// =============================================================================

/**
 * Runtime shape of an Ontology instance
 */
export interface OntologyShape<
  Namespace extends string = string,
  Config extends OntologyConfig = OntologyConfig,
> {
  /** Foundry namespace (e.g., "com.mycompany.") */
  readonly namespace: Namespace
  /** Object type definitions as Map */
  readonly objects: ReadonlyMap<string, ObjectTypeDef>
  /** Original config object (for typed access) */
  readonly config: Config
  /** Resolved links between object types */
  readonly links: readonly ResolvedLink[]
  /** Get object names */
  readonly objectNames: readonly string[]
  /** Get an object by name */
  readonly getObject: (name: string) => ObjectTypeDef | undefined
}

// =============================================================================
// MissingSelfGeneric Error Type
// =============================================================================

/**
 * Error type shown when Self generic is missing
 */
export interface MissingSelfGeneric {
  readonly _tag: "MissingSelfGeneric"
  readonly message: "You must provide the Self type parameter: Ontology<YourClassName>()"
}

// =============================================================================
// Ontology Class Type
// =============================================================================

/**
 * The class returned by the Ontology factory
 */
export interface OntologyClass<
  Self,
  Namespace extends string,
  Config extends OntologyConfig,
> {
  new (): OntologyShape<Namespace, Config>

  /** Context.Tag for dependency injection */
  readonly Tag: Context.Tag<Self, OntologyShape<Namespace, Config>>

  /** Default Layer that provides this ontology */
  readonly Default: Layer.Layer<Self>

  /** The namespace string */
  readonly namespace: Namespace

  /** Access the config at the type level */
  readonly _config: Config
}

// =============================================================================
// Ontology Factory
// =============================================================================

/**
 * Create an Ontology Service using Effect.Service-style pattern.
 *
 * The double-call pattern `Ontology<Self>()("namespace", config)` follows
 * Effect's convention for self-referential types.
 *
 * @example
 * ```typescript
 * class MyOntology extends Ontology<MyOntology>()("com.mycompany.", {
 *   objects: {
 *     Department: ObjectType.from(Department, { primaryKey: "id" }),
 *     Employee: ObjectType.from(Employee, { primaryKey: "employeeId" }),
 *   },
 * }) {}
 *
 * // Access as Effect Service
 * const program = Effect.gen(function* () {
 *   const ontology = yield* MyOntology
 *   for (const name of ontology.objectNames) {
 *     console.log(name)
 *   }
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(MyOntology.Default)))
 * ```
 */
export const Ontology = <Self = never>(): [Self] extends [never]
  ? MissingSelfGeneric
  : <const Namespace extends string, const Config extends OntologyConfig>(
      namespace: Namespace,
      config: Config
    ) => OntologyClass<Self, Namespace, Config> => {
  // Return the factory function
  return (<const Namespace extends string, const Config extends OntologyConfig>(
    namespace: Namespace,
    config: Config
  ): OntologyClass<Self, Namespace, Config> => {
    // Build the objects Map
    const objectsMap = new Map<string, ObjectTypeDef>(
      globalThis.Object.entries(config.objects)
    )

    // Resolve links
    const links = resolveLinks(objectsMap)

    // Create the ontology shape
    const shape: OntologyShape<Namespace, Config> = {
      namespace,
      objects: objectsMap,
      config,
      links,
      objectNames: globalThis.Object.keys(config.objects),
      getObject: (name: string) => objectsMap.get(name),
    }

    // Create Context.Tag using Context.GenericTag
    const tag = Context.GenericTag<Self, OntologyShape<Namespace, Config>>(
      `Ontology/${namespace}`
    )

    // Create a function class following Effect.Service pattern
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function OntologyImpl(_service?: OntologyShape<Namespace, Config>) {
      return shape
    }

    // Get the tag's prototype (which has Symbol.iterator from EffectPrototype)
    // and copy all its properties onto OntologyImpl
    const tagProto = globalThis.Object.getPrototypeOf(tag)
    globalThis.Object.assign(OntologyImpl, tagProto)

    // Also copy properties from the tag itself
    globalThis.Object.assign(OntologyImpl, tag)

    // Set our static properties
    ;(OntologyImpl as any).Tag = tag
    ;(OntologyImpl as any).namespace = namespace
    ;(OntologyImpl as any)._config = config
    ;(OntologyImpl as any).key = `Ontology/${namespace}`

    // Override the Default Layer to provide our shape
    globalThis.Object.defineProperty(OntologyImpl, "Default", {
      get() {
        return Layer.succeed(tag, shape as any)
      },
      configurable: true,
    })

    return OntologyImpl as unknown as OntologyClass<Self, Namespace, Config>
  }) as any
}

// =============================================================================
// Type Utilities
// =============================================================================

/**
 * Extract the namespace from an Ontology class
 */
export type OntologyNamespace<T> = T extends OntologyClass<any, infer N, any>
  ? N
  : never

/**
 * Extract the config from an Ontology class
 */
export type OntologyConfigOf<T> = T extends OntologyClass<any, any, infer C>
  ? C
  : never

/**
 * Extract object names from an Ontology class
 */
export type OntologyObjectNames<T> = T extends OntologyClass<
  any,
  any,
  infer C
>
  ? keyof C["objects"]
  : never

/**
 * Extract a specific ObjectTypeDef from an Ontology class
 */
export type OntologyObject<
  T,
  Name extends OntologyObjectNames<T>,
> = T extends OntologyClass<any, any, infer C>
  ? Name extends keyof C["objects"]
    ? C["objects"][Name]
    : never
  : never
