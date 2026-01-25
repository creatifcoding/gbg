/**
 * SessionService
 *
 * Per-user tab/window state persistence.
 * Manages tabs, windows, and view state.
 *
 * @module lib/actors/services/SessionService
 */

import { Context, Effect, Layer, PubSub, Ref, Stream } from 'effect'
import { Atom } from '@effect-atom/atom-react'
import {
  type TabId,
  type WindowId,
  type BufferId,
  type UserId,
  type SessionTab,
  type SessionWindow,
  type SessionState,
  type SessionEvent,
} from '../schemas'
import { ActorPersistence } from './ActorPersistence'

// =============================================================================
// Types
// =============================================================================

export interface CreateTabOptions {
  layout?: unknown
  isPinned?: boolean
}

export interface UpdateTabOptions {
  name?: string
  layout?: unknown
  isPinned?: boolean
}

export interface UpdateWindowOptions {
  scroll?: { x: number; y: number }
  cursor?: { offset: number; line?: number; column?: number }
  mode?: { major: string; minor: string[] }
}

export interface SessionServiceShape {
  /** Create a new tab */
  readonly createTab: (name: string, options?: CreateTabOptions) => Effect.Effect<SessionTab>

  /** Set the active tab */
  readonly setActiveTab: (tabId: TabId) => Effect.Effect<void>

  /** Close a tab */
  readonly closeTab: (tabId: TabId) => Effect.Effect<void>

  /** Update tab properties */
  readonly updateTab: (tabId: TabId, updates: UpdateTabOptions) => Effect.Effect<SessionTab>

  /** Reorder tabs */
  readonly reorderTabs: (newOrder: readonly TabId[]) => Effect.Effect<void>

  /** Create a window for a buffer */
  readonly createWindow: (
    bufferId: BufferId,
    majorMode?: string
  ) => Effect.Effect<SessionWindow>

  /** Focus a window */
  readonly focusWindow: (windowId: WindowId) => Effect.Effect<void>

  /** Update window state */
  readonly updateWindow: (
    windowId: WindowId,
    updates: UpdateWindowOptions
  ) => Effect.Effect<SessionWindow>

  /** Close a window */
  readonly closeWindow: (windowId: WindowId) => Effect.Effect<void>

  /** Get full session snapshot */
  readonly getSnapshot: Effect.Effect<SessionState>

  /** Restore session from snapshot */
  readonly restoreSnapshot: (snapshot: Partial<SessionState>) => Effect.Effect<void>

  /** Clear session state */
  readonly clear: Effect.Effect<void>

  /** Subscribe to session events */
  readonly events: Stream.Stream<SessionEvent>

  /** Current state atom (for React integration) */
  readonly stateAtom: Atom.Atom<SessionState>
}

/** Factory for creating session services per user */
export interface SessionServiceFactoryShape {
  readonly forUser: (userId: UserId) => Effect.Effect<SessionServiceShape>
}

// =============================================================================
// Service Tags
// =============================================================================

export class SessionService extends Context.Tag('SessionService')<
  SessionService,
  SessionServiceShape
>() {}

export class SessionServiceFactory extends Context.Tag('SessionServiceFactory')<
  SessionServiceFactory,
  SessionServiceFactoryShape
>() {}

// =============================================================================
// Implementation
// =============================================================================

const generateTabId = (): TabId => `tab-${crypto.randomUUID().slice(0, 8)}` as TabId
const generateWindowId = (): WindowId => `win-${crypto.randomUUID().slice(0, 8)}` as WindowId

const initialState: SessionState = {
  tabs: {} as Record<TabId, SessionTab>,
  windows: {} as Record<WindowId, SessionWindow>,
  activeTabId: null,
  focusedWindowId: null,
  tabOrder: [],
}

