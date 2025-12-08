/**
 * OPC-UA PubSub JSON Payload Generator
 *
 * Generates OPC Foundation Part 14 compliant JSON payloads.
 * Reference: https://reference.opcfoundation.org/Core/Part14/v104/docs/7.2.3
 *
 * Example output:
 * ```json
 * {
 *   "MessageId": "9279c0b3-da88-45a4-af74-451cebf82db0",
 *   "MessageType": "ua-data",
 *   "PublisherId": "Publisher-001",
 *   "Messages": [{
 *     "DataSetWriterId": 101,
 *     "SequenceNumber": 1,
 *     "Timestamp": "2024-01-15T10:30:00.000Z",
 *     "Payload": { ... }
 *   }]
 * }
 * ```
 *
 * @module
 */

import type { PayloadGenerator, PayloadTier } from '../types'
import { PAYLOAD_SIZE_TARGETS } from '../types'

// ============================================================================
// OPC-UA TYPES
// ============================================================================

/** OPC-UA DataSet field with variant value */
interface OpcUaField {
  /** Field name (NodeId-like) */
  Name: string
  /** Value with type information */
  Value: {
    Type: number  // OPC-UA Built-in Type ID
    Body: unknown // Actual value
  }
  /** Source timestamp */
  SourceTimestamp?: string
  /** Server timestamp */
  ServerTimestamp?: string
  /** Status code (0 = Good) */
  StatusCode?: number
}

/** OPC-UA DataSetMessage */
interface OpcUaDataSetMessage {
  /** Writer identifier */
  DataSetWriterId: number
  /** Sequence number for ordering */
  SequenceNumber: number
  /** Message timestamp */
  Timestamp: string
  /** Status (0 = Good) */
  Status?: number
  /** Field data */
  Payload: Record<string, OpcUaField>
}

/** OPC-UA NetworkMessage (JSON encoding) */
interface OpcUaNetworkMessage {
  /** Unique message identifier */
  MessageId: string
  /** Message type discriminator */
  MessageType: 'ua-data' | 'ua-metadata' | 'ua-event'
  /** Publisher identifier */
  PublisherId: string
  /** Optional writer group */
  WriterGroupId?: number
  /** DataSet messages */
  Messages: OpcUaDataSetMessage[]
}

// ============================================================================
// FIELD DEFINITIONS
// ============================================================================

/** OPC-UA Built-in Type IDs */
const OPC_UA_TYPES = {
  Boolean: 1,
  SByte: 2,
  Byte: 3,
  Int16: 4,
  UInt16: 5,
  Int32: 6,
  UInt32: 7,
  Int64: 8,
  UInt64: 9,
  Float: 10,
  Double: 11,
  String: 12,
  DateTime: 13,
  ByteString: 15,
} as const

/** Simulated PLC/SCADA field definitions */
const FIELD_DEFINITIONS = [
  { name: 'Temperature_PV', type: OPC_UA_TYPES.Double, range: [15, 85] as const, unit: '°C' },
  { name: 'Temperature_SP', type: OPC_UA_TYPES.Double, range: [20, 80] as const, unit: '°C' },
  { name: 'Pressure_PV', type: OPC_UA_TYPES.Double, range: [0, 10] as const, unit: 'bar' },
  { name: 'Pressure_SP', type: OPC_UA_TYPES.Double, range: [0, 10] as const, unit: 'bar' },
  { name: 'FlowRate_PV', type: OPC_UA_TYPES.Double, range: [0, 500] as const, unit: 'L/min' },
  { name: 'Level_PV', type: OPC_UA_TYPES.Double, range: [0, 100] as const, unit: '%' },
  { name: 'ValvePosition', type: OPC_UA_TYPES.Double, range: [0, 100] as const, unit: '%' },
  { name: 'MotorSpeed', type: OPC_UA_TYPES.UInt32, range: [0, 3600] as const, unit: 'RPM' },
  { name: 'MotorCurrent', type: OPC_UA_TYPES.Double, range: [0, 50] as const, unit: 'A' },
  { name: 'MotorRunning', type: OPC_UA_TYPES.Boolean, range: [0, 1] as const, unit: '' },
  { name: 'AlarmActive', type: OPC_UA_TYPES.Boolean, range: [0, 1] as const, unit: '' },
  { name: 'BatchCounter', type: OPC_UA_TYPES.UInt32, range: [0, 10000] as const, unit: '' },
  { name: 'ProductionRate', type: OPC_UA_TYPES.Double, range: [0, 1000] as const, unit: 'units/hr' },
  { name: 'QualityIndex', type: OPC_UA_TYPES.Double, range: [0, 100] as const, unit: '%' },
  { name: 'EnergyConsumption', type: OPC_UA_TYPES.Double, range: [0, 5000] as const, unit: 'kWh' },
  { name: 'Vibration_X', type: OPC_UA_TYPES.Double, range: [-10, 10] as const, unit: 'mm/s' },
  { name: 'Vibration_Y', type: OPC_UA_TYPES.Double, range: [-10, 10] as const, unit: 'mm/s' },
  { name: 'Vibration_Z', type: OPC_UA_TYPES.Double, range: [-10, 10] as const, unit: 'mm/s' },
] as const

