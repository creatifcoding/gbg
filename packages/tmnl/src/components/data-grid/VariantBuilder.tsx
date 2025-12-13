/**
 * VariantBuilder
 *
 * Drawer-ready panel for editing GridVariant configurations.
 * Extracted from DataGridVariantTestbed for use in per-DataGrid settings drawers.
 *
 * @module
 */

import { useState } from 'react'
import {
  Settings2,
  Palette,
  MousePointer2,
  Type,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

import {
  BEHAVIOR_PRESETS,
  type GridVariantType,
  type SelectionModeType,
  type HoverModeType,
  type FocusModeType,
  type EditTriggerType,
  type KeyboardNavModeType,
} from '@/lib/data-grid'

// =============================================================================
// TYPES
// =============================================================================

type GridVariant = GridVariantType

export interface VariantBuilderProps {
  variant: GridVariant
  onChange: (updates: Partial<GridVariant>) => void
}

// =============================================================================
// PRIMITIVE INPUTS
// =============================================================================

interface CollapsibleSectionProps {
  title: string
  icon: React.ReactNode
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}

function CollapsibleSection({ title, icon, isOpen, onToggle, children }: CollapsibleSectionProps) {
  return (
    <div className="border border-neutral-800">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">{icon}</span>
          <span
            className="font-mono uppercase tracking-wide text-neutral-300"
            style={{ fontSize: 10 }}
          >
            {title}
          </span>
        </div>
        {isOpen ? (
          <ChevronDown size={12} className="text-neutral-500" />
        ) : (
          <ChevronRight size={12} className="text-neutral-500" />
        )}
      </button>
      {isOpen && (
        <div className="border-t border-neutral-800 p-3 space-y-3">
          {children}
        </div>
      )}
    </div>
  )
}

interface ColorInputProps {
  label: string
  value: string
  onChange: (value: string) => void
}

function ColorInput({ label, value, onChange }: ColorInputProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-neutral-500" style={{ fontSize: 9 }}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <div
          className="w-4 h-4 border border-neutral-700"
          style={{ backgroundColor: value }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 bg-neutral-900 border border-neutral-800 text-neutral-300 px-2 py-1 font-mono"
          style={{ fontSize: 9 }}
        />
      </div>
    </div>
  )
}

interface SelectInputProps<T extends string> {
  label: string
  value: T
  options: readonly T[]
  onChange: (value: T) => void
}

function SelectInput<T extends string>({ label, value, options, onChange }: SelectInputProps<T>) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-neutral-500" style={{ fontSize: 9 }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="bg-neutral-900 border border-neutral-800 text-neutral-300 px-2 py-1 font-mono"
        style={{ fontSize: 9 }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  )
}

interface ToggleInputProps {
  label: string
  value: boolean
  onChange: (value: boolean) => void
}

function ToggleInput({ label, value, onChange }: ToggleInputProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-neutral-500" style={{ fontSize: 9 }}>
        {label}
      </span>
      <button
        onClick={() => onChange(!value)}
        className={`
          w-8 h-4 rounded-full transition-colors relative
          ${value ? 'bg-cyan-500/50' : 'bg-neutral-700'}
        `}
      >
        <div
          className={`
            absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform
            ${value ? 'translate-x-4' : 'translate-x-0.5'}
          `}
        />
      </button>
    </div>
  )
}

interface NumberInputProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
}

