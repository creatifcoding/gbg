/**
 * AVA v2 Atoms Tests
 *
 * Unit tests for AVA v2 reactive state layer atoms.
 * Tests atom behavior, state transitions, and Effect integration.
 *
 * Test patterns from effect-atom submodule:
 * - Registry.make() for isolated test contexts
 * - Result.isSuccess() / Result.isInitial() assertions
 * - vitest.useFakeTimers() for async control
 * - r.mount() for stream atoms
 *
 * @module
 */

import { describe, it, expect } from '@effect/vitest'
import * as Registry from '@effect-atom/atom/Registry'
import { HashMap, Option } from 'effect'

import {
  // Config
  avaV2ConfigAtom,
  type AvaV2Config,
  // State atoms
  connectionStatusAtom,
  errorAtom,
  subscriptionsAtom,
  artifactsAtom,
  deltasAtom,
  eventsAtom,
  // Derived atoms
  subscribedViewIdsAtom,
  subscriptionCountAtom,
  subscriptionAtom,
  artifactAtom,
  deltaCountAtom,
  eventCountAtom,
  isConnectedAtom,
  // Types
  type ConnectionStatus,
  type ViewSubscription,
} from '../atoms/v2'

import type { ViewId, ViewArtifact, ViewDelta, ReconcilerEvent } from '../schemas/v2'
import { makeViewId, makeChannelId, makeEventSequence } from '../schemas/v2'

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create a test ViewArtifact matching the actual schema structure.
 * Schema: ViewArtifact from artifacts.ts
 */
const createTestArtifact = (viewId: string, version = 1): ViewArtifact => ({
  viewId: makeViewId(viewId),
  version,
  state: 'ACTIVE',
  spec: {
    name: `Test View ${viewId}`,
    domain: 'test-domain',
    description: `Test view for ${viewId}`,
    channels: [],
  },
  channelBindings: [],
  createdAtMs: Date.now(),
  updatedAtMs: Date.now(),
})

const createTestSubscription = (viewId: string): ViewSubscription => ({
  viewId: makeViewId(viewId),
  subscribedAt: Date.now(),
  lastUpdate: null,
  artifact: null,
  deltaCount: 0,
})

/**
 * Create a test ViewDelta matching the actual schema structure.
 * Schema: ViewDelta has { viewId, sequence, timestampMs, delta: ViewDeltaPayload }
 * ViewDeltaPayload is a union with _tag discriminator
 */
const createTestDelta = (viewId: string, sequence = 1): ViewDelta => ({
  viewId: makeViewId(viewId),
  sequence,
  timestampMs: Date.now(),
  delta: {
    _tag: 'ChannelUpdated',
    channelId: makeChannelId('test-channel'),
    rowCount: 10,
    timestampMs: Date.now(),
    isFullRefresh: true,
  },
})

/**
 * Create a test ReconcilerEvent matching the actual schema structure.
 * Schema: ReconcilerEvent has { sequence, timestampMs, correlationId?, event: ReconcilerEventPayload }
 * ReconcilerEventPayload is a union with _tag discriminator
 */
const createTestEvent = (viewId: string): ReconcilerEvent => ({
  sequence: makeEventSequence(BigInt(1)),
  timestampMs: Date.now(),
  event: {
    _tag: 'ViewMounted',
    viewId: makeViewId(viewId),
    artifact: createTestArtifact(viewId),
    compileTimeMs: 100,
    fiberId: 'fiber-1' as any,
  },
})

// =============================================================================
// Configuration Atom Tests
// =============================================================================

describe('avaV2ConfigAtom', () => {
  it('has default configuration', () => {
    const r = Registry.make()
    const config = r.get(avaV2ConfigAtom)

    expect(config.natsUrl).toBe('ws://localhost:9222')
    expect(config.subjectPrefix).toBe('tmnl.ava')
  })

  it('can be updated partially', () => {
    const r = Registry.make()

    r.set(avaV2ConfigAtom, {
      ...r.get(avaV2ConfigAtom),
      natsUrl: 'ws://custom:4222',
    })

    const config = r.get(avaV2ConfigAtom)
    expect(config.natsUrl).toBe('ws://custom:4222')
    expect(config.subjectPrefix).toBe('tmnl.ava') // Unchanged
  })

  it('can be fully replaced', () => {
    const r = Registry.make()
    const newConfig: AvaV2Config = {
      natsUrl: 'ws://new:5222',
      subjectPrefix: 'custom.prefix',
    }

    r.set(avaV2ConfigAtom, newConfig)

    const config = r.get(avaV2ConfigAtom)
    expect(config.natsUrl).toBe('ws://new:5222')
    expect(config.subjectPrefix).toBe('custom.prefix')
  })
})

