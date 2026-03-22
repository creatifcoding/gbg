/**
 * Trait System Testbed
 *
 * Test cases for the trait-based injection system.
 */

import { useState, useEffect } from 'react'
import {
  TraitProvider,
  useTrait,
  useInject,
  ClickableAffordance,
  type ClickableAffordanceSlot,
} from '@/lib/traits'
import { TestCard } from '@/components/testbed/shared'

// =============================================================================
// TC1: BASIC TRAIT CONSUMPTION
// =============================================================================

function TraitConsumer({ id, label }: { id: string; label: string }) {
  const { rendered, style, className, isInjected } = useTrait(ClickableAffordance, id)

  return (
    <span
      style={style}
      className={`inline-block px-3 py-1.5 text-sm font-mono rounded ${className} ${
        isInjected ? 'bg-neutral-800' : 'bg-neutral-900'
      }`}
    >
      {label}
      {rendered}
    </span>
  )
}

function TC1_BasicConsumption() {
  return (
    <TestCard
      title="TC1: Basic Trait Consumption"
      description="Components consume traits but no injection yet — nothing appears"
    >
      <div className="flex gap-4">
        <TraitConsumer id="tc1-a" label="No injection" />
        <TraitConsumer id="tc1-b" label="Also nothing" />
      </div>
      <p className="mt-3 text-xs text-neutral-600">
        These consume ClickableAffordance but no one has injected yet.
      </p>
    </TestCard>
  )
}

// =============================================================================
// TC2: INJECTION FROM PARENT
// =============================================================================

function TC2_Injection() {
  const { inject, clear } = useInject()
  const [injected, setInjected] = useState(false)

  const handleToggle = () => {
    if (injected) {
      clear(ClickableAffordance, 'tc2-target')
    } else {
      inject(ClickableAffordance, 'tc2-target', {
        tooltip: 'I was injected!',
        glow: 'cyan',
        cursor: 'pointer',
      })
    }
    setInjected(!injected)
  }

  return (
    <TestCard
      title="TC2: Injection from Parent"
      description="Parent component injects affordance into child"
    >
      <div className="flex items-center gap-4">
        <button
          onClick={handleToggle}
          className="px-3 py-1.5 text-xs font-mono bg-cyan-900/30 text-cyan-400 rounded hover:bg-cyan-900/50 transition-colors"
        >
          {injected ? 'Clear Injection' : 'Inject Affordance'}
        </button>

        <TraitConsumer id="tc2-target" label="Target Element" />
      </div>
      <p className="mt-3 text-xs text-neutral-600">
        Click the button to inject/clear a glow + tooltip onto the target.
      </p>
    </TestCard>
  )
}

// =============================================================================
// TC3: MULTIPLE TARGETS
// =============================================================================

function TC3_MultipleTargets() {
  const { inject, clearAll } = useInject()
  const [mode, setMode] = useState<'none' | 'all' | 'selective'>('none')

  useEffect(() => {
    clearAll(ClickableAffordance)

    if (mode === 'all') {
      inject(ClickableAffordance, 'tc3-a', { glow: 'orange', tooltip: 'Element A' })
      inject(ClickableAffordance, 'tc3-b', { glow: 'orange', tooltip: 'Element B' })
      inject(ClickableAffordance, 'tc3-c', { glow: 'orange', tooltip: 'Element C' })
    } else if (mode === 'selective') {
      inject(ClickableAffordance, 'tc3-a', { glow: 'green', tooltip: 'Only A' })
      inject(ClickableAffordance, 'tc3-c', { glow: 'violet', tooltip: 'And C', badge: 'NEW' })
    }
  }, [mode, inject, clearAll])

  return (
    <TestCard
      title="TC3: Multiple Targets"
      description="Inject into multiple targets with different configurations"
    >
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('none')}
          className={`px-2 py-1 text-xs font-mono rounded ${
            mode === 'none' ? 'bg-neutral-700 text-white' : 'bg-neutral-900 text-neutral-500'
          }`}
        >
          None
        </button>
        <button
          onClick={() => setMode('all')}
          className={`px-2 py-1 text-xs font-mono rounded ${
            mode === 'all' ? 'bg-orange-900/50 text-orange-400' : 'bg-neutral-900 text-neutral-500'
          }`}
        >
          All (orange)
        </button>
        <button
          onClick={() => setMode('selective')}
          className={`px-2 py-1 text-xs font-mono rounded ${
            mode === 'selective' ? 'bg-violet-900/50 text-violet-400' : 'bg-neutral-900 text-neutral-500'
          }`}
        >
          Selective (A+C)
        </button>
      </div>

      <div className="flex gap-4">
        <TraitConsumer id="tc3-a" label="A" />
        <TraitConsumer id="tc3-b" label="B" />
        <TraitConsumer id="tc3-c" label="C" />
      </div>
    </TestCard>
  )
}

