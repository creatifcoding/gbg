/**
 * Axiom Targets
 *
 * Compilation targets for ontology definitions.
 * Converts OntologyShape to various output formats.
 */

import { Effect } from "effect"
import type { OntologyShape } from "../ontology"
import type { ObjectTypeDef } from "../object-type"
import type { CompileError } from "../errors"
import { ScaffoldError as OaCScaffoldError } from "./oac"

// =============================================================================
// OSDK Types (re-export)
// =============================================================================

export type {
  OSDKPropertyType,
  OSDKPropertyDef,
  OSDKStructDef,
  OSDKObjectDefinition,
  OSDKLinkMetadata,
  OSDKLinkDefinition,
  ToOSDKPropertyType,
} from "./osdk"

// =============================================================================
// Target Namespace
// =============================================================================

/**
 * Compilation targets for Axiom ontologies
 */
export const Target = {
  /**
   * OSDK target - compile to Palantir OSDK definitions
   */
  OSDK: {
    /**
     * Compile an OntologyShape to OSDK object definitions
     */
    compile: (
      ontology: OntologyShape
    ): Effect.Effect<OSDKOutput, CompileError> =>
      compileOntologyToOSDK(ontology),

    /**
     * Generate @osdk/maker code string from OntologyShape
     */
    generate: (
      ontology: OntologyShape
    ): Effect.Effect<string, CompileError> =>
      generateOntologyCode(ontology),

    /**
     * Compile a single ObjectTypeDef to OSDK definition
     */
    compileObject: (
      def: ObjectTypeDef
    ): Effect.Effect<import("./osdk").OSDKObjectDefinition, CompileError> =>
      compileObjectTypeToOSDK(def),
  },

  /**
   * Ontology as Code target - scaffold deployable repository
   */
  OaC: {
    /**
     * Scaffold a complete OaC repository from OntologyShape
     */
    scaffold: (
      ontology: OntologyShape,
      outputPath: string,
      options?: OaCOptions
    ): Effect.Effect<void, CompileError | OaCScaffoldError> =>
      scaffoldFromOntology(ontology, outputPath, options),

    /**
     * Preview files that would be generated without writing
     */
    preview: (
      ontology: OntologyShape,
      options?: OaCOptions
    ): Effect.Effect<ReadonlyMap<string, string>, CompileError> =>
      previewFromOntology(ontology, options),
  },
}

// =============================================================================
// Output Types
// =============================================================================

/**
 * OSDK compilation output
 */
export interface OSDKOutput {
  /** Compiled object definitions */
  readonly objects: readonly import("./osdk").OSDKObjectDefinition[]
  /** Compiled link definitions */
  readonly links: readonly import("./osdk").OSDKLinkDefinition[]
}

/**
 * Options for OaC scaffolding
 */
export interface OaCOptions {
  /** npm package name */
  readonly packageName?: string
  /** Package version */
  readonly version?: string
  /** Package author */
  readonly author?: string
  /** Package description */
  readonly description?: string
}

// =============================================================================
// Implementation (delegating to osdk.ts and oac.ts)
// =============================================================================

import {
  compileToOSDK as legacyCompileToOSDK,
  type OSDKObjectDefinition,
  type OSDKLinkDefinition,
} from "./osdk"
import { Schema } from "effect"

/**
 * Compile OntologyShape to OSDK output
 */
