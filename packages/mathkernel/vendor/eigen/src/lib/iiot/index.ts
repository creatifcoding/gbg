/**
 * IIoT Module - Industrial IoT Data Management
 *
 * Unified PostgreSQL-based IIoT data platform combining:
 * - TimescaleDB: Time-series sensor data (hypertables, continuous aggregates)
 * - pg_mooncake: Columnar analytics (historical data, batch queries)
 * - Apache AGE: Graph relationships (asset hierarchy, event causality)
 *
 * Architecture:
 * ```
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                     PostgreSQL 16 (Single Instance)                      │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
 * │  │   Apache AGE    │  │   TimescaleDB   │  │   pg_mooncake   │          │
 * │  │   (Graphs)      │  │  (Time-series)  │  │   (Columnar)    │          │
 * │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘          │
 * │           │         device_id FK           │                             │
 * │           └────────────────────┼───────────┘                             │
 * │                                │                                         │
 * │  ┌─────────────────────────────┴─────────────────────────────────────┐  │
 * │  │                    Unified Query Layer                             │  │
 * │  └───────────────────────────────────────────────────────────────────┘  │
 * └─────────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * Service Layers:
 * - L1: Core database clients (TimeSeriesClient, GraphClient)
 * - L2: Domain services (SensorService, AssetService, AlarmService)
 * - L3: Orchestration (IIoTService)
 *
 * @module
 */

// Schemas
export * from './schemas'

// Services
export * from './services'
