/**
 * AVA v2 Schemas Module
 *
 * Comprehensive Effect Schema definitions matching proto types.
 * Provides runtime validation, branded types, and type inference.
 *
 * @pattern Effect Schema barrel exports
 * @see src-ava/proto/ava/ for proto definitions
 * @module
 */

// ============================================================================
// Identifiers (Branded Types)
// ============================================================================

export {
  // Branded identifiers
  ViewId,
  ChannelId,
  AssemblageId,
  AssetId,
  SourceId,
  FiberId,
  SessionId,
  CorrelationId,
  EventSequence,
  EventSequenceFromString,
  // Constructors
  makeViewId,
  makeChannelId,
  makeAssemblageId,
  makeAssetId,
  makeSourceId,
  makeFiberId,
  makeSessionId,
  makeCorrelationId,
  makeEventSequence,
} from './identifiers'

// ============================================================================
// Enums
// ============================================================================

export {
  // Channel
  ChannelRole,
  ChannelRoleShort,
  ChannelDisplayRole,
  // Materialization
  MaterializationTier,
  MaterializationTierShort,
  // Artifact state
  ArtifactState,
  DeactivationReason,
  ReplacementReason,
  // Events
  UnmountReason,
  SuspendReason,
  InvalidationScope,
  RequestPriority,
  // Pipeline
  JoinType,
  OutputFormat,
  DataFormat,
  Codec,
  // Stream
  StreamProtocol,
  OverflowStrategy,
  // Fiber
  FiberPriority,
  YieldReason,
  CancelReason,
} from './enums'

// ============================================================================
// Artifacts (Core Runtime Types)
// ============================================================================

export {
  // Timestamps
  Timestamp,
  TimestampMs,
  // Spec types
  ChannelSpec,
  ViewProfileSpec,
  // Binding types
  ChannelBinding,
  ArtifactMetrics,
  // Core artifact
  ViewArtifact,
  // Delta types
  RowRange,
  ChannelUpdated,
  ChannelActivated,
  ChannelDeactivated,
  ChannelCleared,
  ArtifactReplaced,
  StateChanged,
  MetadataUpdated,
  ViewDeltaPayload,
  ViewDelta,
  // Tagged messages
  TaggedArtifact,
  TaggedDelta,
} from './artifacts'

// ============================================================================
// Events (Lifecycle Types)
// ============================================================================

export {
  // View lifecycle events
  ViewRequested,
  ViewCompiling,
  ViewMounted,
  ViewUpdated,
  ViewUnmounted,
  ViewCompilationFailed,
  ViewSuspended,
  ViewResumed,
  ViewInvalidated,
  ViewSpecUpdated,
  ReconcilerEventPayload,
  ReconcilerEvent,
  // Fiber actions
  FiberSpawned,
  FiberYielded,
  FiberResumed,
  FiberCompleted,
  FiberFailed,
  FiberCancelled,
  FiberActionPayload,
  FiberAction,
  // Query
  EventFilter,
} from './events'

// ============================================================================
// Channel Data (Hydration Payloads)
// ============================================================================

export {
  // Channel data variants
  ChannelDataInline,
  ChannelDataRows,
  ChannelDataAssetRef,
  ChannelDataStreamHandle,
  ChannelDataError,
  ChannelDataPending,
  // Union type
  ChannelData,
  // Type guards
  isHydrated,
  isError,
  isPending,
  isInline,
  isRows,
  isAssetRef,
  isStreamHandle,
} from './channel-data'

// ============================================================================
// Status Events (NATS status.* subjects)
// ============================================================================

export {
  // Status types
  ViewLifecycleStatus,
  ViewStatusEvent,
  // Invalidation types
  InvalidationReason,
  InvalidationReasonSourceUpdate,
  InvalidationReasonClientRequest,
  InvalidationReasonConfigChange,
  InvalidationReasonStaleData,
  InvalidationReasonDependencyInvalidated,
  InvalidationReasonManual,
  InvalidationEvent,
  InvalidationRequest,
  SubscribeRequest,
  UnsubscribeRequest,
} from './status'

// ============================================================================
// Type Re-exports (for convenience)
// ============================================================================

