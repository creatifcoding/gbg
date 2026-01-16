/**
 * @fileoverview Component catalog system with Effect Schema
 *
 * Provides:
 * - Component registration with prop schemas
 * - Action definitions with param schemas
 * - Custom validation function registry
 * - Dynamic schema generation for AI prompts
 * - Catalog-aware validation
 *
 * ALL methods return Effects!
 */

import { Effect, Schema, pipe, ParseResult } from "effect"
import type { UIElement, UITree } from "./schemas"
import { VisibilityCondition } from "./schemas"
import type { SyncValidationFunction } from "./validation"

// =============================================================================
// Types
// =============================================================================

/** Schema type for component props */
export type ComponentSchema = Schema.Schema<any, any, never>

/** Validation mode */
export type ValidationMode = "strict" | "loose" | "none"

/** Component definition with visibility and validation support */
export interface ComponentDefinition<TProps extends ComponentSchema = ComponentSchema> {
  /** Effect Schema for component props */
  readonly props: TProps
  /** Whether this component can have children */
  readonly hasChildren?: boolean
  /** Description for AI generation */
  readonly description?: string
}

/** Action definition with param schema */
export interface ActionDefinition<TParams extends ComponentSchema = ComponentSchema> {
  /** Effect Schema for action params */
  readonly params?: TParams
  /** Description for AI generation */
  readonly description?: string
}

/** Catalog configuration */
export interface CatalogConfig<
  TComponents extends Record<string, ComponentDefinition> = Record<string, ComponentDefinition>,
  TActions extends Record<string, ActionDefinition> = Record<string, ActionDefinition>,
  TFunctions extends Record<string, SyncValidationFunction> = Record<string, SyncValidationFunction>
> {
  /** Catalog name */
  readonly name?: string
  /** Component definitions */
  readonly components: TComponents
  /** Action definitions with param schemas */
  readonly actions?: TActions
  /** Custom validation functions */
  readonly functions?: TFunctions
  /** Validation mode */
  readonly validation?: ValidationMode
}

/** Validation result */
export interface CatalogValidationResult<T> {
  readonly success: boolean
  readonly data?: T
  readonly error?: ParseResult.ParseError
}

/** Catalog instance */
export interface Catalog<
  TComponents extends Record<string, ComponentDefinition> = Record<string, ComponentDefinition>,
  TActions extends Record<string, ActionDefinition> = Record<string, ActionDefinition>,
  TFunctions extends Record<string, SyncValidationFunction> = Record<string, SyncValidationFunction>
> {
  /** Catalog name */
  readonly name: string
  /** Component names */
  readonly componentNames: readonly (keyof TComponents)[]
  /** Action names */
  readonly actionNames: readonly (keyof TActions)[]
  /** Function names */
  readonly functionNames: readonly (keyof TFunctions)[]
  /** Validation mode */
  readonly validation: ValidationMode
  /** Component definitions */
  readonly components: TComponents
  /** Action definitions */
  readonly actions: TActions
  /** Custom validation functions */
  readonly functions: TFunctions

  /** Check if component exists - returns Effect */
  hasComponent(type: string): Effect.Effect<boolean, never>
  /** Check if action exists - returns Effect */
  hasAction(name: string): Effect.Effect<boolean, never>
  /** Check if function exists - returns Effect */
  hasFunction(name: string): Effect.Effect<boolean, never>
  /** Validate an element - returns Effect */
  validateElement(element: unknown): Effect.Effect<CatalogValidationResult<UIElement>, never>
  /** Validate a UI tree - returns Effect */
  validateTree(tree: unknown): Effect.Effect<CatalogValidationResult<UITree>, never>
  /** Generate prompt for AI - returns Effect */
  generatePrompt(): Effect.Effect<string, never>
}

// =============================================================================
// Catalog Creation
// =============================================================================

/**
 * Create an effectual catalog with visibility, actions, and validation support
 */
export const createCatalog = <
  TComponents extends Record<string, ComponentDefinition>,
  TActions extends Record<string, ActionDefinition> = Record<string, ActionDefinition>,
  TFunctions extends Record<string, SyncValidationFunction> = Record<string, SyncValidationFunction>
