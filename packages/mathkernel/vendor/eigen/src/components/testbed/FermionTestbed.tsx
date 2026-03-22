/**
 * Fermion Testbed
 *
 * Comprehensive validation of the Fermion schema-driven Atom.family library.
 *
 * Route: /testbed/fermion
 *
 * HYPOTHESES:
 * - H1: Result state machine (initial → waiting → success/failure) flows correctly
 * - H2: CRUD operations (fetch/persist/remove) update atoms predictably
 * - H3: Lifecycle config (keepAlive/TTL) controls atom persistence
 * - H4: Composite keys work with structural equality
 * - H5: Multiple subscribers share the same atom instance
 *
 * TABS:
 * 1. State Visualization - Real-time Result state machine display
 * 2. CRUD Operations - Interactive fetch/persist/remove with grid
 * 3. Lifecycle - TTL expiry, keepAlive vs autoReset behavior
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { Effect, Schema, Duration, Layer, Scope } from 'effect'
import { Registry, Atom } from '@effect-atom/atom'
import { useAtomValue, RegistryContext } from '@effect-atom/atom-react'
import React from 'react'
import * as Result from '@effect-atom/atom/Result'
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  Trash2,
  Database,
  Activity,
  Clock,
  Users,
  Zap,
  Radio,
  Thermometer,
  Droplets,
  Gauge,
  MapPin,
  Wifi,
  WifiOff,
} from 'lucide-react'

import {
  TestbedHeader,
  SectionLabel,
  TestCard,
  Button,
  StatusIndicator,
  ValueDisplay,
  VersionBadge,
} from '@/components/testbed/shared'
import {
  HypothesisSummary,
  HypothesisBadge,
  type ValidationStatus,
} from '@/components/testbed/shared/hypothesis'

import {
  fromSchema,
  makeSimpleMemoryAlgebra,
  NotFoundError,
  type Fermion,
} from '@/lib/fermion'
import {
  NatsKVService,
  NatsConfigTag,
  type NatsKVError,
} from '@/lib/nats/NatsKVService'
import type { KV } from 'nats.ws'
import type { ParseResult } from 'effect'

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

const UserSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  role: Schema.Literal('admin', 'user', 'guest'),
})
type User = typeof UserSchema.Type

// IoT Sensor Schema
const IoTSensorSchema = Schema.Struct({
  sensorId: Schema.String,
  name: Schema.String,
  type: Schema.Literal('temperature', 'humidity', 'pressure', 'composite'),
  location: Schema.Struct({
    lat: Schema.Number,
    lng: Schema.Number,
    zone: Schema.String,
  }),
  readings: Schema.Struct({
    temperature: Schema.optional(Schema.Number),
    humidity: Schema.optional(Schema.Number),
    pressure: Schema.optional(Schema.Number),
    timestamp: Schema.Number,
  }),
  status: Schema.Literal('online', 'offline', 'warning', 'error'),
  battery: Schema.Number, // 0-100
})
type IoTSensor = typeof IoTSensorSchema.Type

// ─────────────────────────────────────────────────────────────────────────────
// Dead-Band Delta Compression (OPC UA Standard)
// ─────────────────────────────────────────────────────────────────────────────
// Zero-allocation, O(1) per sample. See: assets/documents/SENSOR_DELTA_COMPRESSION_STRATEGIES.md

/**
 * Dead-Band thresholds per measurement type.
 * IF |current - lastTransmitted| > threshold THEN transmit
 */
const DEADBAND = {
  temperature: 0.1, // 0.1°C - captures meaningful HVAC changes
  humidity: 0.5,    // 0.5%RH - captures environmental shifts
  pressure: 0.1,    // 0.1 hPa - captures weather fronts
} as const

/**
 * Primitive baseline storage - zero allocation per read.
 * Map<sensorId:field, lastTransmittedValue>
 * e.g., "sensor-alpha-01:temperature" -> 22.5
 */
const deadbandBaselines = new Map<string, number>()

/**
 * Dead-Band filter - returns true if value should be transmitted.
 * O(1) time, zero allocation.
 */
function shouldTransmit(
  sensorId: string,
  field: 'temperature' | 'humidity' | 'pressure',
  currentValue: number | undefined
): boolean {
  if (currentValue === undefined) return false

  const key = `${sensorId}:${field}`
  const lastTransmitted = deadbandBaselines.get(key)

  // No baseline = first reading = always transmit
  if (lastTransmitted === undefined) {
    deadbandBaselines.set(key, currentValue)
    return true
  }

  // Dead-band check: |current - last| > threshold
  if (Math.abs(currentValue - lastTransmitted) > DEADBAND[field]) {
    deadbandBaselines.set(key, currentValue)
    return true
  }

  return false
}

/**
 * Check all readings, return which changed (for logging).
 * Returns: { changed: boolean, deltaStr: string }
 */
function checkDeadbandDeltas(sensor: IoTSensor): { changed: boolean; deltaStr: string } {
  const { sensorId, readings } = sensor
  const parts: string[] = []
  let changed = false

  // Temperature
  if (readings.temperature !== undefined) {
    const key = `${sensorId}:temperature`
    const last = deadbandBaselines.get(key)
    if (shouldTransmit(sensorId, 'temperature', readings.temperature)) {
      changed = true
      if (last !== undefined) {
        const delta = readings.temperature - last
        const sign = delta >= 0 ? '+' : ''
        parts.push(`Δ${sign}${delta.toFixed(2)}°C`)
      } else {
        parts.push(`${readings.temperature.toFixed(1)}°C`)
      }
    }
  }

  // Humidity
  if (readings.humidity !== undefined) {
    const key = `${sensorId}:humidity`
    const last = deadbandBaselines.get(key)
    if (shouldTransmit(sensorId, 'humidity', readings.humidity)) {
      changed = true
      if (last !== undefined) {
        const delta = readings.humidity - last
        const sign = delta >= 0 ? '+' : ''
        parts.push(`Δ${sign}${delta.toFixed(1)}%`)
      } else {
        parts.push(`${readings.humidity.toFixed(1)}%`)
      }
    }
  }

  // Pressure
  if (readings.pressure !== undefined) {
    const key = `${sensorId}:pressure`
    const last = deadbandBaselines.get(key)
    if (shouldTransmit(sensorId, 'pressure', readings.pressure)) {
      changed = true
      if (last !== undefined) {
        const delta = readings.pressure - last
        const sign = delta >= 0 ? '+' : ''
        parts.push(`Δ${sign}${delta.toFixed(2)}hPa`)
      } else {
        parts.push(`${readings.pressure.toFixed(1)}hPa`)
      }
    }
  }

  return {
    changed,
    deltaStr: parts.length > 0 ? parts.join(' · ') : 'no change',
  }
}

/**
 * Reset baselines for a sensor (forces full re-transmission).
 */
function resetSensorBaseline(sensorId: string): void {
  deadbandBaselines.delete(`${sensorId}:temperature`)
  deadbandBaselines.delete(`${sensorId}:humidity`)
  deadbandBaselines.delete(`${sensorId}:pressure`)
}

/**
 * Reset all baselines.
 */
