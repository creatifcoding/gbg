// ===========================================
// TMNL ENTITY SYSTEM
// Interface contracts for entity interactions
// ===========================================

import type { TLShapeId } from "tldraw"

// --- Parameter Control Types ---
export type ControlType = "slider" | "fader" | "knob"
export type ParameterType = "number" | "string" | "boolean" | "color" | "select" | "range"

export interface ParameterConfig {
  type: ParameterType
  label: string
  defaultValue: any
  value?: any
  min?: number
  max?: number
  step?: number
  options?: { label: string; value: any }[]
  description?: string
  hidden?: boolean
  control?: ControlType
}

export interface ParameterSchema {
  [key: string]: ParameterConfig
}

// --- Entity Metadata Contracts ---
export interface EntityMetadata {
  name: string
  type: string
  parameters: ParameterSchema
}

// --- Visitor Pattern Interfaces ---
export interface IControllable {
  entityId: string
  metadata: EntityMetadata
  parameters: Record<string, any>
  acceptVisitor(visitorId: string): boolean
  applyParameters(params: Record<string, any>): void
}

export interface IController {
  controllerId: string
  visitorId: string
  targetId: TLShapeId | null
  targetMetadata: EntityMetadata | null
  canControl(entity: IControllable): boolean
  bind(entity: IControllable): void
  unbind(): void
  setParameter(key: string, value: any): void
}

// --- Entity Registry ---
export interface EntityRegistry {
  controllables: Map<TLShapeId, IControllable>
  controllers: Map<TLShapeId, IController>
  bindings: Map<TLShapeId, TLShapeId>
}

// --- Shape Props Types (for tldraw) ---
export interface ChartWidgetProps {
  w: number
  h: number
  entityId: string
  metadata: EntityMetadata
  parameters: Record<string, any>
  chartData: number[]
}

export interface ControllerWidgetProps {
  w: number
  h: number
  controllerId: string
  visitorId: string
  targetId: string | null
  targetMetadata: EntityMetadata | null
  isExpanded: boolean
}

export interface NotesWidgetProps {
  w: number
  h: number
  title: string
  content: string
}

export interface TerminalWidgetProps {
  w: number
  h: number
  history: string[]
}

// --- Predefined Metadata Templates ---
export const ChartMetadataTemplate: EntityMetadata = {
  name: "PULSE_MONITOR",
  type: "chart",
  parameters: {
    lineColor: { type: "color", label: "Line", defaultValue: "#ffffff" },
    glowColor: { type: "color", label: "Glow", defaultValue: "#ffffff", hidden: true },
    syncGlow: { type: "boolean", label: "Sync", defaultValue: true },
    lineWidth: { type: "range", label: "Width", defaultValue: 2, min: 1, max: 10, step: 0.5, control: "knob" },
    amplitude: { type: "range", label: "Amp", defaultValue: 50, min: 10, max: 100, step: 1, control: "fader" },
    frequency: { type: "range", label: "Freq", defaultValue: 1, min: 0.1, max: 5, step: 0.1, control: "knob" },
    barSpacing: { type: "range", label: "Space", defaultValue: 1, min: 0.5, max: 5, step: 0.1, control: "slider" },
    showPoints: { type: "boolean", label: "Points", defaultValue: false },
    smoothing: { type: "range", label: "Smooth", defaultValue: 0, min: 0, max: 1, step: 0.1, control: "slider" },
  },
}

export const SignalMetadataTemplate: EntityMetadata = {
  name: "SIGNAL_ANALYZER",
  type: "signal",
  parameters: {
    waveform: {
      type: "select",
      label: "Wave",
      defaultValue: "sine",
      options: [
        { label: "Sine", value: "sine" },
        { label: "Square", value: "square" },
        { label: "Saw", value: "saw" },
        { label: "Noise", value: "noise" },
      ],
    },
    frequency: { type: "range", label: "Freq", defaultValue: 440, min: 20, max: 2000, step: 1, control: "knob" },
    amplitude: { type: "range", label: "Amp", defaultValue: 0.8, min: 0, max: 1, step: 0.01, control: "fader" },
    phase: { type: "range", label: "Phase", defaultValue: 0, min: 0, max: 360, step: 1, control: "knob" },
    color: { type: "color", label: "Color", defaultValue: "#00ff88" },
  },
}

// --- Global Settings ---
export interface GlobalSettings {
  logDuration: number
  gridSnap: boolean
  showMinimap: boolean
}

// --- Utility Functions ---
// Moved here to avoid circular dependencies

export function normalizeParameters(metadata: EntityMetadata): Record<string, any> {
  const params: Record<string, any> = {}
  Object.entries(metadata.parameters).forEach(([key, config]) => {
    params[key] = config.value ?? config.defaultValue
  })
  return params
}

export function cloneMetadataWithValues(metadata: EntityMetadata, parameters: Record<string, any>): EntityMetadata {
  const cloned = JSON.parse(JSON.stringify(metadata))
  Object.keys(cloned.parameters).forEach((key) => {
    if (parameters[key] !== undefined) {
      cloned.parameters[key].value = parameters[key]
    }
  })
  return cloned
}