>(
  config: CatalogConfig<TComponents, TActions, TFunctions>
): Effect.Effect<Catalog<TComponents, TActions, TFunctions>, never> =>
  Effect.gen(function* () {
    const {
      name = "unnamed",
      components,
      actions = {} as TActions,
      functions = {} as TFunctions,
      validation = "strict"
    } = config

    const componentNames = Object.keys(components) as (keyof TComponents)[]
    const actionNames = Object.keys(actions) as (keyof TActions)[]
    const functionNames = Object.keys(functions) as (keyof TFunctions)[]

    // Create element schema for each component type
    const componentSchemas = componentNames.map((componentName) => {
      const def = components[componentName]!

      return Schema.Struct({
        key: Schema.String,
        type: Schema.Literal(componentName as string),
        props: def.props,
        children: Schema.optional(Schema.Array(Schema.String)),
        parentKey: Schema.optional(Schema.NullOr(Schema.String)),
        visible: Schema.optional(VisibilityCondition)
      })
    })

    // Create union schema for all components
    const elementSchema: Schema.Schema<UIElement, any, never> = componentSchemas.length === 0
      ? Schema.Struct({
          key: Schema.String,
          type: Schema.String,
          props: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
          children: Schema.optional(Schema.Array(Schema.String)),
          parentKey: Schema.optional(Schema.NullOr(Schema.String)),
          visible: Schema.optional(VisibilityCondition)
        }) as unknown as Schema.Schema<UIElement, any, never>
      : componentSchemas.length === 1
        ? componentSchemas[0] as unknown as Schema.Schema<UIElement, any, never>
        : Schema.Union(...componentSchemas) as unknown as Schema.Schema<UIElement, any, never>

    // Create tree schema
    const treeSchema = Schema.Struct({
      root: Schema.String,
      elements: Schema.Record({ key: Schema.String, value: elementSchema })
    }) as unknown as Schema.Schema<UITree, any, never>

    // Decode helpers
    const decodeElement = Schema.decodeUnknown(elementSchema)
    const decodeTree = Schema.decodeUnknown(treeSchema)

    return {
      name,
      componentNames,
      actionNames,
      functionNames,
      validation,
      components,
      actions,
      functions,

      hasComponent: (type: string): Effect.Effect<boolean, never> =>
        Effect.succeed(type in components),

      hasAction: (actionName: string): Effect.Effect<boolean, never> =>
        Effect.succeed(actionName in actions),

      hasFunction: (fnName: string): Effect.Effect<boolean, never> =>
        Effect.succeed(fnName in functions),

      validateElement: (element: unknown): Effect.Effect<CatalogValidationResult<UIElement>, never> =>
        pipe(
          decodeElement(element),
          Effect.map((data) => ({ success: true as const, data })),
          Effect.catchAll((error) => Effect.succeed({ success: false as const, error }))
        ),

      validateTree: (tree: unknown): Effect.Effect<CatalogValidationResult<UITree>, never> =>
        pipe(
          decodeTree(tree),
          Effect.map((data) => ({ success: true as const, data })),
          Effect.catchAll((error) => Effect.succeed({ success: false as const, error }))
        ),

      generatePrompt: (): Effect.Effect<string, never> =>
        Effect.succeed(generateCatalogPromptSync({
          name,
          componentNames,
          actionNames,
          functionNames,
          components,
          actions,
          functions
        } as any))
    }
  })

/**
 * Create catalog (sync version)
 */
export const createCatalogSync = <
  TComponents extends Record<string, ComponentDefinition>,
  TActions extends Record<string, ActionDefinition> = Record<string, ActionDefinition>,
  TFunctions extends Record<string, SyncValidationFunction> = Record<string, SyncValidationFunction>
>(
  config: CatalogConfig<TComponents, TActions, TFunctions>
): Catalog<TComponents, TActions, TFunctions> =>
  Effect.runSync(createCatalog(config))

// =============================================================================
// Prompt Generation
// =============================================================================

