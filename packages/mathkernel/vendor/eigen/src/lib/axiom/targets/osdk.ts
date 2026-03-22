/**
 * Axiom OSDK Target
 *
 * Compiles Axiom schemas to Palantir OSDK definitions.
 * Output is compatible with @osdk/maker API.
 *
 * This is the handler interpretation of the free algebra:
 * compileToOSDK : Free(EffectSig) → IO(OSDKDefinition)
 */

import { Effect } from "effect"
import type { ObjectSchema, LinkType, LinkCardinality } from "../object"
import { isLink } from "../object"
import {
  isPrimaryKey,
  isTitle,
  isNullable,
  hasDisplayName,
  hasDescription,
} from "../modifiers"
import {
  MissingPrimaryKeyError,
  InvalidFieldTypeError,
  type CompileError,
} from "../errors"
import type { FieldRecord } from "../types"

// Note: @osdk/maker types are used at runtime via dynamic import
// Type definitions are handled internally by the maker package

// =============================================================================
// OSDK Output Types
// =============================================================================

/**
 * OSDK property types
 */
export type OSDKPropertyType =
  | "string"
  | "integer"
  | "decimal"
  | "boolean"
  | "date"
  | "timestamp"
  | "geopoint"
  | "geoshape"
  | "mediaReference"

/**
 * OSDK property definition (matches @osdk/maker)
 */
export interface OSDKPropertyDef {
  readonly type: OSDKPropertyType | OSDKStructDef
  readonly displayName?: string
  readonly description?: string
  readonly nullable?: boolean
  readonly array?: boolean
}

/**
 * OSDK struct definition (nested object)
 */
export interface OSDKStructDef {
  readonly type: "struct"
  readonly structDefinition: Record<string, OSDKPropertyDef | string>
}

/**
 * OSDK object type definition (matches @osdk/maker defineObject)
 */
export interface OSDKObjectDefinition {
  readonly apiName: string
  readonly displayName: string
  readonly pluralDisplayName: string
  readonly description?: string
  readonly primaryKeyPropertyApiName: string
  readonly titlePropertyApiName: string
  readonly properties: Record<string, OSDKPropertyDef>
}

/**
 * OSDK link metadata
 */
export interface OSDKLinkMetadata {
  readonly apiName: string
  readonly displayName: string
  readonly pluralDisplayName: string
  readonly visibility?: "NORMAL" | "HIDDEN" | "PROMINENT"
}

/**
 * OSDK link definition (matches @osdk/maker defineLink)
 */
export interface OSDKLinkDefinition {
  readonly apiName: string
  readonly one?: {
    readonly object: OSDKObjectDefinition
    readonly metadata: OSDKLinkMetadata
  }
  readonly toOne?: {
    readonly object: OSDKObjectDefinition
    readonly metadata: OSDKLinkMetadata
  }
  readonly toMany?: {
    readonly object: OSDKObjectDefinition
    readonly metadata: OSDKLinkMetadata
  }
  readonly manyForeignKeyProperty?: string
}

// =============================================================================
// Type-Level Projections
// =============================================================================

/**
 * Type-level mapping from Axiom field type to OSDK property type
 */
export type ToOSDKPropertyType<F> = F extends { _tag: "String" }
  ? "string"
  : F extends { _tag: "Int" }
    ? "integer"
    : F extends { _tag: "Number" }
      ? "decimal"
      : F extends { _tag: "Decimal" }
        ? "decimal"
        : F extends { _tag: "Boolean" }
          ? "boolean"
          : F extends { _tag: "Date" }
            ? "date"
            : F extends { _tag: "DateTimeUtc" }
              ? "timestamp"
              : F extends { _tag: "Timestamp" }
                ? "timestamp"
                : F extends { _tag: "GeoPoint" }
                  ? "geopoint"
                  : F extends { _tag: "GeoShape" }
                    ? "geoshape"
                    : F extends { _tag: "MediaReference" }
                      ? "mediaReference"
                      : never

// =============================================================================
// Runtime Type Mapping
// =============================================================================

/**
 * Map Axiom field tag to OSDK property type at runtime
 */
const mapToOSDKType = (field: { _tag: string }): OSDKPropertyType => {
  switch (field._tag) {
    case "String":
      return "string"
    case "Int":
      return "integer"
    case "Number":
    case "Decimal":
      return "decimal"
    case "Boolean":
      return "boolean"
    case "Date":
      return "date"
    case "DateTimeUtc":
    case "Timestamp":
      return "timestamp"
    case "GeoPoint":
      return "geopoint"
    case "GeoShape":
      return "geoshape"
    case "MediaReference":
      return "mediaReference"
    default:
      throw new Error(`Unknown field type: ${field._tag}`)
  }
}

