/**
 * IIoT RPC Barrel Export
 *
 * Exports all RPC definitions and the combined IIoTRpcs group.
 *
 * @module
 */

import { RpcGroup } from '@effect/rpc'

// Individual RPC groups
export * from './SensorRpcs'
export * from './AssetRpcs'
export * from './AlarmRpcs'
export * from './errors'

// Import for composition
import { SensorRpcs } from './SensorRpcs'
import { AssetRpcs } from './AssetRpcs'
import { AlarmRpcs } from './AlarmRpcs'

// =============================================================================
// Combined IIoT RPC Group
// =============================================================================

/**
 * Combined IIoT RPCs
 *
 * Single RpcGroup containing all IIoT operations:
 * - Sensor: GetLatest, Query, QueryAggregated, Subscribe
 * - Asset: GetSensorHierarchy, GetPlantHierarchy, GetMachineWithSensors, etc.
 * - Alarm: Create, Get, Acknowledge, Clear, Query, GetContext, GetStats
 */
export const IIoTRpcs = RpcGroup.make(
  ...Array.from(SensorRpcs.requests.values()),
  ...Array.from(AssetRpcs.requests.values()),
  ...Array.from(AlarmRpcs.requests.values())
)

// Export type for client typing
export type IIoTRpcs = typeof IIoTRpcs
