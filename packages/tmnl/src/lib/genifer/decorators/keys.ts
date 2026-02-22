/**
 * Metadata keys for all genifer decorators.
 *
 * Using Symbol keys to avoid collision with other decorator libraries.
 * All metadata stored via reflect-metadata.
 *
 * @module genifer/decorators/keys
 */

// Component family
export const COMPONENT_META     = Symbol('genifer:component')
export const PROPS_META         = Symbol('genifer:props')
export const RENDERER_META      = Symbol('genifer:renderer')
export const CHILDREN_META      = Symbol('genifer:children')
export const DOMAIN_META        = Symbol('genifer:domain')
export const TIER_META          = Symbol('genifer:tier')

// ActionGroup family
export const ACTION_GROUP_META  = Symbol('genifer:actionGroup')
export const ACTION_META        = Symbol('genifer:action')
export const STATE_META         = Symbol('genifer:state')
export const COMPUTED_META      = Symbol('genifer:computed')

// RPC family
export const RPC_META           = Symbol('genifer:rpc')
export const HANDLER_META       = Symbol('genifer:handler')
export const PAYLOAD_META       = Symbol('genifer:payload')
export const SUCCESS_META       = Symbol('genifer:success')
export const ERROR_META         = Symbol('genifer:error')

// Event family
export const EVENT_META         = Symbol('genifer:event')
export const EMITS_META         = Symbol('genifer:emits')
export const SUBSCRIBES_META    = Symbol('genifer:subscribes')

// Tool family
export const TOOL_META          = Symbol('genifer:tool')
export const PARAM_META         = Symbol('genifer:param')
export const RESULT_META        = Symbol('genifer:result')

// Observability
export const TRACED_META        = Symbol('genifer:traced')
export const SPAN_META          = Symbol('genifer:span')

// Validation
export const VALIDATED_META     = Symbol('genifer:validated')
export const SCHEMA_META        = Symbol('genifer:schema')