/**
 * Build OSDK property definition from Axiom field
 */
const buildPropertyDef = (
  field: Record<string, unknown>
): OSDKPropertyDef | null => {
  // Skip links - they're handled separately
  if (field._tag === "Link") {
    return null
  }

  // Handle array types
  if (field._tag === "Array") {
    const item = field._item as Record<string, unknown>
    const itemDef = buildPropertyDef(item)
    if (!itemDef) return null
    return {
      ...itemDef,
      array: true,
    }
  }

  // Handle struct types
  if (field._tag === "Struct") {
    const fields = field._fields as Record<string, Record<string, unknown>>
    const structDef: Record<string, OSDKPropertyDef | string> = {}

    for (const [key, subField] of globalThis.Object.entries(fields)) {
      const subDef = buildPropertyDef(subField)
      if (subDef) {
        structDef[key] = subDef
      }
    }

    return {
      type: { type: "struct", structDefinition: structDef },
      ...(isNullable(field) && { nullable: true }),
      ...(hasDisplayName(field) && { displayName: field._displayName }),
      ...(hasDescription(field) && { description: field._description }),
    }
  }

  // Handle primitive types
  return {
    type: mapToOSDKType(field as { _tag: string }),
    ...(isNullable(field) && { nullable: true }),
    ...(hasDisplayName(field) && { displayName: field._displayName }),
    ...(hasDescription(field) && { description: field._description }),
  }
}

// =============================================================================
// Compiler
// =============================================================================

/**
 * Compile an Axiom schema to OSDK object definition.
 *
 * This is the handler interpretation: Schema → Effect<OSDKObjectDefinition, CompileError>
 *
 * @example
 * ```ts
 * const Person = A.Object("Person", {
 *   id: A.String.pipe(A.primaryKey),
 *   name: A.String.pipe(A.title),
 * })
 *
 * const result = yield* compileToOSDK(Person)
 * // { apiName: "Person", properties: {...}, primaryKeyPropertyApiName: "id" }
 * ```
 */
export const compileToOSDK = <
  Name extends string,
  Fields extends FieldRecord,
>(
  schema: ObjectSchema<Name, Fields>
): Effect.Effect<OSDKObjectDefinition, CompileError> => {
  const fields = schema._fields as Record<string, Record<string, unknown>>
  const properties: Record<string, OSDKPropertyDef> = {}

  let primaryKeyApiName: string | undefined
  let titlePropertyApiName: string | undefined

  // Process each field
  for (const [key, field] of globalThis.Object.entries(fields)) {
    // Skip links
    if (isLink(field)) {
      continue
    }

    // Build property definition
    const propDef = buildPropertyDef(field)
    if (propDef) {
      properties[key] = propDef
    }

    // Track primary key
    if (isPrimaryKey(field)) {
      primaryKeyApiName = key
    }

    // Track title
    if (isTitle(field)) {
      titlePropertyApiName = key
    }
  }

  // Validate primary key exists
  if (!primaryKeyApiName) {
    return Effect.fail(
      new MissingPrimaryKeyError({ schemaName: schema._name })
    )
  }

  // Build the OSDK definition
  const displayName = schema._metadata?.displayName ?? schema._name
  const pluralDisplayName =
    schema._metadata?.pluralDisplayName ?? `${schema._name}s`

  return Effect.succeed({
    apiName: schema._name,
    displayName,
    pluralDisplayName,
    ...(schema._metadata?.description && {
      description: schema._metadata.description,
    }),
    primaryKeyPropertyApiName: primaryKeyApiName,
    titlePropertyApiName: titlePropertyApiName ?? primaryKeyApiName,
    properties,
  })
}

/**
 * Compile multiple Axiom schemas to OSDK definitions
 */
export const compileAllToOSDK = <S extends ObjectSchema<string, FieldRecord>>(
  schemas: readonly S[]
): Effect.Effect<OSDKObjectDefinition[], CompileError> =>
  Effect.all(schemas.map(compileToOSDK))

// =============================================================================
// Link Compiler (for defineLink output)
// =============================================================================

/**
 * Extract link definitions from an Axiom schema.
 * Returns metadata for each link field.
 */
