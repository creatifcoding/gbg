/**
 * Context Event Handlers — graph projections for Work Order context.
 *
 * ContextEvents remain durable facts. These handlers materialize relationship
 * topology only: WorkOrder graph nodes, context-owned relationship edges, and
 * the relationship edge audit trail via GraphClient. They do not dispatch
 * Reactor target mutations.
 *
 * IMPORTANT: EventLog.group handlers must return Effect<void, never, R>.
 * All errors are caught and logged, never propagated.
 *
 * @module @gbg/tmnl/iiot/handlers/context-handlers
 */

import { Cause, Effect, Option } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import { ContextEvents } from '../schemas/events/groups'
import type { AssetId } from '../schemas/identifiers'
import {
  RelationshipEdgeMetadata,
  type RelationshipEdgeType,
  type RelationshipNodeType,
} from '../schemas/relationships'
import { GraphClient } from '../services/l1/GraphClient'

// =============================================================================
// Projection port
// =============================================================================

interface RelationshipEndpointInput {
  readonly type: RelationshipNodeType
  readonly id: string
}

export interface RelationshipGraphProjectionPort {
  readonly upsertRelationshipNode: (
    endpoint: RelationshipEndpointInput,
    properties?: Record<string, string | number | boolean | null | undefined>,
  ) => Effect.Effect<void, unknown>
  readonly upsertRelationshipEdge: (input: {
    readonly source: RelationshipEndpointInput
    readonly target: RelationshipEndpointInput
    readonly edgeType: RelationshipEdgeType
    readonly metadata: RelationshipEdgeMetadata
  }) => Effect.Effect<void, unknown>
  readonly softDeleteRelationshipEdge: (input: {
    readonly source: RelationshipEndpointInput
    readonly target: RelationshipEndpointInput
    readonly edgeType: RelationshipEdgeType
    readonly reason?: string
  }) => Effect.Effect<void, unknown>
}

interface ContextPayloadBase {
  readonly eventId: string
  readonly causedBy: string
  readonly workOrderId: string
  readonly contextId: string
}

interface ContextCreatedPayload extends ContextPayloadBase {
  readonly initialAssets: readonly AssetId[]
}

interface AssetAttachedPayload extends ContextPayloadBase {
  readonly attachedAssetId: AssetId
  readonly assetRole: 'primary_target' | 'secondary_target' | 'support' | 'reference'
  readonly notes: Option.Option<string>
}

interface AssetDetachedPayload extends ContextPayloadBase {
  readonly detachedAssetId: AssetId
  readonly reason: 'scope_change' | 'error_correction' | 'work_complete' | 'asset_unavailable' | 'other'
  readonly notes: Option.Option<string>
}

interface ResourceAllocatedPayload extends ContextPayloadBase {
  readonly resourceId: string
  readonly resourceType: string
  readonly resourceName: string
  readonly allocatedBy: string
}

interface ResourceReleasedPayload extends ContextPayloadBase {
  readonly resourceId: string
  readonly releaseReason: string
  readonly releasedBy: string
}

interface ExternalRefLinkedPayload extends ContextPayloadBase {
  readonly externalRefId: string
  readonly externalSystem: string
  readonly externalType: string
  readonly externalIdentifier: string
}

interface ExternalRefUnlinkedPayload extends ContextPayloadBase {
  readonly externalRefId: string
  readonly reason: string
}

interface ChildWorkOrderSpawnedPayload extends ContextPayloadBase {
  readonly childWorkOrderId: string
  readonly childType: string
  readonly reason: string
  readonly inheritAssets: boolean
  readonly inheritResources: boolean
}

// =============================================================================
// Materialization helpers
// =============================================================================

export const resolveRelationshipNodeTypeFromAssetId = (
  assetId: string,
): RelationshipNodeType | undefined => {
  if (assetId.startsWith('ENT-')) return 'enterprise'
  if (assetId.startsWith('SIT-')) return 'site'
  if (assetId.startsWith('ARA-') || assetId.startsWith('AREA-')) return 'area'
  if (assetId.startsWith('PLT-')) return 'plant'
  if (assetId.startsWith('LIN-')) return 'line'
  if (assetId.startsWith('WCL-')) return 'workcell'
  if (assetId.startsWith('MCH-')) return 'machine'
  if (assetId.startsWith('SNS-') || assetId.startsWith('SEN-')) return 'sensor'
  if (assetId.startsWith('DEV-')) return 'device'
  return undefined
}