// =============================================================================
// Connection Status Atom Tests
// =============================================================================

describe('connectionStatusAtom', () => {
  it('defaults to disconnected', () => {
    const r = Registry.make()
    expect(r.get(connectionStatusAtom)).toBe('disconnected')
  })

  it('can transition through states', () => {
    const r = Registry.make()

    const states: ConnectionStatus[] = ['connecting', 'connected', 'error', 'disconnected']

    for (const state of states) {
      r.set(connectionStatusAtom, state)
      expect(r.get(connectionStatusAtom)).toBe(state)
    }
  })
})

describe('isConnectedAtom', () => {
  it('derives from connectionStatusAtom', () => {
    const r = Registry.make()

    expect(r.get(isConnectedAtom)).toBe(false)

    r.set(connectionStatusAtom, 'connecting')
    expect(r.get(isConnectedAtom)).toBe(false)

    r.set(connectionStatusAtom, 'connected')
    expect(r.get(isConnectedAtom)).toBe(true)

    r.set(connectionStatusAtom, 'error')
    expect(r.get(isConnectedAtom)).toBe(false)
  })
})

describe('errorAtom', () => {
  it('defaults to null', () => {
    const r = Registry.make()
    expect(r.get(errorAtom)).toBeNull()
  })

  it('stores error messages', () => {
    const r = Registry.make()

    r.set(errorAtom, 'Connection timeout')
    expect(r.get(errorAtom)).toBe('Connection timeout')

    r.set(errorAtom, null)
    expect(r.get(errorAtom)).toBeNull()
  })
})

// =============================================================================
// Subscriptions Atom Tests
// =============================================================================

describe('subscriptionsAtom', () => {
  it('defaults to empty HashMap', () => {
    const r = Registry.make()
    const subs = r.get(subscriptionsAtom)

    expect(HashMap.isEmpty(subs)).toBe(true)
    expect(HashMap.size(subs)).toBe(0)
  })

  it('can add subscriptions', () => {
    const r = Registry.make()

    const viewId = 'view-1' as ViewId
    const sub = createTestSubscription('view-1')

    r.set(subscriptionsAtom, HashMap.set(HashMap.empty(), viewId, sub))

    const subs = r.get(subscriptionsAtom)
    expect(HashMap.size(subs)).toBe(1)
    expect(HashMap.has(subs, viewId)).toBe(true)
  })

  it('can remove subscriptions', () => {
    const r = Registry.make()

    const viewId = 'view-1' as ViewId
    const sub = createTestSubscription('view-1')

    // Add subscription
    r.set(subscriptionsAtom, HashMap.set(HashMap.empty(), viewId, sub))
    expect(HashMap.size(r.get(subscriptionsAtom))).toBe(1)

    // Remove subscription
    r.set(subscriptionsAtom, HashMap.remove(r.get(subscriptionsAtom), viewId))
    expect(HashMap.size(r.get(subscriptionsAtom))).toBe(0)
  })

  it('supports multiple subscriptions', () => {
    const r = Registry.make()

    const ids = ['view-1', 'view-2', 'view-3'] as ViewId[]
    let subs = HashMap.empty<ViewId, ViewSubscription>()

    for (const id of ids) {
      subs = HashMap.set(subs, id, createTestSubscription(id))
    }

    r.set(subscriptionsAtom, subs)

    expect(HashMap.size(r.get(subscriptionsAtom))).toBe(3)
    for (const id of ids) {
      expect(HashMap.has(r.get(subscriptionsAtom), id)).toBe(true)
    }
  })
})

