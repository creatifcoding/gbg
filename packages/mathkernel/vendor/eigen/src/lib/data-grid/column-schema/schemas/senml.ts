/**
 * SenML Column Schema
 *
 * RFC 8428 SenML (Sensor Measurement Lists) payload schema.
 * Generates semantic column groups for IoT sensor data.
 *
 * @module
 */

import type { ColDef, ICellRendererParams, ValueGetterParams } from 'ag-grid-community'
import type { GridVariantType } from '../../schemas'
import type { PayloadSummary } from '../types'
import { BaseColumnSchema } from '../base'

// =============================================================================
// PAYLOAD TYPES
// =============================================================================

/**
 * SenML record (RFC 8428)
 */
export interface SenMLRecord {
  /** Base Name - device/sensor prefix */
  bn?: string
  /** Base Time - epoch seconds */
  bt?: number
  /** Base Unit */
  bu?: string
  /** Name - sensor identifier */
  n?: string
  /** Unit */
  u?: string
  /** Value (numeric) */
  v?: number
  /** String Value */
  vs?: string
  /** Boolean Value */
  vb?: boolean
  /** Data Value (base64) */
  vd?: string
  /** Sum */
  s?: number
  /** Time offset from bt */
  t?: number
}

export type SenMLPayload = SenMLRecord[]

// =============================================================================
// SEMANTIC MAPPINGS
// =============================================================================

/**
 * Known sensor types with semantic styling
 */
const SENSOR_SEMANTICS: Record<string, { label: string; color: string }> = {
  temperature: { label: 'Temp', color: '#ef4444' },
  humidity: { label: 'Humidity', color: '#3b82f6' },
  pressure: { label: 'Pressure', color: '#8b5cf6' },
  voltage: { label: 'Voltage', color: '#f59e0b' },
  current: { label: 'Current', color: '#f59e0b' },
  power: { label: 'Power', color: '#ef4444' },
  luminosity: { label: 'Light', color: '#fbbf24' },
  co2: { label: 'CO₂', color: '#6b7280' },
  sound: { label: 'Sound', color: '#a855f7' },
  battery: { label: 'Battery', color: '#22c55e' },
  rssi: { label: 'RSSI', color: '#06b6d4' },
}

/** Primary sensors to show as column groups */
const PRIMARY_SENSORS = ['temperature', 'humidity', 'pressure', 'voltage']

// =============================================================================
// SCHEMA IMPLEMENTATION
// =============================================================================

/**
 * SenML Column Schema
 *
 * Detects SenML payloads (arrays with n/bn fields) and generates
 * semantic column groups for primary sensors.
 */
export class SenMLColumnSchema<TData extends { payload?: unknown } = { payload?: unknown }>
  extends BaseColumnSchema<TData, SenMLPayload>
{
  constructor() {
    super({
      id: 'senml',
      name: 'SenML',
      description: 'RFC 8428 Sensor Measurement Lists - IoT sensor data format',
      color: '#22c55e',
      icon: '📡',
    })
  }

  /**
   * Detect SenML payload: array with records containing n or bn fields
   */
  detect(payload: unknown): payload is SenMLPayload {
    if (!Array.isArray(payload) || payload.length === 0) return false
    const first = payload[0]
    if (typeof first !== 'object' || first === null) return false
    return 'n' in first || 'bn' in first
  }

  /**
   * Generate column groups for primary sensors
   */
  generateColumns(variant: GridVariantType): Array<ColDef<TData>> {
    return PRIMARY_SENSORS.map((sensorName) => {
      const semantic = SENSOR_SEMANTICS[sensorName] ?? {
        label: sensorName,
        color: variant.colors.text.secondary,
      }

      return this.toColDefGroup(
        {
          headerName: semantic.label,
          headerClass: 'ag-header-group-sensor',
          marryChildren: true,
          children: [
            {
              headerName: 'Value',
              width: 70,
              suppressSizeToFit: true,
              valueGetter: (params: ValueGetterParams<TData>) => {
                const payload = params.data?.payload as SenMLPayload | undefined
                if (!Array.isArray(payload)) return null
                const record = payload.find((r) => r.n === sensorName)
                return record?.v
              },
              cellStyle: {
                color: semantic.color,
                fontFamily: 'monospace',
                fontVariantNumeric: 'tabular-nums',
                fontSize: variant.density.fontSize,
              },
              valueFormatter: (params) =>
                params.value !== null && params.value !== undefined
                  ? (params.value as number).toFixed(1)
                  : '—',
            },
            {
              headerName: 'Unit',
              width: 50,
              suppressSizeToFit: true,
              valueGetter: (params: ValueGetterParams<TData>) => {
                const payload = params.data?.payload as SenMLPayload | undefined
                if (!Array.isArray(payload)) return null
                const record = payload.find((r) => r.n === sensorName)
                return record?.u
              },
              cellStyle: {
                color: variant.colors.text.muted,
                fontSize: variant.density.fontSizeXs,
              },
            },
          ],
        },
        variant
      )
    })
  }

  /**
   * Compact payload renderer showing first sensor + count
   */
  getPayloadRenderer(variant: GridVariantType): React.ComponentType<ICellRendererParams<TData>> {
    return function SenMLRenderer(params: ICellRendererParams<TData>) {
      const payload = params.data?.payload as SenMLPayload | undefined
      if (!payload || !Array.isArray(payload) || payload.length === 0) return null

      const first = payload[0]
      const name = first.n || '—'
      const value = first.v !== undefined ? first.v.toFixed(2) : '—'
      const unit = first.u || ''

      return (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: variant.colors.text.muted, fontSize: variant.density.fontSizeXs }}>
            {name}
          </span>
          <span
            style={{
              color: variant.colors.signal.accent,
              fontFamily: 'monospace',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value}
          </span>
          <span style={{ color: variant.colors.text.muted, fontSize: variant.density.fontSizeXs }}>
            {unit}
          </span>
          {payload.length > 1 && (
            <span
              style={{
                color: variant.colors.text.muted,
                fontSize: variant.density.fontSizeXs,
                opacity: 0.6,
              }}
            >
              +{payload.length - 1}
            </span>
          )}
        </div>
      )
    }
  }

  /**
   * Extract summary from SenML payload
   */
  getSummary(payload: SenMLPayload): PayloadSummary {
    const first = payload[0]
    return {
      label: first?.n || first?.bn || 'unknown',
      value: first?.v ?? first?.vs ?? '—',
      unit: first?.u,
      count: payload.length,
    }
  }
}

/** Default SenML schema instance */
export const senmlSchema = new SenMLColumnSchema()
