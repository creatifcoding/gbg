/**
 * IIoT Domain Identifiers
 *
 * Branded types for type-safe identifiers across the IIoT domain.
 *
 * @module
 */

import { Schema } from 'effect'

// =============================================================================
// Branded Identifiers
// =============================================================================

/** Plant identifier (e.g., 'PLANT-A') */
export const PlantId = Schema.String.pipe(Schema.brand('PlantId'))
export type PlantId = Schema.Schema.Type<typeof PlantId>

/** Production line identifier (e.g., 'LINE-001') */
export const LineId = Schema.String.pipe(Schema.brand('LineId'))
export type LineId = Schema.Schema.Type<typeof LineId>

/** Machine identifier (e.g., 'MCH-001') */
export const MachineId = Schema.String.pipe(Schema.brand('MachineId'))
export type MachineId = Schema.Schema.Type<typeof MachineId>

/** Sensor/device identifier (e.g., 'TMP-001') */
export const DeviceId = Schema.String.pipe(Schema.brand('DeviceId'))
export type DeviceId = Schema.Schema.Type<typeof DeviceId>

/** Alarm identifier (e.g., 'ALM-abc123') */
export const AlarmId = Schema.String.pipe(Schema.brand('AlarmId'))
export type AlarmId = Schema.Schema.Type<typeof AlarmId>