// =============================================================================
// TC4: ALL GLOW COLORS
// =============================================================================

function TC4_GlowColors() {
  const { inject } = useInject()

  useEffect(() => {
    const colors: ClickableAffordanceSlot['glow'][] = ['orange', 'cyan', 'violet', 'green', 'red', 'amber']
    colors.forEach((color, i) => {
      inject(ClickableAffordance, `tc4-${color}`, {
        glow: color,
        tooltip: `${color} glow`,
      })
    })
  }, [inject])

  return (
    <TestCard
      title="TC4: Glow Color Palette"
      description="All available glow colors"
    >
      <div className="flex flex-wrap gap-3">
        {(['orange', 'cyan', 'violet', 'green', 'red', 'amber'] as const).map((color) => (
          <TraitConsumer key={color} id={`tc4-${color}`} label={color} />
        ))}
      </div>
    </TestCard>
  )
}

// =============================================================================
// TC5: PULSE ANIMATION
// =============================================================================

function TC5_Pulse() {
  const { inject } = useInject()

  useEffect(() => {
    inject(ClickableAffordance, 'tc5-pulse', {
      glow: 'red',
      pulse: true,
      tooltip: 'Attention!',
      badge: 'ALERT',
    })
    inject(ClickableAffordance, 'tc5-static', {
      glow: 'green',
      pulse: false,
      tooltip: 'All good',
    })
  }, [inject])

  return (
    <TestCard
      title="TC5: Pulse Animation"
      description="Compare pulsing vs static glow"
    >
      <div className="flex gap-6">
        <TraitConsumer id="tc5-pulse" label="Pulsing" />
        <TraitConsumer id="tc5-static" label="Static" />
      </div>
    </TestCard>
  )
}

// =============================================================================
// TC6: REAL-WORLD SIMULATION (DMG Badge)
// =============================================================================

function DmgBadgeSimulation({ id, onClick }: { id: string; onClick: () => void }) {
  const { rendered, style, className } = useTrait(ClickableAffordance, id)

  return (
    <button
      onClick={onClick}
      style={{ ...style, fontSize: 'var(--tmnl-text-xs, 12px)' }}
      className={`px-1.5 py-0.5 font-mono uppercase rounded bg-orange-900/30 text-orange-400 ${className}`}
    >
      DMG
      {rendered}
    </button>
  )
}

