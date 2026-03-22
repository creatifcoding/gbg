/**
 * AVA v2 Hooks Tests
 *
 * Unit tests for React hooks consuming AVA v2 atoms.
 * Tests hook behavior, state subscriptions, and cleanup.
 *
 * Note: These hooks use the singleton `avaV2Registry` directly,
 * so tests manipulate that registry. Each test cleans up after itself.
 *
 * @module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act, type RenderHookOptions } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { HashMap } from 'effect'

import {
  useAvaConnection,
  useViewSubscription,
  useChannelData,
  useChannels,
  useAvaMonitor,
  useAllArtifacts,
  useSubscriptions,
  useAvaCleanup,
} from '../hooks/v2'

import {
  connectionStatusAtom,
  errorAtom,
  subscriptionsAtom,
  artifactsAtom,
  deltasAtom,
  eventsAtom,
  avaV2Registry,
  type ViewSubscription,
} from '../atoms/v2'

import { OverlayRegistryProvider } from '../../overlays'

// ============================================================================
// Test Wrapper
// ============================================================================

/**
 * Wrapper component that provides OverlayRegistryProvider context.
 * Required for hooks that use useAtomValue to subscribe to atoms.
 */
const wrapper = ({ children }: { children: ReactNode }) => (
  <OverlayRegistryProvider>{children}</OverlayRegistryProvider>
)

/**
 * Helper to render a hook with the registry provider wrapper
 */
function renderHookWithProvider<TResult, TProps>(
  hook: (props: TProps) => TResult,
  options?: Omit<RenderHookOptions<TProps>, 'wrapper'>
) {
  return renderHook(hook, { ...options, wrapper })
}

import type {
  ViewId,
  ChannelId,
  ViewArtifact,
  ViewDelta,
  ReconcilerEvent,
  ChannelData,
  EventSequence,
  ViewProfileSpec,
  ChannelSpec,
  ChannelBinding,
  ChannelRole,
} from '../schemas/v2'

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Helper to create typed ViewId
 */
const makeViewId = (id: string): ViewId => id as ViewId

/**
 * Helper to create typed ChannelId
 */
const makeChannelId = (id: string): ChannelId => id as ChannelId

/**
 * Helper to create typed EventSequence
 */
const makeEventSequence = (n: bigint): EventSequence => n as EventSequence

/**
 * Create a test ChannelSpec
 */
const createTestChannelSpec = (channelId: string): ChannelSpec => ({
  channelId: makeChannelId(channelId),
  name: channelId,
  role: 'CHANNEL_ROLE_STATE' as ChannelRole,
  required: true,
})

/**
 * Create a test ViewProfileSpec
 */
const createTestSpec = (name: string, channels: string[] = []): ViewProfileSpec => ({
  name,
  domain: 'test-domain',
  description: `Test spec for ${name}`,
  channels: channels.map(createTestChannelSpec),
})

/**
 * Create a test ViewArtifact
 */
const createTestArtifact = (viewId: string, version = 1): ViewArtifact => ({
  viewId: makeViewId(viewId),
  version,
  state: 'ACTIVE',
  spec: createTestSpec(`View ${viewId}`),
  channelBindings: [],
  createdAtMs: Date.now(),
  updatedAtMs: Date.now(),
})

/**
 * Create a test ChannelBinding
 */
const createTestChannelBinding = (channelId: string, data?: ChannelData): ChannelBinding => ({
  channelId: makeChannelId(channelId),
  name: channelId,
  role: 'CHANNEL_ROLE_STATE' as ChannelRole,
  active: true,
  data,
})

/**
 * Create a test ViewArtifact with channel bindings
 */
const createTestArtifactWithChannels = (
  viewId: string,
  channels: Array<{ id: string; data?: ChannelData }>
): ViewArtifact => ({
  viewId: makeViewId(viewId),
  version: 1,
  state: 'ACTIVE',
  spec: createTestSpec(`View ${viewId}`, channels.map((c) => c.id)),
  channelBindings: channels.map((c) => createTestChannelBinding(c.id, c.data)),
  createdAtMs: Date.now(),
  updatedAtMs: Date.now(),
})

/**
 * Create a test ViewSubscription
 */
const createTestSubscription = (viewId: string): ViewSubscription => ({
  viewId: makeViewId(viewId),
  subscribedAt: Date.now(),
  lastUpdate: null,
  artifact: null,
  deltaCount: 0,
})

/**
 * Create a test ViewDelta
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
 * Create a test ReconcilerEvent
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

// ============================================================================
// Test Setup/Teardown
// ============================================================================

/**
 * Save initial state for restoration after each test
 */