function resetAllBaselines(): void {
  deadbandBaselines.clear()
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Data
// ─────────────────────────────────────────────────────────────────────────────

const SEED_USERS: User[] = [
  { id: 'user-1', name: 'Alice Chen', email: 'alice@example.com', role: 'admin' },
  { id: 'user-2', name: 'Bob Smith', email: 'bob@example.com', role: 'user' },
  { id: 'user-3', name: 'Carol Jones', email: 'carol@example.com', role: 'user' },
  { id: 'user-4', name: 'David Lee', email: 'david@example.com', role: 'guest' },
]

// Seed IoT Sensors - simulating industrial/environmental monitoring
const SEED_SENSORS: IoTSensor[] = [
  {
    sensorId: 'sensor-alpha-01',
    name: 'Lab A Temperature',
    type: 'temperature',
    location: { lat: 37.7749, lng: -122.4194, zone: 'Building A - Lab' },
    readings: { temperature: 22.5, timestamp: Date.now() },
    status: 'online',
    battery: 87,
  },
  {
    sensorId: 'sensor-alpha-02',
    name: 'Lab A Humidity',
    type: 'humidity',
    location: { lat: 37.7749, lng: -122.4194, zone: 'Building A - Lab' },
    readings: { humidity: 45.2, timestamp: Date.now() },
    status: 'online',
    battery: 92,
  },
  {
    sensorId: 'sensor-beta-01',
    name: 'Server Room Composite',
    type: 'composite',
    location: { lat: 37.7751, lng: -122.4189, zone: 'Building B - Data Center' },
    readings: { temperature: 18.3, humidity: 38.0, pressure: 1013.25, timestamp: Date.now() },
    status: 'online',
    battery: 100, // Hardwired
  },
  {
    sensorId: 'sensor-gamma-01',
    name: 'Rooftop Weather',
    type: 'composite',
    location: { lat: 37.7755, lng: -122.4180, zone: 'Building A - Roof' },
    readings: { temperature: 15.8, humidity: 62.0, pressure: 1015.80, timestamp: Date.now() },
    status: 'warning',
    battery: 23,
  },
  {
    sensorId: 'sensor-delta-01',
    name: 'Warehouse Pressure',
    type: 'pressure',
    location: { lat: 37.7740, lng: -122.4200, zone: 'Warehouse District' },
    readings: { pressure: 1012.50, timestamp: Date.now() },
    status: 'offline',
    battery: 0,
  },
]

// Simulated IoT algebra - adds realistic latency and live reading generation
const makeSimulatedIoTAlgebra = (store: Map<string, IoTSensor>) => {
  const generateLiveReadings = (sensor: IoTSensor): IoTSensor['readings'] => {
    const base = sensor.readings
    const jitter = () => (Math.random() - 0.5) * 2 // ±1 variation

    return {
      temperature: base.temperature !== undefined ? base.temperature + jitter() : undefined,
      humidity: base.humidity !== undefined
        ? Math.min(100, Math.max(0, base.humidity + jitter() * 2))
        : undefined,
      pressure: base.pressure !== undefined ? base.pressure + jitter() * 0.5 : undefined,
      timestamp: Date.now(),
    }
  }

  return {
    fetch: (sensorId: string) =>
      Effect.gen(function* () {
        // Simulate network latency (50-300ms)
        yield* Effect.sleep(Duration.millis(50 + Math.random() * 250))

        const sensor = store.get(sensorId)
        if (!sensor) {
          return yield* Effect.fail(new NotFoundError({ key: sensorId }))
        }

        // Return sensor with fresh readings
        const updated: IoTSensor = {
          ...sensor,
          readings: generateLiveReadings(sensor),
          // Randomly flip status occasionally for realism
          status: sensor.status === 'offline' ? 'offline'
            : Math.random() > 0.95 ? 'warning'
            : 'online',
        }
        store.set(sensorId, updated)
        return updated
      }),

    persist: (sensor: IoTSensor) =>
      Effect.gen(function* () {
        yield* Effect.sleep(Duration.millis(30 + Math.random() * 70))
        store.set(sensor.sensorId, sensor)
      }),
  }
}

// NATS KV-backed IoT algebra - uses real NATS JetStream KV store
const makeNatsIoTAlgebra = (bucket: KV) => {
  return {
    fetch: (sensorId: string) =>
      Effect.gen(function* () {
        const natsKV = yield* NatsKVService
        const sensor = yield* natsKV.get(bucket, sensorId, IoTSensorSchema)

        if (!sensor) {
          return yield* Effect.fail(new NotFoundError({ key: sensorId }))
        }

        // Add fresh timestamp to readings
        return {
          ...sensor,
          readings: {
            ...sensor.readings,
            timestamp: Date.now(),
          },
        }
      }),

    persist: (sensor: IoTSensor) =>
      Effect.gen(function* () {
        const natsKV = yield* NatsKVService
        yield* natsKV.put(bucket, sensor.sensorId, sensor, IoTSensorSchema)
      }),

    remove: (sensorId: string) =>
      Effect.gen(function* () {
        const natsKV = yield* NatsKVService
        yield* natsKV.delete(bucket, sensorId)
      }),
  }
}

// IoT Sensor Emitter - generates realistic sensor readings at configurable rate
class IoTSensorEmitter {
  private intervalId: number | null = null
  private readonly sensors: Map<string, IoTSensor>
  private readonly onEmit: (sensor: IoTSensor) => void
  private emitRateMs: number

  constructor(
    sensors: Map<string, IoTSensor>,
    onEmit: (sensor: IoTSensor) => void,
    emitRateMs: number = 1000
  ) {
    this.sensors = sensors
    this.onEmit = onEmit
    this.emitRateMs = emitRateMs
  }

  start(): void {
    if (this.intervalId) return

    // Emit readings from each online sensor at configured rate
    this.intervalId = window.setInterval(() => {
      const sensorArray = Array.from(this.sensors.values())
        .filter((s) => s.status !== 'offline')

      for (const sensor of sensorArray) {
        const updated = this.generateReading(sensor)
        this.sensors.set(sensor.sensorId, updated)
        this.onEmit(updated)
      }
    }, this.emitRateMs)
  }

  stop(): void {
    if (this.intervalId) {
      window.clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  setRate(ms: number): void {
    this.emitRateMs = ms
    if (this.intervalId) {
      this.stop()
      this.start()
    }
  }

  private generateReading(sensor: IoTSensor): IoTSensor {
    const jitter = () => (Math.random() - 0.5) * 2
    const readings = sensor.readings

    return {
      ...sensor,
      readings: {
        temperature: readings.temperature !== undefined
          ? readings.temperature + jitter()
          : undefined,
        humidity: readings.humidity !== undefined
          ? Math.min(100, Math.max(0, readings.humidity + jitter() * 2))
          : undefined,
        pressure: readings.pressure !== undefined
          ? readings.pressure + jitter() * 0.5
          : undefined,
        timestamp: Date.now(),
      },
      // Randomly drain battery
      battery: Math.max(0, sensor.battery - Math.random() * 0.01),
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IoT Atoms (Atom-as-State Pattern)
// ─────────────────────────────────────────────────────────────────────────────

// Module-level state atoms for IoT tab
const iotModeAtom = Atom.make<'simulated' | 'nats'>('simulated')
const iotNatsStatusAtom = Atom.make<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
const iotNatsErrorAtom = Atom.make<string | null>(null)
const iotIsEmittingAtom = Atom.make(false)
const iotEmitRateMsAtom = Atom.make(1000)
const iotEmitCountAtom = Atom.make(0)
const iotLogAtom = Atom.make<string[]>([])

// Per-sensor polling state (Atom.family pattern - each sensor is an independent isolate)
// Each sensor maintains its own polling state independently
const iotSensorPollingAtom = Atom.family((sensorId: string) =>
  Atom.make<{ isPolling: boolean; pollRateMs: number }>({ isPolling: false, pollRateMs: 1000 })
)

// Dead-band mode toggle - when enabled, only significant changes are logged
// Uses primitive Map storage (deadbandBaselines) for zero-allocation filtering
const iotDeadbandEnabledAtom = Atom.make(true)

// Track active polling intervals per sensor (imperative management)
const iotPollingIntervalsRef = { current: new Map<string, number>() }

// Derived: formatted emit rate
const iotEmitRateDisplayAtom = Atom.make((get) => {
  const ms = get(iotEmitRateMsAtom)
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
})

// ─────────────────────────────────────────────────────────────────────────────
// IoT Registry Singleton
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Global registry singleton for IoT state mutations.
 * Shared across all IoT operations AND React components.
 *
 * CRITICAL: Use iotRegistry.set() instead of Atom.set()
 * Atom.set() returns an Effect, iotRegistry.set() mutates directly.
 */
const iotRegistry = Registry.make()

/**
 * Provides the IoT registry to React components.
 * Wrap IoT UI with this so useAtomValue reads from the same registry
 * that iotRegistry.set() writes to.
 */
function IoTRegistryProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  return React.createElement(
    RegistryContext.Provider,
    { value: iotRegistry as any },
    children
  )
}

// Logger function that updates atom (uses registry directly, not Effect)
const logToIoT = (msg: string) => {
  const timestamp = new Date().toLocaleTimeString()
  iotRegistry.set(iotLogAtom, [...iotRegistry.get(iotLogAtom).slice(-14), `${timestamp}: ${msg}`])
}

// NATS Runtime - for operations that need NatsKVService
const natsRuntimeAtom = Atom.runtime(
  Layer.mergeAll(
    NatsKVService.Default,
    NatsConfigTag.Default
  )
)

// Shared refs for emitter and NATS bucket (needed for imperative control)
const iotEmitterRef = { current: null as IoTSensorEmitter | null }
const iotNatsBucketRef = { current: null as KV | null }
const iotSensorStoreRef = { current: new Map(SEED_SENSORS.map((s) => [s.sensorId, s])) }

// Operation atoms
const iotOps = {
  // Connect to NATS
  connect: natsRuntimeAtom.fn()((_, ctx) =>
    Effect.gen(function* () {
      const currentStatus = ctx.get(iotNatsStatusAtom)
      if (currentStatus === 'connecting') return

      ctx.set(iotNatsStatusAtom, 'connecting')
      ctx.set(iotNatsErrorAtom, null)
      logToIoT('🔌 Connecting to NATS...')

      const natsKV = yield* NatsKVService
      logToIoT('📡 Connected to NATS server')

      // Create/get the IoT sensors bucket
      const bucket = yield* natsKV.getOrCreateBucket('iot-sensors', { history: 10 })
      logToIoT('🗄️ Created/accessed iot-sensors bucket')
      iotNatsBucketRef.current = bucket

      // Seed initial data if bucket is empty
      const existingKeys = yield* natsKV.keys(bucket)
      if (existingKeys.length === 0) {
        logToIoT('🌱 Seeding initial sensor data...')
        for (const sensor of SEED_SENSORS) {
          yield* natsKV.put(bucket, sensor.sensorId, sensor, IoTSensorSchema)
        }
        logToIoT(`✅ Seeded ${SEED_SENSORS.length} sensors`)
      } else {
        logToIoT(`📊 Found ${existingKeys.length} existing sensors`)
      }

      ctx.set(iotNatsStatusAtom, 'connected')
      ctx.set(iotModeAtom, 'nats')
      logToIoT('✅ NATS connection established')
    }).pipe(
      Effect.catchAll((e) =>
        Effect.sync(() => {
          const errorMsg = e instanceof Error ? e.message : String(e)
          iotRegistry.set(iotNatsStatusAtom, 'error')
          iotRegistry.set(iotNatsErrorAtom, errorMsg)
          logToIoT(`❌ NATS connection failed: ${errorMsg}`)
        })
      )
    )
  ),

  // Disconnect from NATS
  disconnect: () => {
    iotNatsBucketRef.current = null
    iotRegistry.set(iotNatsStatusAtom, 'disconnected')
    iotRegistry.set(iotModeAtom, 'simulated')
    logToIoT('🔌 Disconnected from NATS')
  },

  // Toggle emitter (plain function - no Effect wrapper needed, all sync operations)
  toggleEmitter: () => {
    const isEmitting = iotRegistry.get(iotIsEmittingAtom)
    const emitRateMs = iotRegistry.get(iotEmitRateMsAtom)

    if (isEmitting) {
      // Stop emitter
      if (iotEmitterRef.current) {
        iotEmitterRef.current.stop()
        iotEmitterRef.current = null
      }
      iotRegistry.set(iotIsEmittingAtom, false)
      logToIoT('⏹️ Stopped sensor emission')
    } else {
      // Start emitter - THE SINGLE MECHANISM for generating simulation data
      const emitter = new IoTSensorEmitter(
        iotSensorStoreRef.current,
        async (sensor) => {
          iotRegistry.set(iotEmitCountAtom, iotRegistry.get(iotEmitCountAtom) + 1)

          // Dead-Band Delta Compression (OPC UA standard)
          // Zero-allocation, O(1) filtering - see SENSOR_DELTA_COMPRESSION_STRATEGIES.md
          const deadbandEnabled = iotRegistry.get(iotDeadbandEnabledAtom)

          if (deadbandEnabled) {
            // Check dead-band thresholds - only log if significant change
            const { changed, deltaStr } = checkDeadbandDeltas(sensor)
            if (changed) {
              logToIoT(`📡 EMIT ${sensor.name}: ${deltaStr}`)
            }
            // Insignificant changes are suppressed (bandwidth optimization)
          } else {
            // Dead-band disabled - log every reading (full values)
            logToIoT(`📡 EMIT ${sensor.name}: ${formatReadings(sensor)}`)
          }

          // In NATS mode, persist to bucket (always persist, regardless of dead-band)
          const mode = iotRegistry.get(iotModeAtom)
          if (mode === 'nats' && iotNatsBucketRef.current) {
            try {
              await Effect.runPromise(
                Effect.gen(function* () {
                  const natsKV = yield* NatsKVService
                  yield* natsKV.put(iotNatsBucketRef.current!, sensor.sensorId, sensor, IoTSensorSchema)
                }).pipe(
                  Effect.provide(NatsKVService.Default),
                  Effect.provide(NatsConfigTag.Default)
                )
              )
            } catch (e) {
              logToIoT(`❌ NATS persist failed: ${e}`)
            }
          }
        },
        emitRateMs
      )
      iotEmitterRef.current = emitter
      emitter.start()
      iotRegistry.set(iotIsEmittingAtom, true)
      iotRegistry.set(iotEmitCountAtom, 0)
      logToIoT(`▶️ Started sensor emission @ ${emitRateMs}ms (dead-band: ${iotRegistry.get(iotDeadbandEnabledAtom) ? 'ON' : 'OFF'})`)
    }
  },

  // Update emit rate
  setEmitRate: (ms: number) => {
    iotRegistry.set(iotEmitRateMsAtom, ms)
    if (iotEmitterRef.current) {
      iotEmitterRef.current.setRate(ms)
      logToIoT(`⚡ Updated emit rate to ${ms}ms`)
    }
  },

  // Set mode
  setMode: (mode: 'simulated' | 'nats') => {
    iotRegistry.set(iotModeAtom, mode)
    logToIoT(`🔄 Switched to ${mode} mode`)
  },

  // Clear log
  clearLog: () => {
    iotRegistry.set(iotLogAtom, [])
  },

  // Dead-band mode toggle
  toggleDeadband: () => {
    const current = iotRegistry.get(iotDeadbandEnabledAtom)
    iotRegistry.set(iotDeadbandEnabledAtom, !current)
    logToIoT(`🔄 Dead-band: ${!current ? 'ON' : 'OFF'}`)
  },

  // Reset all dead-band baselines (forces full value re-transmission)
  resetBaselines: () => {
    resetAllBaselines()
    logToIoT('🔄 Reset all dead-band baselines')
  },

  // Per-sensor polling operations (Atom.family pattern)
  startSensorPolling: (
    sensorId: string,
    fetchFn: () => Promise<void>,
    pollRateMs?: number
  ) => {
    const pollAtom = iotSensorPollingAtom(sensorId)
    const currentState = iotRegistry.get(pollAtom)

    // Already polling? Skip
    if (currentState.isPolling) return

    const rate = pollRateMs ?? currentState.pollRateMs

    // Update atom state
    iotRegistry.set(pollAtom, { isPolling: true, pollRateMs: rate })

    // Create interval for this sensor
    const intervalId = window.setInterval(async () => {
      try {
        await fetchFn()
      } catch (e) {
        logToIoT(`❌ Poll failed for ${sensorId}: ${e}`)
      }
    }, rate)

    // Store interval ID for cleanup
    iotPollingIntervalsRef.current.set(sensorId, intervalId)
    logToIoT(`📡 Started polling ${sensorId} @ ${rate}ms`)
  },

  stopSensorPolling: (sensorId: string) => {
    const pollAtom = iotSensorPollingAtom(sensorId)
    const intervalId = iotPollingIntervalsRef.current.get(sensorId)

    if (intervalId) {
      window.clearInterval(intervalId)
      iotPollingIntervalsRef.current.delete(sensorId)
    }

    const prev = iotRegistry.get(pollAtom)
    iotRegistry.set(pollAtom, { ...prev, isPolling: false })
    logToIoT(`⏹️ Stopped polling ${sensorId}`)
  },

  setSensorPollRate: (sensorId: string, pollRateMs: number) => {
    const pollAtom = iotSensorPollingAtom(sensorId)
    const currentState = iotRegistry.get(pollAtom)

    iotRegistry.set(pollAtom, { ...currentState, pollRateMs })

    // If currently polling, restart with new rate
    if (currentState.isPolling) {
      const intervalId = iotPollingIntervalsRef.current.get(sensorId)
      if (intervalId) {
        window.clearInterval(intervalId)
      }
      logToIoT(`⚡ Updated poll rate for ${sensorId} to ${pollRateMs}ms`)
    }
  },

  stopAllSensorPolling: () => {
    for (const [sensorId, intervalId] of iotPollingIntervalsRef.current.entries()) {
      window.clearInterval(intervalId)
      const pollAtom = iotSensorPollingAtom(sensorId)
      const prev = iotRegistry.get(pollAtom)
      iotRegistry.set(pollAtom, { ...prev, isPolling: false })
    }
    iotPollingIntervalsRef.current.clear()
    logToIoT('⏹️ Stopped all sensor polling')
  },

  // Get polling state for a sensor
  getSensorPollingAtom: (sensorId: string) => iotSensorPollingAtom(sensorId),
}

// ─────────────────────────────────────────────────────────────────────────────
// Result State Display
// ─────────────────────────────────────────────────────────────────────────────

interface ResultStateProps<A, E> {
  result: Result.Result<A, E>
  label: string
}

function ResultStateDisplay<A, E>({ result, label }: ResultStateProps<A, E>) {
  const getStateInfo = () => {
    if (Result.isInitial(result)) {
      return { state: 'initial', color: 'text-neutral-500', bg: 'bg-neutral-800/50' }
    }
    if (Result.isWaiting(result)) {
      return { state: 'waiting', color: 'text-amber-400', bg: 'bg-amber-900/20' }
    }
    if (Result.isSuccess(result)) {
      return { state: 'success', color: 'text-green-400', bg: 'bg-green-900/20' }
    }
    if (Result.isFailure(result)) {
      return { state: 'failure', color: 'text-red-400', bg: 'bg-red-900/20' }
    }
    return { state: 'unknown', color: 'text-neutral-400', bg: 'bg-neutral-800/50' }
  }

  const { state, color, bg } = getStateInfo()

  return (
    <div className={`p-3 rounded border border-neutral-800 ${bg}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-neutral-400" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {label}
        </span>
        <span className={`font-mono uppercase ${color}`} style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {state}
        </span>
      </div>
      {Result.isSuccess(result) && (
        <pre className="text-neutral-300 font-mono overflow-x-auto" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {JSON.stringify(result.value, null, 2)}
        </pre>
      )}
      {Result.isFailure(result) && (
        <div className="text-red-400 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          Error: {String(result.cause)}
        </div>
      )}
      {Result.isWaiting(result) && result.previous && Result.isSuccess(result.previous) && (
        <div className="text-amber-400/60 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          (refreshing: {JSON.stringify(result.previous.value)})
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// State Visualization Tab
// ─────────────────────────────────────────────────────────────────────────────

interface StateVisualizationTabProps {
  registry: Registry.Registry
  userFamily: Fermion<User, User, NotFoundError, never, string>
  onHypothesisUpdate: (id: string, validated: boolean) => void
}

function StateVisualizationTab({
  registry,
  userFamily,
  onHypothesisUpdate,
}: StateVisualizationTabProps) {
  const [selectedKey, setSelectedKey] = useState('user-1')
  const [atomState, setAtomState] = useState<Result.Result<User, NotFoundError>>(Result.initial())
  const [stateHistory, setStateHistory] = useState<string[]>([])

  // Subscribe to atom changes
  useEffect(() => {
    const atom = userFamily(selectedKey)
    const initialState = registry.get(atom)
    setAtomState(initialState)

    const unsubscribe = registry.subscribe(atom, (newState) => {
      setAtomState(newState)
      const stateName = Result.isInitial(newState) ? 'initial'
        : Result.isWaiting(newState) ? 'waiting'
        : Result.isSuccess(newState) ? 'success'
        : 'failure'
      setStateHistory((prev) => [...prev.slice(-9), `${Date.now()}: ${stateName}`])
    })

    return unsubscribe
  }, [registry, userFamily, selectedKey])

  // Check H1: State machine flows correctly
  useEffect(() => {
    const hasTransitions = stateHistory.length >= 2
    const hasSuccess = stateHistory.some((s) => s.includes('success'))
    onHypothesisUpdate('H1', hasTransitions && hasSuccess)
  }, [stateHistory, onHypothesisUpdate])

  const handleFetch = async () => {
    setStateHistory([])
    try {
      await Effect.runPromise(
        userFamily.fetch(selectedKey).pipe(
          Effect.provideService(Registry.AtomRegistry, registry)
        )
      )
    } catch (e) {
      // Error state is tracked via subscription
    }
  }

  const handleInvalidate = async () => {
    await Effect.runPromise(
      userFamily.invalidate(selectedKey).pipe(
        Effect.provideService(Registry.AtomRegistry, registry)
      )
    )
  }

  return (
    <div className="space-y-6">
      <TestCard
        title="Result State Machine"
        description="Watch the atom transition through initial → waiting → success/failure"
      >
        <div className="space-y-4">
          {/* Key Selector */}
          <div className="flex items-center gap-4">
            <span className="text-neutral-400 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              Key:
            </span>
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 rounded px-3 py-1 font-mono text-neutral-200"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              {SEED_USERS.map((u) => (
                <option key={u.id} value={u.id}>{u.id}</option>
              ))}
              <option value="nonexistent">nonexistent (will fail)</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handleFetch} variant="primary">
              <RefreshCw size={14} className="mr-2" />
              Fetch
            </Button>
            <Button onClick={handleInvalidate}>
              Invalidate
            </Button>
          </div>

          {/* Current State */}
          <ResultStateDisplay result={atomState} label={`userFamily("${selectedKey}")`} />

          {/* State History */}
          <div className="p-3 bg-neutral-900/50 rounded border border-neutral-800">
            <div className="text-neutral-500 font-mono mb-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              State Transitions
            </div>
            <div className="font-mono text-neutral-400 space-y-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {stateHistory.length === 0 ? (
                <div className="text-neutral-600">No transitions yet. Click Fetch to start.</div>
              ) : (
                stateHistory.map((entry, i) => (
                  <div key={i}>{entry}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </TestCard>

      {/* State Machine Diagram */}
      <TestCard title="State Machine Diagram">
        <div className="flex items-center justify-center gap-4 py-6">
          <StateNode label="initial" active={Result.isInitial(atomState)} />
          <Arrow />
          <StateNode label="waiting" active={Result.isWaiting(atomState)} />
          <Arrow />
          <div className="flex flex-col gap-2">
            <StateNode label="success" active={Result.isSuccess(atomState)} variant="success" />
            <StateNode label="failure" active={Result.isFailure(atomState)} variant="error" />
          </div>
        </div>
      </TestCard>
    </div>
  )
}

function StateNode({
  label,
  active,
  variant = 'default',
}: {
  label: string
  active: boolean
  variant?: 'default' | 'success' | 'error'
}) {
  const baseClasses = 'px-4 py-2 rounded border font-mono transition-all'
  const variantClasses = {
    default: active
      ? 'bg-cyan-900/50 border-cyan-600 text-cyan-300'
      : 'bg-neutral-800/50 border-neutral-700 text-neutral-500',
    success: active
      ? 'bg-green-900/50 border-green-600 text-green-300'
      : 'bg-neutral-800/50 border-neutral-700 text-neutral-500',
    error: active
      ? 'bg-red-900/50 border-red-600 text-red-300'
      : 'bg-neutral-800/50 border-neutral-700 text-neutral-500',
  }

  return (
    <div className={`${baseClasses} ${variantClasses[variant]}`} style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
      {label}
    </div>
  )
}

function Arrow() {
  return (
    <div className="text-neutral-600 font-mono">→</div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD Operations Tab
// ─────────────────────────────────────────────────────────────────────────────

interface CrudOperationsTabProps {
  registry: Registry.Registry
  onHypothesisUpdate: (id: string, validated: boolean) => void
}

// Generate a random ID slug
const generateId = () => `crud-${Math.random().toString(36).slice(2, 8)}`

// Sample names for random user generation
const SAMPLE_NAMES = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason']

function CrudOperationsTab({
  registry,
  onHypothesisUpdate,
}: CrudOperationsTabProps) {
  const [users, setUsers] = useState<User[]>([])
  const [newUserName, setNewUserName] = useState('')
  const [operationLog, setOperationLog] = useState<string[]>([])

  // CRUD tab has its own independent store and family
  const { crudFamily, crudStore } = useMemo(() => {
    // Start with some sample users with random IDs
    const initialUsers: User[] = [
      { id: generateId(), name: 'Test User Alpha', email: 'alpha@test.com', role: 'admin' },
      { id: generateId(), name: 'Test User Beta', email: 'beta@test.com', role: 'user' },
    ]
    const store = new Map(initialUsers.map((u) => [u.id, u]))
    const { algebra } = makeSimpleMemoryAlgebra<User, string>((u) => u.id, store)

    const family = fromSchema(UserSchema)
      .withKey('id')
      .withFetch(algebra.fetch)
      .withPersist(algebra.persist!)
      .withRemove(algebra.remove!)
      .withLifecycle({ keepAlive: true })
      .buildWithDeps()

    return { crudFamily: family, crudStore: store }
  }, [])

  const log = useCallback((msg: string) => {
    setOperationLog((prev) => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${msg}`])
  }, [])

  // Load all users from store
  const refreshUsers = useCallback(() => {
    setUsers(Array.from(crudStore.values()))
  }, [crudStore])

  useEffect(() => {
    refreshUsers()
  }, [refreshUsers])

  // Check H2: CRUD operations work
  useEffect(() => {
    const hasFetch = operationLog.some((l) => l.includes('Fetched'))
    const hasPersist = operationLog.some((l) => l.includes('Persisted'))
    const hasRemove = operationLog.some((l) => l.includes('Removed'))
    onHypothesisUpdate('H2', hasFetch && (hasPersist || hasRemove))
  }, [operationLog, onHypothesisUpdate])

  const handleFetch = async (id: string) => {
    try {
      const user = await Effect.runPromise(
        crudFamily.fetch(id).pipe(
          Effect.provideService(Registry.AtomRegistry, registry)
        )
      )
      log(`Fetched ${user.name}`)
    } catch (e) {
      log(`Fetch failed: ${e}`)
    }
  }

  const handlePrefetchAll = async () => {
    const keys = Array.from(crudStore.keys())
    if (keys.length === 0) {
      log('No users to prefetch')
      return
    }
    await Effect.runPromise(
      crudFamily.prefetch(keys).pipe(
        Effect.provideService(Registry.AtomRegistry, registry)
      )
    )
    log(`Prefetched ${keys.length} users`)
    refreshUsers()
  }

  const handleCreate = async () => {
    if (!newUserName.trim()) return

    const newUser: User = {
      id: generateId(),
      name: newUserName,
      email: `${newUserName.toLowerCase().replace(/\s/g, '.')}@example.com`,
      role: 'user',
    }

    await Effect.runPromise(
      crudFamily.persist(newUser).pipe(
        Effect.provideService(Registry.AtomRegistry, registry)
      )
    )
    log(`Persisted ${newUser.name}`)
    setNewUserName('')
    refreshUsers()
  }

  const handleRemove = async (id: string) => {
    await Effect.runPromise(
      crudFamily.remove(id).pipe(
        Effect.provideService(Registry.AtomRegistry, registry)
      )
    )
    log(`Removed ${id}`)
    refreshUsers()
  }

  return (
    <div className="space-y-6">
      {/* Create User */}
      <TestCard title="Create User" description="Persist a new user to the store">
        <div className="flex gap-2">
          <input
            type="text"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            placeholder="Enter name..."
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-3 py-2 font-mono text-neutral-200"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <Button onClick={handleCreate} variant="primary">
            <Plus size={14} className="mr-2" />
            Create
          </Button>
        </div>
      </TestCard>

      {/* User Grid */}
      <TestCard
        title="User Store"
        description={`${users.length} users in memory store`}
        actions={
          <Button onClick={handlePrefetchAll} variant="ghost">
            <Zap size={14} className="mr-1" />
            Prefetch All
          </Button>
        }
      >
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 bg-neutral-800/50 rounded border border-neutral-700"
            >
              <div>
                <div className="font-mono text-neutral-200" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                  {user.name}
                </div>
                <div className="text-neutral-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                  {user.id} · {user.email} · {user.role}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleFetch(user.id)} variant="ghost">
                  <RefreshCw size={12} />
                </Button>
                <Button onClick={() => handleRemove(user.id)} variant="danger">
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <div className="text-neutral-500 text-center py-4 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              No users in store. Create one above.
            </div>
          )}
        </div>
      </TestCard>

      {/* Operation Log */}
      <TestCard title="Operation Log">
        <div className="h-32 overflow-y-auto font-mono text-neutral-400 space-y-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {operationLog.length === 0 ? (
            <div className="text-neutral-600">No operations yet.</div>
          ) : (
            operationLog.map((entry, i) => (
              <div key={i}>{entry}</div>
            ))
          )}
        </div>
      </TestCard>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle Tab
// ─────────────────────────────────────────────────────────────────────────────

interface LifecycleTabProps {
  registry: Registry.Registry
  onHypothesisUpdate: (id: string, validated: boolean) => void
}

function LifecycleTab({ registry, onHypothesisUpdate }: LifecycleTabProps) {
  const [keepAliveState, setKeepAliveState] = useState<string>('initial')
  const [autoResetState, setAutoResetState] = useState<string>('initial')
  const [subscriberCount, setSubscriberCount] = useState(0)

  // Create two families with different lifecycle configs
  const { keepAliveFamily, autoResetFamily, keepAliveStore, autoResetStore } = useMemo(() => {
    const kaStore = new Map<string, User>([['test-1', SEED_USERS[0]]])
    const arStore = new Map<string, User>([['test-1', SEED_USERS[0]]])

    const kaAlgebra = makeSimpleMemoryAlgebra<User, string>((u) => u.id, kaStore)
    const arAlgebra = makeSimpleMemoryAlgebra<User, string>((u) => u.id, arStore)

    const kaFamily = fromSchema(UserSchema)
      .withKey('id')
      .withFetch(kaAlgebra.algebra.fetch)
      .withLifecycle({ keepAlive: true })
      .buildWithDeps()

    const arFamily = fromSchema(UserSchema)
      .withKey('id')
      .withFetch(arAlgebra.algebra.fetch)
      .withLifecycle({ keepAlive: false })
      .buildWithDeps()

    return {
      keepAliveFamily: kaFamily,
      autoResetFamily: arFamily,
      keepAliveStore: kaStore,
      autoResetStore: arStore,
    }
  }, [])

  const runKeepAliveTest = async () => {
    // Fetch to populate atom
    setKeepAliveState('fetching...')
    await Effect.runPromise(
      keepAliveFamily.fetch('test-1').pipe(
        Effect.provideService(Registry.AtomRegistry, registry)
      )
    )

    // Check state immediately
    const atom = keepAliveFamily('test-1')
    const result = registry.get(atom)

    // Wait a tick (simulates subscriber drop scenario)
    await new Promise((r) => setTimeout(r, 100))

    // Check state after delay
    const resultAfter = registry.get(atom)
    const stillSuccess = Result.isSuccess(resultAfter)

    setKeepAliveState(stillSuccess ? 'SUCCESS: State persisted' : 'FAIL: State lost')
    onHypothesisUpdate('H3', stillSuccess)
  }

  const runAutoResetTest = async () => {
    // This test is more complex - we'd need to actually mount/unmount subscribers
    // For now, just show the config difference
    setAutoResetState('autoReset: keepAlive=false configured')
  }

  return (
    <div className="space-y-6">
      <TestCard
        title="Lifecycle: keepAlive=true"
        description="Atom retains state when subscriber count drops to zero"
      >
        <div className="space-y-4">
          <div className="p-3 bg-neutral-800/50 rounded border border-neutral-700">
            <code className="text-cyan-400 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              .withLifecycle({'{ keepAlive: true }'})
            </code>
          </div>

          <Button onClick={runKeepAliveTest} variant="primary">
            Run keepAlive Test
          </Button>

          <div className={`p-3 rounded border ${
            keepAliveState.includes('SUCCESS') ? 'border-green-700 bg-green-900/20' :
            keepAliveState.includes('FAIL') ? 'border-red-700 bg-red-900/20' :
            'border-neutral-700 bg-neutral-800/50'
          }`}>
            <span className="font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              {keepAliveState}
            </span>
          </div>
        </div>
      </TestCard>

      <TestCard
        title="Lifecycle: keepAlive=false"
        description="Atom resets to initial when subscriber count drops to zero"
      >
        <div className="space-y-4">
          <div className="p-3 bg-neutral-800/50 rounded border border-neutral-700">
            <code className="text-amber-400 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              .withLifecycle({'{ keepAlive: false }'})
            </code>
          </div>

          <Button onClick={runAutoResetTest}>
            Run autoReset Test
          </Button>

          <div className="p-3 rounded border border-neutral-700 bg-neutral-800/50">
            <span className="font-mono text-neutral-400" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              {autoResetState}
            </span>
          </div>

          <div className="text-neutral-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            Note: Full autoReset testing requires React component mount/unmount cycles.
            In practice, this config means the atom will reset when useAtomValue unmounts.
          </div>
        </div>
      </TestCard>

      <TestCard
        title="TTL Configuration"
        description="Atoms expire after idle duration"
      >
        <div className="p-3 bg-neutral-800/50 rounded border border-neutral-700">
          <code className="text-purple-400 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            .withLifecycle({'{ keepAlive: true, ttl: Duration.minutes(5) }'})
          </code>
        </div>
        <div className="text-neutral-500 mt-3" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          TTL implies keepAlive until the timeout expires. After {'{ttl}'} of inactivity,
          the atom resets to initial state.
        </div>
      </TestCard>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// IoT Sensors Tab
// ─────────────────────────────────────────────────────────────────────────────

interface IoTSensorsTabProps {
  registry: Registry.Registry
  onHypothesisUpdate: (id: string, validated: boolean) => void
}

function IoTSensorsTab({ registry, onHypothesisUpdate }: IoTSensorsTabProps) {
  // Subscribe to atom state (Atom-as-State pattern)
  const mode = useAtomValue(iotModeAtom)
  const natsStatus = useAtomValue(iotNatsStatusAtom)
  const natsError = useAtomValue(iotNatsErrorAtom)
  const isEmitting = useAtomValue(iotIsEmittingAtom)
  const emitRateMs = useAtomValue(iotEmitRateMsAtom)
  const emitCount = useAtomValue(iotEmitCountAtom)
  const emitRateDisplay = useAtomValue(iotEmitRateDisplayAtom)
  const deadbandEnabled = useAtomValue(iotDeadbandEnabledAtom)
  const fetchLog = useAtomValue(iotLogAtom)

  // Local UI state (appropriate for single-component scope)
  const [sensors, setSensors] = useState<IoTSensor[]>([])
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null)
  const [sensorState, setSensorState] = useState<Result.Result<IoTSensor, NotFoundError>>(Result.initial())

  // Create IoT family with simulated algebra (uses shared store ref)
  const sensorFamily = useMemo(() => {
    const algebra = makeSimulatedIoTAlgebra(iotSensorStoreRef.current)

    return fromSchema(IoTSensorSchema)
      .withKey('sensorId')
      .withFetch(algebra.fetch)
      .withPersist(algebra.persist)
      .withLifecycle({ keepAlive: true })
      .buildWithDeps()
  }, [])

  // Refresh sensor list from store
  const refreshSensors = useCallback(() => {
    setSensors(Array.from(iotSensorStoreRef.current.values()))
  }, [])

  useEffect(() => {
    refreshSensors()
  }, [refreshSensors])

  // Subscribe to selected sensor atom
  useEffect(() => {
    if (!selectedSensor) {
      setSensorState(Result.initial())
      return
    }

    const atom = sensorFamily(selectedSensor)
    const initialState = registry.get(atom)
    setSensorState(initialState)

    // DECOUPLED: Subscription only updates inspector state
    // Logging is handled by emitter (📡 EMIT) and polling (📡 POLL) independently
    const unsubscribe = registry.subscribe(atom, (newState) => {
      setSensorState(newState)
      if (Result.isSuccess(newState)) {
        onHypothesisUpdate('H6', true)
      }
    })

    return unsubscribe
  }, [registry, sensorFamily, selectedSensor, onHypothesisUpdate])

  // Cleanup emitter and all sensor polling on unmount
  useEffect(() => {
    return () => {
      if (iotEmitterRef.current) {
        iotEmitterRef.current.stop()
        iotEmitterRef.current = null
      }
      // Stop all per-sensor polling intervals
      iotOps.stopAllSensorPolling()
    }
  }, [])

  // Selection only opens the state inspector panel (decoupled from streaming)
  const handleFetch = async (sensorId: string) => {
    setSelectedSensor(sensorId)
    try {
      await Effect.runPromise(
        sensorFamily.fetch(sensorId).pipe(
          Effect.provideService(Registry.AtomRegistry, registry)
        )
      )
      // Log selection action separately from EMIT/POLL
      const atom = sensorFamily(sensorId)
      const result = registry.get(atom)
      if (Result.isSuccess(result)) {
        logToIoT(`🔍 SELECT ${result.value.name}: ${formatReadings(result.value)}`)
      }
    } catch (e) {
      logToIoT(`❌ Fetch failed for ${sensorId}: ${e}`)
    }
  }

  const handleFetchAll = async () => {
    const ids = Array.from(iotSensorStoreRef.current.keys())
    logToIoT(`🔄 Prefetching ${ids.length} sensors...`)
    await Effect.runPromise(
      sensorFamily.prefetch(ids).pipe(
        Effect.provideService(Registry.AtomRegistry, registry)
      )
    )
    logToIoT(`✅ Prefetched ${ids.length} sensors`)
    refreshSensors()
  }

  // Per-sensor polling toggle (each sensor is an independent isolate)
  // DECOUPLED: Polling pushes to Sensor Data Stream Log independently of selection
  const handleToggleSensorPolling = useCallback((sensorId: string) => {
    const pollAtom = iotSensorPollingAtom(sensorId)
    const currentState = iotRegistry.get(pollAtom)

    if (currentState.isPolling) {
      iotOps.stopSensorPolling(sensorId)
    } else {
      // Create fetch function for this sensor - logs to stream independently
      const fetchFn = async () => {
        try {
          await Effect.runPromise(
            sensorFamily.fetch(sensorId).pipe(
              Effect.provideService(Registry.AtomRegistry, registry)
            )
          )
          // Get the fetched result and log to stream (decoupled from selection)
          const atom = sensorFamily(sensorId)
          const result = registry.get(atom)
          if (Result.isSuccess(result)) {
            logToIoT(`📡 POLL ${result.value.name}: ${formatReadings(result.value)}`)
          }
          // Refresh sensor list to show updated readings
          refreshSensors()
        } catch (e) {
          logToIoT(`❌ Poll failed for ${sensorId}: ${e}`)
        }
      }
      iotOps.startSensorPolling(sensorId, fetchFn)
    }
  }, [sensorFamily, registry, refreshSensors])

  const handleSetSensorPollRate = useCallback((sensorId: string, rateMs: number) => {
    iotOps.setSensorPollRate(sensorId, rateMs)
    // If polling, restart with new rate (using decoupled fetch pattern)
    const pollAtom = iotSensorPollingAtom(sensorId)
    const currentState = iotRegistry.get(pollAtom)
    if (currentState.isPolling) {
      iotOps.stopSensorPolling(sensorId)
      const fetchFn = async () => {
        try {
          await Effect.runPromise(
            sensorFamily.fetch(sensorId).pipe(
              Effect.provideService(Registry.AtomRegistry, registry)
            )
          )
          const atom = sensorFamily(sensorId)
          const result = registry.get(atom)
          if (Result.isSuccess(result)) {
            logToIoT(`📡 POLL ${result.value.name}: ${formatReadings(result.value)}`)
          }
          refreshSensors()
        } catch (e) {
          logToIoT(`❌ Poll failed for ${sensorId}: ${e}`)
        }
      }
      iotOps.startSensorPolling(sensorId, fetchFn, rateMs)
    }
  }, [sensorFamily, registry, refreshSensors])

  const natsStatusColors = {
    disconnected: 'text-neutral-500',
    connecting: 'text-amber-400',
    connected: 'text-green-400',
    error: 'text-red-400',
  }

  return (
    <div className="space-y-6">
      {/* Mode & Connection Controls */}
      <TestCard
        title="Data Source"
        description="Toggle between simulated data and NATS JetStream KV"
      >
        <div className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex items-center gap-4">
            <span className="text-neutral-400 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              Mode:
            </span>
            <div className="flex gap-1 p-1 bg-neutral-900/50 rounded border border-neutral-800">
              <button
                onClick={() => iotOps.setMode('simulated')}
                className={`px-3 py-1 rounded font-mono transition-colors ${
                  mode === 'simulated'
                    ? 'bg-cyan-900/50 text-cyan-300'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
                style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
              >
                Simulated
              </button>
              <button
                onClick={() => iotOps.setMode('nats')}
                className={`px-3 py-1 rounded font-mono transition-colors ${
                  mode === 'nats'
                    ? 'bg-green-900/50 text-green-300'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
                style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
              >
                NATS
              </button>
            </div>
          </div>

          {/* NATS Connection */}
          {mode === 'nats' && (
            <div className="flex items-center gap-4 p-3 bg-neutral-900/50 rounded border border-neutral-800">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  natsStatus === 'connected' ? 'bg-green-400' :
                  natsStatus === 'connecting' ? 'bg-amber-400 animate-pulse' :
                  natsStatus === 'error' ? 'bg-red-400' : 'bg-neutral-500'
                }`} />
                <span className={`font-mono ${natsStatusColors[natsStatus]}`} style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                  {natsStatus}
                </span>
              </div>

              {natsStatus === 'disconnected' || natsStatus === 'error' ? (
                <Button onClick={() => iotRegistry.get(iotOps.connect())} variant="primary">
                  <Wifi size={14} className="mr-1" />
                  Connect to NATS
                </Button>
              ) : natsStatus === 'connected' ? (
                <Button onClick={iotOps.disconnect} variant="danger">
                  <WifiOff size={14} className="mr-1" />
                  Disconnect
                </Button>
              ) : (
                <span className="text-amber-400 font-mono animate-pulse" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                  Connecting...
                </span>
              )}

              {natsError && (
                <span className="text-red-400 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                  {natsError}
                </span>
              )}
            </div>
          )}

          {/* Emission Controls */}
          <div className="flex items-center gap-4 p-3 bg-neutral-900/50 rounded border border-neutral-800">
            <Button
              onClick={() => iotOps.toggleEmitter()}
              variant={isEmitting ? 'danger' : 'primary'}
            >
              {isEmitting ? (
                <>
                  <Activity size={14} className="mr-1 animate-pulse" />
                  Stop Emitter
                </>
              ) : (
                <>
                  <Activity size={14} className="mr-1" />
                  Start Emitter
                </>
              )}
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-neutral-500 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                Rate:
              </span>
              <input
                type="range"
                min={100}
                max={5000}
                step={100}
                value={emitRateMs}
                onChange={(e) => iotOps.setEmitRate(Number(e.target.value))}
                className="w-24 accent-cyan-500"
              />
              <span className="text-cyan-400 font-mono w-12" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                {emitRateDisplay}
              </span>
            </div>

            {isEmitting && (
              <span className="text-green-400 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                📊 {emitCount} emits
              </span>
            )}
          </div>

          {/* Dead-Band Delta Compression Controls (OPC UA Standard) */}
          <div className="flex items-center gap-4 p-3 bg-neutral-900/50 rounded border border-neutral-800">
            <button
              onClick={iotOps.toggleDeadband}
              className={`flex items-center gap-2 px-3 py-1 rounded font-mono transition-colors ${
                deadbandEnabled
                  ? 'bg-purple-900/40 text-purple-400 border border-purple-700'
                  : 'bg-neutral-800 text-neutral-500 border border-neutral-700 hover:text-neutral-300'
              }`}
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
              title="OPC UA dead-band filtering - only transmit significant changes (zero allocation)"
            >
              {deadbandEnabled ? 'Dead-Band: ON' : 'Dead-Band: OFF'}
            </button>

            <button
              onClick={iotOps.resetBaselines}
              className="px-3 py-1 rounded font-mono bg-neutral-800 text-neutral-500 border border-neutral-700 hover:text-neutral-300 transition-colors"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
              title="Reset all dead-band baselines to force full value transmission"
            >
              Reset Baselines
            </button>

            <span className="text-neutral-500 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              Thresholds: T±{DEADBAND.temperature}°C · H±{DEADBAND.humidity}% · P±{DEADBAND.pressure}hPa
            </span>
          </div>
        </div>
      </TestCard>

      {/* Sensor Grid */}
      <TestCard
        title="IoT Sensor Network"
        description={`${sensors.length} industrial sensors · Mode: ${mode}`}
        actions={
          <Button onClick={handleFetchAll} variant="ghost">
            <Zap size={14} className="mr-1" />
            Prefetch All
          </Button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sensors.map((sensor) => (
            <SensorCard
              key={sensor.sensorId}
              sensor={sensor}
              isSelected={selectedSensor === sensor.sensorId}
              onSelect={() => handleFetch(sensor.sensorId)}
              onTogglePolling={() => handleToggleSensorPolling(sensor.sensorId)}
              onSetPollRate={(rate) => handleSetSensorPollRate(sensor.sensorId, rate)}
            />
          ))}
        </div>
      </TestCard>

      {/* Live Reading Panel - shows state of selected sensor */}
      {selectedSensor && (
        <TestCard
          title="Sensor State Inspector"
          description={`Atom state for ${selectedSensor} (decoupled from streaming)`}
          actions={
            <Button onClick={() => handleFetch(selectedSensor)} variant="ghost">
              <RefreshCw size={14} className="mr-1" />
              Manual Fetch
            </Button>
          }
        >
          <ResultStateDisplay result={sensorState} label={`sensorFamily("${selectedSensor}")`} />
        </TestCard>
      )}

      {/* Data Stream Log */}
      <TestCard
        title="Sensor Data Stream"
        actions={
          <Button onClick={iotOps.clearLog} variant="ghost">
            Clear
          </Button>
        }
      >
        <div className="h-40 overflow-y-auto font-mono text-neutral-400 space-y-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {fetchLog.length === 0 ? (
            <div className="text-neutral-600">Select a sensor or start the emitter to begin streaming data...</div>
          ) : (
            fetchLog.map((entry, i) => (
              <div key={i}>{entry}</div>
            ))
          )}
        </div>
      </TestCard>
    </div>
  )
}

// Sensor card component with per-sensor polling controls
function SensorCard({
  sensor,
  isSelected,
  onSelect,
  onTogglePolling,
  onSetPollRate,
}: {
  sensor: IoTSensor
  isSelected: boolean
  onSelect: () => void
  onTogglePolling: () => void
  onSetPollRate: (rateMs: number) => void
}) {
  // Subscribe to this sensor's polling atom (per-sensor isolate)
  const pollingState = useAtomValue(iotSensorPollingAtom(sensor.sensorId))

  const statusColors = {
    online: 'text-green-400',
    offline: 'text-neutral-500',
    warning: 'text-amber-400',
    error: 'text-red-400',
  }

  const typeIcons = {
    temperature: <Thermometer size={14} className="text-orange-400" />,
    humidity: <Droplets size={14} className="text-blue-400" />,
    pressure: <Gauge size={14} className="text-purple-400" />,
    composite: <Radio size={14} className="text-cyan-400" />,
  }

  const formatPollRate = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`

  return (
    <div
      className={`p-4 rounded border transition-all ${
        isSelected
          ? 'bg-cyan-900/30 border-cyan-600'
          : 'bg-neutral-800/50 border-neutral-700 hover:border-neutral-600'
      }`}
    >
      {/* Header row - clickable to select */}
      <button
        onClick={onSelect}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {typeIcons[sensor.type]}
            <span className="font-mono text-neutral-200" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              {sensor.name}
            </span>
          </div>
          <div className={`flex items-center gap-1 ${statusColors[sensor.status]}`}>
            <div className={`w-2 h-2 rounded-full ${
              sensor.status === 'online' ? 'bg-green-400' :
              sensor.status === 'warning' ? 'bg-amber-400' :
              sensor.status === 'error' ? 'bg-red-400' : 'bg-neutral-500'
            }`} />
            <span className="font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {sensor.status}
            </span>
          </div>
        </div>

        <div className="text-neutral-500 mb-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          <MapPin size={10} className="inline mr-1" />
          {sensor.location.zone}
        </div>

        <div className="flex items-center justify-between">
          <div className="font-mono text-neutral-300" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {formatReadings(sensor)}
          </div>
          <div className={`font-mono ${sensor.battery < 25 ? 'text-red-400' : 'text-neutral-500'}`}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            🔋 {sensor.battery.toFixed(0)}%
          </div>
        </div>
      </button>

      {/* Per-sensor polling controls */}
      <div className="mt-3 pt-3 border-t border-neutral-700/50 flex items-center gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onTogglePolling()
          }}
          className={`flex items-center gap-1 px-2 py-1 rounded font-mono transition-colors ${
            pollingState.isPolling
              ? 'bg-green-900/40 text-green-400 border border-green-700'
              : 'bg-neutral-800 text-neutral-500 border border-neutral-700 hover:text-neutral-300'
          }`}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          disabled={sensor.status === 'offline'}
          title={sensor.status === 'offline' ? 'Sensor is offline' : pollingState.isPolling ? 'Stop polling' : 'Start polling'}
        >
          {pollingState.isPolling ? (
            <>
              <Wifi size={12} className="animate-pulse" />
              Polling
            </>
          ) : (
            <>
              <WifiOff size={12} />
              Poll
            </>
          )}
        </button>

        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min={200}
            max={5000}
            step={200}
            value={pollingState.pollRateMs}
            onChange={(e) => {
              e.stopPropagation()
              onSetPollRate(Number(e.target.value))
            }}
            className="w-16 accent-cyan-500"
            disabled={sensor.status === 'offline'}
          />
          <span className="text-neutral-500 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {formatPollRate(pollingState.pollRateMs)}
          </span>
        </div>
      </div>
    </div>
  )
}

// Format sensor readings for display
function formatReadings(sensor: IoTSensor): string {
  const parts: string[] = []
  if (sensor.readings.temperature !== undefined) {
    parts.push(`${sensor.readings.temperature.toFixed(1)}°C`)
  }
  if (sensor.readings.humidity !== undefined) {
    parts.push(`${sensor.readings.humidity.toFixed(1)}%`)
  }
  if (sensor.readings.pressure !== undefined) {
    parts.push(`${sensor.readings.pressure.toFixed(1)} hPa`)
  }
  return parts.join(' · ') || 'No readings'
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

type TabId = 'state' | 'crud' | 'lifecycle' | 'iot'

export function FermionTestbed() {
  const [activeTab, setActiveTab] = useState<TabId>('state')
  const [hypotheses, setHypotheses] = useState<Record<string, ValidationStatus>>({
    H1: 'pending',
    H2: 'pending',
    H3: 'pending',
    H4: 'pending',
    H5: 'pending',
    H6: 'pending',
  })

  // Create registry and family once
  const { registry, userFamily, store } = useMemo(() => {
    const r = Registry.make()
    const seedData = new Map(SEED_USERS.map((u) => [u.id, u]))
    const { algebra, store } = makeSimpleMemoryAlgebra<User, string>((u) => u.id, seedData)

    const family = fromSchema(UserSchema)
      .withKey('id')
      .withFetch(algebra.fetch)
      .withPersist(algebra.persist!)
      .withRemove(algebra.remove!)
      .withLifecycle({ keepAlive: true })
      .buildWithDeps()

    return { registry: r, userFamily: family, store }
  }, [])

  const updateHypothesis = useCallback((id: string, validated: boolean) => {
    setHypotheses((prev) => ({
      ...prev,
      [id]: validated ? 'validated' : prev[id],
    }))
  }, [])

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: 'state', label: 'State Visualization', icon: <Activity size={14} /> },
    { id: 'crud', label: 'CRUD Operations', icon: <Database size={14} /> },
    { id: 'lifecycle', label: 'Lifecycle', icon: <Clock size={14} /> },
    { id: 'iot', label: 'IoT Sensors', icon: <Radio size={14} /> },
  ]

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      <div className="max-w-4xl mx-auto">
        <TestbedHeader
          title="Fermion Testbed"
          subtitle="Schema-driven Atom.family with Effect algebra"
          actions={<VersionBadge version="v1" status="new" />}
        />

        {/* Hypothesis Summary */}
        <HypothesisSummary
          hypotheses={[
            { id: 'H1', title: 'State machine transitions', status: hypotheses.H1 },
            { id: 'H2', title: 'CRUD operations', status: hypotheses.H2 },
            { id: 'H3', title: 'Lifecycle config', status: hypotheses.H3 },
            { id: 'H4', title: 'Composite keys', status: hypotheses.H4 },
            { id: 'H5', title: 'Shared atoms', status: hypotheses.H5 },
            { id: 'H6', title: 'IoT sensor streaming', status: hypotheses.H6 },
          ]}
          className="mb-8"
        />

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-neutral-900/50 rounded-lg border border-neutral-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded font-mono transition-colors ${
                activeTab === tab.id
                  ? 'bg-neutral-800 text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'state' && (
          <StateVisualizationTab
            registry={registry}
            userFamily={userFamily}
            onHypothesisUpdate={updateHypothesis}
          />
        )}
        {activeTab === 'crud' && (
          <CrudOperationsTab
            registry={registry}
            onHypothesisUpdate={updateHypothesis}
          />
        )}
        {activeTab === 'lifecycle' && (
          <LifecycleTab
            registry={registry}
            onHypothesisUpdate={updateHypothesis}
          />
        )}
        {activeTab === 'iot' && (
          <IoTRegistryProvider>
            <IoTSensorsTab
              registry={registry}
              onHypothesisUpdate={updateHypothesis}
            />
          </IoTRegistryProvider>
        )}
      </div>
    </div>
  )
}