/**
 * Internal sync prompt generator
 */
const generateCatalogPromptSync = <
  TComponents extends Record<string, ComponentDefinition>,
  TActions extends Record<string, ActionDefinition>,
  TFunctions extends Record<string, SyncValidationFunction>
>(catalog: {
  name: string
  componentNames: readonly (keyof TComponents)[]
  actionNames: readonly (keyof TActions)[]
  functionNames: readonly (keyof TFunctions)[]
  components: TComponents
  actions: TActions
  functions: TFunctions
}): string => {
  const lines: string[] = [
    `# ${catalog.name} Component Catalog`,
    "",
    "## Available Components",
    ""
  ]

  // Components
  for (const name of catalog.componentNames) {
    const def = catalog.components[name]!
    lines.push(`### ${String(name)}`)
    if (def.description) {
      lines.push(def.description)
    }
    if (def.hasChildren) {
      lines.push("*Can contain children*")
    }
    lines.push("")
  }

  // Actions
  if (catalog.actionNames.length > 0) {
    lines.push("## Available Actions")
    lines.push("")
    for (const name of catalog.actionNames) {
      const def = catalog.actions[name]!
      lines.push(
        `- \`${String(name)}\`${def.description ? `: ${def.description}` : ""}`
      )
    }
    lines.push("")
  }

  // Visibility
  lines.push("## Visibility Conditions")
  lines.push("")
  lines.push("Components can have a `visible` property:")
  lines.push("- `true` / `false` - Always visible/hidden")
  lines.push('- `{ "_tag": "PathCondition", "path": "/data/path" }` - Visible when path is truthy')
  lines.push('- `{ "_tag": "AuthCondition", "auth": "signedIn" }` - Visible when user is signed in')
  lines.push('- `{ "_tag": "AndCondition", "conditions": [...] }` - All conditions must be true')
  lines.push('- `{ "_tag": "OrCondition", "conditions": [...] }` - Any condition must be true')
  lines.push('- `{ "_tag": "NotCondition", "condition": {...} }` - Negates a condition')
  lines.push('- `{ "_tag": "EqCondition", "left": a, "right": b }` - Equality check')
  lines.push("")

  // Validation
  lines.push("## Validation Functions")
  lines.push("")
  lines.push(
    "Built-in: `required`, `email`, `minLength`, `maxLength`, `pattern`, `min`, `max`, `url`, `numeric`, `phone`, `alphanumeric`"
  )
  if (catalog.functionNames.length > 0) {
    lines.push(`Custom: ${catalog.functionNames.map(String).join(", ")}`)
  }
  lines.push("")

  return lines.join("\n")
}

/**
 * Generate a prompt for AI that describes the catalog - returns Effect
 */
export const generateCatalogPrompt = <
  TComponents extends Record<string, ComponentDefinition>,
  TActions extends Record<string, ActionDefinition>,
  TFunctions extends Record<string, SyncValidationFunction>
>(
  catalog: Catalog<TComponents, TActions, TFunctions>
): Effect.Effect<string, never> =>
  catalog.generatePrompt()

// =============================================================================
// Type Helpers
// =============================================================================

/**
 * Type helper to infer component props from catalog
 */
export type InferCatalogComponentProps<C extends Catalog<Record<string, ComponentDefinition>>> = {
  [K in keyof C["components"]]: Schema.Schema.Type<C["components"][K]["props"]>
}

/**
 * Type helper to infer action params from catalog
 */
export type InferCatalogActionParams<C extends Catalog<Record<string, ComponentDefinition>, Record<string, ActionDefinition>>> = {
  [K in keyof C["actions"]]: C["actions"][K]["params"] extends Schema.Schema<infer T, any, any>
    ? T
    : Record<string, unknown>
}

// =============================================================================
// Builder Pattern
// =============================================================================

