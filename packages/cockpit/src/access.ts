import { Effect, Schema } from 'effect'

// =============================================================================
// Access contract literals
// =============================================================================

export const PlatformId = Schema.Literals([
  'ios',
  'android',
  'windows',
  'macos',
  'linux',
  'web',
  'remote',
  'cluster',
])
export type PlatformId = typeof PlatformId.Type

export const BuildProfile = Schema.Literals([
  'expo-go',
  'dev-build',
  'standalone',
  'tauri',
  'rn-desktop',
  'remote',
  'cluster',
])
export type BuildProfile = typeof BuildProfile.Type

export const FormFactor = Schema.Literals([
  'phone',
  'tablet',
  'desktop',
  'foldable',
  'dual-screen',
  'console',
])
export type FormFactor = typeof FormFactor.Type

export const InputModality = Schema.Literals([
  'touch',
  'mouse',
  'keyboard',
  'pen',
  'gamepad',
])
export type InputModality = typeof InputModality.Type

export const AccessResult = Schema.Literals([
  'allow',
  'deny',
  'degrade',
  'proxy',
  'requires-approval',
  'unavailable',
])
export type AccessResult = typeof AccessResult.Type

export const HostConnectionState = Schema.Literals([
  'unknown',
  'offline',
  'connecting',
  'connected',
  'degraded',
])
export type HostConnectionState = typeof HostConnectionState.Type

// =============================================================================
// Schema-backed request context
// =============================================================================

export class PlatformProfile extends Schema.TaggedClass<PlatformProfile>()('PlatformProfile', {
  os: PlatformId,
  buildProfile: BuildProfile,
  formFactor: FormFactor,
  input: Schema.Array(InputModality),
  localProcess: Schema.Boolean,
  haptics: Schema.Boolean,
  nativeWindows: Schema.Boolean,
  availableNativeModules: Schema.Array(Schema.String),
}) {}

export class HostProfile extends Schema.TaggedClass<HostProfile>()('HostProfile', {
  hostId: Schema.String,
  platform: PlatformId,
  connection: HostConnectionState,
  provides: Schema.Array(Schema.String),
  denies: Schema.Array(Schema.String),
}) {}

export class AccessRequest extends Schema.TaggedClass<AccessRequest>()('AccessRequest', {
  id: Schema.String,
  capability: Schema.String,
  actorId: Schema.String,
  sessionId: Schema.String,
  surfaceId: Schema.String,
  machineState: Schema.String,
  requestedAt: Schema.DateTimeUtcFromString,
  input: Schema.Unknown,
}) {}

export class AccessDecision extends Schema.TaggedClass<AccessDecision>()('AccessDecision', {
  id: Schema.String,
  requestId: Schema.String,
  capability: Schema.String,
  result: AccessResult,
  platform: PlatformId,
  reason: Schema.String,
  implementation: Schema.Unknown,
  uiBehavior: Schema.Unknown,
  decidedAt: Schema.DateTimeUtcFromString,
  provenance: Schema.Array(Schema.String),
}) {}

export const CockpitAccessInput = Schema.Struct({
  request: AccessRequest,
  platform: PlatformProfile,
  host: Schema.NullOr(HostProfile),
})
export type CockpitAccessInput = typeof CockpitAccessInput.Type

// =============================================================================
// Inline first-slice resolver
// =============================================================================

function isMobile(platform: PlatformProfile): boolean {
  return platform.os === 'ios' || platform.os === 'android' || platform.formFactor === 'phone'
}

function hasConnectedHost(host: HostProfile | null): host is HostProfile {
  return host !== null && host.connection === 'connected'
}

function hostProvides(host: HostProfile | null, capability: string): boolean {
  return hasConnectedHost(host) && host.provides.includes(capability) && !host.denies.includes(capability)
}

function decision(
  input: CockpitAccessInput,
  result: AccessResult,
  reason: string,
  implementation: unknown,
  uiBehavior: unknown,
  provenance: readonly string[],
): AccessDecision {
  return new AccessDecision({
    id: `${input.request.id}:decision`,
    requestId: input.request.id,
    capability: input.request.capability,
    result,
    platform: input.platform.os,
    reason,
    implementation,
    uiBehavior,
    decidedAt: input.request.requestedAt as never,
    provenance: [...provenance],
  })
}

export function resolveCockpitAccessSync(input: CockpitAccessInput): AccessDecision {
  const { request, platform, host } = input
  const capability = request.capability

  if (capability === 'ui.commandDeck.open') {
    const variant = isMobile(platform) ? 'mobileThumbDeck' : 'desktopWhichKey'
    return decision(
      input,
      'allow',
      `Command deck is available as ${variant}.`,
      { provider: 'local-ui' },
      { variant },
      ['cockpit.ui', platform.buildProfile],
    )
  }

  if (capability === 'shell.run') {
    if (platform.localProcess && !isMobile(platform)) {
      return decision(
        input,
        'allow',
        'Local process execution is available through the desktop sidecar.',
        { provider: 'local-sidecar' },
        { variant: 'desktopExecutionInline' },
        ['cockpit.localProcess', platform.buildProfile],
      )
    }

    if (hostProvides(host, 'shell.run')) {
      return decision(
        input,
        'requires-approval',
        'This platform cannot execute a local shell; use the connected remote host after scoped approval.',
        { provider: 'remote-host', hostId: host.hostId },
        { variant: 'remoteExecutionApprovalSheet', approvalRequestId: `${request.id}:approval` },
        ['cockpit.proxy', host.hostId, platform.buildProfile],
      )
    }

    return decision(
      input,
      'unavailable',
      'No local process runtime or connected host can execute shell.run.',
      { provider: 'none' },
      { variant: 'disabledCommand', recoverBy: 'connect-host' },
      ['cockpit.unavailable', platform.buildProfile],
    )
  }

  if (capability === 'surface.lottie.preview') {
    const hasSkia = platform.availableNativeModules.includes('@shopify/react-native-skia')
    if (hasSkia) {
      return decision(
        input,
        'allow',
        'Skia is available locally; use local Skottie preview.',
        { provider: 'local-skia' },
        { variant: 'localSkottiePreview' },
        ['cockpit.skia', platform.buildProfile],
      )
    }

    if (hostProvides(host, 'surface.lottie.preview')) {
      return decision(
        input,
        'proxy',
        'Local Skia/Skottie is unavailable; proxy preview to connected host.',
        { provider: 'remote-host', hostId: host.hostId },
        { variant: 'remotePreview' },
        ['cockpit.proxy', host.hostId, platform.buildProfile],
      )
    }

    return decision(
      input,
      'degrade',
      'No local Skia/Skottie or remote preview host is available; render static/video fallback.',
      { provider: 'fallback' },
      { variant: 'videoFallback' },
      ['cockpit.degrade', platform.buildProfile],
    )
  }

  return decision(
    input,
    'deny',
    `No cockpit access rule exists for ${capability}.`,
    { provider: 'none' },
    { variant: 'hiddenCommand' },
    ['cockpit.deny', platform.buildProfile],
  )
}

export function resolveCockpitAccess(input: CockpitAccessInput): Effect.Effect<AccessDecision> {
  return Effect.succeed(resolveCockpitAccessSync(input))
}

export const decodeCockpitAccessInput = Schema.decodeUnknownSync(CockpitAccessInput)
export const decodeAccessDecision = Schema.decodeUnknownSync(AccessDecision)