/** Tier configuration */
const TIER_CONFIG = {
  small: { dataSetCount: 1, fieldsPerSet: 4 },   // ~500 bytes
  medium: { dataSetCount: 3, fieldsPerSet: 8 },  // ~3 kB
  large: { dataSetCount: 8, fieldsPerSet: 16 },  // ~20 kB
} as const

// ============================================================================
// GENERATOR IMPLEMENTATION
// ============================================================================

/**
 * Generate a random value for a field.
 */
const randomFieldValue = (
  type: number,
  range: readonly [number, number]
): unknown => {
  const [min, max] = range

  if (type === OPC_UA_TYPES.Boolean) {
    return Math.random() > 0.5
  }

  if (type === OPC_UA_TYPES.UInt32 || type === OPC_UA_TYPES.Int32) {
    return Math.floor(min + Math.random() * (max - min))
  }

  // Default: Double/Float
  return Math.round((min + Math.random() * (max - min)) * 100) / 100
}

/**
 * Generate payload for a single DataSet.
 */
const generateDataSetPayload = (
  fieldsCount: number,
  dataSetIndex: number
): Record<string, OpcUaField> => {
  const payload: Record<string, OpcUaField> = {}
  const timestamp = new Date().toISOString()

  for (let i = 0; i < fieldsCount; i++) {
    const fieldDef = FIELD_DEFINITIONS[(dataSetIndex * 4 + i) % FIELD_DEFINITIONS.length]
    const fieldName = `${fieldDef.name}_${dataSetIndex}`

    payload[fieldName] = {
      Name: fieldName,
      Value: {
        Type: fieldDef.type,
        Body: randomFieldValue(fieldDef.type, fieldDef.range),
      },
      SourceTimestamp: timestamp,
      StatusCode: 0, // Good
    }
  }

  return payload
}

/**
 * OPC-UA PubSub JSON payload generator.
 *
 * Produces Part 14 compliant network messages with
 * realistic SCADA/PLC data.
 */
export const opcuaGenerator: PayloadGenerator = {
  id: 'opcua',
  name: 'OPC-UA PubSub',
  description: 'Industrial automation — SCADA, PLCs, manufacturing',

  generate(tier: PayloadTier, eventIndex: number): OpcUaNetworkMessage {
    const config = TIER_CONFIG[tier]
    const timestamp = new Date().toISOString()
    const publisherId = `Publisher-${(eventIndex % 100).toString().padStart(3, '0')}`

    const messages: OpcUaDataSetMessage[] = Array.from(
      { length: config.dataSetCount },
      (_, i) => ({
        DataSetWriterId: 100 + i,
        SequenceNumber: eventIndex,
        Timestamp: timestamp,
        Status: 0, // Good
        Payload: generateDataSetPayload(config.fieldsPerSet, i),
      })
    )

    return {
      MessageId: crypto.randomUUID(),
      MessageType: 'ua-data',
      PublisherId: publisherId,
      WriterGroupId: 1,
      Messages: messages,
    }
  },

  estimateSizeBytes(tier: PayloadTier): number {
    return PAYLOAD_SIZE_TARGETS[tier]
  },
}

export type { OpcUaNetworkMessage, OpcUaDataSetMessage, OpcUaField }
