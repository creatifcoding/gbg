/**
 * SliderTestbed
 *
 * Combined testbed for Slider V1 (DAW-grade) and V2 (CEW-grade).
 * Uses collapsible panels for organized exploration.
 *
 * @route /testbed/slider
 */

import { useState } from 'react'
import {
  Slider as SliderV1,
  withSliderDebug,
  SliderDebugPanel,
  LinearBehavior,
  LogarithmicBehavior,
  DecibelBehavior,
  ExponentialBehavior,
  SteppedBehavior,
  useSlider as useSliderV1,
  type SliderBehaviorShape,
} from '@/lib/slider'
import { Slider as SliderV2 } from '@/lib/slider/v2'
import type { GlowSlot } from '@/lib/slider/v2'
import {
  CollapsiblePanel,
  DemoSection,
  TestbedHeader,
  VersionBadge,
  ValueDisplay,
  ControlGroup,
} from './shared'

// =============================================================================
// V1 DEBUG-WRAPPED SLIDER
// =============================================================================

const DebugSlider = withSliderDebug(SliderV1, { defaultExpanded: false })

// =============================================================================
// V1 BEHAVIOR CARD
// =============================================================================

interface BehaviorCardProps {
  name: string
  behavior: SliderBehaviorShape
  config: {
    min: number
    max: number
    defaultValue: number
    step?: number
    unit?: string
    precision?: number
  }
  description: string
}

function BehaviorCard({ name, behavior, config, description }: BehaviorCardProps) {
  const [value, setValue] = useState(config.defaultValue)

  return (
    <div className="bg-neutral-800/50 border border-neutral-600/30 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-mono text-sm text-cyan-300">{name}</h3>
          <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-neutral-500">ID</div>
          <div className="font-mono text-xs text-neutral-400">{behavior.id}</div>
        </div>
      </div>

      <div className="pt-2">
        <DebugSlider
          value={value}
          onChange={setValue}
          behavior={behavior}
          config={{
            min: config.min,
            max: config.max,
            defaultValue: config.defaultValue,
            step: config.step ?? null,
            unit: config.unit ?? '',
            precision: config.precision ?? 2,
          }}
          showTicks
        />
      </div>

      <div className="flex justify-between text-xs text-neutral-500 font-mono pt-1">
        <span>min: {config.min}</span>
        <span>max: {config.max}</span>
        {config.step && <span>step: {config.step}</span>}
      </div>
    </div>
  )
}

// =============================================================================
// V1 DEMOS
// =============================================================================

function V1ModifierDemo() {
  const [value, setValue] = useState(50)

  return (
    <DemoSection
      title="Precision Modifiers"
      description="Hold Shift for fine control (0.1x), Ctrl for ultra-fine (0.01x)"
    >
      <SliderV1
        value={value}
        onChange={setValue}
        config={{
          min: 0,
          max: 100,
          step: null,
          precision: 4,
        }}
        showValue
        valuePosition="right"
      />
      <div className="grid grid-cols-3 gap-2 text-center text-xs mt-3">
        <div className="bg-neutral-800 rounded p-2">
          <div className="text-neutral-500">Normal</div>
          <div className="font-mono text-neutral-300">1.0x</div>
        </div>
        <div className="bg-neutral-800 rounded p-2">
          <div className="text-neutral-500">+ Shift</div>
          <div className="font-mono text-amber-400">0.1x</div>
        </div>
        <div className="bg-neutral-800 rounded p-2">
          <div className="text-neutral-500">+ Ctrl</div>
          <div className="font-mono text-cyan-400">0.01x</div>
        </div>
      </div>
    </DemoSection>
  )
}

function V1MixerDemo() {
  const [gain, setGain] = useState(-6)
  const [pan, setPan] = useState(0)

  return (
    <DemoSection
      title="DAW Mixer Strip"
      description="Gain fader with decibel behavior, pan with linear"
    >
      <div className="flex gap-6 justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="text-xs text-neutral-500 uppercase">Gain</div>
          <div className="h-32">
            <SliderV1
              value={gain}
              onChange={setGain}
              behavior={DecibelBehavior.shape}
              config={{
                min: -48,
                max: 12,
                defaultValue: 0,
                step: 0.5,
                orientation: 'vertical',
              }}
              showValue
              valuePosition="bottom"
            />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="text-xs text-neutral-500 uppercase">Pan</div>
          <div className="w-24">
            <SliderV1
              value={pan}
              onChange={setPan}
              behavior={LinearBehavior.shape}
              config={{
                min: -100,
                max: 100,
                defaultValue: 0,
                step: 1,
              }}
              showValue
              valuePosition="bottom"
            />
          </div>
          <div className="flex justify-between w-24 text-xs text-neutral-500">
            <span>L</span><span>C</span><span>R</span>
          </div>
        </div>
      </div>
    </DemoSection>
  )
}