function TC6_RealWorld() {
  const { inject, clear } = useInject()
  const [mode, setMode] = useState<'none' | 'subtle' | 'obvious'>('none')

  useEffect(() => {
    clear(ClickableAffordance, 'tc6-dmg')

    if (mode === 'subtle') {
      inject(ClickableAffordance, 'tc6-dmg', {
        tooltip: 'Click to view damage report',
        cursor: 'pointer',
      })
    } else if (mode === 'obvious') {
      inject(ClickableAffordance, 'tc6-dmg', {
        tooltip: 'Click to view damage report',
        glow: 'orange',
        pulse: true,
        cursor: 'pointer',
      })
    }
  }, [mode, inject, clear])

  return (
    <TestCard
      title="TC6: Real-World — DMG Badge"
      description="Simulating the HALFLIFE damage badge with different affordance levels"
    >
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('none')}
          className={`px-2 py-1 text-xs font-mono rounded ${
            mode === 'none' ? 'bg-neutral-700 text-white' : 'bg-neutral-900 text-neutral-500'
          }`}
        >
          No affordance
        </button>
        <button
          onClick={() => setMode('subtle')}
          className={`px-2 py-1 text-xs font-mono rounded ${
            mode === 'subtle' ? 'bg-neutral-700 text-white' : 'bg-neutral-900 text-neutral-500'
          }`}
        >
          Subtle (tooltip only)
        </button>
        <button
          onClick={() => setMode('obvious')}
          className={`px-2 py-1 text-xs font-mono rounded ${
            mode === 'obvious' ? 'bg-orange-900/50 text-orange-400' : 'bg-neutral-900 text-neutral-500'
          }`}
        >
          Obvious (glow + pulse)
        </button>
      </div>

      <div className="p-4 bg-neutral-900/50 rounded border border-neutral-800">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-neutral-500">Finding:</span>
          <span className="text-orange-400 font-mono text-xs">H3.5.dmg1</span>
          <DmgBadgeSimulation id="tc6-dmg" onClick={() => alert('Modal would open!')} />
        </div>
      </div>

      <p className="mt-3 text-xs text-neutral-600">
        Hover over the DMG badge to see the tooltip. The "obvious" mode adds a pulsing glow.
      </p>
    </TestCard>
  )
}

// =============================================================================
// TC7: PROVIDER SCOPING
// =============================================================================

function ScopedInjector() {
  const { inject } = useInject()

  useEffect(() => {
    inject(ClickableAffordance, 'tc7-scoped', {
      glow: 'violet',
      tooltip: 'I am scoped!',
    })
  }, [inject])

  return <TraitConsumer id="tc7-scoped" label="Scoped target" />
}

function TC7_Scoping() {
  return (
    <TestCard
      title="TC7: Provider Scoping"
      description="Injections only reach descendants of the same TraitProvider"
    >
      <div className="space-y-4">
        <div className="p-3 border border-violet-800/30 rounded">
          <div className="text-violet-500 uppercase tracking-wider mb-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            Inner TraitProvider
          </div>
          <TraitProvider>
            <ScopedInjector />
          </TraitProvider>
        </div>

        <div className="p-3 border border-neutral-800 rounded">
          <div className="text-neutral-500 uppercase tracking-wider mb-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            Outer scope (same ID, no injection)
          </div>
          <TraitConsumer id="tc7-scoped" label="Same ID, outer scope" />
        </div>
      </div>

      <p className="mt-3 text-xs text-neutral-600">
        The inner provider's injection doesn't leak to the outer scope.
      </p>
    </TestCard>
  )
}

// =============================================================================
// MAIN TESTBED
// =============================================================================

export function TraitTestbed() {
  return (
    <TraitProvider>
      <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-mono font-bold text-violet-400">Trait System Testbed</h1>
            <p className="text-sm text-neutral-500 mt-2">
              Trait-based injection for React components. Components declare traits, external code injects slots.
            </p>
          </div>

          {/* Test Cases */}
          <div className="space-y-6">
            <TC1_BasicConsumption />
            <TC2_Injection />
            <TC3_MultipleTargets />
            <TC4_GlowColors />
            <TC5_Pulse />
            <TC6_RealWorld />
            <TC7_Scoping />
          </div>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-neutral-800 text-xs text-neutral-600 font-mono">
            <div className="flex justify-between">
              <span>src/lib/traits/</span>
              <span>ClickableAffordance</span>
            </div>
          </div>
        </div>
      </div>
    </TraitProvider>
  )
}

export default TraitTestbed