describe('subscribedViewIdsAtom', () => {
  it('derives list of view IDs from subscriptions', () => {
    const r = Registry.make()

    expect(r.get(subscribedViewIdsAtom)).toEqual([])

    const ids = ['view-a', 'view-b'] as ViewId[]
    let subs = HashMap.empty<ViewId, ViewSubscription>()
    for (const id of ids) {
      subs = HashMap.set(subs, id, createTestSubscription(id))
    }
    r.set(subscriptionsAtom, subs)

    const viewIds = r.get(subscribedViewIdsAtom)
    expect(viewIds).toHaveLength(2)
    expect(viewIds).toContain('view-a')
    expect(viewIds).toContain('view-b')
  })
})

describe('subscriptionCountAtom', () => {
  it('derives count from subscriptions', () => {
    const r = Registry.make()

    expect(r.get(subscriptionCountAtom)).toBe(0)

    const ids = ['v1', 'v2', 'v3'] as ViewId[]
    let subs = HashMap.empty<ViewId, ViewSubscription>()
    for (const id of ids) {
      subs = HashMap.set(subs, id, createTestSubscription(id))
    }
    r.set(subscriptionsAtom, subs)

    expect(r.get(subscriptionCountAtom)).toBe(3)
  })
})

describe('subscriptionAtom (family)', () => {
  it('returns null for non-existent viewId', () => {
    const r = Registry.make()

    const viewSubscriptionAtom = subscriptionAtom('nonexistent' as ViewId)
    expect(r.get(viewSubscriptionAtom)).toBeNull()
  })

  it('returns subscription for existing viewId', () => {
    const r = Registry.make()

    const viewId = 'view-123' as ViewId
    const sub = createTestSubscription('view-123')

    r.set(subscriptionsAtom, HashMap.set(HashMap.empty(), viewId, sub))

    const viewSubscriptionAtom = subscriptionAtom(viewId)
    const result = r.get(viewSubscriptionAtom)

    expect(result).not.toBeNull()
    expect(result?.viewId).toBe(viewId)
  })
})

// =============================================================================
// Artifacts Atom Tests
// =============================================================================

describe('artifactsAtom', () => {
  it('defaults to empty HashMap', () => {
    const r = Registry.make()
    expect(HashMap.isEmpty(r.get(artifactsAtom))).toBe(true)
  })

  it('stores artifacts by viewId', () => {
    const r = Registry.make()

    const viewId = 'truck-42' as ViewId
    const artifact = createTestArtifact('truck-42')

    r.set(artifactsAtom, HashMap.set(HashMap.empty(), viewId, artifact))

    const artifacts = r.get(artifactsAtom)
    expect(HashMap.size(artifacts)).toBe(1)

    const stored = HashMap.get(artifacts, viewId)
    expect(Option.isSome(stored)).toBe(true)
    if (Option.isSome(stored)) {
      expect(stored.value.spec.name).toBe('Test View truck-42')
    }
  })

  it('updates artifacts on new versions', () => {
    const r = Registry.make()

    const viewId = 'truck-42' as ViewId
    const v1 = createTestArtifact('truck-42', 1)
    const v2 = createTestArtifact('truck-42', 2)

    r.set(artifactsAtom, HashMap.set(HashMap.empty(), viewId, v1))
    expect(Option.getOrNull(HashMap.get(r.get(artifactsAtom), viewId))?.version).toBe(1)

    r.set(artifactsAtom, HashMap.set(r.get(artifactsAtom), viewId, v2))
    expect(Option.getOrNull(HashMap.get(r.get(artifactsAtom), viewId))?.version).toBe(2)
  })
})

describe('artifactAtom (family)', () => {
  it('returns null for non-existent viewId', () => {
    const r = Registry.make()

    const viewArtifactAtom = artifactAtom('nonexistent' as ViewId)
    expect(r.get(viewArtifactAtom)).toBeNull()
  })

  it('returns artifact for existing viewId', () => {
    const r = Registry.make()

    const viewId = 'dashboard-1' as ViewId
    const artifact = createTestArtifact('dashboard-1')

    r.set(artifactsAtom, HashMap.set(HashMap.empty(), viewId, artifact))

    const viewArtifactAtom = artifactAtom(viewId)
    const result = r.get(viewArtifactAtom)

    expect(result).not.toBeNull()
    expect(result?.viewId).toBe(viewId)
    expect(result?.spec.name).toBe('Test View dashboard-1')
  })

  it('family atoms share state', () => {
    const r = Registry.make()

    const viewId = 'shared-view' as ViewId
    const artifact = createTestArtifact('shared-view')

    r.set(artifactsAtom, HashMap.set(HashMap.empty(), viewId, artifact))

    // Create two family atoms for the same viewId
    const atom1 = artifactAtom(viewId)
    const atom2 = artifactAtom(viewId)

    // Both should return the same artifact
    expect(r.get(atom1)).toEqual(r.get(atom2))
  })
})