function V1StandaloneDebugDemo() {
  const slider = useSliderV1({
    value: 0.5,
    config: {
      min: 0,
      max: 1,
      step: null,
      precision: 4,
    },
    behavior: LinearBehavior.shape,
    debug: true,
  })

  return (
    <DemoSection
      title="Standalone Debug Panel"
      description="Debug panel can be placed separately from the slider"
    >
      <div className="grid md:grid-cols-2 gap-4">
        <div
          ref={slider.containerRef}
          className="relative flex items-center gap-3 select-none cursor-pointer"
          onPointerDown={slider.handlePointerDown}
          onPointerMove={slider.handlePointerMove}
          onPointerUp={slider.handlePointerUp}
          tabIndex={0}
        >
          <div className="relative flex-1 h-3 rounded-full bg-neutral-700 overflow-hidden">
            <div
              className="absolute h-full bg-gradient-to-r from-cyan-600 to-cyan-400"
              style={{ width: `${slider.normalizedValue * 100}%` }}
            />
            <div
              className="absolute w-4 h-4 rounded-full bg-white shadow border-2 border-cyan-400 transform -translate-x-1/2 -translate-y-1/4"
              style={{ left: `${slider.normalizedValue * 100}%`, top: '50%' }}
            />
          </div>
          <div className="min-w-[4rem] text-right font-mono text-sm text-cyan-300">
            {slider.displayValue}
          </div>
        </div>
        <SliderDebugPanel debugInfo={slider.debugInfo} />
      </div>
    </DemoSection>
  )
}

// =============================================================================
// V2 DEMOS
// =============================================================================

function V2BasicDemo() {
  const [value, setValue] = useState(50)

  return (
    <DemoSection
      title="Basic Slider"
      description="Default configuration with sensible defaults"
    >
      <div className="max-w-md">
        <SliderV2
          id="v2-basic"
          config={{ min: 0, max: 100 }}
          initialValue={50}
          onChange={setValue}
        />
        <ValueDisplay label="Value" value={value} accent="cyan" />
      </div>
    </DemoSection>
  )
}

function V2CEWDemo() {
  const [value, setValue] = useState(0)

  return (
    <DemoSection
      title="CEW Spectrum Control"
      description="Intense glow + 15% overshoot. Drag to boundaries!"
    >
      <div className="max-w-md">
        <SliderV2
          id="v2-cew"
          config={{ min: -100, max: 100, unit: '%' }}
          initialValue={0}
          onChange={setValue}
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
        <ValueDisplay label="Offset" value={value} unit="%" accent="cyan" />
      </div>
    </DemoSection>
  )
}

function V2DecibelDemo() {
  const [value, setValue] = useState(-12)

  return (
    <DemoSection
      title="Decibel Curve"
      description="Audio-style slider with decibel transformation"
    >
      <div className="max-w-md">
        <SliderV2
          id="v2-db"
          config={{ min: -48, max: 6, unit: 'dB' }}
          initialValue={-12}
          onChange={setValue}
          glow={{ color: 'amber', intensity: 'normal' }}
          curve={{ type: 'decibel' }}
        />
        <ValueDisplay label="Level" value={value} unit="dB" accent="amber" />
      </div>
    </DemoSection>
  )
}

function V2SnapDemo() {
  const [value, setValue] = useState(50)

  return (
    <DemoSection
      title="Snap Grid"
      description="Visible snap points with magnetism"
    >
      <div className="max-w-md">
        <SliderV2
          id="v2-snap"
          config={{ min: 0, max: 100 }}
          onChange={setValue}
          glow={{ color: 'green', intensity: 'subtle', emanateOnSnap: true }}
          snap={{
            steps: [0, 0.25, 0.5, 0.75, 1.0],
            magnetism: 0.3,
            showGrid: true,
          }}
        />
        <ValueDisplay label="Value" value={value} accent="green" />
      </div>
    </DemoSection>
  )
}

function V2DynamicDemo() {
  const [glowColor, setGlowColor] = useState<GlowSlot['color']>('cyan')
  const [glowIntensity, setGlowIntensity] = useState<GlowSlot['intensity']>('normal')
  const [overshootExtent, setOvershootExtent] = useState(0.15)

  return (
    <DemoSection
      title="Dynamic Trait Control"
      description="Adjust traits in real-time"
    >
      <div className="max-w-md space-y-4">
        <ControlGroup label="Glow Color">
          <select
            value={glowColor}
            onChange={(e) => setGlowColor(e.target.value as GlowSlot['color'])}
            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm w-full"
          >
            <option value="cyan">Cyan</option>
            <option value="amber">Amber</option>
            <option value="green">Green</option>
            <option value="red">Red</option>
            <option value="violet">Violet</option>
          </select>
        </ControlGroup>

        <ControlGroup label="Intensity">
          <select
            value={glowIntensity}
            onChange={(e) => setGlowIntensity(e.target.value as GlowSlot['intensity'])}
            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm w-full"
          >
            <option value="subtle">Subtle</option>
            <option value="normal">Normal</option>
            <option value="intense">Intense</option>
          </select>
        </ControlGroup>

        <ControlGroup label="Overshoot">
          <div className="flex items-center gap-2">
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
        </ControlGroup>

        <div className="pt-2">
          <SliderV2
            id="v2-dynamic"
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
  )
}