function NumberInput({ label, value, onChange, min, max, step = 1, unit }: NumberInputProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-neutral-500" style={{ fontSize: 9 }}>
        {label}
      </span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="w-14 bg-neutral-900 border border-neutral-800 text-neutral-300 px-2 py-1 font-mono text-right"
          style={{ fontSize: 9 }}
        />
        {unit && (
          <span className="font-mono text-neutral-600" style={{ fontSize: 8 }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// VARIANT BUILDER
// =============================================================================

export function VariantBuilder({ variant, onChange }: VariantBuilderProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    colors: true,
    behavior: false,
    typography: false,
  })

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Helper to update nested color
  const updateColor = (category: 'background' | 'text' | 'signal' | 'border', key: string, value: string) => {
    onChange({
      colors: {
        ...variant.colors,
        [category]: {
          ...variant.colors[category],
          [key]: value,
        },
      },
    })
  }

  // Helper to update behavior
  const updateBehavior = <K extends keyof typeof variant.behavior>(
    key: K,
    value: typeof variant.behavior[K]
  ) => {
    onChange({
      behavior: {
        ...variant.behavior,
        [key]: value,
      },
    })
  }

  // Helper to update micro interactions
  const updateMicroInteraction = <K extends keyof typeof variant.behavior.microInteractions>(
    key: K,
    value: typeof variant.behavior.microInteractions[K]
  ) => {
    onChange({
      behavior: {
        ...variant.behavior,
        microInteractions: {
          ...variant.behavior.microInteractions,
          [key]: value,
        },
      },
    })
  }

  return (
    <div className="space-y-2">
      <div
        className="font-mono uppercase tracking-widest text-neutral-500 mb-2 flex items-center gap-2"
        style={{ fontSize: 10 }}
      >
        <Settings2 size={12} />
        Variant Builder
      </div>

      {/* Colors Section */}
      <CollapsibleSection
        title="Colors"
        icon={<Palette size={12} />}
        isOpen={openSections.colors}
        onToggle={() => toggleSection('colors')}
      >
        <div className="space-y-2">
          <div className="font-mono text-neutral-600 uppercase" style={{ fontSize: 8 }}>
            Background
          </div>
          <ColorInput
            label="BASE"
            value={variant.colors.background.base}
            onChange={(v) => updateColor('background', 'base', v)}
          />
          <ColorInput
            label="HEADER"
            value={variant.colors.background.header}
            onChange={(v) => updateColor('background', 'header', v)}
          />
          <ColorInput
            label="HOVER"
            value={variant.colors.background.hover}
            onChange={(v) => updateColor('background', 'hover', v)}
          />
          <ColorInput
            label="SELECTED"
            value={variant.colors.background.selected}
            onChange={(v) => updateColor('background', 'selected', v)}
          />

          <div className="border-t border-neutral-800 my-2" />

          <div className="font-mono text-neutral-600 uppercase" style={{ fontSize: 8 }}>
            Text
          </div>
          <ColorInput
            label="PRIMARY"
            value={variant.colors.text.primary}
            onChange={(v) => updateColor('text', 'primary', v)}
          />
          <ColorInput
            label="SECONDARY"
            value={variant.colors.text.secondary}
            onChange={(v) => updateColor('text', 'secondary', v)}
          />
          <ColorInput
            label="MUTED"
            value={variant.colors.text.muted}
            onChange={(v) => updateColor('text', 'muted', v)}
          />

          <div className="border-t border-neutral-800 my-2" />

          <div className="font-mono text-neutral-600 uppercase" style={{ fontSize: 8 }}>
            Signals
          </div>
          <ColorInput
            label="POSITIVE"
            value={variant.colors.signal.positive}
            onChange={(v) => updateColor('signal', 'positive', v)}
          />
          <ColorInput
            label="NEGATIVE"
            value={variant.colors.signal.negative}
            onChange={(v) => updateColor('signal', 'negative', v)}
          />
          <ColorInput
            label="ACCENT"
            value={variant.colors.signal.accent}
            onChange={(v) => updateColor('signal', 'accent', v)}
          />
        </div>
      </CollapsibleSection>

      {/* Behavior Section */}
      <CollapsibleSection
        title="Behavior"
        icon={<MousePointer2 size={12} />}
        isOpen={openSections.behavior}
        onToggle={() => toggleSection('behavior')}
      >
        <div className="space-y-2">
          <SelectInput
            label="SELECTION"
            value={variant.behavior.selection}
            options={['single', 'multiple', 'none'] as const}
            onChange={(v) => updateBehavior('selection', v as SelectionModeType)}
          />
          <SelectInput
            label="HOVER"
            value={variant.behavior.hover}
            options={['row', 'cell', 'none'] as const}
            onChange={(v) => updateBehavior('hover', v as HoverModeType)}
          />
          <SelectInput
            label="FOCUS"
            value={variant.behavior.focus}
            options={['cell', 'row', 'none'] as const}
            onChange={(v) => updateBehavior('focus', v as FocusModeType)}
          />
          <SelectInput
            label="EDIT TRIGGER"
            value={variant.behavior.editTrigger}
            options={['click', 'doubleClick', 'enter', 'none'] as const}
            onChange={(v) => updateBehavior('editTrigger', v as EditTriggerType)}
          />
          <SelectInput
            label="KEYBOARD NAV"
            value={variant.behavior.keyboardNav}
            options={['standard', 'vim', 'none'] as const}
            onChange={(v) => updateBehavior('keyboardNav', v as KeyboardNavModeType)}
          />

          <div className="border-t border-neutral-800 my-2" />

          <div className="font-mono text-neutral-600 uppercase" style={{ fontSize: 8 }}>
            Micro Interactions
          </div>
          <ToggleInput
            label="ANIMATE ROWS"
            value={variant.behavior.microInteractions.animateRows}
            onChange={(v) => updateMicroInteraction('animateRows', v)}
          />
          <ToggleInput
            label="CELL FLASH"
            value={variant.behavior.microInteractions.enableCellFlash}
            onChange={(v) => updateMicroInteraction('enableCellFlash', v)}
          />
          <SelectInput
            label="HOVER ROW"
            value={variant.behavior.microInteractions.hoverRow}
            options={['none', 'subtleFill', 'underline', 'glow'] as const}
            onChange={(v) => updateMicroInteraction('hoverRow', v)}
          />
          <SelectInput
            label="FOCUS OUTLINE"
            value={variant.behavior.microInteractions.focusOutline}
            options={['none', 'subtle', 'strong', 'accent'] as const}
            onChange={(v) => updateMicroInteraction('focusOutline', v)}
          />
        </div>
      </CollapsibleSection>

      {/* Typography Section */}
      <CollapsibleSection
        title="Typography"
        icon={<Type size={12} />}
        isOpen={openSections.typography}
        onToggle={() => toggleSection('typography')}
      >
        <div className="space-y-2">
          <NumberInput
            label="ROW HEIGHT"
            value={variant.density.rowHeight}
            onChange={(v) =>
              onChange({
                density: { ...variant.density, rowHeight: v },
              })
            }
            min={12}
            max={64}
            unit="px"
          />
          <NumberInput
            label="HEADER HEIGHT"
            value={variant.density.headerHeight}
            onChange={(v) =>
              onChange({
                density: { ...variant.density, headerHeight: v },
              })
            }
            min={16}
            max={72}
            unit="px"
          />
          <NumberInput
            label="FONT SIZE"
            value={variant.density.fontSize}
            onChange={(v) =>
              onChange({
                density: { ...variant.density, fontSize: v },
              })
            }
            min={8}
            max={24}
            unit="px"
          />
          <NumberInput
            label="FONT SIZE XS"
            value={variant.density.fontSizeXs}
            onChange={(v) =>
              onChange({
                density: { ...variant.density, fontSizeXs: v },
              })
            }
            min={8}
            max={20}
            unit="px"
          />
          <NumberInput
            label="CELL PADDING H"
            value={variant.density.cellPaddingH}
            onChange={(v) =>
              onChange({
                density: { ...variant.density, cellPaddingH: v },
              })
            }
            min={0}
            max={24}
            unit="px"
          />
          <NumberInput
            label="CELL PADDING V"
            value={variant.density.cellPaddingV}
            onChange={(v) =>
              onChange({
                density: { ...variant.density, cellPaddingV: v },
              })
            }
            min={0}
            max={24}
            unit="px"
          />
        </div>
      </CollapsibleSection>

      {/* Preset Buttons */}
      <div className="space-y-2 pt-2">
        <div className="font-mono text-neutral-600 uppercase" style={{ fontSize: 8 }}>
          Behavior Presets
        </div>
        <div className="grid grid-cols-2 gap-1">
          {Object.keys(BEHAVIOR_PRESETS).map((presetKey) => (
            <button
              key={presetKey}
              onClick={() =>
                onChange({
                  behavior: BEHAVIOR_PRESETS[presetKey as keyof typeof BEHAVIOR_PRESETS],
                })
              }
              className="px-2 py-1 border border-neutral-800 hover:border-neutral-700 text-neutral-500 hover:text-white transition-colors"
            >
              <span className="font-mono uppercase" style={{ fontSize: 8 }}>
                {presetKey}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default VariantBuilder
