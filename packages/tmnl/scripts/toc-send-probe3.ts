/**
 * TOC Send Probe 3: Simulate EXACT browser flow — Atom.runtime fn-atoms.
 * connect → verify sessionId$ → send → verify events update messages$.
 */
import { Atom } from '@effect-atom/atom'
import { Effect, Fiber, Option } from 'effect'
import {
  harnessOps,
  harnessMessages$,
  harnessConnection$,
  harnessStreaming$,
  harnessAgents$,
} from '../src/lib/morphchat/hooks/useHarnessAdapter'

// Atom.runtime fn-atoms need a registry to work outside React
const registry = Atom.Registry.make()

async function test() {
  // Step 1: Connect
  console.log('[1] connect...')
  const connectAtom = harnessOps.connect
  
  // fn-atom: writing triggers the effect. We need to simulate useAtom's write.
  // In effect-atom, writing to a fn-atom runs the effect through the runtime.
  registry.set(connectAtom, { nodeId: 'send-probe3', role: 'general' as any, agentName: 'Probe3' })
  
  // Wait for async completion
  await new Promise(r => setTimeout(r, 3000))
  
  const connection = registry.get(harnessConnection$)
  console.log('[1] connection:', JSON.stringify(connection))
  
  const messages = registry.get(harnessMessages$)
  console.log('[1] messages:', messages.length)

  // Step 2: Send
  console.log('\n[2] send...')
  registry.set(harnessOps.send, { content: 'Hello from probe3!', thinkingLevel: undefined })
  
  // Wait for response + streaming
  await new Promise(r => setTimeout(r, 10000))
  
  const msgs = registry.get(harnessMessages$)
  console.log(`\n[3] messages: ${msgs.length}`)
  for (const m of msgs) {
    console.log(`  - [${m.role}] ${m.status} "${m.content?.slice(0, 60)}"`)
  }
  
  const streaming = registry.get(harnessStreaming$)
  console.log('[3] streaming:', JSON.stringify(streaming))
}

test().then(
  () => { console.log('\nDONE'); process.exit(0) },
  (err) => { console.error('\nFAIL:', err); process.exit(1) },
)
