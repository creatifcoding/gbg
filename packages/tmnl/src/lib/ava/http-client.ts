/**
 * AVA HTTP Client Service
 *
 * Effect-based HTTP client for the AVA REST API.
 * Provides typed requests/responses with Schema validation.
 *
 * @module
 */

import { Context, Data, Effect, Layer, Schema } from 'effect';
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from '@effect/platform';
import { FetchHttpClient } from '@effect/platform';

import {
  ViewSummary,
  ViewSpec,
  ViewArtifact,
  ViewStatus,
  RegisterViewRequest,
  RegisterViewResponse,
  InvalidateRequest,
  InvalidateResponse,
} from './schemas';

// ============================================================================
// Configuration
// ============================================================================

/** AVA API configuration */
export interface AvaApiConfig {
  readonly baseUrl: string;
  readonly timeout?: number;
}

export const AvaApiConfig = Context.GenericTag<AvaApiConfig>('ava/ApiConfig');

/** Default configuration for local development */
export const AvaApiConfigDefault = Layer.succeed(AvaApiConfig, {
  baseUrl: 'http://localhost:3000',
  timeout: 30000,
});

// ============================================================================
// Errors
// ============================================================================

/** AVA HTTP client errors */
export class AvaHttpError extends Data.TaggedError('AvaHttpError')<{
  readonly operation: string;
  readonly status?: number;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class AvaNotFoundError extends Data.TaggedError('AvaNotFoundError')<{
  readonly resource: string;
  readonly id: string;
}> {}

export class AvaValidationError extends Data.TaggedError('AvaValidationError')<{
  readonly operation: string;
  readonly message: string;
}> {}

// ============================================================================
// Service Definition
// ============================================================================

/** AVA HTTP Client service interface */
export interface AvaHttpClient {
  /**
   * List all registered views
   * GET /api/v1/views
   */
  readonly listViews: () => Effect.Effect<
    ReadonlyArray<ViewSummary>,
    AvaHttpError | AvaNotFoundError
  >;

  /**
   * Register a new view specification
   * POST /api/v1/views
   */
  readonly registerView: (
    request: RegisterViewRequest
  ) => Effect.Effect<RegisterViewResponse, AvaHttpError | AvaValidationError>;

  /**
   * Get view specification
   * GET /api/v1/views/{id}/spec
   */
  readonly getSpec: (
    viewId: string
  ) => Effect.Effect<ViewSpec, AvaHttpError | AvaNotFoundError>;

  /**
   * Get view artifact (runtime state)
   * GET /api/v1/views/{id}/artifact
   */
  readonly getArtifact: (
    viewId: string
  ) => Effect.Effect<ViewArtifact, AvaHttpError | AvaNotFoundError>;

  /**
   * Get view status
   * GET /api/v1/views/{id}/status
   */
  readonly getStatus: (
    viewId: string
  ) => Effect.Effect<ViewStatus, AvaHttpError | AvaNotFoundError>;

