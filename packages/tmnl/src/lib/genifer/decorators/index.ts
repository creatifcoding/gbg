/**
 * Genifer Decorator Layer
 *
 * Expressive decorator DSL fused with Effect Schema + Atoms.
 * Classes have REAL constructors, REAL methods, REAL atom state.
 *
 * Seven families:
 *   @component / @props / @renders     → CatalogService registration
 *   @actionGroup / @action / @state    → Live atom-backed ActionGroups
 *   @rpc / @handler / @payload         → Dynamic RPC definitions
 *   @event / @emits / @subscribes      → Event bus wiring
 *   @tool / @param / @result           → ToolDefinition registration
 *   @traced / @span                    → Effect.withSpan observability
 *   @validated / @schema               → Schema validation on params
 *
 * @module genifer/decorators
 */

import 'reflect-metadata'

// --- Annotation keys & readers (Schema AST integration) ---
export {
  ComponentId,
  DomainId,
  TierId,
  ChildrenId,
  CompoundParentId,
  CompoundChildrenId,
  EntranceAnimationId,
  ActionGroupId,
  ActionId,
  StateId,
  ComputedId,
  RpcId,
  HandlerId,
  EventId,
  EmitsId,
  SubscribesId,
  ToolId,
  SpanId,
  ValidatedId,
  // Readers
  getAnnotation,
  getComponent,
  getDomain,
  getTier,
  getActionGroup,
  getRpc,
  getEvent,
  getTool,
  getSpan,
} from './annotations'

export type {
  ComponentAnnotation,
  DomainAnnotation,
  TierAnnotation,
  ActionGroupAnnotation,
  ActionAnnotation,
  StateAnnotation,
  RpcAnnotation,
  HandlerAnnotation,
  EventAnnotation,
  ToolAnnotation,
} from './annotations'

// --- Component family ---
export {
  component,
  props,
  renders,
  children,
  domain,
  tier,
  getComponentMeta,
  getPropsMeta,
  getRendererMeta,
  getComponentRegistry,
} from './component'

export type { ComponentOptions } from './component'

// --- ActionGroup family (atom-backed) ---
export {
  actionGroup,
  action,
  state,
  computed,
  ActionGroupAtoms,
  hydrate,
  getActionGroupMeta,
  getActionMeta,
  getStateMeta,
  getActionGroupRegistry,
  getActionGroupInstances,
} from './action-group'

export type {
  ActionGroupOptions,
  ActionOptions,
  StateOptions,
  ActionGroupInstance,
  ActionGroupAtomsOps,
} from './action-group'

// --- RPC family ---
export {
  rpc,
  handler,
  payload,
  error as rpcError,
  success,
  getRpcMeta,
  getRpcRegistry,
} from './rpc'

export type { RpcOptions } from './rpc'

// --- Event family ---
export {
  event,
  emits,
  subscribes,
  getEventMeta,
  getEventRegistry,
} from './event'

export type { EventOptions } from './event'

// --- Tool family ---
export {
  tool,
  param,
  result,
  getToolMeta,
  getToolRegistry,
} from './tool'

// --- Observability ---
export { traced, span } from './traced'

// --- Validation ---
export { validated, schema } from './validated'

// --- Bootstrap (wires everything into atoms + services) ---
export {
  bootstrap,
  bootstrapResultAtom,
  actionGroupsAtom,
  registeredEventsAtom,
  registeredRpcsAtom,
  registeredToolsAtom,
  eventLogAtom,
  subscribeEvent,
} from './bootstrap'

export type { BootstrapResult } from './bootstrap'

// --- React hooks (subscribe to atoms) ---
export {
  useActionGroup,
  useActionGroupState,
  useActionGroupDispatch,
  useGeniferEvent,
  useGeniferEvents,
  useGeniferRpcs,
  useGeniferTools,
  useBootstrapResult,
} from './hooks'
