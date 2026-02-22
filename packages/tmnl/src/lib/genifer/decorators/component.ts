/**
 * @component decorator family
 *
 * Wraps Schema.Class constructors with catalog registration.
 * Annotations written to Schema AST — introspectable by Effect ecosystem.
 *
 * Usage:
 *   @component({ domain: 'forms', tier: 'domain', description: 'Search input' })
 *   class SearchBar extends Schema.Class<SearchBar>('SearchBar')({
 *     placeholder: Schema.optional(Schema.String),
 *     value: Schema.optional(Schema.String),
 *   }) {
 *     @renders()
 *     render({ element, children }: ComponentRenderProps) { return <div>...</div> }
 *
 *     @children(true)
 *     static readonly hasChildren = true
 *   }
 *
 * The @component decorator:
 *   1. Applies Schema.annotations to the class AST (ComponentId, DomainId, TierId)
 *   2. Registers the class in the global component registry
 *   3. Returns the original constructor (augmented, not replaced)
 *
 * @module genifer/decorators/component
 */

import 'reflect-metadata'
import { SchemaAST } from 'effect'
import {
  ComponentId,
  DomainId,
  TierId,
  ChildrenId,
  CompoundParentId,
  CompoundChildrenId,
  EntranceAnimationId,
  type ComponentAnnotation,
  type DomainAnnotation,
  type TierAnnotation,
} from './annotations'

// =============================================================================
// Registry — collected at import time, flushed to CatalogService at bootstrap
// =============================================================================

interface ComponentRegistration {
  readonly ctor: Function
  readonly meta: ComponentAnnotation
  readonly domain: DomainAnnotation
  readonly tier: TierAnnotation
  readonly hasChildren: boolean
  readonly compoundParent?: string
  readonly compoundChildren?: readonly string[]
  readonly rendererMethod?: string
  readonly entrance?: unknown
}

const _registry = new Map<string, ComponentRegistration>()

/** Read-only view of all registered component classes */
export function getComponentRegistry(): ReadonlyMap<string, ComponentRegistration> {
  return _registry
}

/** Read component metadata from a decorated class */
export function getComponentMeta(target: Function): ComponentAnnotation | undefined {
  return Reflect.getMetadata(ComponentId, target)
}

/** Read props schema metadata (the Schema.Class fields) */
export function getPropsMeta(target: Function): Record<string, unknown> | undefined {
  return (target as any).fields
}

/** Read which method is the renderer */
export function getRendererMeta(target: Function): string | undefined {
  return Reflect.getMetadata('genifer:renderer_method', target)
}

// =============================================================================
// @component — Class Decorator
// =============================================================================

export interface ComponentOptions {
  /** Domain membership (forms, cards, data, feedback, navigation, media, interactive) */
  readonly domain: DomainAnnotation
  /** Tier visibility in prompts */
  readonly tier?: TierAnnotation
  /** Human description for LLM */
  readonly description?: string
  /** Available variants (e.g., ['default', 'destructive', 'outline']) */
  readonly variants?: readonly string[]
  /** Is this a compound root? (Card, Form, Tabs, etc.) */
  readonly compound?: boolean
  /** If compound, which sub-component types are valid children? */
  readonly compoundChildren?: readonly string[]
  /** If this is a compound sub-component, who's the parent? */
  readonly compoundParent?: string
  /** Default entrance animation */
  readonly entrance?: unknown
  /** Accept children elements? */
  readonly hasChildren?: boolean
}

/**
 * @component — Register a Schema.Class as a genifer catalog component.
 *
 * Applies annotations to the Schema AST and registers in the global registry.
 *
 * ```ts
 * @component({ domain: 'forms', tier: 'domain', description: 'Search input' })
 * class SearchBar extends Schema.Class<SearchBar>('SearchBar')({
 *   placeholder: Schema.optional(Schema.String),
 * }) {}
 * ```
 */
