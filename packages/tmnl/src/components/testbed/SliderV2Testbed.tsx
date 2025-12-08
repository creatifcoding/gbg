/**
 * Slider V2 Testbed
 *
 * Demonstrates CEW-grade slider with trait-based composition:
 * - Trait injection controls
 * - All 5 trait combinations
 * - Overshoot boundary demo
 * - Precision modifier demo
 */

import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Slider } from '@/lib/slider/v2'
import type { GlowSlot, OvershootSlot } from '@/lib/slider/v2'

// =============================================================================
// DEMO SECTION
// =============================================================================

function DemoSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="p-4 bg-neutral-900/50 rounded-lg border border-neutral-800">
      <h3 className="text-lg font-mono font-bold text-neutral-100 mb-1">{title}</h3>
      <p className="text-sm text-neutral-400 mb-4">{description}</p>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

// =============================================================================
// TESTBED COMPONENT
// =============================================================================

export function SliderV2Testbed() {
  // State for controlled sliders
  const [basicValue, setBasicValue] = useState(50)
  const [cewValue, setCewValue] = useState(0)
  const [decibelValue, setDecibelValue] = useState(-12)

  // Dynamic trait controls
  const [glowColor, setGlowColor] = useState<GlowSlot['color']>('cyan')
  const [glowIntensity, setGlowIntensity] = useState<GlowSlot['intensity']>('normal')
  const [overshootExtent, setOvershootExtent] = useState(0.15)

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <Link to="/" className="text-cyan-400 hover:underline text-sm mb-4 block">
          &larr; Back to Home
        </Link>
        <h1 className="text-3xl font-mono font-bold mb-2">Slider V2 Testbed</h1>
        <p className="text-neutral-400">
          CEW-grade slider with trait-based composition and Effect-ified animations
        </p>
      </div>

      {/* Demo Grid */}
      <div className="max-w-4xl mx-auto grid gap-6">
        {/* Basic Slider */}
        <DemoSection
          title="1. Basic Slider"
          description="Default configuration with sensible defaults"
        >
          <div className="w-full max-w-md">
            <Slider
              id="basic-slider"
              config={{ min: 0, max: 100 }}
              initialValue={50}
              onChange={setBasicValue}
            />
            <div className="mt-2 text-sm text-neutral-500 font-mono">
              Value: {basicValue.toFixed(1)}
            </div>
          </div>
        </DemoSection>

        {/* CEW Spectrum Slider */}
        <DemoSection
          title="2. CEW Spectrum Control"
          description="High-stakes slider with intense glow and 15% overshoot. Try dragging to boundaries!"
        >
          <div className="w-full max-w-md">
            <Slider
              id="cew-slider"
              config={{ min: -100, max: 100, unit: '%' }}
              initialValue={0}
              onChange={setCewValue}
              glow={{
                color: 'cyan',
                intensity: 'intense',
                emanateOnBoundary: true,
              }}
              overshoot={{
                enabled: true,
                extent: 0.15,
                settleMs: 65,
                easing: 'easeOutBack',
              }}
            />
            <div className="mt-4 text-sm text-neutral-500 font-mono">
              Spectrum offset: {cewValue.toFixed(1)}%
            </div>
          </div>
        </DemoSection>

        {/* Decibel Slider */}
        <DemoSection
          title="3. Decibel Curve"
          description="Audio-style slider with decibel curve transformation"
        >
          <div className="w-full max-w-md">
            <Slider
              id="decibel-slider"
              config={{ min: -48, max: 6, unit: 'dB' }}
              initialValue={-12}
              onChange={setDecibelValue}
              glow={{
                color: 'amber',
                intensity: 'normal',
              }}
              curve={{
                type: 'decibel',
              }}
            />
            <div className="mt-4 text-sm text-neutral-500 font-mono">
              Level: {decibelValue.toFixed(1)} dB
            </div>
          </div>
        </DemoSection>

        {/* Snap Grid Slider */}
        <DemoSection
          title="4. Snap Grid"
          description="Slider with visible snap points and magnetism"
        >
          <div className="w-full max-w-md">
            <Slider
              id="snap-slider"
              config={{ min: 0, max: 100 }}
              glow={{
                color: 'green',
                intensity: 'subtle',
                emanateOnSnap: true,
              }}
              snap={{
                steps: [0, 0.25, 0.5, 0.75, 1.0],
                magnetism: 0.3,
                showGrid: true,
              }}
            />
          </div>
        </DemoSection>

        {/* Dynamic Trait Controls */}
        <DemoSection
          title="5. Dynamic Trait Control"
          description="Adjust traits in real-time"
        >
          <div className="w-full max-w-md space-y-4">
            {/* Glow Color Select */}
            <div className="flex items-center gap-4">
              <label className="text-sm text-neutral-400 w-24">Glow Color:</label>
              <select
                value={glowColor}
                onChange={(e) => setGlowColor(e.target.value as GlowSlot['color'])}
                className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm"
              >
                <option value="cyan">Cyan</option>
                <option value="amber">Amber</option>
                <option value="green">Green</option>
                <option value="red">Red</option>
                <option value="violet">Violet</option>
              </select>
            </div>

            {/* Glow Intensity Select */}
            <div className="flex items-center gap-4">
              <label className="text-sm text-neutral-400 w-24">Intensity:</label>
              <select
                value={glowIntensity}
                onChange={(e) => setGlowIntensity(e.target.value as GlowSlot['intensity'])}
                className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm"
              >
                <option value="subtle">Subtle</option>
                <option value="normal">Normal</option>
                <option value="intense">Intense</option>
              </select>
            </div>

            {/* Overshoot Extent */}
            <div className="flex items-center gap-4">
              <label className="text-sm text-neutral-400 w-24">Overshoot:</label>
              <input
                type="range"
                min={0}
                max={0.3}
                step={0.05}
                value={overshootExtent}
                onChange={(e) => setOvershootExtent(parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm text-neutral-500 w-12">
                {(overshootExtent * 100).toFixed(0)}%
              </span>
            </div>

            {/* Dynamic Slider */}
            <div className="pt-4">
              <Slider
                id="dynamic-slider"
                config={{ min: 0, max: 100 }}
                glow={{
                  color: glowColor,
                  intensity: glowIntensity,
                  emanateOnBoundary: true,
                }}
                overshoot={{
                  enabled: true,
                  extent: overshootExtent,
                  settleMs: 65,
                  easing: 'easeOutBack',
                }}
              />
            </div>
          </div>
        </DemoSection>

        {/* Precision Demo */}
        <DemoSection
          title="6. Precision Modifiers"
          description="Hold Shift for fine control (0.1x), Ctrl for ultra-fine (0.01x)"
        >
          <div className="w-full max-w-md">
            <Slider
              id="precision-slider"
              config={{ min: 0, max: 1, step: 0 }}
              glow={{
                color: 'violet',
                intensity: 'normal',
              }}
              precision={{
                baseSensitivity: 1.0,
                shiftMultiplier: 0.1,
                ctrlMultiplier: 0.01,
                altBehavior: 'snap',
              }}
            />
            <div className="mt-4 text-xs text-neutral-500 font-mono">
              <kbd className="px-1 py-0.5 bg-neutral-800 rounded">Shift</kbd> = Fine |{' '}
              <kbd className="px-1 py-0.5 bg-neutral-800 rounded">Ctrl</kbd> = Ultra-fine |{' '}
              <kbd className="px-1 py-0.5 bg-neutral-800 rounded">Alt</kbd> = Snap
            </div>
          </div>
        </DemoSection>

        {/* Multiple Sliders */}
        <DemoSection
          title="7. Multi-Slider Array"
          description="Multiple sliders with different configurations"
        >
          <div className="w-full max-w-md space-y-4">
            {['red', 'green', 'cyan', 'amber', 'violet'].map((color, i) => (
              <div key={color} className="flex items-center gap-4">
                <span className="text-xs text-neutral-500 w-8 font-mono">#{i + 1}</span>
                <div className="flex-1">
                  <Slider
                    id={`multi-slider-${i}`}
                    config={{ min: 0, max: 100 }}
                    initialValue={20 + i * 15}
                    glow={{
                      color: color as GlowSlot['color'],
                      intensity: 'subtle',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </DemoSection>
      </div>

      {/* Footer */}
      <div className="max-w-4xl mx-auto mt-12 pt-8 border-t border-neutral-800">
        <p className="text-sm text-neutral-600 font-mono">
          Slider V2 — CEW-grade, trait-based, Effect-ified
        </p>
      </div>
    </div>
  )
}

export default SliderV2Testbed