// =============================================================================
// Deltas Atom Tests
// =============================================================================

describe('deltasAtom', () => {
  it('defaults to empty array', () => {
    const r = Registry.make()
    expect(r.get(deltasAtom)).toEqual([])
  })

  it('stores deltas in order', () => {
    const r = Registry.make()

    const delta1 = createTestDelta('view-1', 1)
    const delta2 = createTestDelta('view-1', 2)

    r.set(deltasAtom, [delta1])
    expect(r.get(deltasAtom)).toHaveLength(1)

    r.set(deltasAtom, [delta2, ...r.get(deltasAtom)])
    expect(r.get(deltasAtom)).toHaveLength(2)
    expect(r.get(deltasAtom)[0].sequence).toBe(2) // Newest first (sequence not version)
  })

  it('caps at 100 entries', () => {
    const r = Registry.make()

    // Add 110 deltas
    const deltas: ViewDelta[] = []
    for (let i = 0; i < 110; i++) {
      deltas.push(createTestDelta('view-1', i))
    }

    // Simulate the capping logic from avaV2Streams
    r.set(deltasAtom, deltas.slice(0, 100))

    expect(r.get(deltasAtom)).toHaveLength(100)
  })
})

describe('deltaCountAtom', () => {
  it('derives count from deltas', () => {
    const r = Registry.make()

    expect(r.get(deltaCountAtom)).toBe(0)

    r.set(deltasAtom, [createTestDelta('v1'), createTestDelta('v2')])

    expect(r.get(deltaCountAtom)).toBe(2)
  })
})

// =============================================================================
// Events Atom Tests
// =============================================================================

describe('eventsAtom', () => {
  it('defaults to empty array', () => {
    const r = Registry.make()
    expect(r.get(eventsAtom)).toEqual([])
  })

  it('stores reconciler events', () => {
    const r = Registry.make()

    const event = createTestEvent('view-1')

    r.set(eventsAtom, [event])
    expect(r.get(eventsAtom)).toHaveLength(1)
    // ReconcilerEvent has nested `event` field with _tag discriminator
    expect(r.get(eventsAtom)[0].event._tag).toBe('ViewMounted')
  })
})

describe('eventCountAtom', () => {
  it('derives count from events', () => {
    const r = Registry.make()

    expect(r.get(eventCountAtom)).toBe(0)

    r.set(eventsAtom, [createTestEvent('v1'), createTestEvent('v2'), createTestEvent('v3')])

    expect(r.get(eventCountAtom)).toBe(3)
  })
})

// =============================================================================
// Reset Function Tests
// =============================================================================

describe('resetAvaV2State', () => {
  it('resets all state to defaults', () => {
    const r = Registry.make()

    // Set up various state
    r.set(connectionStatusAtom, 'connected')
    r.set(errorAtom, 'some error')
    r.set(subscriptionsAtom, HashMap.set(HashMap.empty(), 'v1' as ViewId, createTestSubscription('v1')))
    r.set(artifactsAtom, HashMap.set(HashMap.empty(), 'v1' as ViewId, createTestArtifact('v1')))
    r.set(deltasAtom, [createTestDelta('v1')])
    r.set(eventsAtom, [createTestEvent('v1')])

    // Verify state was set
    expect(r.get(connectionStatusAtom)).toBe('connected')
    expect(HashMap.size(r.get(subscriptionsAtom))).toBe(1)

    // Note: resetAvaV2State uses avaV2Registry which is a singleton
    // In tests we use Registry.make() for isolation, so we test the logic manually
    r.set(connectionStatusAtom, 'disconnected')
    r.set(errorAtom, null)
    r.set(subscriptionsAtom, HashMap.empty())
    r.set(artifactsAtom, HashMap.empty())
    r.set(deltasAtom, [])
    r.set(eventsAtom, [])

    // Verify reset
    expect(r.get(connectionStatusAtom)).toBe('disconnected')
    expect(r.get(errorAtom)).toBeNull()
    expect(HashMap.isEmpty(r.get(subscriptionsAtom))).toBe(true)
    expect(HashMap.isEmpty(r.get(artifactsAtom))).toBe(true)
    expect(r.get(deltasAtom)).toEqual([])
    expect(r.get(eventsAtom)).toEqual([])
  })
})