function V2MultiDemo() {
  return (
    <DemoSection
      title="Multi-Slider Array"
      description="Multiple sliders with different colors"
    >
      <div className="max-w-md space-y-3">
        {(['cyan', 'amber', 'green', 'red', 'violet'] as const).map((color, i) => (
          <div key={color} className="flex items-center gap-3">
            <span className="text-xs text-neutral-500 w-6 font-mono">#{i + 1}</span>
            <div className="flex-1">
              <SliderV2
                id={`v2-multi-${i}`}
                config={{ min: 0, max: 100 }}
                initialValue={20 + i * 15}
                glow={{ color, intensity: 'subtle' }}
              />
            </div>
          </div>
        ))}
      </div>
    </DemoSection>
  )
}

// =============================================================================
// MAIN TESTBED
// =============================================================================

export function SliderTestbed() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      <div className="max-w-5xl mx-auto">
        <TestbedHeader
          title="Slider System Testbed"
          subtitle="V1 (DAW-grade) and V2 (CEW-grade) slider implementations"
        />

        <div className="space-y-4">
          {/* V2 Section - CEW-grade (NEW) */}
          <CollapsiblePanel
            title="Slider V2 — CEW-Grade"
            subtitle="Trait-based composition, 15% overshoot, 65ms tactical settle, Effect-ified"
            defaultOpen={true}
            badge={<VersionBadge version="v2" status="new" />}
          >
            <div className="grid md:grid-cols-2 gap-4">
              <V2BasicDemo />
              <V2CEWDemo />
              <V2DecibelDemo />
              <V2SnapDemo />
              <V2DynamicDemo />
              <V2MultiDemo />
            </div>

            <div className="mt-4 p-3 bg-neutral-800/30 rounded border border-neutral-700/50">
              <div className="text-xs text-neutral-400">
                <strong className="text-cyan-400">V2 Architecture:</strong>{' '}
                5 atomic traits (Glow, Snap, Curve, Overshoot, Precision) •
                Effect programs with fiber cancellation •
                Direct anime.js v4 •
                Nested TraitProvider pattern
              </div>
            </div>
          </CollapsiblePanel>

          {/* V1 Section - DAW-grade (Legacy) */}
          <CollapsiblePanel
            title="Slider V1 — DAW-Grade"
            subtitle="Effect.Service behaviors, runtime-swappable curves, debug overlays"
            defaultOpen={false}
            badge={<VersionBadge version="v1" status="legacy" />}
          >
            {/* Behavior Variants */}
            <div className="mb-6">
              <h4 className="text-sm font-mono text-neutral-300 mb-3">Behavior Variants</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <BehaviorCard
                  name="Linear"
                  behavior={LinearBehavior.shape}
                  config={{ min: 0, max: 100, defaultValue: 50 }}
                  description="Uniform distribution across range"
                />
                <BehaviorCard
                  name="Logarithmic (base 10)"
                  behavior={LogarithmicBehavior.shape()}
                  config={{ min: 20, max: 20000, defaultValue: 1000, unit: 'Hz' }}
                  description="More resolution at lower values"
                />
                <BehaviorCard
                  name="Decibel"
                  behavior={DecibelBehavior.shape}
                  config={{ min: -48, max: 12, defaultValue: 0, step: 0.5 }}
                  description="Audio gain with 0dB reference"
                />
                <BehaviorCard
                  name="Exponential (^2)"
                  behavior={ExponentialBehavior.shape()}
                  config={{ min: 0, max: 5000, defaultValue: 100, unit: 'ms' }}
                  description="Time constants"
                />
              </div>
            </div>

            {/* Other V1 Demos */}
            <div className="grid md:grid-cols-2 gap-4">
              <V1ModifierDemo />
              <V1MixerDemo />
            </div>

            <div className="mt-4">
              <V1StandaloneDebugDemo />
            </div>

            <div className="mt-4 p-3 bg-neutral-800/30 rounded border border-neutral-700/50">
              <div className="text-xs text-neutral-400">
                <strong className="text-teal-400">V1 Architecture:</strong>{' '}
                Effect.Service for behaviors •
                effect-atom reducer pattern •
                withSliderDebug() HOC •
                Keyboard/wheel/double-click support
              </div>
            </div>
          </CollapsiblePanel>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-neutral-600 py-8 mt-8 border-t border-neutral-800">
          TMNL Slider System — V1 (DAW-grade) + V2 (CEW-grade)
        </div>
      </div>
    </div>
  )
}

export default SliderTestbed