export const catalogBuilder = {
  /** Define a component - returns Effect */
  component: <P extends ComponentSchema>(
    props: P,
    options?: { hasChildren?: boolean; description?: string }
  ): Effect.Effect<ComponentDefinition<P>, never> =>
    Effect.succeed({
      props,
      hasChildren: options?.hasChildren,
      description: options?.description
    }),

  /** Define an action - returns Effect */
  action: <P extends ComponentSchema>(
    params?: P,
    description?: string
  ): Effect.Effect<ActionDefinition<P>, never> =>
    Effect.succeed({
      params,
      description
    }),

  /** Create a catalog from definitions - returns Effect */
  build: <
    TComponents extends Record<string, ComponentDefinition>,
    TActions extends Record<string, ActionDefinition>,
    TFunctions extends Record<string, SyncValidationFunction>
  >(
    config: CatalogConfig<TComponents, TActions, TFunctions>
  ): Effect.Effect<Catalog<TComponents, TActions, TFunctions>, never> =>
    createCatalog(config)
}

// =============================================================================
// Component Schema Helpers
// =============================================================================

/**
 * Common prop schemas for component definitions
 */
export const commonProps = {
  /** Basic text props */
  text: Schema.Struct({
    text: Schema.String,
    className: Schema.optional(Schema.String)
  }),

  /** Button props */
  button: Schema.Struct({
    label: Schema.String,
    variant: Schema.optional(Schema.Literal("primary", "secondary", "ghost", "destructive")),
    size: Schema.optional(Schema.Literal("sm", "md", "lg")),
    disabled: Schema.optional(Schema.Boolean),
    className: Schema.optional(Schema.String)
  }),

  /** Input props */
  input: Schema.Struct({
    name: Schema.String,
    label: Schema.optional(Schema.String),
    placeholder: Schema.optional(Schema.String),
    type: Schema.optional(Schema.Literal("text", "email", "password", "number", "tel", "url")),
    disabled: Schema.optional(Schema.Boolean),
    className: Schema.optional(Schema.String)
  }),

  /** Container props */
  container: Schema.Struct({
    className: Schema.optional(Schema.String),
    layout: Schema.optional(Schema.Literal("row", "column", "grid")),
    gap: Schema.optional(Schema.Number)
  }),

  /** Card props */
  card: Schema.Struct({
    title: Schema.optional(Schema.String),
    description: Schema.optional(Schema.String),
    className: Schema.optional(Schema.String)
  }),

  /** Image props */
  image: Schema.Struct({
    src: Schema.String,
    alt: Schema.String,
    width: Schema.optional(Schema.Number),
    height: Schema.optional(Schema.Number),
    className: Schema.optional(Schema.String)
  }),

  /** Link props */
  link: Schema.Struct({
    href: Schema.String,
    text: Schema.optional(Schema.String),
    target: Schema.optional(Schema.Literal("_blank", "_self", "_parent", "_top")),
    className: Schema.optional(Schema.String)
  })
}

// =============================================================================
// Layout Integration
// =============================================================================

/**
 * Merge layout catalog components into an existing catalog config.
 * Use this to add Grid, Stack, Flex, etc. to your catalog.
 *
 * @example
 * ```typescript
 * import { createCatalogSync, withLayoutComponents } from '@/lib/json-render'
 * import { layoutCatalog } from '@/lib/layout'
 *
 * const myCatalog = createCatalogSync(withLayoutComponents({
 *   name: 'My App',
 *   components: {
 *     MyCustomComponent: { props: mySchema, hasChildren: true }
 *   }
 * }, layoutCatalog))
 * ```
 */
export const withLayoutComponents = <
  TComponents extends Record<string, ComponentDefinition>,
  TActions extends Record<string, ActionDefinition>,
  TFunctions extends Record<string, SyncValidationFunction>,
  LComponents extends Record<string, ComponentDefinition>
>(
  config: CatalogConfig<TComponents, TActions, TFunctions>,
  layoutCatalog: Catalog<LComponents, Record<string, ActionDefinition>, Record<string, SyncValidationFunction>>
): CatalogConfig<TComponents & LComponents, TActions, TFunctions> => ({
  ...config,
  components: {
    ...layoutCatalog.components,
    ...config.components,
  } as TComponents & LComponents,
})