export const extractLinks = <Name extends string, Fields extends FieldRecord>(
  schema: ObjectSchema<Name, Fields>,
  objectDefs: Map<string, OSDKObjectDefinition>
): Effect.Effect<OSDKLinkDefinition[], CompileError> => {
  const fields = schema._fields as Record<string, Record<string, unknown>>
  const links: OSDKLinkDefinition[] = []

  for (const [key, field] of globalThis.Object.entries(fields)) {
    if (!isLink(field)) continue

    const linkField = field as unknown as LinkType<unknown, LinkCardinality>
    const targetSchema = linkField._target() as ObjectSchema<string, FieldRecord>
    const targetDef = objectDefs.get(targetSchema._name)

    if (!targetDef) {
      // Target not yet compiled - skip for now
      continue
    }

    const cardinality = linkField._cardinality
    const apiName = `${schema._name}To${targetSchema._name}`

    const linkDef: OSDKLinkDefinition = {
      apiName,
    }

    // Set up the relationship based on cardinality
    // Note: For simplicity, we use the pre-compiled objectDefs
    // instead of re-compiling inside this function
    switch (cardinality) {
      case "one-to-one": {
        const sourceDef = objectDefs.get(schema._name)
        if (sourceDef) {
          globalThis.Object.assign(linkDef, {
            one: {
              object: sourceDef,
              metadata: {
                apiName: key,
                displayName: key,
                pluralDisplayName: key,
              },
            },
            toOne: {
              object: targetDef,
              metadata: {
                apiName: targetSchema._name.toLowerCase(),
                displayName: targetSchema._name,
                pluralDisplayName: `${targetSchema._name}s`,
              },
            },
          })
        }
        break
      }

      case "many-to-one": {
        const sourceDef = objectDefs.get(schema._name)
        if (sourceDef) {
          globalThis.Object.assign(linkDef, {
            one: {
              object: targetDef,
              metadata: {
                apiName: targetSchema._name.toLowerCase(),
                displayName: targetSchema._name,
                pluralDisplayName: `${targetSchema._name}s`,
              },
            },
            toMany: {
              object: sourceDef,
              metadata: {
                apiName: `${schema._name.toLowerCase()}s`,
                displayName: schema._name,
                pluralDisplayName: `${schema._name}s`,
              },
            },
            manyForeignKeyProperty: key,
          })
        }
        break
      }

      case "one-to-many": {
        const sourceDef = objectDefs.get(schema._name)
        if (sourceDef) {
          globalThis.Object.assign(linkDef, {
            one: {
              object: sourceDef,
              metadata: {
                apiName: schema._name.toLowerCase(),
                displayName: schema._name,
                pluralDisplayName: `${schema._name}s`,
              },
            },
            toMany: {
              object: targetDef,
              metadata: {
                apiName: key,
                displayName: targetSchema._name,
                pluralDisplayName: `${targetSchema._name}s`,
              },
            },
          })
        }
        break
      }

      case "many-to-many":
        // Many-to-many requires a join table in OSDK
        // For now, we just note the relationship
        globalThis.Object.assign(linkDef, {
          toMany: {
            object: targetDef,
            metadata: {
              apiName: key,
              displayName: targetSchema._name,
              pluralDisplayName: `${targetSchema._name}s`,
            },
          },
        })
        break
    }

    links.push(linkDef)
  }

  return Effect.succeed(links)
}

// =============================================================================
// Code Generation (for @osdk/maker output)
// =============================================================================

/**
 * Generate @osdk/maker defineObject() code from OSDK definition
 */
export const generateDefineObjectCode = (
  def: OSDKObjectDefinition
): string => {
  const propsCode = globalThis.Object.entries(def.properties)
    .map(([key, prop]) => {
      const typeStr =
        typeof prop.type === "object"
          ? JSON.stringify(prop.type, null, 2)
          : `"${prop.type}"`

      const extras: string[] = []
      if (prop.displayName) extras.push(`displayName: "${prop.displayName}"`)
      if (prop.description) extras.push(`description: "${prop.description}"`)
      if (prop.nullable) extras.push(`nullable: true`)
      if (prop.array) extras.push(`array: true`)

      if (extras.length > 0) {
        return `    "${key}": { type: ${typeStr}, ${extras.join(", ")} }`
      }
      return `    "${key}": { type: ${typeStr} }`
    })
    .join(",\n")

  return `import { defineObject } from "@osdk/maker";

export const ${def.apiName} = defineObject({
  apiName: "${def.apiName}",
  displayName: "${def.displayName}",
  pluralDisplayName: "${def.pluralDisplayName}",${def.description ? `\n  description: "${def.description}",` : ""}
  primaryKeyPropertyApiName: "${def.primaryKeyPropertyApiName}",
  titlePropertyApiName: "${def.titlePropertyApiName}",
  properties: {
${propsCode}
  },
});
`
}