export type {
  // Identifiers
  ViewId as ViewIdType,
  ChannelId as ChannelIdType,
  AssemblageId as AssemblageIdType,
  AssetId as AssetIdType,
  SourceId as SourceIdType,
  FiberId as FiberIdType,
  SessionId as SessionIdType,
  CorrelationId as CorrelationIdType,
  EventSequence as EventSequenceType,
} from './identifiers'

export type {
  // Enums
  ChannelRole as ChannelRoleType,
  ChannelRoleShort as ChannelRoleShortType,
  ChannelDisplayRole as ChannelDisplayRoleType,
  MaterializationTier as MaterializationTierType,
  MaterializationTierShort as MaterializationTierShortType,
  ArtifactState as ArtifactStateType,
  DeactivationReason as DeactivationReasonType,
  ReplacementReason as ReplacementReasonType,
  UnmountReason as UnmountReasonType,
  SuspendReason as SuspendReasonType,
  InvalidationScope as InvalidationScopeType,
  RequestPriority as RequestPriorityType,
  JoinType as JoinTypeType,
  OutputFormat as OutputFormatType,
  DataFormat as DataFormatType,
  Codec as CodecType,
  StreamProtocol as StreamProtocolType,
  OverflowStrategy as OverflowStrategyType,
  FiberPriority as FiberPriorityType,
  YieldReason as YieldReasonType,
  CancelReason as CancelReasonType,
} from './enums'

export type {
  // Artifacts
  Timestamp as TimestampType,
  TimestampMs as TimestampMsType,
  ChannelSpec as ChannelSpecType,
  ViewProfileSpec as ViewProfileSpecType,
  ChannelBinding as ChannelBindingType,
  ArtifactMetrics as ArtifactMetricsType,
  ViewArtifact as ViewArtifactType,
  RowRange as RowRangeType,
  ChannelUpdated as ChannelUpdatedType,
  ChannelActivated as ChannelActivatedType,
  ChannelDeactivated as ChannelDeactivatedType,
  ChannelCleared as ChannelClearedType,
  ArtifactReplaced as ArtifactReplacedType,
  StateChanged as StateChangedType,
  MetadataUpdated as MetadataUpdatedType,
  ViewDeltaPayload as ViewDeltaPayloadType,
  ViewDelta as ViewDeltaType,
  TaggedArtifact as TaggedArtifactType,
  TaggedDelta as TaggedDeltaType,
} from './artifacts'

export type {
  // Events
  ViewRequested as ViewRequestedType,
  ViewCompiling as ViewCompilingType,
  ViewMounted as ViewMountedType,
  ViewUpdated as ViewUpdatedType,
  ViewUnmounted as ViewUnmountedType,
  ViewCompilationFailed as ViewCompilationFailedType,
  ViewSuspended as ViewSuspendedType,
  ViewResumed as ViewResumedType,
  ViewInvalidated as ViewInvalidatedType,
  ViewSpecUpdated as ViewSpecUpdatedType,
  ReconcilerEventPayload as ReconcilerEventPayloadType,
  ReconcilerEvent as ReconcilerEventType,
  FiberSpawned as FiberSpawnedType,
  FiberYielded as FiberYieldedType,
  FiberResumed as FiberResumedType,
  FiberCompleted as FiberCompletedType,
  FiberFailed as FiberFailedType,
  FiberCancelled as FiberCancelledType,
  FiberActionPayload as FiberActionPayloadType,
  FiberAction as FiberActionType,
  EventFilter as EventFilterType,
} from './events'

export type {
  // Channel data
  ChannelDataInline as ChannelDataInlineType,
  ChannelDataRows as ChannelDataRowsType,
  ChannelDataAssetRef as ChannelDataAssetRefType,
  ChannelDataStreamHandle as ChannelDataStreamHandleType,
  ChannelDataError as ChannelDataErrorType,
  ChannelDataPending as ChannelDataPendingType,
  ChannelData as ChannelDataType,
} from './channel-data'

export type {
  // Status
  ViewLifecycleStatus as ViewLifecycleStatusType,
  ViewStatusEvent as ViewStatusEventType,
  InvalidationReason as InvalidationReasonType,
  InvalidationEvent as InvalidationEventType,
  InvalidationRequest as InvalidationRequestType,
  SubscribeRequest as SubscribeRequestType,
  UnsubscribeRequest as UnsubscribeRequestType,
} from './status'
