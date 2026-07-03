import { Schema } from 'effect'
import { stxMachine, type StxMachineInstance } from '@tmnl/stx'
import { assign, setup } from 'xstate'
import type { AccessDecision } from './access'

// =============================================================================
// Serializable surface definition
// =============================================================================

export const SurfaceRenderer = Schema.Literals([
  'native-rn',
  'skia',
  'lottie',
  'genifer',
  'remote-preview',
  'web-fallback',
])
export type SurfaceRenderer = typeof SurfaceRenderer.Type

export class UiSurfaceDefinition extends Schema.TaggedClass<UiSurfaceDefinition>()('UiSurfaceDefinition', {
  surfaceId: Schema.String,
  generationId: Schema.String,
  renderer: SurfaceRenderer,
  requiredCapabilities: Schema.Array(Schema.String),
  inputSchemaId: Schema.String,
  outputSchemaId: Schema.String,
  machineId: Schema.String,
  defaultState: Schema.String,
  platformVariants: Schema.Record(Schema.String, Schema.Unknown),
}) {}

export const SurfaceLifecycleValues = [
  'draft',
  'validating',
  'previewing',
  'approval',
  'promoted',
  'degraded',
  'rolledBack',
] as const
export const SurfaceLifecycle = Schema.Literals(SurfaceLifecycleValues)
export type SurfaceLifecycle = typeof SurfaceLifecycle.Type

export type SurfaceRuntimeState = {
  readonly surfaceId: string
  readonly generationId: string
  readonly lifecycle: SurfaceLifecycle
  readonly selectedVariant: string
  readonly accessDecisionId: string | null
  readonly approvalRequestId: string | null
  readonly fallbackReason: string | null
  readonly ledgerCursor: string | null
}

export type SurfaceMachineContext = {
  readonly selectedVariant: string
  readonly accessDecisionId: string | null
  readonly approvalRequestId: string | null
  readonly fallbackReason: string | null
  readonly ledgerCursor: string | null
}

export type SurfaceMachineEvent =
  | { readonly type: 'VALIDATE' }
  | { readonly type: 'PREVIEW'; readonly variant: string; readonly accessDecisionId: string }
  | { readonly type: 'REQUIRES_APPROVAL'; readonly approvalRequestId: string; readonly accessDecisionId: string; readonly variant: string }
  | { readonly type: 'PROMOTE'; readonly ledgerCursor: string }
  | { readonly type: 'ROLLBACK'; readonly ledgerCursor: string; readonly reason: string }
  | { readonly type: 'DEGRADE'; readonly reason: string; readonly accessDecisionId: string; readonly variant: string }
  | { readonly type: 'CAPABILITY_DENIED'; readonly reason: string; readonly accessDecisionId: string; readonly variant: string }
  | { readonly type: 'HOST_UNAVAILABLE'; readonly reason: string }
  | { readonly type: 'RENDER_FAULT'; readonly reason: string }
  | { readonly type: 'SCRIPT_FAULT'; readonly reason: string }

// =============================================================================
// Machine
// =============================================================================