/**
 * Generate a complete @osdk/maker ontology file from multiple Axiom schemas.
 *
 * This generates code that uses defineOntology() as the entry point,
 * which is the standard way to define ontologies for Palantir Foundry.
 *
 * @example
 * ```ts
 * const code = await Effect.runPromise(
 *   generateOntologyFile({
 *     namespace: "com.mycompany.",
 *     outputPath: "./ontology",
 *     schemas: [Department, Employee, Project],
 *   })
 * )
 * ```
 */
export const generateOntologyFile = <S extends ObjectSchema<string, FieldRecord>>(config: {
  namespace: string
  schemas: readonly S[]
  includeLinks?: boolean
}): Effect.Effect<string, CompileError> => {
  const { namespace, schemas, includeLinks = true } = config

  return Effect.flatMap(compileAllToOSDK(schemas), (defs) => {
    // Generate object definitions
    const objectDefs = defs
      .map((def) => {
        const propsCode = globalThis.Object.entries(def.properties)
          .map(([key, prop]) => {
            const typeStr =
              typeof prop.type === "object"
                ? JSON.stringify(prop.type)
                : `"${prop.type}"`

            const extras: string[] = []
            if (prop.displayName) extras.push(`displayName: "${prop.displayName}"`)
            if (prop.nullable) extras.push(`nullable: true`)
            if (prop.array) extras.push(`array: true`)

            if (extras.length > 0) {
              return `      "${key}": { type: ${typeStr}, ${extras.join(", ")} }`
            }
            return `      "${key}": { type: ${typeStr} }`
          })
          .join(",\n")

        return `  const ${def.apiName.toLowerCase()} = defineObject({
    apiName: "${def.apiName}",
    displayName: "${def.displayName}",
    pluralDisplayName: "${def.pluralDisplayName}",
    primaryKeyPropertyApiName: "${def.primaryKeyPropertyApiName}",
    titlePropertyApiName: "${def.titlePropertyApiName}",
    properties: {
${propsCode}
    },
  });`
      })
      .join("\n\n")

    // Generate link definitions if requested
    if (!includeLinks) {
      return Effect.succeed(generateOntologyCode(namespace, objectDefs, ""))
    }

    const objectDefMap = new Map(defs.map((d) => [d.apiName, d]))

    // Collect all link effects
    const linkEffects = schemas.map((schema) =>
      extractLinks(schema as ObjectSchema<string, FieldRecord>, objectDefMap)
    )

    return Effect.map(Effect.all(linkEffects), (allLinks) => {
      let linkDefs = ""
      for (const links of allLinks) {
        for (const link of links) {
          if (link.one && link.toMany) {
            linkDefs += `
  defineLink({
    apiName: "${link.apiName}",
    one: {
      object: ${link.one.object.apiName.toLowerCase()},
      metadata: {
        apiName: "${link.one.metadata.apiName}",
        displayName: "${link.one.metadata.displayName}",
        pluralDisplayName: "${link.one.metadata.pluralDisplayName}",
      },
    },
    toMany: {
      object: ${link.toMany.object.apiName.toLowerCase()},
      metadata: {
        apiName: "${link.toMany.metadata.apiName}",
        displayName: "${link.toMany.metadata.displayName}",
        pluralDisplayName: "${link.toMany.metadata.pluralDisplayName}",
      },
    },${link.manyForeignKeyProperty ? `\n    manyForeignKeyProperty: "${link.manyForeignKeyProperty}",` : ""}
  });
`
          }
        }
      }

      return generateOntologyCode(namespace, objectDefs, linkDefs)
    })
  })
}