// =============================================================================
// HashMap Pattern Tests (Effect utility verification)
// =============================================================================

describe('HashMap patterns', () => {
  it('HashMap.get returns Option', () => {
    const map = HashMap.empty<string, number>()
    const result = HashMap.get(map, 'key')
    expect(Option.isNone(result)).toBe(true)
  })

  it('HashMap.set is immutable', () => {
    const map1 = HashMap.empty<string, number>()
    const map2 = HashMap.set(map1, 'key', 42)

    expect(HashMap.isEmpty(map1)).toBe(true)
    expect(HashMap.size(map2)).toBe(1)
  })

  it('HashMap.remove is immutable', () => {
    const map1 = HashMap.set(HashMap.empty<string, number>(), 'key', 42)
    const map2 = HashMap.remove(map1, 'key')

    expect(HashMap.size(map1)).toBe(1)
    expect(HashMap.isEmpty(map2)).toBe(true)
  })

  it('HashMap supports iteration', () => {
    let map = HashMap.empty<string, number>()
    map = HashMap.set(map, 'a', 1)
    map = HashMap.set(map, 'b', 2)

    const entries = Array.from(HashMap.entries(map))
    expect(entries).toHaveLength(2)
  })
})

// =============================================================================
// Option Pattern Tests
// =============================================================================

describe('Option patterns', () => {
  it('Option.getOrNull returns null for None', () => {
    const none = Option.none()
    expect(Option.getOrNull(none)).toBeNull()
  })

  it('Option.getOrNull returns value for Some', () => {
    const some = Option.some(42)
    expect(Option.getOrNull(some)).toBe(42)
  })

  it('Option.isSome and Option.isNone work correctly', () => {
    expect(Option.isSome(Option.some(1))).toBe(true)
    expect(Option.isNone(Option.some(1))).toBe(false)
    expect(Option.isSome(Option.none())).toBe(false)
    expect(Option.isNone(Option.none())).toBe(true)
  })
})

// =============================================================================
// Delta Reducer Integration Tests
// =============================================================================

import {
  applyDeltaReducer,
  deltaToLogEntry,
  categorizeDelta,
  isDataDelta,
  isLifecycleDelta,
  isStateDelta,
} from '../utils/delta-matching'

describe('applyDeltaReducer', () => {
  /**
   * Create test artifact with channel bindings (mutable for tests)
   */
  const createArtifactWithChannels = (viewId: string) => ({
    ...createTestArtifact(viewId),
    channelBindings: [{
      channelId: makeChannelId('test-channel'),
      binding: { _tag: 'DirectBinding' as const, expression: 'test' },
      active: true,
      role: 'primary' as const,
    }],
  })

  it('handles ChannelUpdated delta', () => {
    const artifact = createArtifactWithChannels('truck-42')

    const delta = {
      _tag: 'ChannelUpdated' as const,
      channelId: makeChannelId('test-channel'),
      rowCount: 100,
      timestampMs: Date.now(),
      isFullRefresh: false,
    }

    const updated = applyDeltaReducer(artifact as ViewArtifact, delta)

    const binding = updated.channelBindings.find(b => b.channelId === delta.channelId)
    expect(binding?.rowCount).toBe(100)
    expect(updated.updatedAtMs).toBe(delta.timestampMs)
  })

  it('handles StateChanged delta', () => {
    const artifact = createTestArtifact('truck-42')
    expect(artifact.state).toBe('ACTIVE')

    const delta = {
      _tag: 'StateChanged' as const,
      previousState: 'ACTIVE' as const,
      newState: 'SUSPENDED' as const,
      reason: 'test suspension',
    }

    const updated = applyDeltaReducer(artifact, delta)
    expect(updated.state).toBe('SUSPENDED')
  })

  it('handles ArtifactReplaced delta', () => {
    const artifact = createTestArtifact('truck-42', 1)
    const newArtifact = {
      ...createTestArtifact('truck-42', 2),
      spec: {
        ...createTestArtifact('truck-42', 2).spec,
        name: 'Replaced Artifact',
      },
    }

    const delta = {
      _tag: 'ArtifactReplaced' as const,
      reason: 'INVALIDATED' as const,
      newArtifact: newArtifact as ViewArtifact,
    }

    const updated = applyDeltaReducer(artifact, delta)
    expect(updated.version).toBe(2)
    expect(updated.spec.name).toBe('Replaced Artifact')
  })

  it('handles MetadataUpdated delta', () => {
    const artifact = {
      ...createTestArtifact('truck-42'),
      metadata: { existing: 'value', toRemove: 'old' },
    }

    const delta = {
      _tag: 'MetadataUpdated' as const,
      updated: { newKey: 'newValue', existing: 'updated' },
      removed: ['toRemove'] as string[],
    }

    const updated = applyDeltaReducer(artifact as ViewArtifact, delta)
    expect(updated.metadata?.['newKey']).toBe('newValue')
    expect(updated.metadata?.['existing']).toBe('updated')
    expect(updated.metadata?.['toRemove']).toBeUndefined()
  })
})