export const selectExternalRefRelationship = (externalType: string): RelationshipEdgeType => {
  const normalized = externalType.toLowerCase()
  return normalized.includes('report') ||
    normalized.includes('document') ||
    normalized.includes('certificate') ||
    normalized.includes('artifact')
    ? 'produces'
    : 'requires'
}

const contextRecord = (
  eventTag: string,
  payload: ContextPayloadBase,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  eventTag,
  eventId: payload.eventId,
  contextId: payload.contextId,
  ...extra,
})

const edgeMetadata = (
  eventTag: string,
  payload: ContextPayloadBase,
  reason: string,
  extra: Record<string, unknown> = {},
): RelationshipEdgeMetadata => new RelationshipEdgeMetadata({
  createdBy: payload.causedBy,
  reason,
  context: contextRecord(eventTag, payload, extra),
})

const noteText = (value: Option.Option<string>): string | undefined => Option.getOrUndefined(value)

const workOrderEndpoint = (workOrderId: string): RelationshipEndpointInput => ({
  type: 'work_order',
  id: workOrderId,
})

const externalEndpoint = (externalId: string): RelationshipEndpointInput => ({
  type: 'external',
  id: externalId,
})

const upsertWorkOrderNode = (
  graph: RelationshipGraphProjectionPort,
  payload: ContextPayloadBase,
  status?: string,
) => graph.upsertRelationshipNode(workOrderEndpoint(payload.workOrderId), {
  context_id: payload.contextId,
  projected_from: 'ContextEvents',
  ...(status ? { status } : {}),
})

const upsertExternalNode = (
  graph: RelationshipGraphProjectionPort,
  id: string,
  properties: Record<string, string | number | boolean | null | undefined>,
) => graph.upsertRelationshipNode(externalEndpoint(id), {
  projected_from: 'ContextEvents',
  ...properties,
})

const upsertAssetTargetNode = (
  graph: RelationshipGraphProjectionPort,
  assetId: string,
): Effect.Effect<RelationshipEndpointInput | undefined, unknown> => {
  const targetType = resolveRelationshipNodeTypeFromAssetId(assetId)
  if (!targetType) {
    return Effect.logWarning(`[ContextEventHandler] Could not resolve asset type for ${assetId}`).pipe(
      Effect.as(undefined),
    )
  }

  const endpoint = { type: targetType, id: assetId } satisfies RelationshipEndpointInput
  return graph.upsertRelationshipNode(endpoint, {
    projected_from: 'ContextEvents',
  }).pipe(Effect.as(endpoint))
}

const upsertTargetEdge = (
  graph: RelationshipGraphProjectionPort,
  payload: ContextPayloadBase,
  assetId: string,
  eventTag: string,
  reason: string,
  extra: Record<string, unknown> = {},
): Effect.Effect<void, unknown> => Effect.gen(function* () {
  const target = yield* upsertAssetTargetNode(graph, assetId)
  if (!target) return

  yield* graph.upsertRelationshipEdge({
    source: workOrderEndpoint(payload.workOrderId),
    target,
    edgeType: 'targets',
    metadata: edgeMetadata(eventTag, payload, reason, { assetId, ...extra }),
  })
})

const softDeleteTargetEdge = (
  graph: RelationshipGraphProjectionPort,
  payload: ContextPayloadBase,
  assetId: string,
  reason: string,
): Effect.Effect<void, unknown> => Effect.gen(function* () {
  const target = yield* upsertAssetTargetNode(graph, assetId)
  if (!target) return

  yield* graph.softDeleteRelationshipEdge({
    source: workOrderEndpoint(payload.workOrderId),
    target,
    edgeType: 'targets',
    reason,
  })
})

// =============================================================================
// Projector
// =============================================================================