export const surfaceMachine = setup({
  types: {
    context: {} as SurfaceMachineContext,
    events: {} as SurfaceMachineEvent,
  },
  actions: {
    markPreview: assign(({ event }) => {
      if (event.type !== 'PREVIEW') return {}
      return {
        selectedVariant: event.variant,
        accessDecisionId: event.accessDecisionId,
        approvalRequestId: null,
        fallbackReason: null,
      }
    }),
    markApproval: assign(({ event }) => {
      if (event.type !== 'REQUIRES_APPROVAL') return {}
      return {
        selectedVariant: event.variant,
        accessDecisionId: event.accessDecisionId,
        approvalRequestId: event.approvalRequestId,
        fallbackReason: null,
      }
    }),
    markDegraded: assign(({ event }) => {
      switch (event.type) {
        case 'DEGRADE':
        case 'CAPABILITY_DENIED':
          return {
            selectedVariant: event.variant,
            accessDecisionId: event.accessDecisionId,
            fallbackReason: event.reason,
            approvalRequestId: null,
          }
        case 'HOST_UNAVAILABLE':
        case 'RENDER_FAULT':
          return {
            selectedVariant: 'degradedFallback',
            accessDecisionId: null,
            fallbackReason: event.reason,
            approvalRequestId: null,
          }
        default:
          return {}
      }
    }),
    markRolledBack: assign(({ event }) => {
      if (event.type === 'ROLLBACK') {
        return {
          ledgerCursor: event.ledgerCursor,
          fallbackReason: event.reason,
          approvalRequestId: null,
        }
      }
      return {
        ledgerCursor: null,
        fallbackReason: 'reason' in event ? event.reason : 'rolled back',
        approvalRequestId: null,
      }
    }),
    markPromoted: assign(({ event }) => {
      if (event.type !== 'PROMOTE') return {}
      return {
        ledgerCursor: event.ledgerCursor,
        fallbackReason: null,
        approvalRequestId: null,
      }
    }),
  },
}).createMachine({
  id: 'tmnl.cockpit.surfaceActor',
  initial: 'draft',
  context: {
    selectedVariant: 'unresolved',
    accessDecisionId: null,
    approvalRequestId: null,
    fallbackReason: null,
    ledgerCursor: null,
  },
  states: {
    draft: {
      on: {
        VALIDATE: 'validating',
        PREVIEW: { target: 'previewing', actions: markPreview },
        REQUIRES_APPROVAL: { target: 'approval', actions: markApproval },
        DEGRADE: { target: 'degraded', actions: markDegraded },
        CAPABILITY_DENIED: { target: 'degraded', actions: markDegraded },
      },
    },
    validating: {
      on: {
        PREVIEW: { target: 'previewing', actions: markPreview },
        REQUIRES_APPROVAL: { target: 'approval', actions: markApproval },
        DEGRADE: { target: 'degraded', actions: markDegraded },
        CAPABILITY_DENIED: { target: 'degraded', actions: markDegraded },
        SCRIPT_FAULT: { target: 'rolledBack', actions: markRolledBack },
      },
    },
    previewing: {
      on: {
        PROMOTE: { target: 'promoted', actions: assign({ ledgerCursor: ({ event }) => event.ledgerCursor }) },
        REQUIRES_APPROVAL: { target: 'approval', actions: markApproval },
        HOST_UNAVAILABLE: { target: 'degraded', actions: markDegraded },
        RENDER_FAULT: { target: 'degraded', actions: markDegraded },
        SCRIPT_FAULT: { target: 'rolledBack', actions: markRolledBack },
        DEGRADE: { target: 'degraded', actions: markDegraded },
      },
    },
    approval: {
      on: {
        PREVIEW: { target: 'previewing', actions: markPreview },
        CAPABILITY_DENIED: { target: 'degraded', actions: markDegraded },
        DEGRADE: { target: 'degraded', actions: markDegraded },
      },
    },
    promoted: {
      on: {
        RENDER_FAULT: { target: 'degraded', actions: markDegraded },
        HOST_UNAVAILABLE: { target: 'degraded', actions: markDegraded },
        ROLLBACK: { target: 'rolledBack', actions: markRolledBack },
      },
    },
    degraded: {
      on: {
        PREVIEW: { target: 'previewing', actions: markPreview },
        REQUIRES_APPROVAL: { target: 'approval', actions: markApproval },
        ROLLBACK: { target: 'rolledBack', actions: markRolledBack },
      },
    },
    rolledBack: {
      on: {
        VALIDATE: 'validating',
        PREVIEW: { target: 'previewing', actions: markPreview },
      },
    },
  },
})

export type SurfaceActor = StxMachineInstance<SurfaceRuntimeState, typeof surfaceMachine>

export function makeSurfaceRuntimeState(definition: UiSurfaceDefinition): SurfaceRuntimeState {
  return {
    surfaceId: definition.surfaceId,
    generationId: definition.generationId,
    lifecycle: SurfaceLifecycleValues.includes(definition.defaultState as SurfaceLifecycle)
      ? definition.defaultState as SurfaceLifecycle
      : 'draft',
    selectedVariant: 'unresolved',
    accessDecisionId: null,
    approvalRequestId: null,
    fallbackReason: null,
    ledgerCursor: null,
  }
}

export function createSurfaceActor(definition: UiSurfaceDefinition): SurfaceActor {
  return stxMachine(surfaceMachine, makeSurfaceRuntimeState(definition), {
    contextToState: (context, snapshot) => ({
      lifecycle: String(snapshot.value) as SurfaceLifecycle,
      selectedVariant: context.selectedVariant,
      accessDecisionId: context.accessDecisionId,
      approvalRequestId: context.approvalRequestId,
      fallbackReason: context.fallbackReason,
      ledgerCursor: context.ledgerCursor,
    }),
  })
}

function variantFromDecision(decision: AccessDecision): string {
  const uiBehavior = decision.uiBehavior as { readonly variant?: unknown }
  return typeof uiBehavior?.variant === 'string' ? uiBehavior.variant : `${decision.result}Fallback`
}

function approvalRequestFromDecision(decision: AccessDecision): string {
  const uiBehavior = decision.uiBehavior as { readonly approvalRequestId?: unknown }
  return typeof uiBehavior?.approvalRequestId === 'string'
    ? uiBehavior.approvalRequestId
    : `${decision.requestId}:approval`
}

export function surfaceEventFromAccessDecision(decision: AccessDecision): SurfaceMachineEvent {
  const variant = variantFromDecision(decision)
  switch (decision.result) {
    case 'allow':
    case 'proxy':
      return { type: 'PREVIEW', variant, accessDecisionId: decision.id }
    case 'requires-approval':
      return {
        type: 'REQUIRES_APPROVAL',
        variant,
        accessDecisionId: decision.id,
        approvalRequestId: approvalRequestFromDecision(decision),
      }
    case 'degrade':
    case 'unavailable':
      return { type: 'DEGRADE', variant, accessDecisionId: decision.id, reason: decision.reason }
    case 'deny':
      return { type: 'CAPABILITY_DENIED', variant, accessDecisionId: decision.id, reason: decision.reason }
  }
}

export function applyAccessDecision(actor: SurfaceActor, decision: AccessDecision): void {
  actor.send(surfaceEventFromAccessDecision(decision))
}