const generateOntologyCode = (
  namespace: string,
  objectDefs: string,
  linkDefs: string
): string => `/**
 * Ontology Definition
 *
 * Generated by Axiom Schema Compiler
 * Namespace: ${namespace}
 */

import { defineOntology, defineObject, defineLink } from "@osdk/maker";

await defineOntology("${namespace}", async () => {
  // Object Types
${objectDefs}
${linkDefs ? `\n  // Links${linkDefs}` : ""}
}, "./ontology-output");
`

// =============================================================================
// Direct @osdk/maker Integration
// =============================================================================

/**
 * Execute Axiom schemas through @osdk/maker's defineOntology.
 *
 * This actually runs the ontology definition and generates output files.
 *
 * @example
 * ```ts
 * await Effect.runPromise(
 *   executeOntology({
 *     namespace: "com.mycompany.",
 *     outputPath: "./generated-ontology",
 *     schemas: [Department, Employee],
 *   })
 * )
 * ```
 */
export const executeOntology = <S extends ObjectSchema<string, FieldRecord>>(config: {
  namespace: string
  outputPath: string
  schemas: readonly S[]
}): Effect.Effect<void, CompileError> => {
  const { namespace, outputPath, schemas } = config

  // Import @osdk/maker dynamically
  const importMaker = Effect.tryPromise({
    try: () => import("@osdk/maker"),
    catch: () =>
      new InvalidFieldTypeError({
        field: "@osdk/maker",
        fieldType: "module",
        target: "import",
        reason: "Failed to import @osdk/maker. Is it installed?",
      }),
  })

  return Effect.flatMap(importMaker, (maker) =>
    Effect.flatMap(compileAllToOSDK(schemas), (defs) =>
      Effect.tryPromise({
        try: async () => {
          await maker.defineOntology(
            namespace,
            async () => {
              // Define all objects
              const createdObjects = new Map<
                string,
                ReturnType<typeof maker.defineObject>
              >()

              for (const def of defs) {
                // Convert our properties to @osdk/maker format
                // Use type assertion since @osdk/maker has strict types
                const properties: Record<string, unknown> = {}
                for (const [key, prop] of globalThis.Object.entries(
                  def.properties
                )) {
                  properties[key] = {
                    type: prop.type,
                    ...(prop.nullable && { nullable: true }),
                    ...(prop.array && { array: true }),
                    ...(prop.displayName && { displayName: prop.displayName }),
                  }
                }

                const obj = maker.defineObject({
                  apiName: def.apiName,
                  displayName: def.displayName,
                  pluralDisplayName: def.pluralDisplayName,
                  primaryKeyPropertyApiName: def.primaryKeyPropertyApiName,
                  titlePropertyApiName: def.titlePropertyApiName,
                  // Cast to any to bypass strict @osdk/maker types
                  // Our OSDKPropertyDef is compatible at runtime
                  properties: properties as Parameters<
                    typeof maker.defineObject
                  >[0]["properties"],
                })
                createdObjects.set(def.apiName, obj)
              }

              // Define links
              for (const schema of schemas) {
                const fields = (schema as ObjectSchema<string, FieldRecord>)
                  ._fields as Record<string, Record<string, unknown>>

                for (const [key, field] of globalThis.Object.entries(fields)) {
                  if (!isLink(field)) continue

                  const linkField = field as unknown as LinkType<
                    unknown,
                    LinkCardinality
                  >
                  const targetSchema = linkField._target() as ObjectSchema<
                    string,
                    FieldRecord
                  >
                  const sourceObj = createdObjects.get(schema._name)
                  const targetObj = createdObjects.get(targetSchema._name)

                  if (!sourceObj || !targetObj) continue

                  const cardinality = linkField._cardinality

                  if (
                    cardinality === "many-to-one" ||
                    cardinality === "one-to-many"
                  ) {
                    maker.defineLink({
                      apiName: `${schema._name}To${targetSchema._name}`,
                      one: {
                        object:
                          cardinality === "many-to-one" ? targetObj : sourceObj,
                        metadata: {
                          apiName:
                            cardinality === "many-to-one"
                              ? targetSchema._name.toLowerCase()
                              : schema._name.toLowerCase(),
                          displayName:
                            cardinality === "many-to-one"
                              ? targetSchema._name
                              : schema._name,
                          pluralDisplayName: `${cardinality === "many-to-one" ? targetSchema._name : schema._name}s`,
                        },
                      },
                      toMany: {
                        object:
                          cardinality === "many-to-one" ? sourceObj : targetObj,
                        metadata: {
                          apiName: key,
                          displayName:
                            cardinality === "many-to-one"
                              ? schema._name
                              : targetSchema._name,
                          pluralDisplayName: `${cardinality === "many-to-one" ? schema._name : targetSchema._name}s`,
                        },
                      },
                      ...(cardinality === "many-to-one" && {
                        manyForeignKeyProperty: key,
                      }),
                    })
                  }
                }
              }
            },
            outputPath
          )
        },
        catch: (e) =>
          new InvalidFieldTypeError({
            field: "ontology",
            fieldType: "execution",
            target: "defineOntology",
            reason: `Ontology execution failed: ${e}`,
          }),
      })
    )
  )
}
