/**
 * IIoT Services Module
 *
 * Three-layer architecture:
 * - L1: Core database clients (TimescaleDB, Apache AGE)
 * - L2: Domain services (Sensor, Asset, Alarm)
 * - Events: Domain event emission services
 * - Reactor: Graph-backed consistency sidecars
 * - L3: Orchestration (IIoTService)
 *
 * @module
 */

// L1 - Core Clients
export * from './l1'

// L2 - Domain Services
export * from './l2'

// Events - Domain Event Emission
export * from './events'

// Reactor - Consistency Sidecars
export * from './reactor'

// L3 - Orchestration
export * from './l3'
