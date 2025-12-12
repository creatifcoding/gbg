/**
 * AVA Client Library
 *
 * Effect-based TypeScript client for the AVA (Asset View Agent) API.
 * Provides typed HTTP and WebSocket clients with Schema validation.
 *
 * @example
 * ```typescript
 * import { Effect, Layer } from 'effect'
 * import { AvaHttpClient, AvaHttpClientDefault } from '@/lib/ava'
 *
 * const program = Effect.gen(function* () {
 *   const client = yield* AvaHttpClient
 *   const views = yield* client.listViews()
 *   console.log(views)
 * }).pipe(Effect.provide(AvaHttpClientDefault))
 *
 * Effect.runPromise(program)
 * ```
 *
 * @module
 */

// ============================================================================
// Schemas
// ============================================================================

export {
  // Branded IDs
  ViewId,
  ChannelId,
  AssemblageId,
  // Enums
  ChannelRole,
  MaterializationTier,
  // REST Response Types
  ViewSummary,
  ChannelSpec,
  ViewSpec,
  ChannelBinding,
  ViewArtifact,
  ViewStatus,
  // REST Request Types
  RegisterChannelRequest,
  RegisterViewRequest,
  RegisterViewResponse,
  InvalidateRequest,
  InvalidateResponse,
  // WebSocket Commands
  SubscribeCommand,
  UnsubscribeCommand,
  InvalidateCommand,
  PingCommand,
  SessionCommand,
  // WebSocket Events
  ArtifactEvent,
  DeltaEvent,
  StatusEvent,
  ErrorEvent,
  PongEvent,
  SessionEvent,
  // API Error
  ApiError,
} from './schemas';

export type {
  ViewId as ViewIdType,
  ChannelId as ChannelIdType,
  AssemblageId as AssemblageIdType,
  ChannelRole as ChannelRoleType,
  MaterializationTier as MaterializationTierType,
  ViewSummary as ViewSummaryType,
  ChannelSpec as ChannelSpecType,
  ViewSpec as ViewSpecType,
  ChannelBinding as ChannelBindingType,
  ViewArtifact as ViewArtifactType,
  ViewStatus as ViewStatusType,
  RegisterChannelRequest as RegisterChannelRequestType,
  RegisterViewRequest as RegisterViewRequestType,
  RegisterViewResponse as RegisterViewResponseType,
  InvalidateRequest as InvalidateRequestType,
  InvalidateResponse as InvalidateResponseType,
  SubscribeCommand as SubscribeCommandType,
  UnsubscribeCommand as UnsubscribeCommandType,
  InvalidateCommand as InvalidateCommandType,
  PingCommand as PingCommandType,
  SessionCommand as SessionCommandType,
  ArtifactEvent as ArtifactEventType,
  DeltaEvent as DeltaEventType,
  StatusEvent as StatusEventType,
  ErrorEvent as ErrorEventType,
  PongEvent as PongEventType,
  SessionEvent as SessionEventType,
  ApiError as ApiErrorType,
} from './schemas';

// ============================================================================
// HTTP Client
// ============================================================================

export {
  // Config
  AvaApiConfig,
  AvaApiConfigDefault,
  // Errors
  AvaHttpError,
  AvaNotFoundError,
  AvaValidationError,
  // Service
  AvaHttpClient,
  // Layers
  AvaHttpClientLive,
  AvaHttpClientDefault,
  makeAvaHttpClientLayer,
} from './http-client';

export type { AvaApiConfig as AvaApiConfigType } from './http-client';

// ============================================================================
// Session Client (WebSocket)
// ============================================================================

export {
  // Errors
  AvaSessionError,
  AvaSessionClosedError,
  AvaSessionParseError,
  // Service
  AvaSessionClient,
  // Layers
  AvaSessionClientLive,
  AvaSessionClientDefault,
  makeAvaSessionClientLayer,
} from './session-client';

// ============================================================================
// Test Harness
// ============================================================================

export {
  // Config
  AvaTestConfig,
  AvaTestConfigDefault,
  AvaTestConfigMock,
  // Mock Data
  mockViewSummary,
  mockViewSpec,
  mockViewArtifact,
  mockViewStatus,
  // Mock Layers
  MockHttpClientLayer,
  MockSessionClientLayer,
  // Composed Layers
  AvaTestLayerLive,
  AvaTestLayerMock,
  makeAvaTestLayer,
  // Utilities
  waitForEvent,
} from './test-harness';