const saveAndResetRegistry = () => {
  const savedConnection = avaV2Registry.get(connectionStatusAtom)
  const savedError = avaV2Registry.get(errorAtom)
  const savedSubscriptions = avaV2Registry.get(subscriptionsAtom)
  const savedArtifacts = avaV2Registry.get(artifactsAtom)
  const savedDeltas = avaV2Registry.get(deltasAtom)
  const savedEvents = avaV2Registry.get(eventsAtom)

  // Reset to clean state
  avaV2Registry.set(connectionStatusAtom, 'disconnected')
  avaV2Registry.set(errorAtom, null)
  avaV2Registry.set(subscriptionsAtom, HashMap.empty())
  avaV2Registry.set(artifactsAtom, HashMap.empty())
  avaV2Registry.set(deltasAtom, [])
  avaV2Registry.set(eventsAtom, [])

  return () => {
    // Restore original state
    avaV2Registry.set(connectionStatusAtom, savedConnection)
    avaV2Registry.set(errorAtom, savedError)
    avaV2Registry.set(subscriptionsAtom, savedSubscriptions)
    avaV2Registry.set(artifactsAtom, savedArtifacts)
    avaV2Registry.set(deltasAtom, savedDeltas)
    avaV2Registry.set(eventsAtom, savedEvents)
  }
}

// ============================================================================
// useAvaConnection Tests
// ============================================================================

