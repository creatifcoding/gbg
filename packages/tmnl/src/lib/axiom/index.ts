/**
 * Axiom v2
 *
 * Effect-native ontology definitions for Palantir OSDK.
 *
 * Define schemas with Effect Schema.TaggedClass, wrap with ObjectType.from(),
 * and compose into an Ontology service.
 *
 * @example
 * ```typescript
 * import { Schema, Effect } from "effect"
 * import { Ontology, ObjectType, Target } from "@/lib/axiom"
 *
 * // 1. Define pure Effect Schemas
 * class Department extends Schema.TaggedClass<Department>()("Department", {
 *   id: Schema.String.pipe(Schema.brand("DepartmentId")),
 *   name: Schema.NonEmptyString,
 *   budget: Schema.optionFromNullable(Schema.Number),
 * }) {}
 *
 * class Employee extends Schema.TaggedClass<Employee>()("Employee", {
 *   employeeId: Schema.String.pipe(Schema.brand("EmployeeId")),
 *   fullName: Schema.NonEmptyString,
 *   departmentId: Schema.String,
 * }) {}
 *
 * // 2. Create Ontology Service
 * class MyOntology extends Ontology<MyOntology>()("com.mycompany.", {
 *   objects: {
 *     Department: ObjectType.from(Department, {
 *       primaryKey: "id",
 *       title: "name",
 *       displayName: "Department",
 *     }),
 *     Employee: ObjectType.from(Employee, {
 *       primaryKey: "employeeId",
 *       title: "fullName",
 *       links: {
 *         department: {
 *           target: () => Department,
 *           cardinality: "many-to-one",
 *           foreignKey: "departmentId",
 *         },
 *       },
 *     }),
 *   },
 * }) {}
 *
 * // 3. Compile to targets
 * const program = Effect.gen(function* () {
 *   const ontology = yield* MyOntology
 *   yield* Target.OaC.scaffold(ontology, "./my-ontology")
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(MyOntology.Default)))
 * ```
 *
 * @module
 */

// =============================================================================
// Core - Ontology & ObjectType
// =============================================================================

export { Ontology } from "./ontology"
export type {
  OntologyConfig,
  OntologyShape,
  OntologyClass,
  MissingSelfGeneric,
  OntologyNamespace,
  OntologyConfigOf,
  OntologyObjectNames,
  OntologyObject,
} from "./ontology"

export { ObjectType } from "./object-type"
export type {
  ObjectTypeDef,
  ObjectTypeConfig,
  LinkConfig,
  LinkCardinality,
  InferObjectType,
  InferSchema,
} from "./object-type"

// =============================================================================
// Links
// =============================================================================

export { resolveLinks, groupLinksBySource, getInverseLinks, isResolvedLink } from "./link"
export type { ResolvedLink } from "./link"

// =============================================================================
// Targets
// =============================================================================

export { Target } from "./targets"
export type {
  OSDKPropertyType,
  OSDKPropertyDef,
  OSDKStructDef,
  OSDKObjectDefinition,
  OSDKLinkMetadata,
  OSDKLinkDefinition,
} from "./targets"

// =============================================================================
// Errors
// =============================================================================

export {
  AxiomCompileError,
  MissingPrimaryKeyError,
  InvalidFieldTypeError,
  CircularReferenceError,
  LinkTargetNotFoundError,
  InvalidCardinalityError,
  SchemaValidationError,
} from "./errors"

export type { CompileError } from "./errors"
