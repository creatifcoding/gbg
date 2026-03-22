# Atom.family Session State Architecture

## The Insight

`Atom.family` within `Atom.family` for hierarchical scoping.

**Outer family**: keyed by adapter/surface instance (future multi-adapter)
**Inner family**: keyed by `sessionId` — each session gets its own reactive atom bundle

For now, we collapse the outer layer (single adapter) and use the inner `sessionId` family directly. The outer family exists as the architectural escape hatch for when multiple adapters/surfaces coexist.

## Current State: Flat Maps + Listeners

```typescript
// shell-client-atoms.ts (BEFORE — to be replaced)
const listeners = new Map<string, Set<ShellEventListener>>()
const globalListeners = new Set<ShellEventListener>()

export function subscribeShellEvents(sessionId: string, cb: ShellEventListener) {
  // ... manual listener management
}
```

**Problems:**
1. Manual memory management (must call unsub or leak)
2. No reactive derivation (can't compute "all active sessions" from the Map)
3. No WeakRef cleanup (if React component unmounts but forgets to unsub → leak)
4. Imperative bridge between WS events and React → `useEffect` + callback soup

## Target State: Atom.family(sessionId)

```typescript
import { Atom } from '@effect-atom/atom-react'
import type { ShellSessionStatus, ShellSessionInfo, ShellEvent } from './schemas'

// ─── Per-Session Atom Bundle ──────────────────────────────────────────

interface ShellSessionAtoms {
  /** Accumulated raw PTY output (for terminal.write()) */
  readonly output$: Atom.Writable<string>
  /** Session lifecycle status */
  readonly status$: Atom.Writable<ShellSessionStatus>
  /** Full session info from server */
  readonly info$: Atom.Writable<ShellSessionInfo | null>
  /** Exit code when terminated */
  readonly exitCode$: Atom.Writable<number | null>
  /** Latest error message */
  readonly error$: Atom.Writable<string | null>
  /** Monotonic output sequence number (for incremental reads) */
  readonly outputSeq$: Atom.Writable<number>
}

// ─── The Family ───────────────────────────────────────────────────────

/**
 * Atom.family keyed by sessionId.
 * Each call with the same sessionId returns the SAME atom bundle.
 * WeakRef + FinalizationRegistry auto-GC when no subscribers remain.
 */
export const shellSessionFamily = Atom.family((sessionId: string): ShellSessionAtoms => ({
  output$:    Atom.make(''),
  status$:    Atom.make<ShellSessionStatus>('starting'),
  info$:      Atom.make<ShellSessionInfo | null>(null),
  exitCode$:  Atom.make<number | null>(null),
  error$:     Atom.make<string | null>(null),
  outputSeq$: Atom.make(0),
}))

// ─── Derived: Active Sessions ─────────────────────────────────────────

/**
 * Tracks which sessionIds are currently known.
 * Writable atom — dispatchShellEvent adds new IDs on first sight.
 */
export const activeSessionIds$ = Atom.make<ReadonlyArray<string>>([])

/**
 * Derived: count of active (non-exited) sessions.
 */
export const activeSessionCount$ = Atom.make((get) => {
  const ids = get(activeSessionIds$)
  return ids.filter((id) => {
    const session = shellSessionFamily(id)
    const status = get(session.status$)
    return status === 'starting' || status === 'running'
  }).length
})

// ─── Event Dispatch (replaces dispatchShellEvent) ─────────────────────

/**
 * Dispatch a ShellEvent into the atom system.
 * Called by useHarnessAdapter's daemon fiber when it sees
 * a `remote:shell_event` WS envelope.
 *
 * Pure atom writes — no Effect runtime needed.
 */
export function dispatchShellEvent(
  registry: Atom.Registry,
  event: ShellEvent,
): void {
  const sessionId = 'sessionId' in event
    ? (event as { sessionId: string }).sessionId
    : null
  if (!sessionId) return

  const session = shellSessionFamily(sessionId)

  // Ensure session is tracked
  const currentIds = registry.get(activeSessionIds$)
  if (!currentIds.includes(sessionId)) {
    registry.set(activeSessionIds$, [...currentIds, sessionId])
  }

  switch (event._tag) {
    case 'shell:data':
      // Append output for terminal.write() — component subscribes to output$
      registry.set(session.output$, registry.get(session.output$) + event.data)
      registry.set(session.outputSeq$, registry.get(session.outputSeq$) + 1)
      break

    case 'shell:started':
      registry.set(session.status$, 'running')
      registry.set(session.info$, event.info)
      break

    case 'shell:exited':
      registry.set(session.status$, 'exited')
      registry.set(session.exitCode$, event.exitCode)
      break

    case 'shell:error':
      registry.set(session.status$, 'error')
      registry.set(session.error$, event.message)
      break
  }
}
```

## React Component Integration

### Before (callback bridge)

```tsx
// InteractiveShellTerminalView — BEFORE
const [status, setStatus] = useState<ShellSessionStatus>('starting')
const [exitCode, setExitCode] = useState<number | undefined>()

useEffect(() => {
  const unsub = subscribeShellEvents(sessionId, (event) => {
    switch (event._tag) {
      case 'shell:data': termRef.current?.write(event.data); break
      case 'shell:started': setStatus('running'); break
      case 'shell:exited': setStatus('exited'); setExitCode(event.exitCode); break
      case 'shell:error': setStatus('error'); break
    }
  })
  return unsub
}, [sessionId])
```

### After (Atom.family)

```tsx
// InteractiveShellTerminalView — AFTER
import { useAtomValue } from '@effect-atom/atom-react'
import { shellSessionFamily } from '@/lib/harness/interactive-shell/shell-session-atoms'

const InteractiveShellTerminalView: FC<{ sessionId: string }> = ({ sessionId }) => {
  const session = shellSessionFamily(sessionId)  // Same atoms for same sessionId
  const termRef = useRef<TerminalCoreRef>(null)

  // Reactive subscriptions — no useEffect callback needed
  const status = useAtomValue(session.status$)
  const exitCode = useAtomValue(session.exitCode$)
  const outputSeq = useAtomValue(session.outputSeq$) // trigger on new data

  // Write new output to terminal when outputSeq changes
  // (We track sequence number, not full output string, to avoid holding
  //  the entire buffer in atom — terminal handles its own scrollback)
  useEffect(() => {
    // Terminal writes are handled differently — see below
  }, [outputSeq])

  return (
    <InteractiveTerminal
      sessionId={sessionId}
      status={status}
      exitCode={exitCode ?? undefined}
      onInput={/* ... */}
      onResize={/* ... */}
      onKill={/* ... */}
    />
  )
}
```

## Terminal Data Flow Problem

The output$ atom accumulates ALL raw PTY bytes as a string. This is correct
for incremental reads by the agent, but a React component can't efficiently
subscribe to a growing 512KB string.

**Solution**: Two-channel pattern.

1. **Terminal data**: Still uses a direct callback (event → terminal.write()).
   This is a hot path — ghostty-web handles its own ring buffer.
   We keep a thin listener for `shell:data` events that calls `termRef.current?.write(data)`.

2. **Session metadata**: Uses Atom.family (status$, exitCode$, info$, error$).
   These are cold/infrequent and drive React re-renders.

```typescript
// Hybrid: atoms for metadata, direct callback for hot data path
export function useShellSession(sessionId: string) {
  const session = shellSessionFamily(sessionId)
  const status = useAtomValue(session.status$)
  const exitCode = useAtomValue(session.exitCode$)
  const info = useAtomValue(session.info$)
  const error = useAtomValue(session.error$)

  // Direct data listener — NOT through atoms (hot path)
  const termRef = useRef<TerminalCoreRef>(null)

  useEffect(() => {
    // Subscribe only for data events, bypass atom layer
    const unsub = subscribeShellDataEvents(sessionId, (data: string) => {
      termRef.current?.write(data)
    })
    return unsub
  }, [sessionId])

  return { status, exitCode, info, error, termRef }
}
```

## Agent-Facing State (Server-Side)

For the agent's `readOutput` call, we need the accumulated output buffer.
This lives **server-side** in the PTY worker (xterm-headless buffer),
NOT in client atoms. The agent calls `readOutput(sessionId, { mode: 'tail', lines: 50 })`
which routes through WS → service → `pool.executeEffect(new PtyDumpScreen(...))`.

Client atoms only hold UI-consumable metadata.

## Summary

| Concern            | Before                      | After                           |
| ------------------ | --------------------------- | ------------------------------- |
| Session status     | `useState` + callback       | `useAtomValue(session.status$)` |
| Session info       | `useState` + callback       | `useAtomValue(session.info$)`   |
| Terminal data      | callback → `termRef.write`  | callback → `termRef.write`      |
| Active sessions    | implicit from Map keys      | `activeSessionIds$` atom        |
| Session count      | manual                      | `activeSessionCount$` derived   |
| Memory cleanup     | manual `unsub()` or leak    | WeakRef + FinalizationRegistry  |
| Agent output reads | `stripVTControlCharacters`  | `PtyDumpScreen` RPC (server)    |
| Cross-component    | `subscribeShellEvents` + cb | same `shellSessionFamily(id)`   |

## Future: Outer Family (Multi-Adapter)

When TMNL supports multiple simultaneous adapters (e.g., two chat surfaces
talking to different agents), the outer family scopes session families:

```typescript
const adapterShellFamily = Atom.family((adapterId: string) =>
  Atom.family((sessionId: string): ShellSessionAtoms => ({
    output$:    Atom.make(''),
    status$:    Atom.make<ShellSessionStatus>('starting'),
    // ...
  }))
)

// Usage: adapterShellFamily('adapter-1')('session-abc')
```

For now, we skip the outer layer and use `shellSessionFamily` directly.
