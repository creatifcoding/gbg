import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import {
  applyAccessDecision,
  createSurfaceActor,
  decodeCockpitAccessInput,
  resolveCockpitAccess,
  UiSurfaceDefinition,
} from '../src'

function surfaceDefinition(surfaceId = 'ui.commandDeck.open') {
  return new UiSurfaceDefinition({
    surfaceId,
    generationId: 'builtin',
    renderer: 'native-rn',
    requiredCapabilities: [surfaceId],
    inputSchemaId: 'none',
    outputSchemaId: 'none',
    machineId: 'tmnl.cockpit.surfaceActor',
    defaultState: 'draft',
    platformVariants: {},
  })
}

describe('@tmnl/cockpit vertical slice loop', () => {
  it('drives iPhone shell.run into approval UI instead of pretending local shell exists', () => {
    const input = decodeCockpitAccessInput({
      request: {
        _tag: 'AccessRequest',
        id: 'req-shell-1',
        capability: 'shell.run',
        actorId: 'actor-1',
        sessionId: 'session-1',
        surfaceId: 'ui.commandDeck.open',
        machineState: 'draft',
        requestedAt: '2026-06-09T00:00:00.000Z',
        input: { command: 'pwd' },
      },
      platform: {
        _tag: 'PlatformProfile',
        os: 'ios',
        buildProfile: 'expo-go',
        formFactor: 'phone',
        input: ['touch'],
        localProcess: false,
        haptics: true,
        nativeWindows: false,
        availableNativeModules: ['@shopify/react-native-skia'],
      },
      host: {
        _tag: 'HostProfile',
        hostId: 'remote-1',
        platform: 'remote',
        connection: 'connected',
        provides: ['shell.run', 'surface.lottie.preview'],
        denies: [],
      },
    })

    const decision = Effect.runSync(resolveCockpitAccess(input))
    const actor = createSurfaceActor(surfaceDefinition())

    try {
      applyAccessDecision(actor, decision)

      expect(decision.result).toBe('requires-approval')
      expect(actor.getAt(actor.lens.lifecycle)).toBe('approval')
      expect(actor.getAt(actor.lens.selectedVariant)).toBe('remoteExecutionApprovalSheet')
      expect(actor.getAt(actor.lens.approvalRequestId)).toBe('req-shell-1:approval')
    } finally {
      actor.dispose()
    }
  })

  it('selects desktop command deck variant through the same surface actor loop', () => {
    const input = decodeCockpitAccessInput({
      request: {
        _tag: 'AccessRequest',
        id: 'req-deck-1',
        capability: 'ui.commandDeck.open',
        actorId: 'actor-1',
        sessionId: 'session-1',
        surfaceId: 'ui.commandDeck.open',
        machineState: 'draft',
        requestedAt: '2026-06-09T00:00:00.000Z',
        input: {},
      },
      platform: {
        _tag: 'PlatformProfile',
        os: 'windows',
        buildProfile: 'rn-desktop',
        formFactor: 'desktop',
        input: ['keyboard', 'mouse', 'touch'],
        localProcess: true,
        haptics: false,
        nativeWindows: true,
        availableNativeModules: [],
      },
      host: null,
    })

    const decision = Effect.runSync(resolveCockpitAccess(input))
    const actor = createSurfaceActor(surfaceDefinition())

    try {
      applyAccessDecision(actor, decision)

      expect(decision.result).toBe('allow')
      expect(actor.getAt(actor.lens.lifecycle)).toBe('previewing')
      expect(actor.getAt(actor.lens.selectedVariant)).toBe('desktopWhichKey')
    } finally {
      actor.dispose()
    }
  })

  it('degrades Lottie preview when neither local Skia nor remote host is available', () => {
    const input = decodeCockpitAccessInput({
      request: {
        _tag: 'AccessRequest',
        id: 'req-lottie-1',
        capability: 'surface.lottie.preview',
        actorId: 'actor-1',
        sessionId: 'session-1',
        surfaceId: 'surface.lottie.preview',
        machineState: 'draft',
        requestedAt: '2026-06-09T00:00:00.000Z',
        input: { generationId: 'gen-1' },
      },
      platform: {
        _tag: 'PlatformProfile',
        os: 'web',
        buildProfile: 'expo-go',
        formFactor: 'desktop',
        input: ['mouse', 'keyboard'],
        localProcess: false,
        haptics: false,
        nativeWindows: false,
        availableNativeModules: [],
      },
      host: null,
    })

    const decision = Effect.runSync(resolveCockpitAccess(input))
    const actor = createSurfaceActor(surfaceDefinition('surface.lottie.preview'))

    try {
      applyAccessDecision(actor, decision)

      expect(decision.result).toBe('degrade')
      expect(actor.getAt(actor.lens.lifecycle)).toBe('degraded')
      expect(actor.getAt(actor.lens.selectedVariant)).toBe('videoFallback')
      expect(actor.getAt(actor.lens.fallbackReason)).toContain('No local Skia')
    } finally {
      actor.dispose()
    }
  })
})
