/**
 * Holonet Permission Model
 *
 * Implements scope-based permission checking for durable-streams operations.
 * Supports wildcard patterns and permission inheritance.
 *
 * @module holonet/core/auth/permissions
 */

import { Effect } from 'effect';
import type {
  HolonetClaims,
  StreamOperation,
  StreamPermission,
  StreamScope,
  PermissionResult,
} from './schemas';

// =============================================================================
// Permission Mapping
// =============================================================================

/**
 * Maps stream operations to required permissions
 */
export const OPERATION_PERMISSIONS: Record<StreamOperation, StreamPermission> = {
  create: 'stream:create',
  read: 'stream:read',
  append: 'stream:write',
  delete: 'stream:delete',
  metadata: 'stream:read',
} as const;

/**
 * Permission hierarchy - higher permissions include lower ones
 * admin > delete > write > create > read
 */
export const PERMISSION_HIERARCHY: Record<StreamPermission, StreamPermission[]> = {
  'stream:admin': ['stream:admin', 'stream:delete', 'stream:write', 'stream:create', 'stream:read'],
  'stream:delete': ['stream:delete', 'stream:write', 'stream:create', 'stream:read'],
  'stream:write': ['stream:write', 'stream:read'],
  'stream:create': ['stream:create', 'stream:read'],
  'stream:read': ['stream:read'],
} as const;

// =============================================================================
// Scope Matching
// =============================================================================

/**
 * Check if a scope pattern matches a stream ID
 *
 * @example
 * scopeMatches('stream:*', 'my-stream')           // true
 * scopeMatches('stream:sensor-*', 'sensor-001')   // true
 * scopeMatches('stream:sensor-*', 'other-001')    // false
 * scopeMatches('stream:my-stream', 'my-stream')   // true
 */
export const scopeMatches = (scope: StreamScope, streamId: string): boolean => {
  // Remove 'stream:' prefix
  const pattern = scope.replace(/^stream:/, '');

  if (pattern === '*') {
    return true;
  }

  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return streamId.startsWith(prefix);
  }

  return pattern === streamId;
};

/**
 * Check if any scope in the list matches the stream ID
 */
export const anyScopeMatches = (
  scopes: readonly StreamScope[] | undefined,
  streamId: string
): boolean => {
  if (!scopes || scopes.length === 0) {
    // No scopes defined = all streams allowed (subject to permissions)
    return true;
  }
  return scopes.some((scope) => scopeMatches(scope, streamId));
};

// =============================================================================
// Permission Checking
// =============================================================================

/**
 * Check if a permission grants access to an operation
 * Uses permission hierarchy (admin includes all, write includes read, etc.)
 */
export const permissionGrants = (
  held: StreamPermission,
  required: StreamPermission
): boolean => {
  const grants = PERMISSION_HIERARCHY[held];
  return grants?.includes(required) ?? false;
};

/**
 * Check if claims have sufficient permissions for an operation
 */
export const hasPermission = (
  claims: HolonetClaims,
  operation: StreamOperation,
  streamId: string
): PermissionResult => {
  const requiredPermission = OPERATION_PERMISSIONS[operation];

  // Check if any held permission grants the required permission
  const permissions = claims.permissions ?? [];
  const hasRequiredPermission = permissions.some((p) =>
    permissionGrants(p, requiredPermission)
  );

  if (!hasRequiredPermission) {
    return {
      _tag: 'Denied',
      reason: `Operation '${operation}' requires permission '${requiredPermission}'`,
      requiredPermission,
    };
  }

  // Check if any scope allows access to this stream
  if (!anyScopeMatches(claims.scopes, streamId)) {
    return {
      _tag: 'Denied',
      reason: `No scope matches stream '${streamId}'`,
      requiredPermission,
    };
  }

  return {
    _tag: 'Allowed',
    reason: `Permission '${requiredPermission}' granted`,
  };
};

// =============================================================================
// Effect-Based Permission Checking
// =============================================================================

/**
 * Permission check as an Effect (fails with ForbiddenError on denied)
 */
export const checkPermission = (
  claims: HolonetClaims,
  operation: StreamOperation,
  streamId: string
): Effect.Effect<void, PermissionDeniedError> => {
  const result = hasPermission(claims, operation, streamId);

  if (result._tag === 'Denied') {
    return Effect.fail(
      new PermissionDeniedError({
        operation,
        streamId,
        requiredPermission: result.requiredPermission,
        reason: result.reason,
      })
    );
  }

  return Effect.void;
};

// =============================================================================
// Permission Error
// =============================================================================

import { Data } from 'effect';

/**
 * Permission denied error - thrown when authorization fails
 */
export class PermissionDeniedError extends Data.TaggedError('PermissionDeniedError')<{
  readonly operation: StreamOperation;
  readonly streamId: string;
  readonly requiredPermission: string;
  readonly reason: string;
}> {}

// =============================================================================
// Permission Helpers
// =============================================================================

/**
 * Create claims with full admin access (for testing/internal use)
 */
export const createAdminClaims = (sub: string): HolonetClaims => ({
  sub,
  permissions: ['stream:admin'],
  scopes: ['stream:*'],
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
});

/**
 * Create claims with read-only access to specific streams
 */
export const createReadOnlyClaims = (
  sub: string,
  streamPatterns: StreamScope[]
): HolonetClaims => ({
  sub,
  permissions: ['stream:read'],
  scopes: streamPatterns,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
});

/**
 * Create claims with write access to specific streams
 */
export const createWriterClaims = (
  sub: string,
  streamPatterns: StreamScope[]
): HolonetClaims => ({
  sub,
  permissions: ['stream:write'],
  scopes: streamPatterns,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
});
