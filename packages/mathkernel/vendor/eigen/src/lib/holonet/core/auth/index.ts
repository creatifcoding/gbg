/**
 * Holonet Authentication Module
 *
 * JWT-based authentication and authorization for durable-streams.
 *
 * @module holonet/core/auth
 */

// ─── Schemas ────────────────────────────────────────────────────────────────
export {
  // JWT Claims
  JwtRegisteredClaims,
  HolonetClaims,

  // Permissions
  StreamPermission,
  StreamScope,
  StreamOperation,
  PermissionRequest,
  PermissionResult,

  // Configuration
  JwtAlgorithm,
  HolonetAuthConfig,

  // Results
  AuthSuccess,
  AuthResult,
} from './schemas';

export type {
  JwtRegisteredClaims as JwtRegisteredClaimsType,
  HolonetClaims as HolonetClaimsType,
  StreamPermission as StreamPermissionType,
  StreamScope as StreamScopeType,
  StreamOperation as StreamOperationType,
  PermissionRequest as PermissionRequestType,
  PermissionResult as PermissionResultType,
  JwtAlgorithm as JwtAlgorithmType,
  HolonetAuthConfig as HolonetAuthConfigType,
  AuthSuccess as AuthSuccessType,
  AuthResult as AuthResultType,
} from './schemas';

// ─── Permission Model ───────────────────────────────────────────────────────
export {
  // Constants
  OPERATION_PERMISSIONS,
  PERMISSION_HIERARCHY,

  // Functions
  scopeMatches,
  anyScopeMatches,
  permissionGrants,
  hasPermission,
  checkPermission,

  // Helpers
  createAdminClaims,
  createReadOnlyClaims,
  createWriterClaims,

  // Errors
  PermissionDeniedError,
} from './permissions';

// ─── Auth Service ───────────────────────────────────────────────────────────
export {
  // Service
  HolonetAuthService,

  // Errors
  JwtValidationError,
  JwtExpiredError,
  JwtNotYetValidError,
  MissingAuthHeaderError,

  // Helper
  createTestToken,
} from './HolonetAuthService';

export type {
  HolonetAuthServiceShape,
  HolonetAuthError,
} from './HolonetAuthService';

// ─── HTTP API Middleware ────────────────────────────────────────────────
export {
  // Middleware Tags
  AuthorizationMiddleware,
  OptionalAuthorizationMiddleware,

  // Context Tags
  CurrentHolonetClaims,
  OptionalHolonetClaims,

  // Error Types (with HTTP status annotations)
  Unauthorized,
  Forbidden,

  // Layers
  AuthorizationMiddlewareLive,
  OptionalAuthorizationMiddlewareLive,
  AuthorizationLive,
  makeAuthorizationLayer,
  makeJwksAuthorizationLayer,
} from './middleware';