export function component(options: ComponentOptions) {
  return function <T extends Function>(constructor: T): T {
    const typeName = constructor.name

    const meta: ComponentAnnotation = {
      type: typeName,
      description: options.description,
      variants: options.variants,
      compound: options.compound,
    }

    // Store on reflect-metadata for runtime introspection
    Reflect.defineMetadata(ComponentId, meta, constructor)
    Reflect.defineMetadata(DomainId, options.domain, constructor)
    Reflect.defineMetadata(TierId, options.tier ?? 'domain', constructor)

    // Apply to Schema AST if this is a Schema.Class
    const ast = (constructor as any).ast
    if (ast) {
      // Walk to the 'to' AST node (Schema.Class has from → transform → to)
      const targetAst = ast.to ?? ast
      const existing = targetAst.annotations ?? {}
      targetAst.annotations = {
        ...existing,
        [ComponentId]: meta,
        [DomainId]: options.domain,
        [TierId]: options.tier ?? 'domain',
        [ChildrenId]: options.hasChildren ?? false,
        ...(options.compoundParent ? { [CompoundParentId]: options.compoundParent } : {}),
        ...(options.compoundChildren ? { [CompoundChildrenId]: options.compoundChildren } : {}),
        ...(options.entrance ? { [EntranceAnimationId]: options.entrance } : {}),
      }
    }

    // Register in global registry
    _registry.set(typeName, {
      ctor: constructor,
      meta,
      domain: options.domain,
      tier: options.tier ?? 'domain',
      hasChildren: options.hasChildren ?? false,
      compoundParent: options.compoundParent,
      compoundChildren: options.compoundChildren,
      rendererMethod: Reflect.getMetadata('genifer:renderer_method', constructor.prototype),
      entrance: options.entrance,
    })

    return constructor
  }
}

// =============================================================================
// @props — Property Decorator (documentation only, Schema.Class fields ARE the props)
// =============================================================================

/**
 * @props — Annotate a static field as the component's prop schema.
 *
 * This is mostly documentation — Schema.Class fields are already the props.
 * But it makes intent explicit and is introspectable.
 */
export function props(): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    Reflect.defineMetadata('genifer:props_field', propertyKey, target.constructor)
  }
}

// =============================================================================
// @renders — Method Decorator
// =============================================================================

/**
 * @renders — Mark a method as the component's React renderer.
 *
 * ```ts
 * @component({ domain: 'forms' })
 * class SearchBar extends Schema.Class<SearchBar>('SearchBar')({ ... }) {
 *   @renders()
 *   render({ element, children }: ComponentRenderProps) {
 *     return <div>{element.props.placeholder}</div>
 *   }
 * }
 * ```
 */
export function renders(): MethodDecorator {
  return function (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor): void {
    Reflect.defineMetadata('genifer:renderer_method', propertyKey, target.constructor ?? target)
    // Also store on prototype for bootstrap to find
    Reflect.defineMetadata('genifer:renderer_method', propertyKey, target)
  }
}

// =============================================================================
// @children — Property Decorator (mark as accepting children)
// =============================================================================

/**
 * @children — Declare that this component accepts child elements.
 */
export function children(accepts: boolean = true): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    Reflect.defineMetadata(ChildrenId, accepts, target.constructor)
  }
}

// =============================================================================
// @domain / @tier — Standalone decorators (alternative to options in @component)
// =============================================================================

/**
 * @domain — Set domain membership as a standalone decorator.
 */
export function domain(name: DomainAnnotation): ClassDecorator {
  return function <T extends Function>(constructor: T): T {
    Reflect.defineMetadata(DomainId, name, constructor)
    return constructor
  }
}

/**
 * @tier — Set tier visibility as a standalone decorator.
 */
export function tier(t: TierAnnotation): ClassDecorator {
  return function <T extends Function>(constructor: T): T {
    Reflect.defineMetadata(TierId, t, constructor)
    return constructor
  }
}
