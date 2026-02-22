/**
 * Genifer Custom Schema Annotation Keys
 *
 * These Symbol keys are stored on the Schema AST via Schema.annotations().
 * This means metadata lives WHERE Effect expects it — on the schema node.
 * SchemaAST.getAnnotation<T>(key)(schema.ast) retrieves them.
 *
 * Decorators WRITE to these annotations. Effect services READ from them.
 * JSON Schema generation can surface them. Prompt generation can introspect them.
 *
 * @module genifer/decorators/annotations
 */

import { Schema, SchemaAST } from 'effect'
import { Option } from 'effect'

// =============================================================================
// Annotation Keys (Symbols)
// =============================================================================

/** Component catalog metadata */
export const ComponentId = Symbol.for('genifer/annotation/Component')
/** Domain membership (forms, cards, data, etc.) */
export const DomainId = Symbol.for('genifer/annotation/Domain')
/** Tier visibility (core, primitives, domain, specialized) */
export const TierId = Symbol.for('genifer/annotation/Tier')
/** Whether the component accepts children */
export const ChildrenId = Symbol.for('genifer/annotation/Children')
/** Compound relationship: parent type */
export const CompoundParentId = Symbol.for('genifer/annotation/CompoundParent')
/** Compound relationship: allowed sub-component types */
export const CompoundChildrenId = Symbol.for('genifer/annotation/CompoundChildren')
/** Default entrance animation */
export const EntranceAnimationId = Symbol.for('genifer/annotation/EntranceAnimation')

/** ActionGroup metadata */
export const ActionGroupId = Symbol.for('genifer/annotation/ActionGroup')
/** Action method metadata */
export const ActionId = Symbol.for('genifer/annotation/Action')
/** State field metadata */
export const StateId = Symbol.for('genifer/annotation/State')
/** Computed getter metadata */
export const ComputedId = Symbol.for('genifer/annotation/Computed')

/** RPC definition metadata */
export const RpcId = Symbol.for('genifer/annotation/Rpc')
/** RPC handler type */
export const HandlerId = Symbol.for('genifer/annotation/Handler')

/** Event definition metadata */
export const EventId = Symbol.for('genifer/annotation/Event')
/** Methods that emit events */
export const EmitsId = Symbol.for('genifer/annotation/Emits')
/** Methods that subscribe to events */
export const SubscribesId = Symbol.for('genifer/annotation/Subscribes')

/** Tool definition metadata */
export const ToolId = Symbol.for('genifer/annotation/Tool')

/** Tracing span name */
export const SpanId = Symbol.for('genifer/annotation/Span')

/** Schema validation target */
export const ValidatedId = Symbol.for('genifer/annotation/Validated')

// =============================================================================
// Type-Safe Annotation Interfaces
// =============================================================================

export interface ComponentAnnotation {
  /** Component type name (e.g., "SearchBar") */
  readonly type: string
  /** Human description for LLM prompt */
  readonly description?: string
  /** Available variants */
  readonly variants?: readonly string[]
  /** Whether this is a compound root */
  readonly compound?: boolean
}

export type DomainAnnotation = string // "forms" | "cards" | "data" | etc.

export type TierAnnotation = 'core' | 'primitives' | 'domain' | 'specialized'

export interface ActionGroupAnnotation {
  /** ActionGroup name (e.g., "flight-search") */
  readonly name: string
  /** Human description */
  readonly description?: string
}

export interface ActionAnnotation {
  /** Action tag (e.g., "search") — referenced as @action:search */
  readonly tag: string
  /** Action type */
  readonly type?: 'setState' | 'emitEvent' | 'callRpc' | 'navigate'
  /** Debounce milliseconds */
  readonly debounceMs?: number
}

export interface StateAnnotation {
  /** State field name — referenced as @state:fieldName */
  readonly field: string
  /** Default value */
  readonly defaultValue?: unknown
  /** Whether this field is reactive (subscribable) */
  readonly reactive?: boolean
}

export interface RpcAnnotation {
  /** RPC tag (e.g., "opensky/SearchFlights") */
  readonly tag: string
  /** Human description */
  readonly description?: string
  /** Whether this is a streaming RPC */
  readonly stream?: boolean
}

export interface HandlerAnnotation {
  readonly _tag: 'http' | 'service' | 'llm' | 'script' | 'custom'
  readonly url?: string
  readonly method?: string
  readonly serviceTag?: string
  readonly systemPrompt?: string
  readonly command?: string
}

export interface EventAnnotation {
  /** Event tag (e.g., "FlightSearched") */
  readonly tag: string
  /** Whether to persist events for replay */
  readonly persistent?: boolean
}

export interface ToolAnnotation {
  /** Tool name (e.g., "search_opensky") */
  readonly name: string
  /** Human-readable label */
  readonly label: string
  /** Description for LLM */
  readonly description: string
  /** Renderer style */
  readonly rendererStyle?: 'card' | 'inline' | 'table' | 'terminal'
}

// =============================================================================
// Module Augmentation — Type-Safe Schema.annotations()
// =============================================================================

declare module 'effect/Schema' {
  namespace Annotations {
    interface GenericSchema<A> {
      [ComponentId]?: ComponentAnnotation
      [DomainId]?: DomainAnnotation
      [TierId]?: TierAnnotation
      [ChildrenId]?: boolean
      [CompoundParentId]?: string
      [CompoundChildrenId]?: readonly string[]
      [EntranceAnimationId]?: unknown
      [ActionGroupId]?: ActionGroupAnnotation
      [ActionId]?: ActionAnnotation
      [StateId]?: StateAnnotation
      [ComputedId]?: boolean
      [RpcId]?: RpcAnnotation
      [HandlerId]?: HandlerAnnotation
      [EventId]?: EventAnnotation
      [EmitsId]?: readonly string[]
      [SubscribesId]?: readonly string[]
      [ToolId]?: ToolAnnotation
      [SpanId]?: string
      [ValidatedId]?: boolean
    }
  }
}

// =============================================================================
// Annotation Readers — Effect-native introspection
// =============================================================================

/** Read a genifer annotation from any schema's AST */
export function getAnnotation<T>(key: symbol) {
  return (schema: Schema.Schema<any, any, any>): T | undefined => {
    return SchemaAST.getAnnotation<T>(key)(schema.ast).pipe(
      Option.getOrUndefined
    )
  }
}

/** Read component metadata from a Schema.Class */
export const getComponent = getAnnotation<ComponentAnnotation>(ComponentId)
/** Read domain from a Schema.Class */
export const getDomain = getAnnotation<DomainAnnotation>(DomainId)
/** Read tier from a Schema.Class */
export const getTier = getAnnotation<TierAnnotation>(TierId)
/** Read ActionGroup metadata */
export const getActionGroup = getAnnotation<ActionGroupAnnotation>(ActionGroupId)
/** Read RPC metadata */
export const getRpc = getAnnotation<RpcAnnotation>(RpcId)
/** Read Event metadata */
export const getEvent = getAnnotation<EventAnnotation>(EventId)
/** Read Tool metadata */
export const getTool = getAnnotation<ToolAnnotation>(ToolId)
/** Read span name */
export const getSpan = getAnnotation<string>(SpanId)