describe('useAvaConnection', () => {
  let restore: () => void

  beforeEach(() => {
    restore = saveAndResetRegistry()
  })

  afterEach(() => {
    restore()
  })

  it('returns initial connection state', () => {
    const { result } = renderHookWithProvider(() => useAvaConnection())

    expect(result.current.status).toBe('disconnected')
    expect(result.current.isConnected).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('reflects connection status changes', () => {
    const { result, rerender } = renderHookWithProvider(() => useAvaConnection())

    // Update connection status
    act(() => {
      avaV2Registry.set(connectionStatusAtom, 'connected')
    })

    rerender()

    expect(result.current.status).toBe('connected')
    expect(result.current.isConnected).toBe(true)
  })

  it('reflects error state', () => {
    const { result, rerender } = renderHookWithProvider(() => useAvaConnection())

    act(() => {
      avaV2Registry.set(connectionStatusAtom, 'error')
      avaV2Registry.set(errorAtom, 'Connection timeout')
    })

    rerender()

    expect(result.current.status).toBe('error')
    expect(result.current.isConnected).toBe(false)
    expect(result.current.error).toBe('Connection timeout')
  })

  it('returns current config', () => {
    const { result } = renderHookWithProvider(() => useAvaConnection())

    expect(result.current.config.natsUrl).toBeDefined()
    expect(result.current.config.subjectPrefix).toBeDefined()
  })

  it('provides setConfig function', () => {
    const { result } = renderHookWithProvider(() => useAvaConnection())

    expect(typeof result.current.setConfig).toBe('function')
  })
})

// ============================================================================
// useViewSubscription Tests
// ============================================================================

describe('useViewSubscription', () => {
  let restore: () => void

  beforeEach(() => {
    restore = saveAndResetRegistry()
  })

  afterEach(() => {
    restore()
  })

  it('returns null subscription when not subscribed', () => {
    const viewId = makeViewId('test-view')

    const { result } = renderHookWithProvider(() => useViewSubscription(viewId))

    expect(result.current.subscription).toBeNull()
    expect(result.current.artifact).toBeNull()
    expect(result.current.isSubscribed).toBe(false)
  })

  it('returns subscription data when subscribed', () => {
    const viewId = makeViewId('test-view')
    const subscription = createTestSubscription('test-view')
    const artifact = createTestArtifact('test-view')

    // Set up state in singleton registry
    avaV2Registry.set(subscriptionsAtom, HashMap.set(HashMap.empty(), viewId, subscription))
    avaV2Registry.set(artifactsAtom, HashMap.set(HashMap.empty(), viewId, artifact))

    const { result } = renderHookWithProvider(() => useViewSubscription(viewId))

    expect(result.current.subscription).not.toBeNull()
    expect(result.current.subscription?.viewId).toBe(viewId)
    expect(result.current.artifact).not.toBeNull()
    expect(result.current.artifact?.viewId).toBe(viewId)
    expect(result.current.isSubscribed).toBe(true)
  })

  it('provides subscribe function', () => {
    const viewId = makeViewId('test-view')

    const { result } = renderHookWithProvider(() => useViewSubscription(viewId))

    expect(typeof result.current.subscribe).toBe('function')
  })

  it('provides unsubscribe function', () => {
    const viewId = makeViewId('test-view')

    const { result } = renderHookWithProvider(() => useViewSubscription(viewId))

    expect(typeof result.current.unsubscribe).toBe('function')
  })

  it('provides invalidate function', () => {
    const viewId = makeViewId('test-view')

    const { result } = renderHookWithProvider(() => useViewSubscription(viewId))

    expect(typeof result.current.invalidate).toBe('function')
  })

  it('memoizes returned object when state unchanged', () => {
    const viewId = makeViewId('test-view')

    const { result, rerender } = renderHookWithProvider(() => useViewSubscription(viewId))

    const firstResult = result.current

    // Re-render without state changes
    rerender()

    // Should be the same object reference (memoized)
    expect(result.current).toBe(firstResult)
  })
})

// ============================================================================
// useChannelData Tests
// ============================================================================

describe('useChannelData', () => {
  let restore: () => void

  beforeEach(() => {
    restore = saveAndResetRegistry()
  })

  afterEach(() => {
    restore()
  })

  it('returns loading state when no artifact exists', () => {
    const viewId = makeViewId('test-view')

    const { result } = renderHookWithProvider(() => useChannelData(viewId, 'position'))

    expect(result.current.data).toBeNull()
    expect(result.current.binding).toBeNull()
    expect(result.current.isLoading).toBe(true)
    expect(result.current.isHydrated).toBe(false)
  })

  it('returns loading state when channel has no data', () => {
    const viewId = makeViewId('test-view')
    const artifact = createTestArtifactWithChannels('test-view', [
      { id: 'position' }, // No data
    ])

    avaV2Registry.set(artifactsAtom, HashMap.set(HashMap.empty(), viewId, artifact))

    const { result } = renderHookWithProvider(() => useChannelData(viewId, 'position'))

    expect(result.current.data).toBeNull()
    expect(result.current.binding).not.toBeNull()
    expect(result.current.isLoading).toBe(true)
    expect(result.current.isHydrated).toBe(false)
  })

  it('returns pending state when channel is hydrating', () => {
    const viewId = makeViewId('test-view')
    const artifact = createTestArtifactWithChannels('test-view', [
      { id: 'position', data: { type: 'pending' } },
    ])

    avaV2Registry.set(artifactsAtom, HashMap.set(HashMap.empty(), viewId, artifact))

    const { result } = renderHookWithProvider(() => useChannelData(viewId, 'position'))

    expect(result.current.data).toBeNull()
    expect(result.current.isPending).toBe(true)
    expect(result.current.isLoading).toBe(true)
    expect(result.current.isHydrated).toBe(false)
  })

  it('returns error state when channel has error', () => {
    const viewId = makeViewId('test-view')
    const artifact = createTestArtifactWithChannels('test-view', [
      {
        id: 'position',
        data: {
          type: 'error',
          value: { code: 'HYDRATION_FAILED', message: 'Failed to fetch data', retryable: true },
        },
      },
    ])

    avaV2Registry.set(artifactsAtom, HashMap.set(HashMap.empty(), viewId, artifact))

    const { result } = renderHookWithProvider(() => useChannelData(viewId, 'position'))

    expect(result.current.data).toBeNull()
    expect(result.current.isError).toBe(true)
    expect(result.current.error).toBe('Failed to fetch data')
    expect(result.current.isLoading).toBe(false)
  })

  it('returns hydrated data for inline channel', () => {
    const viewId = makeViewId('test-view')
    const positionData = { lat: 37.7749, lng: -122.4194 }
    const artifact = createTestArtifactWithChannels('test-view', [
      { id: 'position', data: { type: 'inline', value: positionData } },
    ])

    avaV2Registry.set(artifactsAtom, HashMap.set(HashMap.empty(), viewId, artifact))

    const { result } = renderHookWithProvider(
      () => useChannelData<{ lat: number; lng: number }>(viewId, 'position')
    )

    expect(result.current.data).toEqual(positionData)
    expect(result.current.isHydrated).toBe(true)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
  })

  it('returns hydrated data for rows channel', () => {
    const viewId = makeViewId('test-view')
    const rowsData = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
    ]
    const artifact = createTestArtifactWithChannels('test-view', [
      { id: 'items', data: { type: 'rows', value: rowsData } },
    ])

    avaV2Registry.set(artifactsAtom, HashMap.set(HashMap.empty(), viewId, artifact))

    const { result } = renderHookWithProvider(
      () => useChannelData<Array<{ id: number; name: string }>>(viewId, 'items')
    )

    expect(result.current.data).toEqual(rowsData)
    expect(result.current.isHydrated).toBe(true)
  })
})

// ============================================================================
// useChannels Tests
// ============================================================================

describe('useChannels', () => {
  let restore: () => void

  beforeEach(() => {
    restore = saveAndResetRegistry()
  })

  afterEach(() => {
    restore()
  })

  it('returns loading state for all channels when no artifact', () => {
    const viewId = makeViewId('test-view')

    const { result } = renderHookWithProvider(
      () => useChannels<{ position: unknown; telemetry: unknown }>(viewId, ['position', 'telemetry'])
    )

    expect(result.current.position.isLoading).toBe(true)
    expect(result.current.telemetry.isLoading).toBe(true)
  })

  it('returns data for multiple channels', () => {
    const viewId = makeViewId('test-view')
    const artifact = createTestArtifactWithChannels('test-view', [
      { id: 'position', data: { type: 'inline', value: { lat: 37.7749, lng: -122.4194 } } },
      { id: 'telemetry', data: { type: 'inline', value: { speed: 65, fuel: 80 } } },
    ])

    avaV2Registry.set(artifactsAtom, HashMap.set(HashMap.empty(), viewId, artifact))

    type Channels = {
      position: { lat: number; lng: number }
      telemetry: { speed: number; fuel: number }
    }

    const { result } = renderHookWithProvider(
      () => useChannels<Channels>(viewId, ['position', 'telemetry'])
    )

    expect(result.current.position.data).toEqual({ lat: 37.7749, lng: -122.4194 })
    expect(result.current.position.isHydrated).toBe(true)
    expect(result.current.telemetry.data).toEqual({ speed: 65, fuel: 80 })
    expect(result.current.telemetry.isHydrated).toBe(true)
  })

  it('handles mixed channel states', () => {
    const viewId = makeViewId('test-view')
    const artifact = createTestArtifactWithChannels('test-view', [
      { id: 'position', data: { type: 'inline', value: { lat: 37.7749, lng: -122.4194 } } },
      { id: 'telemetry', data: { type: 'pending' } },
      {
        id: 'alerts',
        data: { type: 'error', value: { code: 'TIMEOUT', message: 'Request timed out', retryable: false } },
      },
    ])

    avaV2Registry.set(artifactsAtom, HashMap.set(HashMap.empty(), viewId, artifact))

    const { result } = renderHookWithProvider(
      () => useChannels<{ position: unknown; telemetry: unknown; alerts: unknown }>(
        viewId,
        ['position', 'telemetry', 'alerts']
      )
    )

    expect(result.current.position.isHydrated).toBe(true)
    expect(result.current.telemetry.isPending).toBe(true)
    expect(result.current.alerts.isError).toBe(true)
  })
})

// ============================================================================
// useAvaMonitor Tests
// ============================================================================

describe('useAvaMonitor', () => {
  let restore: () => void

  beforeEach(() => {
    restore = saveAndResetRegistry()
  })

  afterEach(() => {
    restore()
  })

  it('returns empty arrays initially', () => {
    const { result } = renderHookWithProvider(() => useAvaMonitor())

    expect(result.current.deltas).toEqual([])
    expect(result.current.events).toEqual([])
    expect(result.current.subscriptionCount).toBe(0)
    expect(result.current.subscribedViewIds).toEqual([])
  })

  it('returns deltas when present', () => {
    const delta1 = createTestDelta('view-1', 1)
    const delta2 = createTestDelta('view-2', 2)

    avaV2Registry.set(deltasAtom, [delta1, delta2])

    const { result } = renderHookWithProvider(() => useAvaMonitor())

    expect(result.current.deltas).toHaveLength(2)
    expect(result.current.deltas[0]).toEqual(delta1)
    expect(result.current.deltas[1]).toEqual(delta2)
  })

  it('returns events when present', () => {
    const event1 = createTestEvent('view-1')
    const event2 = createTestEvent('view-2')

    avaV2Registry.set(eventsAtom, [event1, event2])

    const { result } = renderHookWithProvider(() => useAvaMonitor())

    expect(result.current.events).toHaveLength(2)
  })

  it('returns subscription count', () => {
    const viewId1 = makeViewId('view-1')
    const viewId2 = makeViewId('view-2')
    const subs = HashMap.empty<ViewId, ViewSubscription>()
    const withSub1 = HashMap.set(subs, viewId1, createTestSubscription('view-1'))
    const withSub2 = HashMap.set(withSub1, viewId2, createTestSubscription('view-2'))

    avaV2Registry.set(subscriptionsAtom, withSub2)

    const { result } = renderHookWithProvider(() => useAvaMonitor())

    expect(result.current.subscriptionCount).toBe(2)
    expect(result.current.subscribedViewIds).toHaveLength(2)
  })

  it('provides monitoring functions', () => {
    const { result } = renderHookWithProvider(() => useAvaMonitor())

    expect(typeof result.current.startMonitoringArtifacts).toBe('function')
    expect(typeof result.current.startMonitoringDeltas).toBe('function')
    expect(typeof result.current.startMonitoringEvents).toBe('function')
  })
})

// ============================================================================
// useAllArtifacts Tests
// ============================================================================

describe('useAllArtifacts', () => {
  let restore: () => void

  beforeEach(() => {
    restore = saveAndResetRegistry()
  })

  afterEach(() => {
    restore()
  })

  it('returns empty array when no artifacts', () => {
    const { result } = renderHookWithProvider(() => useAllArtifacts())

    expect(result.current).toEqual([])
  })

  it('returns all artifacts as entries', () => {
    const viewId1 = makeViewId('view-1')
    const viewId2 = makeViewId('view-2')
    const artifact1 = createTestArtifact('view-1')
    const artifact2 = createTestArtifact('view-2')

    const artifacts = HashMap.empty<ViewId, ViewArtifact>()
    const withArtifact1 = HashMap.set(artifacts, viewId1, artifact1)
    const withArtifact2 = HashMap.set(withArtifact1, viewId2, artifact2)

    avaV2Registry.set(artifactsAtom, withArtifact2)

    const { result } = renderHookWithProvider(() => useAllArtifacts())

    expect(result.current).toHaveLength(2)

    const viewIds = result.current.map(([id]) => id)
    expect(viewIds).toContain(viewId1)
    expect(viewIds).toContain(viewId2)
  })
})

// ============================================================================
// useSubscriptions Tests
// ============================================================================

describe('useSubscriptions', () => {
  let restore: () => void

  beforeEach(() => {
    restore = saveAndResetRegistry()
  })

  afterEach(() => {
    restore()
  })

  it('returns empty array when no subscriptions', () => {
    const { result } = renderHookWithProvider(() => useSubscriptions())

    expect(result.current).toEqual([])
  })

  it('returns all subscriptions as entries', () => {
    const viewId1 = makeViewId('view-1')
    const viewId2 = makeViewId('view-2')
    const sub1 = createTestSubscription('view-1')
    const sub2 = createTestSubscription('view-2')

    const subs = HashMap.empty<ViewId, ViewSubscription>()
    const withSub1 = HashMap.set(subs, viewId1, sub1)
    const withSub2 = HashMap.set(withSub1, viewId2, sub2)

    avaV2Registry.set(subscriptionsAtom, withSub2)

    const { result } = renderHookWithProvider(() => useSubscriptions())

    expect(result.current).toHaveLength(2)

    const viewIds = result.current.map(([id]) => id)
    expect(viewIds).toContain(viewId1)
    expect(viewIds).toContain(viewId2)
  })
})

// ============================================================================
// useAvaCleanup Tests
// ============================================================================

describe('useAvaCleanup', () => {
  let restore: () => void

  beforeEach(() => {
    restore = saveAndResetRegistry()
  })

  afterEach(() => {
    restore()
  })

  it('provides cleanup function', () => {
    // Just verify the hook renders without error
    const { unmount } = renderHookWithProvider(() => useAvaCleanup())

    // Unmount should not throw
    expect(() => unmount()).not.toThrow()
  })
})

// ============================================================================
// Hook Memoization Tests
// ============================================================================

describe('Hook Memoization', () => {
  let restore: () => void

  beforeEach(() => {
    restore = saveAndResetRegistry()
  })

  afterEach(() => {
    restore()
  })

  it('useAvaConnection memoizes return value', () => {
    const { result, rerender } = renderHookWithProvider(() => useAvaConnection())

    const firstResult = result.current

    // Re-render without state changes
    rerender()

    // Should be same reference (memoized)
    expect(result.current).toBe(firstResult)
  })

  it('useAvaConnection returns new value when state changes', () => {
    const { result, rerender } = renderHookWithProvider(() => useAvaConnection())

    const firstStatus = result.current.status

    // Change state
    act(() => {
      avaV2Registry.set(connectionStatusAtom, 'connected')
    })

    rerender()

    // Should have new status
    expect(result.current.status).not.toBe(firstStatus)
    expect(result.current.status).toBe('connected')
  })
})