  /**
   * Invalidate a view (trigger recompilation)
   * POST /api/v1/views/{id}/invalidate
   */
  readonly invalidate: (
    viewId: string,
    request?: InvalidateRequest
  ) => Effect.Effect<InvalidateResponse, AvaHttpError | AvaNotFoundError>;
}

export const AvaHttpClient =
  Context.GenericTag<AvaHttpClient>('ava/HttpClient');

// ============================================================================
// Service Implementation
// ============================================================================

const make = Effect.gen(function* () {
  const config = yield* AvaApiConfig;
  const defaultClient = yield* HttpClient.HttpClient;

  // Configure client with base URL
  const client = defaultClient.pipe(
    HttpClient.mapRequest(HttpClientRequest.prependUrl(config.baseUrl)),
    HttpClient.filterStatusOk
  );

  // Helper to handle HTTP errors (returns error value, not Effect)
  const handleHttpError =
    (operation: string) =>
    (error: unknown): AvaHttpError | AvaNotFoundError => {
      if (
        error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'status' in error.response
      ) {
        const status = error.response.status as number;
        if (status === 404) {
          return new AvaNotFoundError({
            resource: 'view',
            id: operation,
          });
        }
        return new AvaHttpError({
          operation,
          status,
          message: `HTTP ${status}`,
          cause: error,
        });
      }
      return new AvaHttpError({
        operation,
        message: String(error),
        cause: error,
      });
    };

  return {
    listViews: () =>
      client.get('/api/v1/views').pipe(
        Effect.flatMap(
          HttpClientResponse.schemaBodyJson(Schema.Array(ViewSummary))
        ),
        Effect.mapError(handleHttpError('listViews')),
        Effect.withSpan('AvaHttpClient.listViews')
      ),

    registerView: (request: RegisterViewRequest) =>
      HttpClientRequest.post('/api/v1/views').pipe(
        HttpClientRequest.schemaBodyJson(RegisterViewRequest)(request),
        Effect.flatMap(client.execute),
        Effect.flatMap(
          HttpClientResponse.schemaBodyJson(RegisterViewResponse)
        ),
        Effect.mapError((error): AvaHttpError | AvaValidationError => {
          if (
            error &&
            typeof error === 'object' &&
            '_tag' in error &&
            error._tag === 'ParseError'
          ) {
            return new AvaValidationError({
              operation: 'registerView',
              message: String(error),
            });
          }
          return new AvaHttpError({
            operation: 'registerView',
            message: String(error),
            cause: error,
          });
        }),
        Effect.withSpan('AvaHttpClient.registerView', {
          attributes: { viewName: request.name },
        })
      ),

    getSpec: (viewId: string) =>
      client.get(`/api/v1/views/${viewId}/spec`).pipe(
        Effect.flatMap(HttpClientResponse.schemaBodyJson(ViewSpec)),
        Effect.mapError(handleHttpError(`getSpec:${viewId}`)),
        Effect.withSpan('AvaHttpClient.getSpec', { attributes: { viewId } })
      ),

    getArtifact: (viewId: string) =>
      client.get(`/api/v1/views/${viewId}/artifact`).pipe(
        Effect.flatMap(HttpClientResponse.schemaBodyJson(ViewArtifact)),
        Effect.mapError(handleHttpError(`getArtifact:${viewId}`)),
        Effect.withSpan('AvaHttpClient.getArtifact', { attributes: { viewId } })
      ),

    getStatus: (viewId: string) =>
      client.get(`/api/v1/views/${viewId}/status`).pipe(
        Effect.flatMap(HttpClientResponse.schemaBodyJson(ViewStatus)),
        Effect.mapError(handleHttpError(`getStatus:${viewId}`)),
        Effect.withSpan('AvaHttpClient.getStatus', { attributes: { viewId } })
      ),

    invalidate: (viewId: string, request?: InvalidateRequest) =>
      HttpClientRequest.post(`/api/v1/views/${viewId}/invalidate`).pipe(
        HttpClientRequest.schemaBodyJson(InvalidateRequest)(request ?? {}),
        Effect.flatMap(client.execute),
        Effect.flatMap(HttpClientResponse.schemaBodyJson(InvalidateResponse)),
        Effect.mapError(handleHttpError(`invalidate:${viewId}`)),
        Effect.withSpan('AvaHttpClient.invalidate', { attributes: { viewId } })
      ),
  } satisfies AvaHttpClient;
});

// ============================================================================
// Layer
// ============================================================================

/** Live layer for AvaHttpClient */
export const AvaHttpClientLive = Layer.effect(AvaHttpClient, make).pipe(
  Layer.provide(FetchHttpClient.layer)
);

/** Full layer with default config */
export const AvaHttpClientDefault = AvaHttpClientLive.pipe(
  Layer.provide(AvaApiConfigDefault)
);

/** Create layer with custom config */
export const makeAvaHttpClientLayer = (config: AvaApiConfig) =>
  AvaHttpClientLive.pipe(Layer.provide(Layer.succeed(AvaApiConfig, config)));