export const makeContextRelationshipProjector = (graph: RelationshipGraphProjectionPort) => ({
  projectContextCreated: (payload: ContextCreatedPayload): Effect.Effect<void, unknown> =>
    Effect.gen(function* () {
      yield* upsertWorkOrderNode(graph, payload)
      for (const assetId of payload.initialAssets) {
        yield* upsertTargetEdge(graph, payload, assetId, 'ContextCreated', 'initial_asset', {
          sourceField: 'initialAssets',
        })
      }
    }),

  projectAssetAttached: (payload: AssetAttachedPayload): Effect.Effect<void, unknown> =>
    Effect.gen(function* () {
      yield* upsertWorkOrderNode(graph, payload)
      if (payload.assetRole === 'support' || payload.assetRole === 'reference') {
        yield* Effect.logDebug(
          `[ContextEventHandler] Skipping ${payload.assetRole} AssetAttached target edge until related_to supports structural assets`,
        )
        return
      }
      yield* upsertTargetEdge(graph, payload, payload.attachedAssetId, 'AssetAttached', payload.assetRole, {
        assetRole: payload.assetRole,
        notes: noteText(payload.notes),
      })
    }),

  projectAssetDetached: (payload: AssetDetachedPayload): Effect.Effect<void, unknown> =>
    Effect.gen(function* () {
      yield* upsertWorkOrderNode(graph, payload)
      yield* softDeleteTargetEdge(graph, payload, payload.detachedAssetId, payload.reason)
    }),

  projectResourceAllocated: (payload: ResourceAllocatedPayload): Effect.Effect<void, unknown> =>
    Effect.gen(function* () {
      yield* upsertWorkOrderNode(graph, payload)
      yield* upsertExternalNode(graph, payload.resourceId, {
        external_kind: 'resource',
        resource_type: payload.resourceType,
        name: payload.resourceName,
      })
      yield* graph.upsertRelationshipEdge({
        source: workOrderEndpoint(payload.workOrderId),
        target: externalEndpoint(payload.resourceId),
        edgeType: 'requires',
        metadata: edgeMetadata('ResourceAllocated', payload, 'resource_allocated', {
          resourceType: payload.resourceType,
          resourceName: payload.resourceName,
          allocatedBy: payload.allocatedBy,
        }),
      })
    }),

  projectResourceReleased: (payload: ResourceReleasedPayload): Effect.Effect<void, unknown> =>
    Effect.gen(function* () {
      yield* upsertWorkOrderNode(graph, payload)
      yield* upsertExternalNode(graph, payload.resourceId, { external_kind: 'resource' })
      yield* graph.softDeleteRelationshipEdge({
        source: workOrderEndpoint(payload.workOrderId),
        target: externalEndpoint(payload.resourceId),
        edgeType: 'requires',
        reason: payload.releaseReason,
      })
    }),

  projectExternalRefLinked: (payload: ExternalRefLinkedPayload): Effect.Effect<void, unknown> =>
    Effect.gen(function* () {
      const edgeType = selectExternalRefRelationship(payload.externalType)
      yield* upsertWorkOrderNode(graph, payload)
      yield* upsertExternalNode(graph, payload.externalRefId, {
        external_kind: 'reference',
        external_system: payload.externalSystem,
        external_type: payload.externalType,
        external_identifier: payload.externalIdentifier,
      })
      yield* graph.upsertRelationshipEdge({
        source: workOrderEndpoint(payload.workOrderId),
        target: externalEndpoint(payload.externalRefId),
        edgeType,
        metadata: edgeMetadata('ExternalRefLinked', payload, `external_ref_${edgeType}`, {
          externalSystem: payload.externalSystem,
          externalType: payload.externalType,
          externalIdentifier: payload.externalIdentifier,
        }),
      })
    }),

  projectExternalRefUnlinked: (payload: ExternalRefUnlinkedPayload): Effect.Effect<void, unknown> =>
    Effect.gen(function* () {
      yield* upsertWorkOrderNode(graph, payload)
      yield* upsertExternalNode(graph, payload.externalRefId, { external_kind: 'reference' })
      yield* graph.softDeleteRelationshipEdge({
        source: workOrderEndpoint(payload.workOrderId),
        target: externalEndpoint(payload.externalRefId),
        edgeType: 'requires',
        reason: payload.reason,
      })
      yield* graph.softDeleteRelationshipEdge({
        source: workOrderEndpoint(payload.workOrderId),
        target: externalEndpoint(payload.externalRefId),
        edgeType: 'produces',
        reason: payload.reason,
      })
    }),

  projectChildWorkOrderSpawned: (payload: ChildWorkOrderSpawnedPayload): Effect.Effect<void, unknown> =>
    Effect.gen(function* () {
      yield* upsertWorkOrderNode(graph, payload)
      yield* graph.upsertRelationshipNode(workOrderEndpoint(payload.childWorkOrderId), {
        parent_context_id: payload.contextId,
        child_type: payload.childType,
        projected_from: 'ContextEvents',
      })
      yield* graph.upsertRelationshipEdge({
        source: workOrderEndpoint(payload.workOrderId),
        target: workOrderEndpoint(payload.childWorkOrderId),
        edgeType: 'depends_on',
        metadata: edgeMetadata('ChildWorkOrderSpawned', payload, 'child_work_order_spawned', {
          childType: payload.childType,
          inheritAssets: payload.inheritAssets,
          inheritResources: payload.inheritResources,
        }),
      })
      yield* graph.upsertRelationshipEdge({
        source: workOrderEndpoint(payload.childWorkOrderId),
        target: workOrderEndpoint(payload.workOrderId),
        edgeType: 'caused_by',
        metadata: edgeMetadata('ChildWorkOrderSpawned', payload, 'child_work_order_spawned', {
          childType: payload.childType,
        }),
      })
    }),
})