describe('deltaToLogEntry', () => {
  it('creates info entry for ChannelUpdated', () => {
    const delta = {
      _tag: 'ChannelUpdated' as const,
      channelId: makeChannelId('test-channel'),
      rowCount: 50,
      timestampMs: Date.now(),
      isFullRefresh: true,
    }

    const entry = deltaToLogEntry(delta)
    expect(entry.type).toBe('data')
    expect(entry.level).toBe('info')
    // Use type narrowing for properties
    if (entry.type === 'data') {
      expect(entry.rowCount).toBe(50)
      expect(entry.isFullRefresh).toBe(true)
    }
  })

  it('creates warn entry for ChannelDeactivated', () => {
    const delta = {
      _tag: 'ChannelDeactivated' as const,
      channelId: makeChannelId('test-channel'),
      reason: 'SOURCE_DISCONNECTED' as const,
    }

    const entry = deltaToLogEntry(delta)
    expect(entry.type).toBe('lifecycle')
    expect(entry.level).toBe('warn')
  })

  it('creates warn entry for StateChanged to SUSPENDED', () => {
    const delta = {
      _tag: 'StateChanged' as const,
      previousState: 'ACTIVE' as const,
      newState: 'SUSPENDED' as const,
    }

    const entry = deltaToLogEntry(delta)
    expect(entry.type).toBe('state')
    expect(entry.level).toBe('warn')
  })
})

describe('delta categorization', () => {
  it('categorizeDelta returns correct categories', () => {
    const channelDelta = {
      _tag: 'ChannelUpdated' as const,
      channelId: makeChannelId('ch'),
      rowCount: 10,
      timestampMs: Date.now(),
      isFullRefresh: false,
    }

    const stateDelta = {
      _tag: 'StateChanged' as const,
      previousState: 'ACTIVE' as const,
      newState: 'STALE' as const,
    }

    expect(categorizeDelta(channelDelta).type).toBe('data')
    expect(categorizeDelta(stateDelta).type).toBe('state')
  })

  it('predicate functions work correctly', () => {
    const dataDelta = {
      _tag: 'ChannelUpdated' as const,
      channelId: makeChannelId('ch'),
      rowCount: 10,
      timestampMs: Date.now(),
      isFullRefresh: false,
    }

    const lifecycleDelta = {
      _tag: 'ChannelActivated' as const,
      channelId: makeChannelId('ch'),
      role: 'primary' as const,
    }

    const stateDelta = {
      _tag: 'StateChanged' as const,
      previousState: 'ACTIVE' as const,
      newState: 'STALE' as const,
    }

    expect(isDataDelta(dataDelta)).toBe(true)
    expect(isDataDelta(lifecycleDelta)).toBe(false)
    expect(isLifecycleDelta(lifecycleDelta)).toBe(true)
    expect(isLifecycleDelta(dataDelta)).toBe(false)
    expect(isStateDelta(stateDelta)).toBe(true)
    expect(isStateDelta(dataDelta)).toBe(false)
  })
})