const compileOntologyToOSDK = (
  ontology: OntologyShape
): Effect.Effect<OSDKOutput, CompileError> => {
  return Effect.gen(function* () {
    const objects: OSDKObjectDefinition[] = []
    const links: OSDKLinkDefinition[] = []

    // Compile each object type
    for (const [name, objectDef] of ontology.objects) {
      const osdkDef = yield* compileObjectTypeToOSDK(objectDef)
      objects.push(osdkDef)
    }

    // Convert resolved links to OSDK format
    for (const link of ontology.links) {
      const sourceDef = objects.find((o) => o.apiName === link.sourceName)
      const targetDef = objects.find((o) => o.apiName === link.targetName)

      if (sourceDef && targetDef) {
        const osdkLink: OSDKLinkDefinition = {
          apiName: link.apiName,
        }

        if (link.cardinality === "many-to-one") {
          globalThis.Object.assign(osdkLink, {
            one: {
              object: targetDef,
              metadata: {
                apiName: link.targetName.toLowerCase(),
                displayName: link.targetName,
                pluralDisplayName: `${link.targetName}s`,
              },
            },
            toMany: {
              object: sourceDef,
              metadata: {
                apiName: `${link.sourceName.toLowerCase()}s`,
                displayName: link.sourceName,
                pluralDisplayName: `${link.sourceName}s`,
              },
            },
            manyForeignKeyProperty: link.foreignKey,
          })
        }

        links.push(osdkLink)
      }
    }

    return { objects, links }
  })
}

/**
 * Compile a single ObjectTypeDef to OSDK definition
 */
const compileObjectTypeToOSDK = (
  def: ObjectTypeDef
): Effect.Effect<OSDKObjectDefinition, CompileError> => {
  return Effect.sync(() => {
    const schema = def.schema as any
    const config = def.config

    // Extract fields from schema
    const fields = schema.fields ?? schema._fields ?? {}
    const properties: Record<string, import("./osdk").OSDKPropertyDef> = {}

    for (const [key, fieldSchema] of globalThis.Object.entries(fields)) {
      // Skip _tag field
      if (key === "_tag") continue

      const propDef = schemaToOSDKProperty(fieldSchema as any)
      if (propDef) {
        properties[key] = propDef
      }
    }

    const displayName =
      config.displayName ?? def.name
    const pluralDisplayName =
      config.pluralDisplayName ?? `${def.name}s`

    return {
      apiName: def.name,
      displayName,
      pluralDisplayName,
      description: config.description,
      primaryKeyPropertyApiName: config.primaryKey as string,
      titlePropertyApiName: (config.title ?? config.primaryKey) as string,
      properties,
    }
  })
}

/**
 * Convert Effect Schema to OSDK property definition
 */
const schemaToOSDKProperty = (
  schema: any
): import("./osdk").OSDKPropertyDef | null => {
  // Handle branded/refined types
  const baseSchema = schema.from ?? schema

  // Check for common schema types
  const ast = baseSchema.ast ?? baseSchema

  // Try to determine type from AST or schema shape
  if (ast?._tag === "StringKeyword" || baseSchema === Schema.String) {
    return { type: "string" }
  }
  if (ast?._tag === "NumberKeyword" || baseSchema === Schema.Number) {
    return { type: "decimal" }
  }
  if (ast?._tag === "BooleanKeyword" || baseSchema === Schema.Boolean) {
    return { type: "boolean" }
  }

  // Check for NonEmptyString or other string refinements
  if (schema?.ast?._tag === "Refinement") {
    const from = schema.ast.from
    if (from?._tag === "StringKeyword") {
      return { type: "string" }
    }
    if (from?._tag === "NumberKeyword") {
      return { type: "decimal" }
    }
  }

  // Check for Option types (nullable)
  if (ast?._tag === "Union" || schema?._tag === "Option") {
    // Find the non-None variant
    const types = ast?.types ?? []
    for (const t of types) {
      if (t._tag !== "Literal" || t.literal !== null) {
        const inner = schemaToOSDKProperty({ ast: t })
        if (inner) {
          return { ...inner, nullable: true }
        }
      }
    }
    return { type: "string", nullable: true }
  }

  // Check for branded types
  if (schema?.ast?._tag === "Transformation") {
    return schemaToOSDKProperty({ ast: schema.ast.from })
  }

  // Default to string
  return { type: "string" }
}

/**
 * Generate @osdk/maker code from OntologyShape
 */