export type ContextRelationshipProjector = ReturnType<typeof makeContextRelationshipProjector>

// =============================================================================
// Handler implementation
// =============================================================================

const catchHandlerError = <A, E, R>(handlerName: string, effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.catchAllCause((cause) =>
      Effect.log(`[ContextEventHandler] ${handlerName} failed: ${Cause.pretty(cause)}`)
    ),
    Effect.asVoid,
  )

const projectWithGraph = (
  label: string,
  f: (projector: ContextRelationshipProjector) => Effect.Effect<void, unknown>,
) => Effect.gen(function* () {
  const graph = yield* Effect.serviceOption(GraphClient)
  if (Option.isNone(graph)) return
  yield* f(makeContextRelationshipProjector(graph.value))
}).pipe(catchHandlerError(`${label}.projectGraph`))

/** ContextEventHandlers — audit logs plus graph relationship projection. */
export const ContextEventHandlers = EventLog.group(ContextEvents, (handlers) =>
  handlers
    .handle('ContextCreated', ({ payload }) =>
      catchHandlerError(
        'ContextCreated',
        Effect.gen(function* () {
          yield* Effect.log(
            `[ContextEventHandler] Context created: contextId=${payload.contextId}, ` +
              `workOrderId=${payload.workOrderId}, initialAssets=${payload.initialAssets.length}`,
          )
          yield* projectWithGraph('ContextCreated', (projector) => projector.projectContextCreated(payload))
        }),
      )
    )

    .handle('ContextUpdated', ({ payload }) =>
      catchHandlerError(
        'ContextUpdated',
        Effect.gen(function* () {
          const prevSummary = Option.isSome(payload.previousValue)
            ? JSON.stringify(payload.previousValue.value).slice(0, 50)
            : '<none>'
          const newSummary = JSON.stringify(payload.newValue).slice(0, 50)
          const reasonText = Option.isSome(payload.reason) ? ` reason=${payload.reason.value}` : ''
          yield* Effect.log(
            `[ContextEventHandler] Context updated: contextId=${payload.contextId}, ` +
              `field=${payload.fieldName}, previous=${prevSummary}, new=${newSummary}${reasonText}`,
          )
        }),
      )
    )

    .handle('ContextSnapshotted', ({ payload }) =>
      catchHandlerError(
        'ContextSnapshotted',
        Effect.gen(function* () {
          const notesText = Option.isSome(payload.notes) ? ` notes=${payload.notes.value}` : ''
          yield* Effect.log(
            `[ContextEventHandler] Context snapshotted: contextId=${payload.contextId}, ` +
              `snapshotId=${payload.snapshotId}, reason=${payload.snapshotReason}${notesText}`,
          )
        }),
      )
    )

    .handle('AssetAttached', ({ payload }) =>
      catchHandlerError(
        'AssetAttached',
        Effect.gen(function* () {
          const notesText = Option.isSome(payload.notes) ? ` notes=${payload.notes.value}` : ''
          yield* Effect.log(
            `[ContextEventHandler] Asset attached: contextId=${payload.contextId}, ` +
              `assetId=${payload.attachedAssetId}, role=${payload.assetRole}${notesText}`,
          )
          yield* projectWithGraph('AssetAttached', (projector) => projector.projectAssetAttached(payload))
        }),
      )
    )

    .handle('AssetDetached', ({ payload }) =>
      catchHandlerError(
        'AssetDetached',
        Effect.gen(function* () {
          const notesText = Option.isSome(payload.notes) ? ` notes=${payload.notes.value}` : ''
          yield* Effect.log(
            `[ContextEventHandler] Asset detached: contextId=${payload.contextId}, ` +
              `assetId=${payload.detachedAssetId}, reason=${payload.reason}${notesText}`,
          )
          yield* projectWithGraph('AssetDetached', (projector) => projector.projectAssetDetached(payload))
        }),
      )
    )

    .handle('ResourceAllocated', ({ payload }) =>
      catchHandlerError(
        'ResourceAllocated',
        Effect.gen(function* () {
          const quantityText = Option.isSome(payload.quantity) ? ` quantity=${payload.quantity.value}` : ''
          const unitText = Option.isSome(payload.unit) ? payload.unit.value : ''
          yield* Effect.log(
            `[ContextEventHandler] Resource allocated: contextId=${payload.contextId}, ` +
              `resourceId=${payload.resourceId}, type=${payload.resourceType}, ` +
              `name=${payload.resourceName}${quantityText}${unitText}, allocatedBy=${payload.allocatedBy}`,
          )
          yield* projectWithGraph('ResourceAllocated', (projector) => projector.projectResourceAllocated(payload))
        }),
      )
    )

    .handle('ResourceReleased', ({ payload }) =>
      catchHandlerError(
        'ResourceReleased',
        Effect.gen(function* () {
          const quantityText = Option.isSome(payload.quantityReturned)
            ? ` quantityReturned=${payload.quantityReturned.value}`
            : ''
          const conditionText = Option.isSome(payload.conditionNotes)
            ? ` condition=${payload.conditionNotes.value}`
            : ''
          yield* Effect.log(
            `[ContextEventHandler] Resource released: contextId=${payload.contextId}, ` +
              `resourceId=${payload.resourceId}, reason=${payload.releaseReason}, ` +
              `releasedBy=${payload.releasedBy}${quantityText}${conditionText}`,
          )
          yield* projectWithGraph('ResourceReleased', (projector) => projector.projectResourceReleased(payload))
        }),
      )
    )

    .handle('ExternalRefLinked', ({ payload }) =>
      catchHandlerError(
        'ExternalRefLinked',
        Effect.gen(function* () {
          const urlText = Option.isSome(payload.linkUrl) ? ` url=${payload.linkUrl.value}` : ''
          yield* Effect.log(
            `[ContextEventHandler] External ref linked: contextId=${payload.contextId}, ` +
              `refId=${payload.externalRefId}, system=${payload.externalSystem}, ` +
              `type=${payload.externalType}, externalId=${payload.externalIdentifier}${urlText}`,
          )
          yield* projectWithGraph('ExternalRefLinked', (projector) => projector.projectExternalRefLinked(payload))
        }),
      )
    )

    .handle('ExternalRefUnlinked', ({ payload }) =>
      catchHandlerError(
        'ExternalRefUnlinked',
        Effect.gen(function* () {
          const notesText = Option.isSome(payload.notes) ? ` notes=${payload.notes.value}` : ''
          yield* Effect.log(
            `[ContextEventHandler] External ref unlinked: contextId=${payload.contextId}, ` +
              `refId=${payload.externalRefId}, reason=${payload.reason}${notesText}`,
          )
          yield* projectWithGraph('ExternalRefUnlinked', (projector) => projector.projectExternalRefUnlinked(payload))
        }),
      )
    )

    .handle('ChildWorkOrderSpawned', ({ payload }) =>
      catchHandlerError(
        'ChildWorkOrderSpawned',
        Effect.gen(function* () {
          yield* Effect.log(
            `[ContextEventHandler] Child work order spawned: parentContextId=${payload.contextId}, ` +
              `childWorkOrderId=${payload.childWorkOrderId}, type=${payload.childType}, ` +
              `reason=${payload.reason}, inheritAssets=${payload.inheritAssets}, ` +
              `inheritResources=${payload.inheritResources}`,
          )
          yield* projectWithGraph('ChildWorkOrderSpawned', (projector) => projector.projectChildWorkOrderSpawned(payload))
        }),
      )
    )
)

export type ContextEventHandlersLayer = typeof ContextEventHandlers
