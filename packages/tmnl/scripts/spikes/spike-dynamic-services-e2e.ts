#!/usr/bin/env bun
/**
 * spike-dynamic-services-e2e.ts
 *
 * End-to-end smoke test for the full dynamic services pipeline:
 *   1. Decorator registration (@rpc, @event, @action, @state)
 *   2. Bootstrap bridging (decorators → DynamicRpcService + DynamicEventService)
 *   3. Direct service usage (callDynamicRpc, emitDynamicEvent)
 *   4. Interpreter execution (BehaviorBlock → atoms + dispatch → services)
 *   5. Pub/sub (subscribeDynamicEvent, subscribeAllDynamicEvents)
 *
 * Run: bun scripts/spikes/spike-dynamic-services-e2e.ts
 */

import 'reflect-metadata'
import { Effect } from 'effect'
import { Registry } from '@effect-atom/atom'

// ─── Decorator imports ───
import { actionGroup, state, action, computed } from '@/lib/genifer/decorators/action-group'
import { rpc } from '@/lib/genifer/decorators/rpc'
import { event, emits } from '@/lib/genifer/decorators/event'
import { bootstrap, bootstrapRegistry } from '@/lib/genifer/decorators/bootstrap'

// ─── Service imports ───
import {
  callDynamicRpc,
  rpcRegistryAtom,
  registerCustomRpcHandler,
  setDynamicRpcRegistry,
} from '@/lib/genifer/services/DynamicRpcService'
import {
  emitDynamicEvent,
  subscribeDynamicEvent,
  subscribeAllDynamicEvents,
  getDynamicEventLog,
  getDynamicEventDefinitions,
  setDynamicEventRegistry,
  eventDefinitionsAtom,
} from '@/lib/genifer/services/DynamicEventService'
import { EventDefinition } from '@/lib/genifer/services/DynamicEventSchemas'
import { RpcDefinition } from '@/lib/genifer/services/DynamicRpcSchemas'

// ─── Interpreter imports ───
import {
  interpretBehaviorBlock,
  setRpcExecutor,
} from '@/lib/genifer/decorators/interpreter'

// ─── Helpers ───
let total = 0
let passed = 0