const generateOntologyCode = (
  ontology: OntologyShape
): Effect.Effect<string, CompileError> => {
  return Effect.flatMap(compileOntologyToOSDK(ontology), ({ objects, links }) => {
    return Effect.sync(() => {
      const objectDefs = objects
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

      let linkDefs = ""
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

      return `/**
 * Ontology Definition
 *
 * Generated by Axiom v2
 * Namespace: ${ontology.namespace}
 */

import { defineOntology, defineObject, defineLink } from "@osdk/maker";

await defineOntology("${ontology.namespace}", async () => {
  // Object Types
${objectDefs}
${linkDefs ? `\n  // Links${linkDefs}` : ""}
}, "./ontology-output");
`
    })
  })
}

/**
 * Scaffold OaC repository from OntologyShape
 */
const scaffoldFromOntology = (
  ontology: OntologyShape,
  outputPath: string,
  options?: OaCOptions
): Effect.Effect<void, CompileError | OaCScaffoldError> => {
  // Import dynamically to avoid circular deps
  return Effect.gen(function* () {
    const { scaffoldOntologyRepo } = yield* Effect.promise(() =>
      import("./oac")
    )

    // Convert OntologyShape to legacy format for now
    // TODO: Refactor oac.ts to accept OntologyShape directly
    yield* scaffoldOntologyRepoFromShape(ontology, outputPath, options)
  })
}

/**
 * Internal: Scaffold using OntologyShape
 */
const scaffoldOntologyRepoFromShape = (
  ontology: OntologyShape,
  outputPath: string,
  options?: OaCOptions
): Effect.Effect<void, CompileError | OaCScaffoldError> => {
  return Effect.gen(function* () {
    const files = yield* previewFromOntology(ontology, options)

    // Write files
    const { mkdirSync, writeFileSync } = yield* Effect.promise(() =>
      import("fs")
    )
    const { join } = yield* Effect.promise(() => import("path"))

    // Create directories
    const dirs = [
      outputPath,
      join(outputPath, "ontology"),
      join(outputPath, "ontology", "objects"),
      join(outputPath, "ontology", "links"),
      join(outputPath, "scripts"),
    ]

    for (const dir of dirs) {
      mkdirSync(dir, { recursive: true })
    }

    // Write files
    Array.from(files.entries()).forEach(([filePath, content]) => {
      writeFileSync(join(outputPath, filePath), content)
    })

    console.log(`Ontology as Code repository scaffolded at: ${outputPath}`)
  })
}

/**
 * Preview OaC files from OntologyShape
 */
const previewFromOntology = (
  ontology: OntologyShape,
  options?: OaCOptions
): Effect.Effect<ReadonlyMap<string, string>, CompileError> => {
  return Effect.flatMap(compileOntologyToOSDK(ontology), ({ objects, links }) => {
    return Effect.sync(() => {
      const files = new Map<string, string>()

      // Generate package.json
      const packageName =
        options?.packageName ??
        `@${ontology.namespace.replace(/\.$/, "").replace(/\./g, "-")}/ontology`

      files.set(
        "package.json",
        JSON.stringify(
          {
            name: packageName,
            version: options?.version ?? "1.0.0",
            type: "module",
            description:
              options?.description ??
              `Ontology as Code for ${ontology.namespace}`,
            ...(options?.author && { author: options.author }),
            scripts: {
              build: "tsx scripts/build.ts",
              validate: "tsc --noEmit",
            },
            dependencies: {
              "@osdk/maker": "^2.0.0",
            },
            devDependencies: {
              typescript: "^5.0.0",
              tsx: "^4.0.0",
              "@types/node": "^20.0.0",
            },
          },
          null,
          2
        )
      )

      // Generate tsconfig.json
      files.set(
        "tsconfig.json",
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2022",
              module: "ESNext",
              moduleResolution: "bundler",
              strict: true,
              esModuleInterop: true,
              skipLibCheck: true,
            },
            include: ["ontology/**/*", "scripts/**/*"],
          },
          null,
          2
        )
      )

      // Generate README
      files.set(
        "README.md",
        `# ${ontology.namespace} Ontology

Generated by Axiom v2.

## Setup

\`\`\`bash
npm install
npm run validate
npm run build
\`\`\`

## Objects

${objects.map((o) => `- **${o.apiName}**`).join("\n")}
`
      )

      // Generate build script
      files.set(
        "scripts/build.ts",
        `import { defineOntology } from "@osdk/maker";
import { ontologyDefinition } from "../ontology/index.js";

await defineOntology("${ontology.namespace}", ontologyDefinition, "./dist");
console.log("Ontology built successfully.");
`
      )

      // Generate object files
      for (const obj of objects) {
        const propsCode = globalThis.Object.entries(obj.properties)
          .map(([key, prop]) => {
            const typeStr =
              typeof prop.type === "object"
                ? JSON.stringify(prop.type)
                : `"${prop.type}"`
            const extras: string[] = []
            if (prop.nullable) extras.push(`nullable: true`)
            if (extras.length > 0) {
              return `    "${key}": { type: ${typeStr}, ${extras.join(", ")} }`
            }
            return `    "${key}": { type: ${typeStr} }`
          })
          .join(",\n")

        files.set(
          `ontology/objects/${obj.apiName}.ts`,
          `import { defineObject } from "@osdk/maker";

export const ${obj.apiName} = defineObject({
  apiName: "${obj.apiName}",
  displayName: "${obj.displayName}",
  pluralDisplayName: "${obj.pluralDisplayName}",
  primaryKeyPropertyApiName: "${obj.primaryKeyPropertyApiName}",
  titlePropertyApiName: "${obj.titlePropertyApiName}",
  properties: {
${propsCode}
  },
});
`
        )
      }

      // Generate objects index
      files.set(
        "ontology/objects/index.ts",
        objects
          .map((o) => `export { ${o.apiName} } from "./${o.apiName}.js";`)
          .join("\n") + "\n"
      )

      // Generate link files
      for (const link of ontology.links) {
        files.set(
          `ontology/links/${link.apiName}.ts`,
          `import { defineLink } from "@osdk/maker";
import { ${link.sourceName} } from "../objects/${link.sourceName}.js";
import { ${link.targetName} } from "../objects/${link.targetName}.js";

export const ${link.apiName} = defineLink({
  apiName: "${link.apiName}",
  one: {
    object: ${link.targetName},
    metadata: {
      apiName: "${link.targetName.toLowerCase()}",
      displayName: "${link.targetName}",
      pluralDisplayName: "${link.targetName}s",
    },
  },
  toMany: {
    object: ${link.sourceName},
    metadata: {
      apiName: "${link.sourceName.toLowerCase()}s",
      displayName: "${link.sourceName}",
      pluralDisplayName: "${link.sourceName}s",
    },
  },${link.foreignKey ? `\n  manyForeignKeyProperty: "${link.foreignKey}",` : ""}
});
`
        )
      }

      // Generate links index
      const linkExports =
        ontology.links.length > 0
          ? ontology.links
              .map((l) => `export { ${l.apiName} } from "./${l.apiName}.js";`)
              .join("\n")
          : "export {};"
      files.set("ontology/links/index.ts", linkExports + "\n")

      // Generate main index
      const objectImports = objects
        .map((o) => `import { ${o.apiName} } from "./objects/${o.apiName}.js";`)
        .join("\n")
      const linkImports =
        ontology.links.length > 0
          ? ontology.links
              .map(
                (l) => `import { ${l.apiName} } from "./links/${l.apiName}.js";`
              )
              .join("\n")
          : ""

      files.set(
        "ontology/index.ts",
        `${objectImports}
${linkImports ? linkImports + "\n" : ""}
export { ${objects.map((o) => o.apiName).join(", ")} };
${ontology.links.length > 0 ? `export { ${ontology.links.map((l) => l.apiName).join(", ")} };` : ""}

export const ontologyDefinition = async () => {
  console.log("Ontology loaded: ${objects.map((o) => o.apiName).join(", ")}");
};
`
      )

      return files
    })
  })
}
