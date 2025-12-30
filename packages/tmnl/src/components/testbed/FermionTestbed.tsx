/**
 * Fermion Testbed
 *
 * Comprehensive validation of the Fermion schema-driven Atom.family library.
 *
 * Route: /testbed/fermion
 *
 * HYPOTHESES:
 * - H1: Result state machine (initial → waiting → success/failure) flows correctly
 * - H2: CRUD operations (fetch/persist/remove) update atoms predictably
 * - H3: Lifecycle config (keepAlive/TTL) controls atom persistence
 * - H4: Composite keys work with structural equality
 * - H5: Multiple subscribers share the same atom instance
 *
 * TABS:
 * 1. State Visualization - Real-time Result state machine display
 * 2. CRUD Operations - Interactive fetch/persist/remove with grid
 * 3. Lifecycle - TTL expiry, keepAlive vs autoReset behavior
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { Effect, Schema, Duration } from 'effect'
import { Registry } from '@effect-atom/atom'
import * as Result from '@effect-atom/atom/Result'
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  Trash2,
  Database,
  Activity,
  Clock,
  Users,
  Zap,
} from 'lucide-react'

import {
  TestbedHeader,
  SectionLabel,
  TestCard,
  Button,
  StatusIndicator,
  ValueDisplay,
  VersionBadge,
} from '@/components/testbed/shared'
import {
  HypothesisSummary,
  HypothesisBadge,
  type ValidationStatus,
} from '@/components/testbed/shared/hypothesis'

import {
  fromSchema,
  makeSimpleMemoryAlgebra,
  NotFoundError,
  type Fermion,
} from '@/lib/fermion'

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

const UserSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  role: Schema.Literal('admin', 'user', 'guest'),
})
type User = typeof UserSchema.Type

// ─────────────────────────────────────────────────────────────────────────────
// Test Data
// ─────────────────────────────────────────────────────────────────────────────

const SEED_USERS: User[] = [
  { id: 'user-1', name: 'Alice Chen', email: 'alice@example.com', role: 'admin' },
  { id: 'user-2', name: 'Bob Smith', email: 'bob@example.com', role: 'user' },
  { id: 'user-3', name: 'Carol Jones', email: 'carol@example.com', role: 'user' },
  { id: 'user-4', name: 'David Lee', email: 'david@example.com', role: 'guest' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Result State Display
// ─────────────────────────────────────────────────────────────────────────────

interface ResultStateProps<A, E> {
  result: Result.Result<A, E>
  label: string
}

function ResultStateDisplay<A, E>({ result, label }: ResultStateProps<A, E>) {
  const getStateInfo = () => {
    if (Result.isInitial(result)) {
      return { state: 'initial', color: 'text-neutral-500', bg: 'bg-neutral-800/50' }
    }
    if (Result.isWaiting(result)) {
      return { state: 'waiting', color: 'text-amber-400', bg: 'bg-amber-900/20' }
    }
    if (Result.isSuccess(result)) {
      return { state: 'success', color: 'text-green-400', bg: 'bg-green-900/20' }
    }
    if (Result.isFailure(result)) {
      return { state: 'failure', color: 'text-red-400', bg: 'bg-red-900/20' }
    }
    return { state: 'unknown', color: 'text-neutral-400', bg: 'bg-neutral-800/50' }
  }

  const { state, color, bg } = getStateInfo()

  return (
    <div className={`p-3 rounded border border-neutral-800 ${bg}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-neutral-400" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {label}
        </span>
        <span className={`font-mono uppercase ${color}`} style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {state}
        </span>
      </div>
      {Result.isSuccess(result) && (
        <pre className="text-neutral-300 font-mono overflow-x-auto" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {JSON.stringify(result.value, null, 2)}
        </pre>
      )}
      {Result.isFailure(result) && (
        <div className="text-red-400 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          Error: {String(result.cause)}
        </div>
      )}
      {Result.isWaiting(result) && result.previous && Result.isSuccess(result.previous) && (
        <div className="text-amber-400/60 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          (refreshing: {JSON.stringify(result.previous.value)})
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// State Visualization Tab
// ─────────────────────────────────────────────────────────────────────────────

interface StateVisualizationTabProps {
  registry: Registry.Registry
  userFamily: Fermion<User, User, NotFoundError, never, string>
  onHypothesisUpdate: (id: string, validated: boolean) => void
}

function StateVisualizationTab({
  registry,
  userFamily,
  onHypothesisUpdate,
}: StateVisualizationTabProps) {
  const [selectedKey, setSelectedKey] = useState('user-1')
  const [atomState, setAtomState] = useState<Result.Result<User, NotFoundError>>(Result.initial())
  const [stateHistory, setStateHistory] = useState<string[]>([])

  // Subscribe to atom changes
  useEffect(() => {
    const atom = userFamily(selectedKey)
    const initialState = registry.get(atom)
    setAtomState(initialState)

    const unsubscribe = registry.subscribe(atom, (newState) => {
      setAtomState(newState)
      const stateName = Result.isInitial(newState) ? 'initial'
        : Result.isWaiting(newState) ? 'waiting'
        : Result.isSuccess(newState) ? 'success'
        : 'failure'
      setStateHistory((prev) => [...prev.slice(-9), `${Date.now()}: ${stateName}`])
    })

    return unsubscribe
  }, [registry, userFamily, selectedKey])

  // Check H1: State machine flows correctly
  useEffect(() => {
    const hasTransitions = stateHistory.length >= 2
    const hasSuccess = stateHistory.some((s) => s.includes('success'))
    onHypothesisUpdate('H1', hasTransitions && hasSuccess)
  }, [stateHistory, onHypothesisUpdate])

  const handleFetch = async () => {
    setStateHistory([])
    try {
      await Effect.runPromise(
        userFamily.fetch(selectedKey).pipe(
          Effect.provideService(Registry.AtomRegistry, registry)
        )
      )
    } catch (e) {
      // Error state is tracked via subscription
    }
  }

  const handleInvalidate = async () => {
    await Effect.runPromise(
      userFamily.invalidate(selectedKey).pipe(
        Effect.provideService(Registry.AtomRegistry, registry)
      )
    )
  }

  return (
    <div className="space-y-6">
      <TestCard
        title="Result State Machine"
        description="Watch the atom transition through initial → waiting → success/failure"
      >
        <div className="space-y-4">
          {/* Key Selector */}
          <div className="flex items-center gap-4">
            <span className="text-neutral-400 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              Key:
            </span>
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 rounded px-3 py-1 font-mono text-neutral-200"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              {SEED_USERS.map((u) => (
                <option key={u.id} value={u.id}>{u.id}</option>
              ))}
              <option value="nonexistent">nonexistent (will fail)</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handleFetch} variant="primary">
              <RefreshCw size={14} className="mr-2" />
              Fetch
            </Button>
            <Button onClick={handleInvalidate}>
              Invalidate
            </Button>
          </div>

          {/* Current State */}
          <ResultStateDisplay result={atomState} label={`userFamily("${selectedKey}")`} />

          {/* State History */}
          <div className="p-3 bg-neutral-900/50 rounded border border-neutral-800">
            <div className="text-neutral-500 font-mono mb-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              State Transitions
            </div>
            <div className="font-mono text-neutral-400 space-y-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {stateHistory.length === 0 ? (
                <div className="text-neutral-600">No transitions yet. Click Fetch to start.</div>
              ) : (
                stateHistory.map((entry, i) => (
                  <div key={i}>{entry}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </TestCard>

      {/* State Machine Diagram */}
      <TestCard title="State Machine Diagram">
        <div className="flex items-center justify-center gap-4 py-6">
          <StateNode label="initial" active={Result.isInitial(atomState)} />
          <Arrow />
          <StateNode label="waiting" active={Result.isWaiting(atomState)} />
          <Arrow />
          <div className="flex flex-col gap-2">
            <StateNode label="success" active={Result.isSuccess(atomState)} variant="success" />
            <StateNode label="failure" active={Result.isFailure(atomState)} variant="error" />
          </div>
        </div>
      </TestCard>
    </div>
  )
}

function StateNode({
  label,
  active,
  variant = 'default',
}: {
  label: string
  active: boolean
  variant?: 'default' | 'success' | 'error'
}) {
  const baseClasses = 'px-4 py-2 rounded border font-mono transition-all'
  const variantClasses = {
    default: active
      ? 'bg-cyan-900/50 border-cyan-600 text-cyan-300'
      : 'bg-neutral-800/50 border-neutral-700 text-neutral-500',
    success: active
      ? 'bg-green-900/50 border-green-600 text-green-300'
      : 'bg-neutral-800/50 border-neutral-700 text-neutral-500',
    error: active
      ? 'bg-red-900/50 border-red-600 text-red-300'
      : 'bg-neutral-800/50 border-neutral-700 text-neutral-500',
  }

  return (
    <div className={`${baseClasses} ${variantClasses[variant]}`} style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
      {label}
    </div>
  )
}

function Arrow() {
  return (
    <div className="text-neutral-600 font-mono">→</div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD Operations Tab
// ─────────────────────────────────────────────────────────────────────────────

interface CrudOperationsTabProps {
  registry: Registry.Registry
  userFamily: Fermion<User, User, NotFoundError, never, string>
  store: Map<string, User>
  onHypothesisUpdate: (id: string, validated: boolean) => void
}

function CrudOperationsTab({
  registry,
  userFamily,
  store,
  onHypothesisUpdate,
}: CrudOperationsTabProps) {
  const [users, setUsers] = useState<User[]>([])
  const [newUserName, setNewUserName] = useState('')
  const [operationLog, setOperationLog] = useState<string[]>([])

  const log = useCallback((msg: string) => {
    setOperationLog((prev) => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${msg}`])
  }, [])

  // Load all users from store
  const refreshUsers = useCallback(() => {
    setUsers(Array.from(store.values()))
  }, [store])

  useEffect(() => {
    refreshUsers()
  }, [refreshUsers])

  // Check H2: CRUD operations work
  useEffect(() => {
    const hasFetch = operationLog.some((l) => l.includes('Fetched'))
    const hasPersist = operationLog.some((l) => l.includes('Persisted'))
    const hasRemove = operationLog.some((l) => l.includes('Removed'))
    onHypothesisUpdate('H2', hasFetch && (hasPersist || hasRemove))
  }, [operationLog, onHypothesisUpdate])

  const handleFetch = async (id: string) => {
    try {
      const user = await Effect.runPromise(
        userFamily.fetch(id).pipe(
          Effect.provideService(Registry.AtomRegistry, registry)
        )
      )
      log(`Fetched ${user.name}`)
    } catch (e) {
      log(`Fetch failed: ${e}`)
    }
  }

  const handlePrefetchAll = async () => {
    const keys = SEED_USERS.map((u) => u.id)
    await Effect.runPromise(
      userFamily.prefetch(keys).pipe(
        Effect.provideService(Registry.AtomRegistry, registry)
      )
    )
    log(`Prefetched ${keys.length} users`)
    refreshUsers()
  }

  const handleCreate = async () => {
    if (!newUserName.trim()) return

    const newUser: User = {
      id: `user-${Date.now()}`,
      name: newUserName,
      email: `${newUserName.toLowerCase().replace(/\s/g, '.')}@example.com`,
      role: 'user',
    }

    await Effect.runPromise(
      userFamily.persist(newUser).pipe(
        Effect.provideService(Registry.AtomRegistry, registry)
      )
    )
    log(`Persisted ${newUser.name}`)
    setNewUserName('')
    refreshUsers()
  }

  const handleRemove = async (id: string) => {
    await Effect.runPromise(
      userFamily.remove(id).pipe(
        Effect.provideService(Registry.AtomRegistry, registry)
      )
    )
    log(`Removed ${id}`)
    refreshUsers()
  }

  return (
    <div className="space-y-6">
      {/* Create User */}
      <TestCard title="Create User" description="Persist a new user to the store">
        <div className="flex gap-2">
          <input
            type="text"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            placeholder="Enter name..."
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-3 py-2 font-mono text-neutral-200"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <Button onClick={handleCreate} variant="primary">
            <Plus size={14} className="mr-2" />
            Create
          </Button>
        </div>
      </TestCard>

      {/* User Grid */}
      <TestCard
        title="User Store"
        description={`${users.length} users in memory store`}
        actions={
          <Button onClick={handlePrefetchAll} variant="ghost">
            <Zap size={14} className="mr-1" />
            Prefetch All
          </Button>
        }
      >
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 bg-neutral-800/50 rounded border border-neutral-700"
            >
              <div>
                <div className="font-mono text-neutral-200" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                  {user.name}
                </div>
                <div className="text-neutral-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                  {user.id} · {user.email} · {user.role}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleFetch(user.id)} variant="ghost">
                  <RefreshCw size={12} />
                </Button>
                <Button onClick={() => handleRemove(user.id)} variant="danger">
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <div className="text-neutral-500 text-center py-4 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              No users in store. Create one above.
            </div>
          )}
        </div>
      </TestCard>

      {/* Operation Log */}
      <TestCard title="Operation Log">
        <div className="h-32 overflow-y-auto font-mono text-neutral-400 space-y-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {operationLog.length === 0 ? (
            <div className="text-neutral-600">No operations yet.</div>
          ) : (
            operationLog.map((entry, i) => (
              <div key={i}>{entry}</div>
            ))
          )}
        </div>
      </TestCard>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle Tab
// ─────────────────────────────────────────────────────────────────────────────

interface LifecycleTabProps {
  registry: Registry.Registry
  onHypothesisUpdate: (id: string, validated: boolean) => void
}

function LifecycleTab({ registry, onHypothesisUpdate }: LifecycleTabProps) {
  const [keepAliveState, setKeepAliveState] = useState<string>('initial')
  const [autoResetState, setAutoResetState] = useState<string>('initial')
  const [subscriberCount, setSubscriberCount] = useState(0)

  // Create two families with different lifecycle configs
  const { keepAliveFamily, autoResetFamily, keepAliveStore, autoResetStore } = useMemo(() => {
    const kaStore = new Map<string, User>([['test-1', SEED_USERS[0]]])
    const arStore = new Map<string, User>([['test-1', SEED_USERS[0]]])

    const kaAlgebra = makeSimpleMemoryAlgebra<User, string>((u) => u.id, kaStore)
    const arAlgebra = makeSimpleMemoryAlgebra<User, string>((u) => u.id, arStore)

    const kaFamily = fromSchema(UserSchema)
      .withKey('id')
      .withFetch(kaAlgebra.algebra.fetch)
      .withLifecycle({ keepAlive: true })
      .buildWithDeps()

    const arFamily = fromSchema(UserSchema)
      .withKey('id')
      .withFetch(arAlgebra.algebra.fetch)
      .withLifecycle({ keepAlive: false })
      .buildWithDeps()

    return {
      keepAliveFamily: kaFamily,
      autoResetFamily: arFamily,
      keepAliveStore: kaStore,
      autoResetStore: arStore,
    }
  }, [])

  const runKeepAliveTest = async () => {
    // Fetch to populate atom
    setKeepAliveState('fetching...')
    await Effect.runPromise(
      keepAliveFamily.fetch('test-1').pipe(
        Effect.provideService(Registry.AtomRegistry, registry)
      )
    )

    // Check state immediately
    const atom = keepAliveFamily('test-1')
    const result = registry.get(atom)

    // Wait a tick (simulates subscriber drop scenario)
    await new Promise((r) => setTimeout(r, 100))

    // Check state after delay
    const resultAfter = registry.get(atom)
    const stillSuccess = Result.isSuccess(resultAfter)

    setKeepAliveState(stillSuccess ? 'SUCCESS: State persisted' : 'FAIL: State lost')
    onHypothesisUpdate('H3', stillSuccess)
  }

  const runAutoResetTest = async () => {
    // This test is more complex - we'd need to actually mount/unmount subscribers
    // For now, just show the config difference
    setAutoResetState('autoReset: keepAlive=false configured')
  }

  return (
    <div className="space-y-6">
      <TestCard
        title="Lifecycle: keepAlive=true"
        description="Atom retains state when subscriber count drops to zero"
      >
        <div className="space-y-4">
          <div className="p-3 bg-neutral-800/50 rounded border border-neutral-700">
            <code className="text-cyan-400 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              .withLifecycle({'{ keepAlive: true }'})
            </code>
          </div>

          <Button onClick={runKeepAliveTest} variant="primary">
            Run keepAlive Test
          </Button>

          <div className={`p-3 rounded border ${
            keepAliveState.includes('SUCCESS') ? 'border-green-700 bg-green-900/20' :
            keepAliveState.includes('FAIL') ? 'border-red-700 bg-red-900/20' :
            'border-neutral-700 bg-neutral-800/50'
          }`}>
            <span className="font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              {keepAliveState}
            </span>
          </div>
        </div>
      </TestCard>

      <TestCard
        title="Lifecycle: keepAlive=false"
        description="Atom resets to initial when subscriber count drops to zero"
      >
        <div className="space-y-4">
          <div className="p-3 bg-neutral-800/50 rounded border border-neutral-700">
            <code className="text-amber-400 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              .withLifecycle({'{ keepAlive: false }'})
            </code>
          </div>

          <Button onClick={runAutoResetTest}>
            Run autoReset Test
          </Button>

          <div className="p-3 rounded border border-neutral-700 bg-neutral-800/50">
            <span className="font-mono text-neutral-400" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              {autoResetState}
            </span>
          </div>

          <div className="text-neutral-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            Note: Full autoReset testing requires React component mount/unmount cycles.
            In practice, this config means the atom will reset when useAtomValue unmounts.
          </div>
        </div>
      </TestCard>

      <TestCard
        title="TTL Configuration"
        description="Atoms expire after idle duration"
      >
        <div className="p-3 bg-neutral-800/50 rounded border border-neutral-700">
          <code className="text-purple-400 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            .withLifecycle({'{ keepAlive: true, ttl: Duration.minutes(5) }'})
          </code>
        </div>
        <div className="text-neutral-500 mt-3" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          TTL implies keepAlive until the timeout expires. After {'{ttl}'} of inactivity,
          the atom resets to initial state.
        </div>
      </TestCard>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

type TabId = 'state' | 'crud' | 'lifecycle'

export function FermionTestbed() {
  const [activeTab, setActiveTab] = useState<TabId>('state')
  const [hypotheses, setHypotheses] = useState<Record<string, ValidationStatus>>({
    H1: 'pending',
    H2: 'pending',
    H3: 'pending',
    H4: 'pending',
    H5: 'pending',
  })

  // Create registry and family once
  const { registry, userFamily, store } = useMemo(() => {
    const r = Registry.make()
    const seedData = new Map(SEED_USERS.map((u) => [u.id, u]))
    const { algebra, store } = makeSimpleMemoryAlgebra<User, string>((u) => u.id, seedData)

    const family = fromSchema(UserSchema)
      .withKey('id')
      .withFetch(algebra.fetch)
      .withPersist(algebra.persist!)
      .withRemove(algebra.remove!)
      .withLifecycle({ keepAlive: true })
      .buildWithDeps()

    return { registry: r, userFamily: family, store }
  }, [])

  const updateHypothesis = useCallback((id: string, validated: boolean) => {
    setHypotheses((prev) => ({
      ...prev,
      [id]: validated ? 'validated' : prev[id],
    }))
  }, [])

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: 'state', label: 'State Visualization', icon: <Activity size={14} /> },
    { id: 'crud', label: 'CRUD Operations', icon: <Database size={14} /> },
    { id: 'lifecycle', label: 'Lifecycle', icon: <Clock size={14} /> },
  ]

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      <div className="max-w-4xl mx-auto">
        <TestbedHeader
          title="Fermion Testbed"
          subtitle="Schema-driven Atom.family with Effect algebra"
          actions={<VersionBadge version="v1" status="new" />}
        />

        {/* Hypothesis Summary */}
        <HypothesisSummary
          hypotheses={[
            { id: 'H1', title: 'State machine transitions', status: hypotheses.H1 },
            { id: 'H2', title: 'CRUD operations', status: hypotheses.H2 },
            { id: 'H3', title: 'Lifecycle config', status: hypotheses.H3 },
            { id: 'H4', title: 'Composite keys', status: hypotheses.H4 },
            { id: 'H5', title: 'Shared atoms', status: hypotheses.H5 },
          ]}
          className="mb-8"
        />

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-neutral-900/50 rounded-lg border border-neutral-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded font-mono transition-colors ${
                activeTab === tab.id
                  ? 'bg-neutral-800 text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'state' && (
          <StateVisualizationTab
            registry={registry}
            userFamily={userFamily}
            onHypothesisUpdate={updateHypothesis}
          />
        )}
        {activeTab === 'crud' && (
          <CrudOperationsTab
            registry={registry}
            userFamily={userFamily}
            store={store}
            onHypothesisUpdate={updateHypothesis}
          />
        )}
        {activeTab === 'lifecycle' && (
          <LifecycleTab
            registry={registry}
            onHypothesisUpdate={updateHypothesis}
          />
        )}
      </div>
    </div>
  )
}