const makeSessionService = (
  userId: UserId,
  persistence: ActorPersistence
): Effect.Effect<SessionServiceShape> =>
  Effect.gen(function* () {
    // Load persisted state or use initial
    const persisted = yield* persistence.loadSession(userId)
    const initial = persisted ?? initialState

    // State management via Ref
    const stateRef = yield* Ref.make(initial)

    // State atom for React integration
    const stateAtom = Atom.make(initial)

    // Event pub/sub
    const eventHub = yield* PubSub.unbounded<SessionEvent>()

    // Helper to sync state
    const syncState = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      yield* Atom.set(stateAtom, state)
      yield* persistence.saveSession(userId, state)
    })

    const createTab: SessionServiceShape['createTab'] = (name, options) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const id = generateTabId()

        const tab: SessionTab = {
          id,
          name,
          layout: options?.layout ?? null,
          activeWindowId: null,
          isPinned: options?.isPinned ?? false,
          order: state.tabOrder.length,
        }

        yield* Ref.update(stateRef, (s) => ({
          ...s,
          tabs: { ...s.tabs, [id]: tab },
          tabOrder: [...s.tabOrder, id],
          activeTabId: s.activeTabId ?? id, // Auto-activate first tab
        }))

        yield* syncState
        yield* PubSub.publish(eventHub, { _tag: 'TabCreated', tabId: id, tab })

        return tab
      })

    const setActiveTab: SessionServiceShape['setActiveTab'] = (tabId) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        if (!state.tabs[tabId]) {
          return yield* Effect.fail(new Error(`Tab not found: ${tabId}`))
        }

        yield* Ref.update(stateRef, (s) => ({ ...s, activeTabId: tabId }))
        yield* syncState
      })

    const closeTab: SessionServiceShape['closeTab'] = (tabId) =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (s) => {
          const { [tabId]: _, ...restTabs } = s.tabs
          const newOrder = s.tabOrder.filter((id) => id !== tabId)

          // Reorder remaining tabs
          newOrder.forEach((id, index) => {
            if (restTabs[id]) {
              restTabs[id] = { ...restTabs[id], order: index }
            }
          })

          return {
            ...s,
            tabs: restTabs,
            tabOrder: newOrder,
            activeTabId: s.activeTabId === tabId ? (newOrder[0] ?? null) : s.activeTabId,
          }
        })

        yield* syncState
        yield* PubSub.publish(eventHub, { _tag: 'TabClosed', tabId })
      })

    const updateTab: SessionServiceShape['updateTab'] = (tabId, updates) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const tab = state.tabs[tabId]

        if (!tab) {
          return yield* Effect.fail(new Error(`Tab not found: ${tabId}`))
        }

        const updated: SessionTab = {
          ...tab,
          ...(updates.name !== undefined && { name: updates.name }),
          ...(updates.layout !== undefined && { layout: updates.layout }),
          ...(updates.isPinned !== undefined && { isPinned: updates.isPinned }),
        }

        yield* Ref.update(stateRef, (s) => ({
          ...s,
          tabs: { ...s.tabs, [tabId]: updated },
        }))

        yield* syncState
        return updated
      })

    const reorderTabs: SessionServiceShape['reorderTabs'] = (newOrder) =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (s) => {
          const updatedTabs = { ...s.tabs }
          newOrder.forEach((id, index) => {
            if (updatedTabs[id]) {
              updatedTabs[id] = { ...updatedTabs[id], order: index }
            }
          })
          return { ...s, tabs: updatedTabs, tabOrder: [...newOrder] }
        })
        yield* syncState
      })

    const createWindow: SessionServiceShape['createWindow'] = (bufferId, majorMode = 'fundamental') =>
      Effect.gen(function* () {
        const id = generateWindowId()

        const window: SessionWindow = {
          id,
          bufferId,
          scroll: { x: 0, y: 0 },
          mode: { major: majorMode, minor: [] },
          isFocused: false,
        }

        yield* Ref.update(stateRef, (s) => ({
          ...s,
          windows: { ...s.windows, [id]: window },
        }))

        yield* syncState
        return window
      })

    const focusWindow: SessionServiceShape['focusWindow'] = (windowId) =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (s) => {
          const updatedWindows = { ...s.windows }

          // Unfocus previous
          if (s.focusedWindowId && updatedWindows[s.focusedWindowId]) {
            updatedWindows[s.focusedWindowId] = {
              ...updatedWindows[s.focusedWindowId],
              isFocused: false,
            }
          }

          // Focus new
          if (updatedWindows[windowId]) {
            updatedWindows[windowId] = { ...updatedWindows[windowId], isFocused: true }
          }

          return { ...s, windows: updatedWindows, focusedWindowId: windowId }
        })

        yield* syncState
        yield* PubSub.publish(eventHub, { _tag: 'WindowFocused', windowId })
      })

    const updateWindow: SessionServiceShape['updateWindow'] = (windowId, updates) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const window = state.windows[windowId]

        if (!window) {
          return yield* Effect.fail(new Error(`Window not found: ${windowId}`))
        }

        const updated: SessionWindow = {
          ...window,
          ...(updates.scroll && { scroll: updates.scroll }),
          ...(updates.cursor && { cursor: updates.cursor }),
          ...(updates.mode && { mode: updates.mode }),
        }

        yield* Ref.update(stateRef, (s) => ({
          ...s,
          windows: { ...s.windows, [windowId]: updated },
        }))

        yield* syncState
        return updated
      })

    const closeWindow: SessionServiceShape['closeWindow'] = (windowId) =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (s) => {
          const { [windowId]: _, ...restWindows } = s.windows
          const remaining = Object.keys(restWindows)
          return {
            ...s,
            windows: restWindows,
            focusedWindowId:
              s.focusedWindowId === windowId ? (remaining[0] as WindowId) ?? null : s.focusedWindowId,
          }
        })
        yield* syncState
      })

    const getSnapshot: SessionServiceShape['getSnapshot'] = Ref.get(stateRef)

    const restoreSnapshot: SessionServiceShape['restoreSnapshot'] = (snapshot) =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (s) => ({
          ...s,
          ...(snapshot.tabs && { tabs: snapshot.tabs }),
          ...(snapshot.windows && { windows: snapshot.windows }),
          ...(snapshot.activeTabId !== undefined && { activeTabId: snapshot.activeTabId }),
          ...(snapshot.focusedWindowId !== undefined && { focusedWindowId: snapshot.focusedWindowId }),
          ...(snapshot.tabOrder && { tabOrder: snapshot.tabOrder }),
        }))
        yield* syncState
      })

    const clear: SessionServiceShape['clear'] = Effect.gen(function* () {
      yield* Ref.set(stateRef, initialState)
      yield* syncState
    })

    const events = Stream.fromPubSub(eventHub)

    return {
      createTab,
      setActiveTab,
      closeTab,
      updateTab,
      reorderTabs,
      createWindow,
      focusWindow,
      updateWindow,
      closeWindow,
      getSnapshot,
      restoreSnapshot,
      clear,
      events,
      stateAtom,
    }
  })

// =============================================================================
// Factory Implementation
// =============================================================================

const makeFactory = Effect.gen(function* () {
  const persistence = yield* ActorPersistence

  // Initialize persistence once
  yield* persistence.initialize

  // Cache of session services per user
  const sessions = new Map<UserId, SessionServiceShape>()

  const forUser: SessionServiceFactoryShape['forUser'] = (userId) =>
    Effect.gen(function* () {
      const existing = sessions.get(userId)
      if (existing) return existing

      const service = yield* makeSessionService(userId, persistence)
      sessions.set(userId, service)
      return service
    })

  return SessionServiceFactory.of({ forUser })
})

// =============================================================================
// Layers
// =============================================================================

export const SessionServiceFactoryLive = Layer.effect(SessionServiceFactory, makeFactory)
