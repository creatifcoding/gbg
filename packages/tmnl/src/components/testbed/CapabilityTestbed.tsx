/**
 * Capability System Testbed
 *
 * ECS-inspired capability injection demos.
 */

import { useState, useEffect } from 'react'
import {
  CapabilityProvider,
  useCapability,
  useCapabilities,
  useAttach,
  useAttachOnMount,
  GlowRing,
  Tooltip,
  Badge,
  COLORS,
  type AccentColor,
} from '@/lib/capabilities'
import { TestCard } from '@/components/testbed/shared'

// =============================================================================
// TC1: BASIC CAPABILITY CONSUMPTION
// =============================================================================

function CapableElement({ id, label }: { id: string; label: string }) {
  const [hovered, setHovered] = useState(false)
  const glow = useCapability(id, 'glowable')
  const tooltip = useCapability(id, 'tooltippable')
  const badge = useCapability(id, 'badgeable')

  return (
    <span
      className="relative inline-block px-3 py-1.5 text-sm font-mono rounded bg-neutral-800"
      style={{ cursor: glow ? 'pointer' : 'default' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {label}
      {glow && <GlowRing {...glow} />}
      {tooltip && <Tooltip {...tooltip} visible={hovered} />}
      {badge && <Badge {...badge} />}
    </span>
  )
}

function TC1_BasicConsumption() {
  return (
    <TestCard
      title="TC1: Basic Capability Consumption"
      description="Elements consume capabilities — but no injections yet"
    >
      <div className="flex gap-4">
        <CapableElement id="tc1-a" label="Element A" />
        <CapableElement id="tc1-b" label="Element B" />
      </div>
      <p className="mt-3 text-xs text-neutral-600">
        These consume glowable/tooltippable/badgeable but nothing is injected.
      </p>
    </TestCard>
  )
}

// =============================================================================
// TC2: INJECTION FROM PARENT
// =============================================================================

function TC2_Injection() {
  const { attach, detach } = useAttach()
  const [injected, setInjected] = useState(false)

  const handleToggle = () => {
    if (injected) {
      detach('tc2-target', 'glowable')
      detach('tc2-target', 'tooltippable')
    } else {
      attach('tc2-target', 'glowable', { color: 'cyan', intensity: 'md' })
      attach('tc2-target', 'tooltippable', { text: 'Injected tooltip!' })
    }
    setInjected(!injected)
  }

  return (
    <TestCard
      title="TC2: Injection from Parent"
      description="Parent injects glowable + tooltippable into child"
    >
      <div className="flex items-center gap-4">
        <button
          onClick={handleToggle}
          className="px-3 py-1.5 text-xs font-mono bg-cyan-900/30 text-cyan-400 rounded hover:bg-cyan-900/50 transition-colors"
        >
          {injected ? 'Detach' : 'Attach'}
        </button>
        <CapableElement id="tc2-target" label="Target" />
      </div>
    </TestCard>
  )
}

// =============================================================================
// TC3: ALL GLOW COLORS
// =============================================================================

function GlowColorDemo({ color }: { color: AccentColor }) {
  const id = `tc3-${color}`

  // Inject on mount
  useAttachOnMount(id, {
    glowable: { color, intensity: 'md' },
    tooltippable: { text: `${color} glow` },
  })

  return <CapableElement id={id} label={color} />
}

function TC3_GlowColors() {
  const colors: AccentColor[] = ['cyan', 'orange', 'violet', 'green', 'red', 'amber', 'fuchsia']

  return (
    <TestCard
      title="TC3: Glow Color Palette"
      description="All accent colors with glowable capability"
    >
      <div className="flex flex-wrap gap-3">
        {colors.map((color) => (
          <GlowColorDemo key={color} color={color} />
        ))}
      </div>
    </TestCard>
  )
}

// =============================================================================
// TC4: BADGE POSITIONS
// =============================================================================

function BadgePositionDemo({
  position,
}: {
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
}) {
  const id = `tc4-${position}`

  useAttachOnMount(id, {
    badgeable: { text: 'NEW', color: 'violet', position },
  })

  return <CapableElement id={id} label={position} />
}

function TC4_BadgePositions() {
  return (
    <TestCard
      title="TC4: Badge Positions"
      description="Corner badge placement options"
    >
      <div className="flex flex-wrap gap-6">
        <BadgePositionDemo position="top-right" />
        <BadgePositionDemo position="top-left" />
        <BadgePositionDemo position="bottom-right" />
        <BadgePositionDemo position="bottom-left" />
      </div>
    </TestCard>
  )
}

// =============================================================================
// TC5: TOOLTIP POSITIONS
// =============================================================================

function TooltipPositionDemo({
  side,
}: {
  side: 'top' | 'right' | 'bottom' | 'left'
}) {
  const id = `tc5-${side}`

  useAttachOnMount(id, {
    tooltippable: { text: `Tooltip on ${side}`, side },
  })

  return <CapableElement id={id} label={side} />
}

function TC5_TooltipPositions() {
  return (
    <TestCard
      title="TC5: Tooltip Positions"
      description="Hover to see tooltip placement"
    >
      <div className="flex flex-wrap gap-6 py-8 justify-center">
        <TooltipPositionDemo side="top" />
        <TooltipPositionDemo side="right" />
        <TooltipPositionDemo side="bottom" />
        <TooltipPositionDemo side="left" />
      </div>
    </TestCard>
  )
}

// =============================================================================
// TC6: MULTIPLE CAPABILITIES
// =============================================================================

function TC6_MultipleCapabilities() {
  const id = 'tc6-multi'

  useAttachOnMount(id, {
    glowable: { color: 'orange', intensity: 'lg', animated: true },
    tooltippable: { text: 'Glowing + Badge + Tooltip', side: 'top' },
    badgeable: { text: 'HOT', color: 'red', position: 'top-right' },
  })

  return (
    <TestCard
      title="TC6: Multiple Capabilities"
      description="Stacked: glowable + tooltippable + badgeable"
    >
      <div className="flex justify-center py-4">
        <CapableElement id={id} label="Multi-capable" />
      </div>
    </TestCard>
  )
}

// =============================================================================
// TC7: DMG BADGE SIMULATION
// =============================================================================

function DmgBadge({ id, onClick }: { id: string; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false)
  const glow = useCapability(id, 'glowable')
  const tooltip = useCapability(id, 'tooltippable')
  const badge = useCapability(id, 'badgeable')

  return (
    <button
      onClick={onClick}
      className="relative px-1.5 py-0.5 font-mono uppercase rounded bg-orange-900/30 text-orange-400 hover:bg-orange-800/50 transition-colors"
      style={{ cursor: 'pointer', fontSize: 'var(--tmnl-text-xs, 12px)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      DMG
      {glow && <GlowRing {...glow} />}
      {tooltip && <Tooltip {...tooltip} visible={hovered} />}
      {badge && <Badge {...badge} />}
    </button>
  )
}

function TC7_DmgBadge() {
  const [mode, setMode] = useState<'none' | 'subtle' | 'obvious'>('none')
  const { attach, detach } = useAttach()
  const id = 'tc7-dmg'

  useEffect(() => {
    // Clear previous
    detach(id, 'glowable')
    detach(id, 'tooltippable')
    detach(id, 'badgeable')

    if (mode === 'subtle') {
      attach(id, 'tooltippable', { text: 'Click to view damage report' })
    } else if (mode === 'obvious') {
      attach(id, 'glowable', { color: 'orange', intensity: 'md', animated: true })
      attach(id, 'tooltippable', { text: 'Click to view damage report' })
    }
  }, [mode, attach, detach, id])

  return (
    <TestCard
      title="TC7: Real-World — DMG Badge"
      description="HALFLIFE damage badge with capability injection"
    >
      <div className="flex gap-2 mb-4">
        {(['none', 'subtle', 'obvious'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
              mode === m
                ? m === 'obvious'
                  ? 'bg-orange-900/50 text-orange-400'
                  : 'bg-neutral-700 text-white'
                : 'bg-neutral-900 text-neutral-500'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="p-4 bg-neutral-900/50 rounded border border-neutral-800">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-neutral-500">Finding:</span>
          <span className="text-orange-400 font-mono text-xs">H3.5.dmg1</span>
          <DmgBadge id={id} onClick={() => alert('Modal would open!')} />
        </div>
      </div>
    </TestCard>
  )
}

// =============================================================================
// TC8: PROVIDER SCOPING
// =============================================================================

function ScopedInjector({ entityId, color }: { entityId: string; color: AccentColor }) {
  useAttachOnMount(entityId, {
    glowable: { color, intensity: 'md' },
    tooltippable: { text: `Scoped to ${color}` },
  })

  return <CapableElement id={entityId} label={`Scoped (${color})`} />
}

function TC8_Scoping() {
  return (
    <TestCard
      title="TC8: Provider Scoping"
      description="Injections are isolated to their CapabilityProvider"
    >
      <div className="space-y-4">
        <div className="p-3 border border-cyan-800/30 rounded">
          <div className="text-cyan-500 uppercase tracking-wider mb-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            Inner Provider (cyan)
          </div>
          <CapabilityProvider>
            <ScopedInjector entityId="tc8-scoped" color="cyan" />
          </CapabilityProvider>
        </div>

        <div className="p-3 border border-violet-800/30 rounded">
          <div className="text-violet-500 uppercase tracking-wider mb-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            Another Provider (violet)
          </div>
          <CapabilityProvider>
            <ScopedInjector entityId="tc8-scoped" color="violet" />
          </CapabilityProvider>
        </div>

        <div className="p-3 border border-neutral-800 rounded">
          <div className="text-neutral-500 uppercase tracking-wider mb-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            Outer scope (no injection)
          </div>
          <CapableElement id="tc8-scoped" label="Same ID, outer scope" />
        </div>
      </div>
    </TestCard>
  )
}

// =============================================================================
// MAIN TESTBED
// =============================================================================

export function CapabilityTestbed() {
  return (
    <CapabilityProvider>
      <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-mono font-bold text-cyan-400">Capability System Testbed</h1>
            <p className="text-sm text-neutral-500 mt-2">
              ECS-inspired capability injection. Consumer owns render logic.
            </p>
          </div>

          {/* Test Cases */}
          <div className="space-y-6">
            <TC1_BasicConsumption />
            <TC2_Injection />
            <TC3_GlowColors />
            <TC4_BadgePositions />
            <TC5_TooltipPositions />
            <TC6_MultipleCapabilities />
            <TC7_DmgBadge />
            <TC8_Scoping />
          </div>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-neutral-800 text-xs text-neutral-600 font-mono">
            <div className="flex justify-between">
              <span>src/lib/capabilities/</span>
              <span>ECS Pattern</span>
            </div>
          </div>
        </div>
      </div>
    </CapabilityProvider>
  )
}

export default CapabilityTestbed