function pass(label: string) { console.log(`  ✅ ${label}`) }
function fail(label: string, err: unknown) {
  total++
  console.log(`  ❌ ${label}: ${err}`)
  process.exitCode = 1
}
function assert(cond: boolean, label: string, detail?: string) {
  total++
  if (cond) { passed++; pass(label) }
  else { console.log(`  ❌ ${label}: ${detail ?? 'assertion failed'}`); process.exitCode = 1 }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1: Define decorated classes
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔧 PHASE 1: Decorator Registration')

@actionGroup('Counter')
class CounterActions {
  @state counter = 0
  @state label = 'clicks'

  @computed
  get summary() { return `${this.counter} ${this.label}` }

  @action('increment')
  increment() { this.counter += 1 }

  @action('reset')
  reset() { this.counter = 0 }
}

@actionGroup('Greeter')
class GreeterActions {
  @state greeting = 'Hello'

  @action('greet')
  greet() { return `${this.greeting}, World!` }

  @emits('greeted')
  @action('greetAndEmit')
  greetAndEmit() { return { message: `${this.greeting}, World!` } }
}

// Register an RPC via decorator
@rpc('math.add', { description: 'Adds two numbers' })
class MathAddRpc {
  handle(payload: { a: number; b: number }) {
    return { result: payload.a + payload.b }
  }
}

// Register events via decorator
@event('counter.changed', { description: 'Counter value changed' })
class CounterChangedEvent {}

@event('greeted', { description: 'A greeting was emitted' })
class GreetedEvent {}

pass('Decorated classes defined (2 ActionGroups, 1 RPC, 2 Events)')

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2: Bootstrap
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🚀 PHASE 2: Bootstrap')

// Debug: check decorator registries before bootstrap

const result = bootstrap()
assert(result.actionGroups.size === 2, `ActionGroups hydrated: ${result.actionGroups.size}`)
assert(result.rpcCount >= 1, `RPCs registered: ${result.rpcCount}`)
assert(result.eventCount >= 2, `Events registered: ${result.eventCount}`)

// Verify Counter ActionGroup atoms exist
const counterInstance = result.actionGroups.get('Counter')
assert(!!counterInstance, 'Counter ActionGroup hydrated')
if (counterInstance) {
  assert(counterInstance.atoms.has('counter'), 'Counter.counter atom exists')
  assert(counterInstance.atoms.has('label'), 'Counter.label atom exists')
}

// Verify Greeter ActionGroup
const greeterInstance = result.actionGroups.get('Greeter')
assert(!!greeterInstance, 'Greeter ActionGroup hydrated')

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 3: DynamicRpcService — Direct Usage
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📡 PHASE 3: DynamicRpcService — Direct Usage')

// Register a custom RPC handler manually (not via decorator)
registerCustomRpcHandler('echo', (payload) => ({ echo: payload }))

// Register it in the registry atom
const r = bootstrapRegistry
const currentRpcs = r.get(rpcRegistryAtom)
const updatedRpcs = new Map(currentRpcs)
updatedRpcs.set('echo', new RpcDefinition({
  tag: 'echo',
  description: 'Echo handler',
  handler: { _tag: 'custom' as const, handlerId: 'echo' },
  source: 'dynamic' as const,
  registeredAt: Date.now(),
}))
r.set(rpcRegistryAtom, updatedRpcs)

// Call the echo RPC (sync handler — use runSync to avoid atom clobbering)
try {
  const echoResult = Effect.runSync(callDynamicRpc('echo', { hello: 'world' }))
  assert(
    JSON.stringify(echoResult) === JSON.stringify({ echo: { hello: 'world' } }),
    `Echo RPC returned: ${JSON.stringify(echoResult)}`
  )
} catch (e: any) {
  fail('Echo RPC call', e?.message ?? e)
}

// Call unknown RPC — should fail
try {
  Effect.runSync(callDynamicRpc('nonexistent', {}))
  fail('Unknown RPC should have thrown', 'no error')
} catch (e: any) {
  const msg = String(e)
  assert(msg.includes('not registered') || msg.includes('NotFound'), `Unknown RPC correctly fails: ${msg.slice(0, 80)}`)
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4: DynamicEventService — Direct Usage
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📢 PHASE 4: DynamicEventService — Direct Usage')


// Check that bootstrap bridged events
const defs = getDynamicEventDefinitions()
assert(defs.size >= 2, `Event definitions bridged: ${defs.size}`)
assert(defs.has('counter.changed'), 'counter.changed event defined')
assert(defs.has('greeted'), 'greeted event defined')

// Subscribe to events
const receivedEvents: Array<{ tag: string; payload: unknown }> = []
const unsub1 = subscribeDynamicEvent('counter.changed', (payload) => {
  receivedEvents.push({ tag: 'counter.changed', payload })
})

const allEvents: string[] = []
const unsub2 = subscribeAllDynamicEvents((_payload, meta) => {
  allEvents.push(meta.tag)
})

// Emit events
Effect.runSync(emitDynamicEvent('counter.changed', { value: 42 }, 'spike'))
Effect.runSync(emitDynamicEvent('greeted', { message: 'Hi' }, 'spike'))

assert(receivedEvents.length === 1, `Tag subscriber received: ${receivedEvents.length} events`)
assert(
  JSON.stringify(receivedEvents[0]?.payload) === JSON.stringify({ value: 42 }),
  `Tag subscriber payload: ${JSON.stringify(receivedEvents[0]?.payload)}`
)
assert(allEvents.length === 2, `Wildcard subscriber received: ${allEvents.length} events`)
assert(allEvents[0] === 'counter.changed' && allEvents[1] === 'greeted', `Wildcard order: [${allEvents}]`)

// Check log
const log = getDynamicEventLog()
assert(log.length === 2, `Event log has ${log.length} entries`)
assert(log[0].eventTag === 'counter.changed', `Log[0] tag: ${log[0].eventTag}`)
assert(log[1].eventTag === 'greeted', `Log[1] tag: ${log[1].eventTag}`)

// Emit undefined event — should fail
try {
  Effect.runSync(emitDynamicEvent('bogus.event', {}))
  fail('Undefined event should have thrown', 'no error')
} catch (e: any) {
  const msg = String(e)
  assert(msg.includes('not defined') || msg.includes('NotDefined'), `Undefined event correctly fails`)
}

unsub1()
unsub2()

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 5: Interpreter Bridge — BehaviorBlock → Actions → Services
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🧠 PHASE 5: Interpreter Bridge — BehaviorBlock execution')

// Wire callDynamicRpc as the interpreter's RPC executor
setRpcExecutor((tag: string, payload: unknown) => callDynamicRpc(tag, payload))

// Define a BehaviorBlock matching the generation-schema.ts BehaviorBlock shape
const counterBlock = {
  name: 'SpikeCounter',
  state: [
    { field: 'counter', initial: 0 },
    { field: 'label', initial: 'clicks' },
  ],
  actions: {
    increment: {
      _tag: 'setState' as const,
      values: { counter: 1 },
    },
    reset: {
      _tag: 'setState' as const,
      values: { counter: 0 },
    },
    notify: {
      _tag: 'emitEvent' as const,
      event: 'counter.changed',
      payload: { value: '{{@state:counter}}' },
    },
  },
  subscriptions: [],
  emits: ['counter.changed'],
  requires: [],
}

try {
  const instance = interpretBehaviorBlock(counterBlock)
  assert(!!instance, 'BehaviorBlock interpreted successfully')
  assert(instance.atoms.has('counter'), 'Interpreted block has counter atom')
  assert(instance.atoms.has('label'), 'Interpreted block has label atom')
  assert(typeof instance.dispatch === 'function', 'Interpreted block has dispatch function')

  // Read initial state — interpreter creates its own Registry, use that
  const counterAtom = instance.atoms.get('counter')!
  // The interpreter's registry is internal — use the instance's registry getter if available
  // or just use bootstrapRegistry since atoms are global
  const instRegistry = (instance as any).registry ?? bootstrapRegistry
  const initialValue = instRegistry.get(counterAtom)
  assert(initialValue === 0, `Initial counter: ${initialValue}`)

  // Dispatch increment (dispatch returns an Effect)
  Effect.runSync(instance.dispatch('increment', {}))
  const afterIncrement = instRegistry.get(counterAtom)
  assert(afterIncrement === 1, `After increment: ${afterIncrement}`)

  // Dispatch reset
  Effect.runSync(instance.dispatch('reset', {}))
  const afterReset = instRegistry.get(counterAtom)
  assert(afterReset === 0, `After reset: ${afterReset}`)

  pass('BehaviorBlock dispatch cycle complete')
} catch (e: any) {
  fail('BehaviorBlock interpretation', e?.message ?? e)
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 6: Subscriber Error Isolation
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🛡️  PHASE 6: Subscriber Error Isolation')

// Define a fresh event for this test
const freshDefs = new Map(r.get(eventDefinitionsAtom))
freshDefs.set('error.test', new EventDefinition({ tag: 'error.test' }))
r.set(eventDefinitionsAtom, freshDefs)

const safeReceived: unknown[] = []
subscribeDynamicEvent('error.test', () => { throw new Error('kaboom') })
subscribeDynamicEvent('error.test', (payload) => { safeReceived.push(payload) })

try {
  Effect.runSync(emitDynamicEvent('error.test', { ok: true }))
  assert(safeReceived.length === 1, `Safe subscriber received despite throwing sibling`)
  assert(JSON.stringify(safeReceived[0]) === '{"ok":true}', `Safe subscriber got correct payload`)
} catch (e: any) {
  fail('Subscriber error isolation', e?.message ?? e)
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60))
console.log(`  ${passed}/${total} assertions passed`)
if (passed === total) {
  console.log('  🎉 ALL CLEAR — Dynamic Services E2E spike passed')
} else {
  console.log(`  ⚠️  ${total - passed} failures`)
}
console.log('═'.repeat(60) + '\n')

process.exit(passed === total ? 0 : 1)
