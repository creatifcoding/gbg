# WBS V2 — Physical Infrastructure & Sovereign Mesh Networking

**Owner**: infra-architect
**RFC Sections**: S34 (Physical Infrastructure, lines 35105-36910), S35 (Network Backbone, lines 36911-38460)
**Total Story Points**: ~430 SP across 24 Epics, 7 Phases
**Domain Prefix**: `IF-`
**Categories**: Effect-TS Code, Firmware, Hardware Design, RF Engineering, DevOps, Manufacturing

---

## Category Legend

| Category | Tag | Description |
|----------|-----|-------------|
| **Effect-TS Code** | `[CODE]` | TypeScript + Effect services, schemas, repos |
| **Firmware** | `[FW]` | Embedded Rust/C, Zephyr RTOS, ESP-IDF |
| **Hardware Design** | `[HW]` | PCB layout, BOM validation, thermal, enclosure |
| **RF Engineering** | `[RF]` | Antenna design, radio config, propagation modeling |
| **DevOps** | `[DEVOPS]` | CI/CD, OTA, fleet management, manufacturing tooling |
| **Manufacturing** | `[MFG]` | Supply chain, certification, test fixtures, assembly |

---

## Phase 1: Hardware Foundation (Sprints 1-3) — 48 SP

### Epic IF-01: Edge Device Hardware Design — 21 SP
| Status | Task | Category | Description |
|--------|------|----------|-------------|
| ⏳ | IF-01.1.1 | `[HW]` | SoM evaluation: procure QCS6490, iMX8MP, AM62x development kits; validate boot, peripheral access, thermal profile |
| ⏳ | IF-01.1.2 | `[HW]` | SMARC 2.1 carrier board schematic — dual GbE PHY (RTL8211F), RS-485 transceivers (MAX3485 + ADM2587E), USB hub, M.2 slots |
| ⏳ | IF-01.1.3 | `[HW]` | Carrier board 6-layer PCB layout (KiCad/Altium) — signal integrity, power planes, SMARC connector routing |
| ⏳ | IF-01.1.4 | `[HW]` | Power supply design: 9-36VDC wide-range input, PoE PD module (Ag9800), reverse polarity protection |
| ⏳ | IF-01.1.5 | `[HW]` | Digital I/O subsystem: 4-in/4-out optoisolated (TLP291), 24VDC rated |
| ⏳ | IF-01.1.6 | `[HW]` | Enclosure design: aluminum extrusion DIN-rail mount, IP40 base, thermal pad integration, 120x80x40mm |
| ⏳ | IF-01.1.7 | `[HW]` | Thermal simulation and validation: fanless design at 15W TDP (-40C to +70C) with conduction to case |
| ⏳ | IF-01.2.1 | `[HW]` | BOM Option A (QCS6490 Premium $449): finalize component selection at @1K and @10K pricing |
| ⏳ | IF-01.2.2 | `[HW]` | BOM Option B (iMX8MP Standard $349): finalize with Variscite/Toradex SoM selection |
| ⏳ | IF-01.2.3 | `[HW]` | BOM Option C (AM62x Budget $249): finalize with VAR-SOM-AM62, 4-layer PCB variant |
| ⏳ | IF-01.3.1 | `[HW]` | Second-source audit: pin-compatible alternatives for each SoM (QCS5430, VAR-SOM Pin2Pin family, Phytec AM62x) |

**Dependencies**: None (greenfield hardware)
**RFC Sections**: S34.2-34.4

---

### Epic IF-02: Gateway Hardware Design — 13 SP
| Status | Task | Category | Description |
|--------|------|----------|-------------|
| ⏳ | IF-02.1.1 | `[HW]` | ESP32-S3 gateway schematic: W5500 SPI Ethernet, 2x RS-485 isolated, 4x analog input (ADS1115), 4x DIO |
| ⏳ | IF-02.1.2 | `[HW]` | Gateway PCB layout: 4-layer for Option A (Full), 4-layer reduced for Option B, 2-layer for Option C |
| ⏳ | IF-02.1.3 | `[HW]` | Gateway enclosure: ABS/PC DIN-rail mount, IP40, 90x70x35mm, 3 status LED light pipes |
| ⏳ | IF-02.2.1 | `[HW]` | BOM Gateway Option A (Full $149): ESP32-S3-WROOM-1 N16R8, full I/O |
| ⏳ | IF-02.2.2 | `[HW]` | BOM Gateway Option B (Ethernet $99): N8R2, reduced I/O |
| ⏳ | IF-02.2.3 | `[HW]` | BOM Gateway Option C (Minimal $49): ESP32-S3-MINI-1 N4R2, Ethernet + USB-C only |
| ⏳ | IF-02.3.1 | `[HW]` | Gateway power design: 9-36VDC buck converter for Options A/B; USB-C 5V for Option C |

**Dependencies**: None
**RFC Sections**: S34.5

---

### Epic IF-03: Protocol Adapter Hardware — 14 SP
| Status | Task | Category | Description |
|--------|------|----------|-------------|
| ⏳ | IF-03.1.1 | `[HW]` | TMNL-ADA-485: Passive RS-485 cable adapter with termination + ESD protection ($29) |
| ⏳ | IF-03.1.2 | `[HW]` | TMNL-ADA-AIO: 4-channel 16-bit ADC (ADS1115), isolated galvanic separation, 4-20mA/0-10V ($79) |
| ⏳ | IF-03.1.3 | `[HW]` | TMNL-ADA-AIO8: 8-channel variant of AIO ($119) |
| ⏳ | IF-03.1.4 | `[HW]` | TMNL-ADA-DIO: 8-channel optoisolated digital input, 24VDC ($59) |
| ⏳ | IF-03.1.5 | `[HW]` | TMNL-ADA-232: RS-232 to RS-485 converter with auto-baud ($39) |
| ⏳ | IF-03.1.6 | `[HW]` | TMNL-ADA-CT: Split-core current transformer + signal conditioner ($49) |
| ⏳ | IF-03.2.1 | `[HW]` | TMNL-ADA-OPC: ESP32-S3 based OPC UA client adapter ($129) |
| ⏳ | IF-03.2.2 | `[HW]` | TMNL-ADA-ENET: ESP32-S3 based EtherNet/IP CIP scanner adapter ($129) |
| ⏳ | IF-03.2.3 | `[HW]` | TMNL-ADA-MTC: ESP32-S3 based MTConnect HTTP client adapter ($99) |
| ⏳ | IF-03.2.4 | `[HW]` | TMNL-ADA-PNET: TI AM62x PRU-based PROFINET passive tap adapter ($149) |
| ⏳ | IF-03.2.5 | `[HW]` | TMNL-ADA-BACNET: ESP32-S3 based BACnet/IP adapter ($119) |

**Dependencies**: None
**RFC Sections**: S34.6

---

## Phase 2: Firmware & Edge Software (Sprints 4-7) — 58 SP

### Epic IF-04: Edge Device System Image — 16 SP
| Status | Task | Category | Description |
|--------|------|----------|-------------|
| ⏳ | IF-04.1.1 | `[FW]` | Yocto/Ubuntu base image for QCS6490: kernel, drivers, device tree, Wi-Fi 6E, BT5.2, TPM 2.0 |
| ⏳ | IF-04.1.2 | `[FW]` | Yocto base image for iMX8MP: mainline kernel, NPU driver (ethosu), CAN-FD |
| ⏳ | IF-04.1.3 | `[FW]` | TI SDK base image for AM62x: mainline kernel, PRU-ICSS drivers for EtherCAT/PROFINET |
| ⏳ | IF-04.2.1 | `[FW]` | TMNL system image overlay: NATS server (leaf mode), Bun runtime, systemd services |
| ⏳ | IF-04.2.2 | `[FW]` | Deployment mode configuration: entity count limits by tier (500+/500/200), JetStream retention |
| ⏳ | IF-04.2.3 | `[FW]` | BLE provisioning daemon: QR code pairing, mobile app handshake, initial configuration via BLE GATT |
| ⏳ | IF-04.2.4 | `[FW]` | LED status driver: power/status/network x 5 LEDs, factory reset button handler |
| ⏳ | IF-04.2.5 | `[FW]` | TPM 2.0 attestation daemon: device identity sealed in TPM (hardware TPM on QCS6490, OP-TEE TrustZone fallback on iMX8MP/AM62x), signed heartbeat generation at 60s intervals for DePIN Proof of Uptime. Heartbeat emitted on `tmnl.depin.attestation.<org_id>.<device_id>` per agreed interface with depin-architect. |
| ⏳ | IF-04.2.6 | `[FW]` | Power consumption reporter: current draw measurement via INA219/INA226 ADC, cross-referenced with claimed machine state for DePIN Proof of Capacity. Published on `tmnl.depin.power-state.<org_id>.<device_id>` per agreed interface with depin-architect. |
| ⏳ | IF-04.3.1 | `[DEVOPS]` | Firmware build pipeline: Yocto/TI SDK CI on GitHub Actions, artifact storage |
| ⏳ | IF-04.3.2 | `[DEVOPS]` | OTA update mechanism: A/B partition scheme, cryptographic signature verification, rollback |

**Dependencies**: IF-01 (hardware specs)
**RFC Sections**: S34.4, S34.17, S30.3.4 (DePIN attestation cross-ref)

---

### Epic IF-05: Gateway Firmware — 13 SP
| Status | Task | Category | Description |
|--------|------|----------|-------------|
| ⏳ | IF-05.1.1 | `[FW]` | ESP-IDF base project: ESP32-S3 initialization, Wi-Fi, Ethernet (W5500 SPI driver) |
| ⏳ | IF-05.1.2 | `[FW]` | Modbus RTU master: RS-485 driver, configurable baud/parity, register mapping |
| ⏳ | IF-05.1.3 | `[FW]` | Sparkplug-B MQTT client: Eclipse Paho or lightweight MQTT, Sparkplug-B payload encoding/decoding |
| ⏳ | IF-05.1.4 | `[FW]` | NATS leaf node client: lightweight NATS protocol implementation for ESP32 (pub/sub, JetStream ack) |
| ⏳ | IF-05.1.5 | `[FW]` | Telemetry buffer: flash-backed circular buffer for 24hr of readings during network outage |
| ⏳ | IF-05.1.6 | `[FW]` | Report-by-exception engine: configurable deadband per channel, 80-90% traffic reduction |
| ⏳ | IF-05.2.1 | `[FW]` | 4-20mA analog input driver: ADS1115 I2C, calibration table, signal conditioning |
| ⏳ | IF-05.2.2 | `[FW]` | BLE configuration: BLE GATT server for mobile app provisioning, sensor naming, range calibration |
| ⏳ | IF-05.2.3 | `[FW]` | OTA firmware update: USB-C DFU fallback + OTA via Wi-Fi/Ethernet from edge device |

**Dependencies**: IF-02 (gateway hardware)
**RFC Sections**: S34.5, S34.12

---

### Epic IF-06: Protocol Adapter Firmware — 16 SP
| Status | Task | Category | Description |
|--------|------|----------|-------------|
| ⏳ | IF-06.1.1 | `[FW]` | TMNL-ADA-OPC firmware: lightweight OPC UA client (open62541), node discovery, subscription, Sparkplug mapping |
| ⏳ | IF-06.1.2 | `[FW]` | TMNL-ADA-MTC firmware: HTTP client, MTConnect XML parser, auto-discovery via subnet scan |
| ⏳ | IF-06.1.3 | `[FW]` | TMNL-ADA-ENET firmware: EtherNet/IP CIP scanner, object discovery, Sparkplug mapping |
| ⏳ | IF-06.1.4 | `[FW]` | TMNL-ADA-PNET firmware: TI PRU-ICSS PROFINET packet inspection, passive tap mode, cyclic data extraction |
| ⏳ | IF-06.1.5 | `[FW]` | TMNL-ADA-BACNET firmware: BACnet/IP client, object discovery, Sparkplug topic mapping |
| ⏳ | IF-06.2.1 | `[FW]` | Machine profile library: pre-built Sparkplug mappings for FANUC, Haas, Mazak, Siemens, Allen-Bradley |
| ⏳ | IF-06.2.2 | `[FW]` | Auto-discovery engine: network scan for MTConnect agents, OPC UA endpoints, EtherNet/IP CIP objects |
| ⏳ | IF-06.2.3 | `[FW]` | Zero-configuration mapping: brand detection -> auto-apply Sparkplug profile within 60 seconds |

**Dependencies**: IF-03 (adapter hardware), IF-05 (Sparkplug protocol shared code)
**RFC Sections**: S34.6, S34.12

---

### Epic IF-07: Wireless Sensor Node Firmware — 13 SP
| Status | Task | Category | Description |
|--------|------|----------|-------------|
| ⏳ | IF-07.1.1 | `[FW]` | nRF5340 Zephyr base: BLE 5.3 + Thread stack, dual-core M33 initialization |
| ⏳ | IF-07.1.2 | `[FW]` | Accelerometer driver: ADXL345 SPI, FFT for vibration RMS, configurable sampling rate |
| ⏳ | IF-07.1.3 | `[FW]` | Temp/humidity driver: SHT40 I2C, calibration, report-by-exception |
| ⏳ | IF-07.1.4 | `[FW]` | BLE GATT sensor service: advertising, connection, characteristic notification to gateway/edge |
| ⏳ | IF-07.1.5 | `[FW]` | Power management: deep sleep scheduling, 2-5 year CR2477 battery life optimization |
| ⏳ | IF-07.2.1 | `[FW]` | nRF9160 cellular firmware: LTE-M/NB-IoT modem configuration, eSIM provisioning |
| ⏳ | IF-07.2.2 | `[FW]` | nRF9160 GNSS: GPS fix for location reporting, power-optimized periodic fix |
| ⏳ | IF-07.2.3 | `[FW]` | Cellular data plan integration: APN configuration, data budget management (2-5 MB/day) |

**Dependencies**: None (independent sensor platform)
**RFC Sections**: S34.7

---

## Phase 3: Device Management Software (Sprints 8-10) — 95 SP

### Epic IF-08: Device Provisioning & Fleet Management Service — 52 SP

**Entity Classification:**
| Entity | Tier | Rationale |
|--------|------|-----------|
| **Device** (edge/gateway/adapter/sensor) | **MACHINE** | State lifecycle: provisioned -> online -> offline -> faulted -> firmware_update -> decommissioned. Machine ALREADY EXISTS in WBS V1 (`DeviceMachine.ts`, `device-graph.ts`). V2 adds ES Handler, Entity, Observer layers. |
| **OtaDeployment** | **MACHINE** | State lifecycle: pending -> downloading -> flashing -> rebooting -> verified -> failed -> rolled_back |
| **FirmwareVersion** | **CRUD** | Immutable data record (version, hash, size, release_date) |
| **SensorCalibration** | **CRUD** | Config record (range, deadband, label, units) |

| Status | Task | Category | Description |
|--------|------|----------|-------------|
| | | | **--- Layer 1: Schema ---** |
| ⏳ | IF-08.1.1 | `[CODE]` | `DeviceSchema`: Effect Schema for edge devices, gateways, adapters, sensors (branded IDs, serial numbers, SKU) |
| ⏳ | IF-08.1.2 | `[CODE]` | `OtaDeploymentSchema`: Effect Schema — deployment_id, device_id, firmware_version_id, status (Literal states), started_at, completed_at |
| ⏳ | IF-08.1.3 | `[CODE]` | `FirmwareVersionSchema` + `SensorCalibrationSchema`: CRUD entity schemas |
| | | | **--- Layer 2: Model ---** |
| ⏳ | IF-08.2.1 | `[CODE]` | `DeviceModel` derivation: `NumericFromPg`, `OptionalMetadata`, `CreatedAt/UpdatedAt` transforms for list and detail views (follows `src/lib/iiot/models/_common.ts` pattern) |
| ⏳ | IF-08.2.2 | `[CODE]` | `OtaDeploymentModel` + `FirmwareVersionModel` + `SensorCalibrationModel` derivations |
| | | | **--- Layer 3: DDL ---** |
| ⏳ | IF-08.3.1 | `[CODE]` | Device DDL: `tmnl_devices`, `tmnl_firmware_versions`, `tmnl_ota_deployments`, `tmnl_sensor_calibrations` tables |
| | | | **--- Layer 4: Repository ---** |
| ⏳ | IF-08.4.1 | `[CODE]` | Device repository: CRUD with pagination, filtering by SKU/firmware/status |
| ⏳ | IF-08.4.2 | `[CODE]` | OtaDeployment repository + FirmwareVersion repository + SensorCalibration repository |
| | | | **--- Layer 5: Errors ---** |
| ⏳ | IF-08.5.1 | `[CODE]` | `DeviceErrors`: TaggedError types — `DeviceNotFoundError`, `DeviceValidationError`, `DeviceConflictError`, `ProvisioningError` + union `DeviceCommandError` |
| ⏳ | IF-08.5.2 | `[CODE]` | `OtaErrors`: TaggedError types — `OtaNotFoundError`, `OtaInvalidTransitionError`, `OtaRollbackError` + union `OtaCommandError` |
| ⏳ | IF-08.5.3 | `[CODE]` | `FleetErrors`: TaggedError types — `FleetNotFoundError`, `FleetLimitExceededError`, `TierConstraintError` + union `FleetCommandError` |
| | | | **--- Layer 6: L2 Service ---** |
| ⏳ | IF-08.6.1 | `[CODE]` | `DeviceService`: Effect service for device CRUD, registration, status tracking |
| ⏳ | IF-08.6.2 | `[CODE]` | `ProvisioningService`: BLE-based device onboarding flow — QR scan -> BLE pairing -> device registration -> auto-config |
| ⏳ | IF-08.6.3 | `[CODE]` | `FleetService`: Device inventory, firmware version tracking, health monitoring, deployment topology view |
| ⏳ | IF-08.6.4 | `[CODE]` | `OtaUpdateService`: Firmware distribution via NATS JetStream, version targeting, rollback triggers |
| | | | **--- Layer 7: Machine (MACHINE entities only) ---** |
| ⏳ | IF-08.7.1 | `[CODE]` | `OtaDeploymentMachine`: State machine — pending -> downloading -> flashing -> rebooting -> verified / failed -> rolled_back. Graph-validated transitions. |
| ⏳ | IF-08.7.2 | `[CODE]` | `ota-deployment-graph.ts`: Effect Graph.directed definition with state nodes and transition actions |
| | | | **--- Layer 8: ES Handler (MACHINE entities only) ---** |
| ⏳ | IF-08.8.1 | `[CODE]` | `DeviceHandler`: ES command handler — delegates to existing DeviceMachine, emits `DeviceStateChanged` events via EventLog (feature-flag gated) |
| ⏳ | IF-08.8.2 | `[CODE]` | `OtaDeploymentHandler`: ES command handler — delegates to OtaDeploymentMachine, emits `OtaStateChanged` events |
| | | | **--- Layer 9: Entity (MACHINE entities only) ---** |
| ⏳ | IF-08.9.1 | `[CODE]` | `DeviceEntity`: `Entity.make()` wiring DeviceMachine + DeviceHandler + RPC procedures (extends existing WBS V1 pattern) |
| ⏳ | IF-08.9.2 | `[CODE]` | `OtaDeploymentEntity`: `Entity.make()` wiring OtaDeploymentMachine + OtaHandler |
| | | | **--- Layer 10: Observer (MACHINE entities only) ---** |
| ⏳ | IF-08.10.1 | `[CODE]` | `DeviceObserver`: `makeEntityObserver('Device', machine.changes)` — scoped fiber subscribing to `Machine.changes` stream at entity activation. Uses `Stream.zipWithPrevious` to compute `{previousState, currentState, action}`. First emission has `Option.none()` for previous (handle as "initialized" action). Publishes `DeviceEntityStateChanged` to `iiot:entity-changes` channel (5th EventDistribution channel). **NOTE**: platform-architect owns observer infra (PL-07 makeEntityObserver factory, PL-08 handler wiring) — we register with it. |
| ⏳ | IF-08.10.2 | `[CODE]` | `OtaDeploymentObserver`: `makeEntityObserver('OtaDeployment', machine.changes)` — same pattern as DeviceObserver. Scoped fiber, `Stream.zipWithPrevious`, publishes `OtaEntityStateChanged` to `iiot:entity-changes` channel. |
| ⏳ | IF-08.10.3 | `[CODE]` | `DeviceEntityStateChangedSchema`: Effect Schema for `DeviceEntityStateChanged` event — `{entityType: 'Device', entityId, previousState: Option<DeviceState>, currentState: DeviceState, action: string, timestamp}` |
| ⏳ | IF-08.10.4 | `[CODE]` | `OtaEntityStateChangedSchema`: Effect Schema for `OtaEntityStateChanged` event — same shape with OTA-specific states |
| | | | **--- Layer 11: RPC Group ---** |
| ⏳ | IF-08.11.1 | `[CODE]` | `DeviceRpcs`: RPC group via `EntityProxy.toRpcGroup` — `Device.Get`, `Device.List`, `Device.Create`, `Device.GoOnline`, `Device.GoOffline`, `Device.MarkFaulted`, `Device.Decommission` |
| ⏳ | IF-08.11.2 | `[CODE]` | `OtaRpcs`: RPC group — `Ota.Deploy`, `Ota.GetStatus`, `Ota.Rollback`, `Ota.ListDeployments` |
| ⏳ | IF-08.11.3 | `[CODE]` | `FleetRpcs`: RPC group — `Fleet.ListDevices`, `Fleet.GetHealth`, `Fleet.TriggerOta`, `Fleet.GetFirmwareVersions` |
| | | | **--- Layer 12: HTTP Routes ---** |
| ⏳ | IF-08.12.1 | `[CODE]` | `DeviceHttpApi`: HTTP endpoints wrapping DeviceRpcs + FleetRpcs + OtaRpcs via `EntityProxy.toHttpApiGroup`, prefix `/api/devices` |
| | | | **--- Tests: Device (MACHINE — 6 SP) ---** |
| ⏳ | IF-08.T1.1 | `[CODE]` | `device-schema.test.ts`: Schema decode/encode roundtrip for Device, branded DeviceId, SKU validation |
| ⏳ | IF-08.T1.2 | `[CODE]` | `device-model.test.ts`: Model derivation — NumericFromPg transforms, computed display fields |
| ⏳ | IF-08.T1.3 | `[CODE]` | `device-ddl.test.ts`: DDL migration — table exists, constraints (unique serial_number, foreign keys) |
| ⏳ | IF-08.T1.4 | `[CODE]` | `device-repo.test.ts`: Repository integration — create -> read -> update -> delete, pagination, SKU/status filtering |
| ⏳ | IF-08.T1.5 | `[CODE]` | `device-errors.test.ts`: Error schema — each TaggedError variant decodes correctly, union type match |
| ⏳ | IF-08.T1.6 | `[CODE]` | `device-service.test.ts`: L2 service — registration, status tracking, validation rules |
| ⏳ | IF-08.T1.7 | `[CODE]` | `device-machine-transitions.test.ts`: Machine — every valid transition (provisioned->online, online->offline, online->faulted, etc.) |
| ⏳ | IF-08.T1.8 | `[CODE]` | `device-machine-invalid.test.ts`: Machine — every invalid transition rejected (provisioned->faulted, decommissioned->online, etc.) |
| ⏳ | IF-08.T1.9 | `[CODE]` | `device-handler.test.ts`: ES handler — command -> event emission -> state update, feature-flag gating |
| ⏳ | IF-08.T1.10 | `[CODE]` | `device-entity.test.ts`: Entity.make integration — cluster entity lifecycle, boot -> send -> respond |
| ⏳ | IF-08.T1.11 | `[CODE]` | `device-machine-changes.test.ts`: `Machine.changes` stream emission — trigger state transition, verify stream emits new state. Test `Stream.zipWithPrevious` yields `{previous: Option.none(), current}` on first emission and `{previous: Option.some(old), current: new}` on subsequent. |
| ⏳ | IF-08.T1.12 | `[CODE]` | `device-observer.test.ts`: Observer subscription — `makeEntityObserver` subscribes to `Machine.changes`, publishes `DeviceEntityStateChanged` to `iiot:entity-changes` channel. **NOTE**: Use `it()` + `Effect.runPromise`, NOT `it.effect()` (PubSub timeout issue) |
| ⏳ | IF-08.T1.13 | `[CODE]` | `device-observer-roundtrip.test.ts`: EventDistribution roundtrip — Device state change -> Observer -> `iiot:entity-changes` channel -> subscriber receives filtered event. Use `it()` + `Effect.runPromise`. |
| ⏳ | IF-08.T1.14 | `[CODE]` | `device-rpc.test.ts`: RPC roundtrip — client -> server -> response for all Device RPCs |
| ⏳ | IF-08.T1.15 | `[CODE]` | `device-http.test.ts`: HTTP endpoint — GET/POST/PUT/DELETE for /api/devices |
| | | | **--- Tests: OtaDeployment (MACHINE — 6 SP) ---** |
| ⏳ | IF-08.T2.1 | `[CODE]` | `ota-schema.test.ts`: Schema decode/encode roundtrip, branded OtaDeploymentId, status Literal validation |
| ⏳ | IF-08.T2.2 | `[CODE]` | `ota-model.test.ts`: Model derivation — computed fields, duration display |
| ⏳ | IF-08.T2.3 | `[CODE]` | `ota-repo.test.ts`: Repository integration — create -> read -> update, filtering by device_id/status |
| ⏳ | IF-08.T2.4 | `[CODE]` | `ota-errors.test.ts`: Error schema — OtaNotFoundError, OtaInvalidTransitionError, OtaRollbackError |
| ⏳ | IF-08.T2.5 | `[CODE]` | `ota-service.test.ts`: L2 service — version targeting, rollback triggers, JetStream distribution |
| ⏳ | IF-08.T2.6 | `[CODE]` | `ota-machine-transitions.test.ts`: Machine — all valid transitions (pending->downloading->flashing->rebooting->verified, pending->downloading->failed->rolled_back) |
| ⏳ | IF-08.T2.7 | `[CODE]` | `ota-machine-invalid.test.ts`: Machine — rejected transitions (verified->downloading, rolled_back->flashing, etc.) |
| ⏳ | IF-08.T2.8 | `[CODE]` | `ota-handler.test.ts`: ES handler — command -> OtaStateChanged event emission |
| ⏳ | IF-08.T2.9 | `[CODE]` | `ota-entity.test.ts`: Entity.make integration — cluster entity lifecycle |
| ⏳ | IF-08.T2.10 | `[CODE]` | `ota-machine-changes.test.ts`: `Machine.changes` stream emission — trigger OTA state transitions, verify `Stream.zipWithPrevious` yields correct previous/current pairs |
| ⏳ | IF-08.T2.11 | `[CODE]` | `ota-observer.test.ts`: Observer subscription — publishes `OtaEntityStateChanged` to `iiot:entity-changes`. Use `it()` + `Effect.runPromise` |
| ⏳ | IF-08.T2.12 | `[CODE]` | `ota-observer-roundtrip.test.ts`: EventDistribution roundtrip — OTA transition -> Observer -> channel -> subscriber. Use `it()` + `Effect.runPromise` |
| ⏳ | IF-08.T2.13 | `[CODE]` | `ota-rpc.test.ts`: RPC roundtrip — Ota.Deploy, Ota.GetStatus, Ota.Rollback |
| ⏳ | IF-08.T2.14 | `[CODE]` | `ota-http.test.ts`: HTTP endpoint tests |
| | | | **--- Tests: FirmwareVersion (CRUD — 2 SP) ---** |
| ⏳ | IF-08.T3.1 | `[CODE]` | `firmware-version-schema.test.ts`: Schema roundtrip, version string format validation |
| ⏳ | IF-08.T3.2 | `[CODE]` | `firmware-version-repo.test.ts`: Repository CRUD + version listing, hash uniqueness constraint |
| ⏳ | IF-08.T3.3 | `[CODE]` | `firmware-version-service.test.ts`: L2 service — version lookup, latest version queries |
| ⏳ | IF-08.T3.4 | `[CODE]` | `firmware-version-rpc.test.ts`: RPC roundtrip via Fleet.GetFirmwareVersions |
| | | | **--- Tests: SensorCalibration (CRUD — 2 SP) ---** |
| ⏳ | IF-08.T4.1 | `[CODE]` | `sensor-calibration-schema.test.ts`: Schema roundtrip, range/deadband validation |
| ⏳ | IF-08.T4.2 | `[CODE]` | `sensor-calibration-repo.test.ts`: Repository CRUD + device_id filtering |
| ⏳ | IF-08.T4.3 | `[CODE]` | `sensor-calibration-service.test.ts`: L2 service — calibration application, threshold learning |
| ⏳ | IF-08.T4.4 | `[CODE]` | `sensor-calibration-rpc.test.ts`: RPC roundtrip |

**Dependencies**: Existing `src/lib/iiot/` patterns (repos, services, schemas), existing `DeviceMachine.ts` + `device-graph.ts` from WBS V1
**RFC Sections**: S34.17
**E2E Stack Coverage**:
- Device: Schema ✅ | Model ✅ | DDL ✅ | Repo ✅ | Errors ✅ | L2 Svc ✅ | Machine ✅ (V1) | ES Handler ✅ | Entity ✅ | Observer ✅ (Machine.changes + EntityStateChanged schema) | RPC ✅ | HTTP ✅ | Streaming: see IF-09 | **Tests: 15 files (6 SP)** — incl. Machine.changes emission, observer subscription, EventDistribution roundtrip
- OtaDeployment: Schema ✅ | Model ✅ | DDL ✅ | Repo ✅ | Errors ✅ | L2 Svc ✅ | Machine ✅ | ES Handler ✅ | Entity ✅ | Observer ✅ (Machine.changes + EntityStateChanged schema) | RPC ✅ | HTTP ✅ | Streaming: see IF-09 | **Tests: 14 files (6 SP)** — incl. Machine.changes, observer, roundtrip
- FirmwareVersion: Schema ✅ | Model ✅ | DDL ✅ | Repo ✅ | Errors (shared) | L2 Svc (shared) | RPC (shared) | HTTP (shared) | **Tests: 4 files (2 SP)**
- SensorCalibration: Schema ✅ | Model ✅ | DDL ✅ | Repo ✅ | Errors (shared) | L2 Svc (shared) | RPC (shared) | HTTP (shared) | **Tests: 4 files (2 SP)**

---

### Epic IF-09: Device & Fleet Streaming RPCs + EventDistribution — 10 SP
| Status | Task | Category | Description |
|--------|------|----------|-------------|
| ⏳ | IF-09.1.1 | `[CODE]` | `SubscribeDeviceStatus`: Streaming RPC (`stream: true`) — real-time `DeviceStateChanged` events via EntityObserver, filterable by SKU/tier |
| ⏳ | IF-09.1.2 | `[CODE]` | `SubscribeOtaProgress`: Streaming RPC — real-time `OtaStateChanged` events per device (downloading/flashing/rebooting/verified/failed) |
| ⏳ | IF-09.1.3 | `[CODE]` | `SubscribeFleetHealth`: Streaming RPC — aggregate fleet health metrics (devices online, firmware distribution, error rates) |
| ⏳ | IF-09.2.1 | `[CODE]` | EventDistribution channel registration: Device + OTA entities publish `EntityStateChanged` events to the unified `iiot:entity-changes` channel (5th EventDistribution channel, maxLag 1k). **NOTE**: platform-architect defines channel infra; we register our entity types with it. No per-domain channel needed — all Machine entities share `iiot:entity-changes`. |
| ⏳ | IF-09.2.2 | `[CODE]` | Streaming RPC handler integration: wire `Stream.unwrap` pattern to bridge `iiot:entity-changes` channel (filtered by entityType='Device'/'OtaDeployment') to `RpcGroup.toLayer` (follows `src/lib/iiot/rpc/RealtimeRpcs.ts` pattern) |
| | | | **--- Tests: Streaming (2 SP) ---** |
| ⏳ | IF-09.T1.1 | `[CODE]` | `subscribe-device-status.test.ts`: Streaming RPC — subscribe, trigger Device state change, receive event. **NOTE**: Use `it()` + `Effect.runPromise` (PubSub timeout) |
| ⏳ | IF-09.T1.2 | `[CODE]` | `subscribe-ota-progress.test.ts`: Streaming RPC — subscribe, trigger OTA transition, receive progress events |
| ⏳ | IF-09.T1.3 | `[CODE]` | `subscribe-fleet-health.test.ts`: Streaming RPC — subscribe, verify aggregate metrics computation |
| ⏳ | IF-09.T1.4 | `[CODE]` | `device-event-distribution.test.ts`: E2E — Device state change -> Observer -> EventDistribution -> Streaming RPC roundtrip |

**Dependencies**: IF-08 (DeviceEntity, OtaDeploymentEntity, Observers)
**RFC Sections**: S34.17
**E2E Stack Coverage**: Streaming RPCs ✅ | EventDistribution ✅

---

### Epic IF-10: Deployment Topology Service — 8 SP

**Note**: `DeploymentMode` (T0/T1/T2/T3 tiers) is a **config constant** (Schema.Literal), NOT a persisted CRUD entity. It does not need Model/DDL/Repo/Errors/RPC/HTTP layers — it is consumed internally by `DeploymentTopologyService`.

| Status | Task | Category | Description |
|--------|------|----------|-------------|
| ⏳ | IF-10.1.1 | `[CODE]` | `DeploymentModeSchema`: Schema.Literal for T0/T1/T2/T3 tiers with capability constraints — config constant, not a persisted entity |
| ⏳ | IF-10.1.2 | `[CODE]` | `DeploymentTopologyService`: Maps hardware SKUs to software tiers, entity count limits, JetStream retention |
| ⏳ | IF-10.1.3 | `[CODE]` | Tier constraint enforcement: AM62x = 200 entities max, iMX8MP = 500, QCS6490 = 500+ |
| ⏳ | IF-10.2.1 | `[CODE]` | Network topology graph: Apache AGE nodes for devices, edges for network connections (Ethernet, Wi-Fi, mesh) |
| ⏳ | IF-10.2.2 | `[CODE]` | T0 client discovery: WebSocket endpoint registration, mobile app device list |

**Dependencies**: IF-08 (device schemas), existing graph infrastructure (DDL/AGE)
**RFC Sections**: S34.17, S15 cross-ref

---

### Epic IF-11: Mobile Provisioning App Backend — 8 SP
| Status | Task | Category | Description |
|--------|------|----------|-------------|
| ⏳ | IF-11.1.1 | `[CODE]` | BLE provisioning protocol: GATT service definition for device setup handshake |
| ⏳ | IF-11.1.2 | `[CODE]` | Sensor naming + calibration API: CRUD for sensor labels, range min/max, deadband config |
| ⏳ | IF-11.1.3 | `[CODE]` | Auto-discovery results endpoint: returns discovered MTConnect/OPC UA/EtherNet-IP devices |
| ⏳ | IF-11.1.4 | `[CODE]` | Real-time data preview: WebSocket stream for initial data verification ("see data flowing") |
| ⏳ | IF-11.2.1 | `[CODE]` | RPC group: `Provisioning.StartSetup`, `Provisioning.DiscoverDevices`, `Provisioning.ConfirmSensors` |
| ⏳ | IF-11.2.2 | `[CODE]` | Integration test: full provisioning flow from BLE scan to data flowing |

**Dependencies**: IF-08, existing RPC infrastructure
**RFC Sections**: S34.12 (installation scenarios)

---

### Epic IF-12: Deployment Kit Configuration — 17 SP

**Entity Classification:**
| Entity | Tier | Rationale |
|--------|------|-----------|
| **DeploymentKit** | **CRUD** | Configuration record — Earl's/Professional/Enterprise kits with component manifests, pricing, adapter mappings |

| Status | Task | Category | Description |
|--------|------|----------|-------------|
| | | | **--- Layer 1: Schema ---** |
| ⏳ | IF-12.1.1 | `[CODE]` | `DeploymentKitSchema`: Effect Schema — kit_id (branded), tier (Literal: 'earl' \| 'professional' \| 'enterprise'), price_usd, component_manifest (array of {sku, quantity, unit_price}), max_machines, protocols_supported |
| | | | **--- Layer 2: Model ---** |
| ⏳ | IF-12.2.1 | `[CODE]` | `DeploymentKitModel` derivation: `NumericFromPg` for pricing, computed total_components, formatted price display, protocol list summary |
| | | | **--- Layer 3: DDL ---** |
| ⏳ | IF-12.3.1 | `[CODE]` | DeploymentKit DDL: `tmnl_deployment_kits`, `tmnl_kit_components` tables with tier unique constraint |
| | | | **--- Layer 4: Repository ---** |
| ⏳ | IF-12.4.1 | `[CODE]` | DeploymentKit repository: CRUD with tier filtering, component manifest queries |
| | | | **--- Layer 5: Errors ---** |
| ⏳ | IF-12.5.1 | `[CODE]` | `DeploymentKitErrors`: TaggedError types — `KitNotFoundError`, `KitValidationError`, `KitConfigurationError` + union `KitCommandError` |
| | | | **--- Layer 6: L2 Service ---** |
| ⏳ | IF-12.6.1 | `[CODE]` | `DeploymentKitService`: Kit CRUD, configuration wizard logic — recommend kit based on machine count, protocol mix, compliance needs |
| ⏳ | IF-12.6.2 | `[CODE]` | Adapter auto-mapping: equipment tier (0-5) -> recommended adapter + gateway combination |
| ⏳ | IF-12.6.3 | `[CODE]` | `ThresholdLearningService`: 72-hour baseline learning, auto-suggest alarm thresholds |
| ⏳ | IF-12.6.4 | `[CODE]` | Auto-generated OEE dashboards: default views for cycle time, utilization, availability per machine |
| | | | **--- Layer 7: RPC Group ---** |
| ⏳ | IF-12.7.1 | `[CODE]` | `KitRpcs`: RPC group — `Kit.Get`, `Kit.List`, `Kit.Recommend`, `Kit.GetComponents`, `Kit.Configure` |
| | | | **--- Layer 8: HTTP Routes ---** |
| ⏳ | IF-12.8.1 | `[CODE]` | `KitHttpApi`: HTTP endpoints wrapping KitRpcs via `EntityProxy.toHttpApiGroup`, prefix `/api/kits` |
| | | | **--- Non-Entity Services ---** |
| ⏳ | IF-12.9.1 | `[CODE]` | Quick Start content: 7-step guided setup matching physical Quick Start Guide |
| ⏳ | IF-12.9.2 | `[CODE]` | Installation time tracker: measure and report "time to first data" for each deployment |
| | | | **--- Tests: DeploymentKit (CRUD — 2 SP) ---** |
| ⏳ | IF-12.T1.1 | `[CODE]` | `deployment-kit-schema.test.ts`: Schema decode/encode roundtrip, branded KitId, tier Literal validation |
| ⏳ | IF-12.T1.2 | `[CODE]` | `deployment-kit-model.test.ts`: Model derivation — pricing transforms, component counts |
| ⏳ | IF-12.T1.3 | `[CODE]` | `deployment-kit-repo.test.ts`: Repository CRUD + tier filtering, component manifest queries |
| ⏳ | IF-12.T1.4 | `[CODE]` | `deployment-kit-errors.test.ts`: Error schema — KitNotFoundError, KitValidationError |
| ⏳ | IF-12.T1.5 | `[CODE]` | `deployment-kit-service.test.ts`: L2 service — kit recommendation logic, adapter mapping |
| ⏳ | IF-12.T1.6 | `[CODE]` | `deployment-kit-rpc.test.ts`: RPC roundtrip — Kit.Get, Kit.List, Kit.Recommend |
| ⏳ | IF-12.T1.7 | `[CODE]` | `deployment-kit-http.test.ts`: HTTP endpoint — GET/POST /api/kits |

**Dependencies**: IF-08, IF-11
**RFC Sections**: S34.8, S34.12, S34.13.4
**E2E Stack Coverage**: DeploymentKit: Schema ✅ | Model ✅ | DDL ✅ | Repo ✅ | Errors ✅ | L2 Svc ✅ | RPC ✅ | HTTP ✅ | **Tests: 7 files (2 SP)**

---

## Phase 4: Reticulum Mesh Integration & Attestation (Sprints 11-14) — 98 SP

### Epic IF-13: Reticulum Transport Layer & Device Attestation — 64 SP

**Entity Classification:**
| Entity | Tier | Rationale |
|--------|------|-----------|
| **MeshNode** | **MACHINE** | State lifecycle: discovered -> announcing -> reachable -> unreachable -> expired. Nodes transition as they announce, respond, and go silent. |
| **ReticularBridge** | **MACHINE** | State lifecycle: initializing -> connected -> failover -> disconnected. Bridge transitions between transport interfaces. |

| Status | Task | Category | Description |
|--------|------|----------|-------------|
| | | | **--- Reticulum Infrastructure (non-entity) ---** |
| ⏳ | IF-13.1.1 | `[CODE]` | Reticulum Python installation + configuration on QCS6490 system image |
| ⏳ | IF-13.1.2 | `[CODE]` | RNode LoRa interface configuration: 915MHz, SX1262, SF7-SF12 adaptive selection |
| ⏳ | IF-13.1.3 | `[CODE]` | CBRS TCP/UDP interface: Reticulum over QCS6490 integrated 5G modem (Band n48/B48) |
| ⏳ | IF-13.1.4 | `[CODE]` | AutoInterface (LAN): Reticulum peer discovery over local Ethernet/Wi-Fi |
| | | | **--- Layer 1: Schema ---** |
| ⏳ | IF-13.2.1 | `[CODE]` | `MeshNodeSchema`: Effect Schema — node_id (branded), identity_hash, interfaces[], hop_count, last_announce, status (Literal states) |
| ⏳ | IF-13.2.2 | `[CODE]` | `ReticularBridgeSchema`: Effect Schema — bridge_id, local_endpoint, remote_identity, active_interface, status (Literal states), throughput_bps |
| | | | **--- Layer 2: Model ---** |
| ⏳ | IF-13.3.1 | `[CODE]` | `MeshNodeModel` derivation: Model transforms for mesh node list/detail views — identity hash, interface list, hop count, last seen |
| ⏳ | IF-13.3.2 | `[CODE]` | `ReticularBridgeModel` derivation: Model transforms for bridge status views — active interface, failover history, throughput |
| | | | **--- Layer 3: DDL ---** |
| ⏳ | IF-13.4.1 | `[CODE]` | Mesh DDL: `tmnl_mesh_nodes`, `tmnl_reticular_bridges`, `tmnl_mesh_path_table` tables |
| | | | **--- Layer 4: Repository ---** |
| ⏳ | IF-13.4.2 | `[CODE]` | MeshNode repository + ReticularBridge repository: CRUD with status filtering, path table queries |
| | | | **--- Layer 5: Errors ---** |
| ⏳ | IF-13.5.1 | `[CODE]` | `MeshNodeErrors`: TaggedError types — `MeshNodeNotFoundError`, `MeshNodeInvalidTransitionError`, `MeshPathError` + union `MeshNodeCommandError` |
| ⏳ | IF-13.5.2 | `[CODE]` | `BridgeErrors`: TaggedError types — `BridgeNotFoundError`, `BridgeInvalidTransitionError`, `BridgeConnectionError`, `IdentityError` + union `BridgeCommandError` |
| | | | **--- Layer 6: L2 Service ---** |
| ⏳ | IF-13.6.1 | `[CODE]` | `ReticulumIdentityService`: Effect service wrapping Reticulum Identity (X25519/Ed25519 key management) |
| ⏳ | IF-13.6.2 | `[CODE]` | Identity-to-NATS binding: map Reticulum identity hash to NATS account JWT |
| ⏳ | IF-13.6.3 | `[CODE]` | `DeviceAttestationService`: TPM-backed device signing for DePIN heartbeats — Ed25519 key sealed in TPM (hardware TPM 2.0 on QCS6490, OP-TEE TrustZone fallback on iMX8MP/AM62x), 60s signed heartbeat emission via NATS subject `tmnl.depin.attestation.<org_id>.<device_id>`. Heartbeat payload includes `tpmType: 'hardware' \| 'optee'` for trust tier differentiation. **Interface contract agreed with depin-architect (DP-25/DP-26).** |
| ⏳ | IF-13.6.4 | `[CODE]` | Variable-interval challenge response: handle Chainlink oracle challenges at random intervals via `tmnl.depin.challenge.<org_id>.<device_id>` (inbound), TPM-signed response via `tmnl.depin.challenge-response.<org_id>.<device_id>` (outbound) to prevent replay attacks |
| ⏳ | IF-13.6.5 | `[CODE]` | Hardware attestation: TPM Platform Configuration Register (PCR) measurement of firmware hash, reported in heartbeat `firmwareHash` field for fake node detection |
| ⏳ | IF-13.6.6 | `[CODE]` | Power-state cross-reference: correlate INA219 power draw data with claimed machine state, publish via `tmnl.depin.power-state.<org_id>.<device_id>` NATS subject. Multi-tenant `<org_id>` enables NATS JWT subject-based authorization per S21 isolation model. |
| ⏳ | IF-13.6.7 | `[CODE]` | `ReticulumTransportService`: Effect service for Transport Node operation (announce propagation, path table management) |
| ⏳ | IF-13.6.8 | `[CODE]` | Path table monitoring: expose path_table metrics (destination count, hop counts, interface stats) |
| ⏳ | IF-13.6.9 | `[CODE]` | `ReticularBridgeService`: TCP bridge — local 127.0.0.1:4222 <-> Reticulum Link to hub identity |
| ⏳ | IF-13.6.10 | `[CODE]` | TCP bridge failover: Ethernet -> CBRS -> LoRa path selection, automatic migration |
| ⏳ | IF-13.6.11 | `[CODE]` | LXMF message handler: store-and-forward for management commands, firmware notifications, alarm propagation |
| | | | **--- Layer 7: Machine (MACHINE entities only) ---** |
| ⏳ | IF-13.7.1 | `[CODE]` | `MeshNodeMachine`: State machine — discovered -> announcing -> reachable -> unreachable -> expired. Graph-validated announce/timeout transitions. |
| ⏳ | IF-13.7.2 | `[CODE]` | `mesh-node-graph.ts`: Effect Graph.directed definition — announce events drive reachable, timeout drives unreachable, TTL expiry drives expired |
| ⏳ | IF-13.7.3 | `[CODE]` | `ReticularBridgeMachine`: State machine — initializing -> connected -> failover -> disconnected. Interface-switch triggers failover transition. |
| ⏳ | IF-13.7.4 | `[CODE]` | `reticular-bridge-graph.ts`: Effect Graph.directed definition — connect/disconnect/failover transitions |
| | | | **--- Layer 8: ES Handler (MACHINE entities only) ---** |
| ⏳ | IF-13.8.1 | `[CODE]` | `MeshNodeHandler`: ES command handler — delegates to MeshNodeMachine, emits `MeshNodeStateChanged` events (feature-flag gated) |
| ⏳ | IF-13.8.2 | `[CODE]` | `BridgeHandler`: ES command handler — delegates to ReticularBridgeMachine, emits `BridgeStateChanged` events |
| | | | **--- Layer 9: Entity (MACHINE entities only) ---** |
| ⏳ | IF-13.9.1 | `[CODE]` | `MeshNodeEntity`: `Entity.make()` wiring MeshNodeMachine + MeshNodeHandler + RPC procedures |
| ⏳ | IF-13.9.2 | `[CODE]` | `ReticularBridgeEntity`: `Entity.make()` wiring ReticularBridgeMachine + BridgeHandler |
| | | | **--- Layer 10: Observer (MACHINE entities only) ---** |
| ⏳ | IF-13.10.1 | `[CODE]` | `MeshNodeObserver`: `makeEntityObserver('MeshNode', machine.changes)` — scoped fiber subscribing to `Machine.changes` stream at entity activation. Uses `Stream.zipWithPrevious` (NOT `Stream.pairwise`). First emission has `Option.none()` for previous (handle as "initialized" action). Publishes `MeshNodeEntityStateChanged` to `iiot:entity-changes` channel. |
| ⏳ | IF-13.10.2 | `[CODE]` | `BridgeObserver`: `makeEntityObserver('ReticularBridge', machine.changes)` — same pattern. Publishes `BridgeEntityStateChanged` to `iiot:entity-changes` channel. |
| ⏳ | IF-13.10.3 | `[CODE]` | `MeshNodeEntityStateChangedSchema`: Effect Schema — `{entityType: 'MeshNode', entityId, previousState: Option<MeshNodeState>, currentState: MeshNodeState, action: string, timestamp}` |
| ⏳ | IF-13.10.4 | `[CODE]` | `BridgeEntityStateChangedSchema`: Effect Schema — same shape with Bridge-specific states |
| | | | **--- Layer 11: RPC Group ---** |
| ⏳ | IF-13.11.1 | `[CODE]` | `MeshRpcs`: RPC group — `Mesh.GetNode`, `Mesh.ListNodes`, `Mesh.GetPathTable`, `Mesh.TriggerAnnounce`, `Mesh.ExpireNode` |
| ⏳ | IF-13.11.2 | `[CODE]` | `BridgeRpcs`: RPC group — `Bridge.GetStatus`, `Bridge.Connect`, `Bridge.Disconnect`, `Bridge.TriggerFailover` |
| | | | **--- Layer 12: HTTP Routes ---** |
| ⏳ | IF-13.12.1 | `[CODE]` | `MeshHttpApi`: HTTP endpoints wrapping MeshRpcs + BridgeRpcs via `EntityProxy.toHttpApiGroup`, prefix `/api/mesh` |
| | | | **--- Streaming + EventDistribution ---** |
| ⏳ | IF-13.13.1 | `[CODE]` | EventDistribution channel registration: MeshNode + ReticularBridge entities publish `EntityStateChanged` events to the unified `iiot:entity-changes` channel (5th EventDistribution channel). Streaming RPCs filter by `entityType='MeshNode'`/`'ReticularBridge'`. No per-domain channel needed. |
| ⏳ | IF-13.13.2 | `[CODE]` | `SubscribeMeshTopology`: Streaming RPC (`stream: true`) — real-time `MeshNodeStateChanged` events via MeshNodeObserver |
| ⏳ | IF-13.13.3 | `[CODE]` | `SubscribeBridgeMetrics`: Streaming RPC — real-time `BridgeStateChanged` events, failover events, latency per interface |
| | | | **--- Tests: MeshNode (MACHINE — 6 SP) ---** |
| ⏳ | IF-13.T1.1 | `[CODE]` | `mesh-node-schema.test.ts`: Schema decode/encode roundtrip, branded MeshNodeId, interfaces[] array validation |
| ⏳ | IF-13.T1.2 | `[CODE]` | `mesh-node-model.test.ts`: Model derivation — identity hash display, hop count formatting, last_seen human-readable |
| ⏳ | IF-13.T1.3 | `[CODE]` | `mesh-node-ddl.test.ts`: DDL migration — tables exist, identity_hash unique constraint, path_table foreign keys |
| ⏳ | IF-13.T1.4 | `[CODE]` | `mesh-node-repo.test.ts`: Repository integration — create -> read -> update -> delete, status filtering, path table queries |
| ⏳ | IF-13.T1.5 | `[CODE]` | `mesh-node-errors.test.ts`: Error schema — each MeshNodeError variant decodes correctly |
| ⏳ | IF-13.T1.6 | `[CODE]` | `mesh-node-service.test.ts`: L2 service — ReticulumTransportService announce propagation, path table management |
| ⏳ | IF-13.T1.7 | `[CODE]` | `mesh-node-machine-transitions.test.ts`: Machine — all valid transitions (discovered->announcing->reachable, reachable->unreachable->expired) |
| ⏳ | IF-13.T1.8 | `[CODE]` | `mesh-node-machine-invalid.test.ts`: Machine — rejected transitions (expired->reachable, discovered->expired without announce) |
| ⏳ | IF-13.T1.9 | `[CODE]` | `mesh-node-handler.test.ts`: ES handler — command -> MeshNodeStateChanged event emission, feature-flag gating |
| ⏳ | IF-13.T1.10 | `[CODE]` | `mesh-node-entity.test.ts`: Entity.make integration — cluster entity lifecycle, boot -> send -> respond |
| ⏳ | IF-13.T1.11 | `[CODE]` | `mesh-node-machine-changes.test.ts`: `Machine.changes` stream emission — trigger MeshNode transitions, verify `Stream.zipWithPrevious` yields correct previous/current state pairs with `Option.none()` on first |
| ⏳ | IF-13.T1.12 | `[CODE]` | `mesh-node-observer.test.ts`: Observer subscription — publishes `MeshNodeEntityStateChanged` to `iiot:entity-changes`. Use `it()` + `Effect.runPromise` |
| ⏳ | IF-13.T1.13 | `[CODE]` | `mesh-node-observer-roundtrip.test.ts`: EventDistribution roundtrip — node transition -> Observer -> channel -> subscriber. Use `it()` + `Effect.runPromise` |
| ⏳ | IF-13.T1.14 | `[CODE]` | `mesh-node-rpc.test.ts`: RPC roundtrip — Mesh.GetNode, Mesh.ListNodes, Mesh.GetPathTable, Mesh.TriggerAnnounce |
| ⏳ | IF-13.T1.15 | `[CODE]` | `mesh-node-http.test.ts`: HTTP endpoint — /api/mesh GET/POST routes |
| ⏳ | IF-13.T1.16 | `[CODE]` | `subscribe-mesh-topology.test.ts`: Streaming RPC — subscribe, trigger node state change, receive event. Use `it()` + `Effect.runPromise` |
| | | | **--- Tests: ReticularBridge (MACHINE — 4 SP) ---** |
| ⏳ | IF-13.T2.1 | `[CODE]` | `bridge-schema.test.ts`: Schema decode/encode roundtrip, branded BridgeId, status Literal validation |
| ⏳ | IF-13.T2.2 | `[CODE]` | `bridge-model.test.ts`: Model derivation — active interface display, throughput formatting |
| ⏳ | IF-13.T2.3 | `[CODE]` | `bridge-repo.test.ts`: Repository CRUD + status filtering |
| ⏳ | IF-13.T2.4 | `[CODE]` | `bridge-errors.test.ts`: Error schema — BridgeNotFoundError, BridgeInvalidTransitionError, BridgeConnectionError |
| ⏳ | IF-13.T2.5 | `[CODE]` | `bridge-service.test.ts`: L2 service — ReticularBridgeService TCP bridge, failover logic |
| ⏳ | IF-13.T2.6 | `[CODE]` | `bridge-machine-transitions.test.ts`: Machine — all valid transitions (initializing->connected, connected->failover->connected, connected->disconnected) |
| ⏳ | IF-13.T2.7 | `[CODE]` | `bridge-machine-invalid.test.ts`: Machine — rejected transitions (disconnected->failover, initializing->disconnected) |
| ⏳ | IF-13.T2.8 | `[CODE]` | `bridge-handler.test.ts`: ES handler — command -> BridgeStateChanged event emission |
| ⏳ | IF-13.T2.9 | `[CODE]` | `bridge-entity.test.ts`: Entity.make integration — cluster entity lifecycle |
| ⏳ | IF-13.T2.10 | `[CODE]` | `bridge-machine-changes.test.ts`: `Machine.changes` stream emission — trigger bridge transitions, verify `Stream.zipWithPrevious` pairs |
| ⏳ | IF-13.T2.11 | `[CODE]` | `bridge-observer.test.ts`: Observer subscription — publishes `BridgeEntityStateChanged` to `iiot:entity-changes`. Use `it()` + `Effect.runPromise` |
| ⏳ | IF-13.T2.12 | `[CODE]` | `bridge-observer-roundtrip.test.ts`: EventDistribution roundtrip. Use `it()` + `Effect.runPromise` |
| ⏳ | IF-13.T2.13 | `[CODE]` | `bridge-rpc.test.ts`: RPC roundtrip — Bridge.GetStatus, Bridge.Connect, Bridge.Disconnect, Bridge.TriggerFailover |
| ⏳ | IF-13.T2.14 | `[CODE]` | `subscribe-bridge-metrics.test.ts`: Streaming RPC — subscribe, trigger failover, receive event |
| | | | **--- Tests: Infrastructure Integration (2 SP) ---** |
| ⏳ | IF-13.T3.1 | `[CODE]` | `reticulum-nats-bridge.test.ts`: NATS pub/sub over Reticulum link (LoRa interface, simulated) |
| ⏳ | IF-13.T3.2 | `[CODE]` | `bridge-failover-e2e.test.ts`: TCP bridge failover from Ethernet to CBRS to LoRa, verify NATS continuity |

**Dependencies**: IF-04 (system image)
**RFC Sections**: S35.4, S35.9
**E2E Stack Coverage**:
- MeshNode: Schema ✅ | Model ✅ | DDL ✅ | Repo ✅ | Errors ✅ | L2 Svc ✅ | Machine ✅ | ES Handler ✅ | Entity ✅ | Observer ✅ (Machine.changes + EntityStateChanged schema) | RPC ✅ | HTTP ✅ | Streaming ✅ | EventDistribution ✅ (`iiot:entity-changes`) | **Tests: 16 files (6 SP)** — incl. Machine.changes, observer, roundtrip
- ReticularBridge: Schema ✅ | Model ✅ | DDL ✅ | Repo ✅ | Errors ✅ | L2 Svc ✅ | Machine ✅ | ES Handler ✅ | Entity ✅ | Observer ✅ (Machine.changes + EntityStateChanged schema) | RPC ✅ | HTTP ✅ | Streaming ✅ | EventDistribution ✅ (`iiot:entity-changes`) | **Tests: 14 files (4 SP)** — incl. Machine.changes, observer, roundtrip

---

### Epic IF-14: SAS Client & CBRS Management — 13 SP
| Status | Task | Category | Description |
|--------|------|----------|-------------|
| ⏳ | IF-14.1.1 | `[CODE]` | `SasClientService`: Effect service for SAS registration, heartbeat, frequency assignment |
| ⏳ | IF-14.1.2 | `[CODE]` | SAS auto-registration: GPS fix -> device location -> SAS API registration on first boot |
| ⏳ | IF-14.1.3 | `[CODE]` | SAS heartbeat daemon: periodic check-in, power control compliance, channel reassignment |
| ⏳ | IF-14.1.4 | `[CODE]` | SAS provider abstraction: support Google SAS, Federated Wireless, CommScope via pluggable adapter |
| ⏳ | IF-14.2.1 | `[RF]` | CBRS antenna characterization: QCS6490 integrated antenna vs external panel (gain, pattern, penetration loss) |
| ⏳ | IF-14.2.2 | `[RF]` | CBRS link budget analysis: 1W EIRP Cat A, path loss models (eHata urban/suburban), margin calculation |
| ⏳ | IF-14.2.3 | `[RF]` | CBRS interference assessment: GAA coexistence with PAL holders in Atlanta metro |
| ⏳ | IF-14.3.1 | `[CODE]` | Integration test: SAS registration -> heartbeat -> frequency assignment -> CBRS data transfer |

**Dependencies**: IF-13 (Reticulum CBRS interface)
**RFC Sections**: S35.5

---

### Epic IF-15: Mesh Network Operating Modes — 8 SP
| Status | Task | Category | Description |
|--------|------|----------|-------------|
| ⏳ | IF-15.1.1 | `[CODE]` | `NetworkModeService`: ISP-Primary, Mesh-Primary, Mesh-Only mode detection and switching |
| ⏳ | IF-15.1.2 | `[CODE]` | ISP health monitor: detect ISP outage within 200ms, trigger CBRS failover |
| ⏳ | IF-15.1.3 | `[CODE]` | Graceful migration: switch NATS traffic from ISP to mesh (and back) without connection drop |
| ⏳ | IF-15.1.4 | `[CODE]` | CBRS power management: sleep after 60s idle, wake on NATS traffic demand, LoRa-triggered wake |
| ⏳ | IF-15.2.1 | `[CODE]` | Hybrid topology orchestrator: LoRa discovers path -> CBRS activates for data -> CBRS sleeps when idle |
| ⏳ | IF-15.2.2 | `[CODE]` | Hop count optimization: prefer ISP when mesh hop count > 5, adaptive threshold |
| ⏳ | IF-15.3.1 | `[CODE]` | Integration test: ISP drop -> mesh failover -> ISP recovery -> graceful return |

**Dependencies**: IF-13, IF-14
**RFC Sections**: S35.3, S35.7

---

### Epic IF-16: LoRa Control Plane — 13 SP
| Status | Task | Category | Description |
|--------|------|----------|-------------|
| ⏳ | IF-16.1.1 | `[RF]` | RNode configuration: Heltec LoRa32 v3 / RAK4631 USB integration with QCS6490 carrier board |
| ⏳ | IF-16.1.2 | `[RF]` | LoRa parameter optimization: spreading factor selection (SF7-SF12), bandwidth (125/250/500 kHz), adaptive based on link quality |
| ⏳ | IF-16.1.3 | `[RF]` | External antenna design: 3 dBi omnidirectional whip (standard), 6-8 dBi fiberglass collinear (extended range) |
| ⏳ | IF-16.2.1 | `[CODE]` | LoRa announce scheduler: Reticulum announce broadcasting, rate limiting, hop count prioritization |
| ⏳ | IF-16.2.2 | `[CODE]` | Path discovery metrics: track path quality, hop count, last-seen timestamp per destination |
| ⏳ | IF-16.2.3 | `[CODE]` | Keepalive at 0.44 bps: minimal power consumption for always-on topology awareness |
| ⏳ | IF-16.3.1 | `[RF]` | Atlanta MSA propagation validation: field test LoRa range in I-85 NE corridor (urban/suburban/industrial) |
| ⏳ | IF-16.3.2 | `[RF]` | EMI resilience testing: LoRa performance near welding stations, VFDs, induction heaters |

**Dependencies**: IF-13
**RFC Sections**: S35.6, S35.8

---

## Phase 5: DePIN Relay & Coverage (Sprints 15-17) — 67 SP

### Epic IF-17: Proof-of-Relay Receipt System — 54 SP

**Entity Classification:**
| Entity | Tier | Rationale |
|--------|------|-----------|
| **RewardBatch** | **MACHINE** | State lifecycle: pending -> submitted -> verified -> distributed / disputed. On-chain settlement drives state transitions. |
| **RelayReceipt** | **CRUD** | Immutable append-only record (signed receipt per relayed packet) |
| **EpochSummary** | **CRUD** | Computed aggregate (merkle root, totals per epoch) |

| Status | Task | Category | Description |
|--------|------|----------|-------------|
| | | | **--- Layer 1: Schema ---** |
| ⏳ | IF-17.1.1 | `[CODE]` | `RelayReceiptSchema`: Effect Schema for relay receipts (relay_node_id, source_hash, dest_hash, bytes_forwarded, hop_number, Ed25519 signature) |
| ⏳ | IF-17.1.2 | `[CODE]` | `EpochSummarySchema`: Effect Schema — epoch_id, total_bytes, unique_sources, unique_dests, merkle_root, created_at |
| ⏳ | IF-17.1.3 | `[CODE]` | `RewardBatchSchema`: Effect Schema — batch_id (branded), epoch_id, merkle_root, total_rewards, status (Literal states), submitted_at, verified_at, distributed_at |
| | | | **--- Layer 2: Model ---** |
| ⏳ | IF-17.2.1 | `[CODE]` | `RelayReceiptModel` derivation: Model transforms for receipt list/detail views — `NumericFromPg` for bytes_forwarded, epoch timestamp formatting |
| ⏳ | IF-17.2.2 | `[CODE]` | `EpochSummaryModel` derivation: total_bytes display, merkle_root truncation |
| ⏳ | IF-17.2.3 | `[CODE]` | `RewardBatchModel` derivation: Model transforms for batch status views — reward totals, claim counts, settlement tx hash |
| | | | **--- Layer 3: DDL ---** |
| ⏳ | IF-17.3.1 | `[CODE]` | Receipt DDL: `tmnl_relay_receipts`, `tmnl_epoch_summaries`, `tmnl_reward_batches`, `tmnl_reward_claims` (PostgreSQL/ClickHouse) |
| | | | **--- Layer 4: Repository ---** |
| ⏳ | IF-17.4.1 | `[CODE]` | Relay receipt repository: CRUD + epoch queries, signature-verified reads, pagination by relay_node_id |
| ⏳ | IF-17.4.2 | `[CODE]` | EpochSummary repository + RewardBatch repository: CRUD + status filtering |
| | | | **--- Layer 5: Errors ---** |
| ⏳ | IF-17.5.1 | `[CODE]` | `RelayReceiptErrors`: TaggedError types — `ReceiptNotFoundError`, `ReceiptValidationError`, `EpochAggregationError` + union `ReceiptCommandError` |
| ⏳ | IF-17.5.2 | `[CODE]` | `RewardBatchErrors`: TaggedError types — `BatchNotFoundError`, `BatchInvalidTransitionError`, `SettlementError`, `RewardCalculationError`, `ClaimError` + union `BatchCommandError` |
| | | | **--- Layer 6: L2 Service ---** |
| ⏳ | IF-17.6.1 | `[CODE]` | `RelayReceiptService`: Generate, sign, and store receipts per relayed Reticulum packet |
| ⏳ | IF-17.6.2 | `[CODE]` | Receipt storage: LevelDB local store indexed by epoch/source/dest/relay_node_id (SQLite fallback) |
| ⏳ | IF-17.6.3 | `[CODE]` | `EpochAggregatorService`: Compute epoch_summary at UTC midnight — total_bytes, unique_sources, unique_dests, merkle_root |
| ⏳ | IF-17.6.4 | `[CODE]` | Merkle tree construction: SHA-256 Merkle root over all receipt hashes per epoch |
| ⏳ | IF-17.6.5 | `[CODE]` | Epoch summary NATS publication: `tmnl.depin.receipts.submit.<relay_node_id>` |
| ⏳ | IF-17.6.6 | `[CODE]` | Hub receipt aggregator: receive, validate signatures, cross-reference with destination received_from tables |
| ⏳ | IF-17.6.7 | `[CODE]` | Plausibility checker: flag anomalies > 3sigma in bytes_forwarded relative to traffic patterns |
| ⏳ | IF-17.6.8 | `[CODE]` | `RewardCalculatorService`: Apply reward formula — base_rate x temporal x relay_volume(log2) x uptime x coverage x hop_weight |
| ⏳ | IF-17.6.9 | `[CODE]` | Coverage bonus classification: map relay location to coverage zone (industrial corridor, urban, suburban, rural) |
| ⏳ | IF-17.6.10 | `[CODE]` | Temporal decay: `max(1.0, 3.0 x e^(-0.03 x month))` based on node join date |
| ⏳ | IF-17.6.11 | `[CODE]` | `SettlementBridgeService`: Interface contract — submitRewardBatch, claimReward, getRewardParameters, getUnclaimedBalance |
| ⏳ | IF-17.6.12 | `[CODE]` | Weekly batch settlement: Merkle tree of all rewards, single on-chain transaction per settlement interval |
| ⏳ | IF-17.6.13 | `[CODE]` | Individual claim mechanism: relay submits Merkle proof to claim reward from verified batch |
| | | | **--- Layer 7: Machine (RewardBatch only) ---** |
| ⏳ | IF-17.7.1 | `[CODE]` | `RewardBatchMachine`: State machine — pending -> submitted -> verified -> distributed / disputed. On-chain tx confirmation drives verified->distributed. |
| ⏳ | IF-17.7.2 | `[CODE]` | `reward-batch-graph.ts`: Effect Graph.directed definition — submit/verify/distribute/dispute transitions |
| | | | **--- Layer 8: ES Handler (RewardBatch only) ---** |
| ⏳ | IF-17.8.1 | `[CODE]` | `RewardBatchHandler`: ES command handler — delegates to RewardBatchMachine, emits `RewardBatchStateChanged` events |
| | | | **--- Layer 9: Entity (RewardBatch only) ---** |
| ⏳ | IF-17.9.1 | `[CODE]` | `RewardBatchEntity`: `Entity.make()` wiring RewardBatchMachine + RewardBatchHandler + RPC procedures |
| | | | **--- Layer 10: Observer (RewardBatch only) ---** |
| ⏳ | IF-17.10.1 | `[CODE]` | `RewardBatchObserver`: `makeEntityObserver('RewardBatch', machine.changes)` — scoped fiber subscribing to `Machine.changes` stream at entity activation. Uses `Stream.zipWithPrevious` (NOT `Stream.pairwise`). First emission has `Option.none()` for previous. Publishes `RewardBatchEntityStateChanged` to `iiot:entity-changes` channel. |
| ⏳ | IF-17.10.2 | `[CODE]` | `RewardBatchEntityStateChangedSchema`: Effect Schema — `{entityType: 'RewardBatch', entityId, previousState: Option<RewardBatchState>, currentState: RewardBatchState, action: string, timestamp}` |
| | | | **--- Layer 11: RPC Group ---** |
| ⏳ | IF-17.11.1 | `[CODE]` | `RelayRpcs`: RPC group — `Relay.GetReceipt`, `Relay.ListReceipts`, `Relay.GetEpochSummary`, `Relay.ListEpochs` |
| ⏳ | IF-17.11.2 | `[CODE]` | `RewardBatchRpcs`: RPC group — `Batch.Submit`, `Batch.GetStatus`, `Batch.Claim`, `Batch.ListBatches`, `Batch.Dispute` |
| | | | **--- Layer 12: HTTP Routes ---** |
| ⏳ | IF-17.12.1 | `[CODE]` | `RelayHttpApi`: HTTP endpoints wrapping RelayRpcs + RewardBatchRpcs via `EntityProxy.toHttpApiGroup`, prefix `/api/relay` |
| | | | **--- Streaming + EventDistribution ---** |
| ⏳ | IF-17.13.1 | `[CODE]` | EventDistribution channel registration: RewardBatch entity publishes `EntityStateChanged` events to the unified `iiot:entity-changes` channel (5th EventDistribution channel). Streaming RPCs filter by `entityType='RewardBatch'`. |
| ⏳ | IF-17.13.2 | `[CODE]` | `SubscribeRelayMetrics`: Streaming RPC (`stream: true`) — real-time relay receipt count, bytes forwarded, reward accumulation per node |
| ⏳ | IF-17.13.3 | `[CODE]` | `SubscribeEpochProgress`: Streaming RPC — current epoch receipt count, estimated merkle root, countdown to aggregation |
| ⏳ | IF-17.13.4 | `[CODE]` | `SubscribeBatchSettlement`: Streaming RPC — real-time `RewardBatchStateChanged` events via RewardBatchObserver |
| | | | **--- Anti-Gaming ---** |
| ⏳ | IF-17.14.1 | `[CODE]` | Anti-gaming: logarithmic volume scaling (log2), invalid path rejection, self-relay detection |
| | | | **--- Tests: RewardBatch (MACHINE — 4 SP) ---** |
| ⏳ | IF-17.T1.1 | `[CODE]` | `reward-batch-schema.test.ts`: Schema decode/encode roundtrip, branded BatchId, status Literal validation |
| ⏳ | IF-17.T1.2 | `[CODE]` | `reward-batch-model.test.ts`: Model derivation — reward totals display, claim counts, settlement tx hash |
| ⏳ | IF-17.T1.3 | `[CODE]` | `reward-batch-repo.test.ts`: Repository CRUD + status filtering, epoch queries |
| ⏳ | IF-17.T1.4 | `[CODE]` | `reward-batch-errors.test.ts`: Error schema — BatchNotFoundError, BatchInvalidTransitionError, SettlementError, ClaimError |
| ⏳ | IF-17.T1.5 | `[CODE]` | `reward-batch-service.test.ts`: L2 service — reward calculation formula, coverage bonus, temporal decay |
| ⏳ | IF-17.T1.6 | `[CODE]` | `reward-batch-machine-transitions.test.ts`: Machine — all valid transitions (pending->submitted->verified->distributed, pending->submitted->disputed) |
| ⏳ | IF-17.T1.7 | `[CODE]` | `reward-batch-machine-invalid.test.ts`: Machine — rejected transitions (distributed->pending, verified->submitted) |
| ⏳ | IF-17.T1.8 | `[CODE]` | `reward-batch-handler.test.ts`: ES handler — command -> RewardBatchStateChanged event emission |
| ⏳ | IF-17.T1.9 | `[CODE]` | `reward-batch-entity.test.ts`: Entity.make integration — cluster entity lifecycle |
| ⏳ | IF-17.T1.10 | `[CODE]` | `reward-batch-machine-changes.test.ts`: `Machine.changes` stream emission — trigger RewardBatch transitions, verify `Stream.zipWithPrevious` pairs |
| ⏳ | IF-17.T1.11 | `[CODE]` | `reward-batch-observer.test.ts`: Observer subscription — publishes `RewardBatchEntityStateChanged` to `iiot:entity-changes`. Use `it()` + `Effect.runPromise` |
| ⏳ | IF-17.T1.12 | `[CODE]` | `reward-batch-observer-roundtrip.test.ts`: EventDistribution roundtrip — batch transition -> Observer -> channel -> subscriber. Use `it()` + `Effect.runPromise` |
| ⏳ | IF-17.T1.13 | `[CODE]` | `reward-batch-rpc.test.ts`: RPC roundtrip — Batch.Submit, Batch.GetStatus, Batch.Claim, Batch.Dispute |
| ⏳ | IF-17.T1.14 | `[CODE]` | `subscribe-batch-settlement.test.ts`: Streaming RPC — subscribe, trigger batch transition, receive event |
| | | | **--- Tests: RelayReceipt (CRUD — 3 SP) ---** |
| ⏳ | IF-17.T2.1 | `[CODE]` | `relay-receipt-schema.test.ts`: Schema decode/encode roundtrip, Ed25519 signature field validation |
| ⏳ | IF-17.T2.2 | `[CODE]` | `relay-receipt-model.test.ts`: Model derivation — bytes_forwarded display, epoch timestamp formatting |
| ⏳ | IF-17.T2.3 | `[CODE]` | `relay-receipt-repo.test.ts`: Repository CRUD + epoch queries, signature-verified reads, pagination by relay_node_id |
| ⏳ | IF-17.T2.4 | `[CODE]` | `relay-receipt-errors.test.ts`: Error schema — ReceiptNotFoundError, ReceiptValidationError |
| ⏳ | IF-17.T2.5 | `[CODE]` | `relay-receipt-service.test.ts`: L2 service — receipt generation, signature verification, storage |
| ⏳ | IF-17.T2.6 | `[CODE]` | `relay-receipt-rpc.test.ts`: RPC roundtrip — Relay.GetReceipt, Relay.ListReceipts |
| ⏳ | IF-17.T2.7 | `[CODE]` | `relay-receipt-http.test.ts`: HTTP endpoint — GET /api/relay/receipts |
| | | | **--- Tests: EpochSummary (CRUD — 2 SP) ---** |
| ⏳ | IF-17.T3.1 | `[CODE]` | `epoch-summary-schema.test.ts`: Schema decode/encode roundtrip, merkle_root format validation |
| ⏳ | IF-17.T3.2 | `[CODE]` | `epoch-summary-repo.test.ts`: Repository CRUD + epoch listing |
| ⏳ | IF-17.T3.3 | `[CODE]` | `epoch-summary-service.test.ts`: L2 service — EpochAggregator midnight computation, Merkle tree construction |
| ⏳ | IF-17.T3.4 | `[CODE]` | `epoch-summary-rpc.test.ts`: RPC roundtrip — Relay.GetEpochSummary, Relay.ListEpochs |
| | | | **--- Tests: E2E Integration (2 SP) ---** |
| ⏳ | IF-17.T4.1 | `[CODE]` | `relay-receipt-to-reward.test.ts`: E2E — receipt generation -> aggregation -> reward calculation -> settlement batch |
| ⏳ | IF-17.T4.2 | `[CODE]` | `anti-gaming.test.ts`: Anti-gaming — log2 volume scaling, self-relay detection, invalid path rejection |
| ⏳ | IF-17.T4.3 | `[CODE]` | `plausibility-checker.test.ts`: Plausibility — 3sigma anomaly detection in bytes_forwarded |

**Dependencies**: IF-13 (Reticulum relay), DP-25/DP-26 (depin-architect for token economics, Merkle batching, reward distribution)
**RFC Sections**: S35.11
**E2E Stack Coverage**:
- RewardBatch: Schema ✅ | Model ✅ | DDL ✅ | Repo ✅ | Errors ✅ | L2 Svc ✅ | Machine ✅ | ES Handler ✅ | Entity ✅ | Observer ✅ (Machine.changes + EntityStateChanged schema) | RPC ✅ | HTTP ✅ | Streaming ✅ | EventDistribution ✅ (`iiot:entity-changes`) | **Tests: 14 files (4 SP)** — incl. Machine.changes, observer, roundtrip
- RelayReceipt: Schema ✅ | Model ✅ | DDL ✅ | Repo ✅ | Errors ✅ | L2 Svc ✅ | RPC ✅ | HTTP ✅ | **Tests: 7 files (3 SP)**
- EpochSummary: Schema ✅ | Model ✅ | DDL ✅ | Repo ✅ | Errors (shared) | L2 Svc ✅ | RPC ✅ | HTTP ✅ | **Tests: 4 files (2 SP)**

---

### Epic IF-18: Seed Network Deployment — 13 SP
| Status | Task | Category | Description |
|--------|------|----------|-------------|
| ⏳ | IF-18.1.1 | `[DEVOPS]` | Seed node configuration: QCS6490 edge + RNode + external 6-8 dBi antenna per site |
| ⏳ | IF-18.1.2 | `[DEVOPS]` | Seed node site selection: 20-30 elevated locations in I-85 NE corridor (water towers, industrial park offices, coworking) |
| ⏳ | IF-18.1.3 | `[DEVOPS]` | Seed node deployment automation: Ansible playbook for system image + Reticulum Transport Node + SAS registration |
| ⏳ | IF-18.2.1 | `[RF]` | Coverage validation: drive-test LoRa RSSI mapping across I-85 NE corridor post-seed deployment |
| ⏳ | IF-18.2.2 | `[RF]` | CBRS coverage mapping: data throughput measurements between seed nodes at varying distances |
| ⏳ | IF-18.3.1 | `[CODE]` | Mesh monitoring dashboard: real-time topology visualization, node status, path quality, relay metrics |
| ⏳ | IF-18.3.2 | `[CODE]` | Network health alerting: node offline detection, coverage gap identification, SAS heartbeat failure |
| ⏳ | IF-18.3.3 | `[DEVOPS]` | Seed node remote management: SSH over Reticulum, remote firmware update, log collection |
| ⏳ | IF-18.4.1 | `[CODE]` | Coverage modeling validation: compare actual propagation with predicted (eHata, ITM) per zone |

**Dependencies**: IF-13, IF-14, IF-16
**RFC Sections**: S35.8, S35.14

---

## Phase 6: Certification & Manufacturing (Sprints 18-21) — 34 SP

### Epic IF-19: Regulatory Certification — 13 SP
| Status | Task | Category | Description |
|--------|------|----------|-------------|
| ⏳ | IF-19.1.1 | `[MFG]` | FCC Part 15 testing: EMC + radio emissions for edge device (all 3 variants) + gateway (all 3 variants) |
| ⏳ | IF-19.1.2 | `[MFG]` | FCC Part 96 compliance: CBRS Cat A CBSD certification for QCS6490 modem configuration |
| ⏳ | IF-19.1.3 | `[MFG]` | CE (RED + LVD + EMC): EU radio, safety, EMC testing |
| ⏳ | IF-19.1.4 | `[MFG]` | UL/cUL 62368-1: Product safety certification for edge device |
| ⏳ | IF-19.1.5 | `[MFG]` | IC (Canada): Radio emissions testing (alongside FCC) |
| ⏳ | IF-19.1.6 | `[MFG]` | RoHS / REACH: Hazardous substances compliance documentation |
| ⏳ | IF-19.2.1 | `[MFG]` | Environmental testing: IEC 60068-2-6 vibration (5-500Hz, 2g), IEC 60068-2-27 shock (30g), temperature cycling -40C to +70C |
| ⏳ | IF-19.2.2 | `[MFG]` | IP rating validation: IP40 base, IP65 factory floor variant, IP67 washdown variant |
| ⏳ | IF-19.2.3 | `[MFG]` | EMC/EMI testing: IEC 61000-4 series (ESD, RF immunity, burst, surge, conducted) |

**Dependencies**: IF-01 (finalized hardware)
**RFC Sections**: S34.15

---

### Epic IF-20: Manufacturing Pipeline — 13 SP
| Status | Task | Category | Description |
|--------|------|----------|-------------|
| ⏳ | IF-20.1.1 | `[MFG]` | EVT: 20-50 units in-house/prototype, 100% manual test, design iteration |
| ⏳ | IF-20.1.2 | `[MFG]` | DVT: 100-500 units at contract manufacturer pilot line, automated test fixture |
| ⏳ | IF-20.1.3 | `[MFG]` | PVT: 500-2,000 units production line, statistical sampling + automated |
| ⏳ | IF-20.2.1 | `[MFG]` | Test fixture design: power-on self-test, network test, I/O loopback, firmware flash, 10-min burn-in |
| ⏳ | IF-20.2.2 | `[MFG]` | Test fixture fabrication: $5K-15K per SKU, automated pass/fail with serial number assignment |
| ⏳ | IF-20.3.1 | `[MFG]` | Supply chain qualification: Vietnam or Mexico primary assembly, second-source in alternate region |
| ⏳ | IF-20.3.2 | `[MFG]` | BOM sensitivity management: LPDDR5 price tracking, SoC availability monitoring, tariff risk hedging |
| ⏳ | IF-20.3.3 | `[MFG]` | Label/packaging: serial number, MAC address, QR code per device; Earl's Kit box design |

**Dependencies**: IF-19 (certification complete)
**RFC Sections**: S34.14, S34.16

---

### Epic IF-21: Quality Assurance & Field Testing — 8 SP
| Status | Task | Category | Description |
|--------|------|----------|-------------|
| ⏳ | IF-21.1.1 | `[MFG]` | Earl's Kit field test: deploy complete kit in real machine shop, validate 45-minute installation target |
| ⏳ | IF-21.1.2 | `[MFG]` | Professional Kit field test: 5-machine MTConnect deployment, validate 30-minute installation |
| ⏳ | IF-21.1.3 | `[MFG]` | Enterprise Kit field test: 32-machine PROFINET deployment with IT/OT segmentation |
| ⏳ | IF-21.2.1 | `[DEVOPS]` | Fleet monitoring: production device telemetry, firmware update success rate, crash reporting |
| ⏳ | IF-21.2.2 | `[DEVOPS]` | Warranty/RMA process: field-replaceable module identification, return workflow |

**Dependencies**: IF-20 (DVT units available)
**RFC Sections**: S34.12 (installation scenarios)

---

## Phase 7: Scale & Maturity (Sprints 22-24) — 30 SP

### Epic IF-22: Atlanta MSA Coverage Expansion — 13 SP
| Status | Task | Category | Description |
|--------|------|----------|-------------|
| ⏳ | IF-22.1.1 | `[RF]` | Phase 2 coverage modeling: 50->250->500 device growth plan for inner suburban coverage |
| ⏳ | IF-22.1.2 | `[RF]` | Cat B relay site planning: 10-20 tower-mount CBRS nodes for rural gap fill |
| ⏳ | IF-22.1.3 | `[CODE]` | DePIN activation: $TMNL relay rewards at 100-device threshold |
| ⏳ | IF-22.2.1 | `[CODE]` | Mesh-Primary mode rollout: automatic switching from ISP-Primary as mesh density reaches threshold |
| ⏳ | IF-22.2.2 | `[CODE]` | Cross-metro hub backbone: hub-to-hub CBRS or fiber links for multi-corridor coverage |
| ⏳ | IF-22.3.1 | `[CODE]` | Reticulum scaling validation: test path table at 1K, 5K, 10K nodes (simulation + progressive real-world) |
| ⏳ | IF-22.3.2 | `[CODE]` | Hierarchical routing: implement sub-network partitioning if flat path table exceeds memory at scale |

**Dependencies**: IF-18 (seed network operational)
**RFC Sections**: S35.8, S35.14

---

### Epic IF-23: Reticulum-rs & Performance — 8 SP
| Status | Task | Category | Description |
|--------|------|----------|-------------|
| ⏳ | IF-23.1.1 | `[CODE]` | Monitor reticulum-rs Rust port maturity; evaluate for TMNL integration |
| ⏳ | IF-23.1.2 | `[CODE]` | Benchmark: Python vs Rust Reticulum on QCS6490 — throughput, latency, memory, CPU |
| ⏳ | IF-23.2.1 | `[FW]` | Embedded Reticulum: evaluate reticulum-rs on iMX8MP and AM62x (lower-power platforms) |
| ⏳ | IF-23.2.2 | `[FW]` | Gateway mesh participation: assess ESP32-S3 running lightweight Reticulum (Rust, no Python) |
| ⏳ | IF-23.3.1 | `[CODE]` | CBSD relay mode investigation: QCS6490 modem as both UE and relay (requires Qualcomm engagement) |

**Dependencies**: IF-13 (Python implementation stable)
**RFC Sections**: S35.4.6, S35.14.4

---

### Epic IF-24: Advanced Networking Features — 9 SP
| Status | Task | Category | Description |
|--------|------|----------|-------------|
| ⏳ | IF-24.1.1 | `[CODE]` | SAS heartbeat over mesh: resolve circular dependency — LoRa control plane forwards SAS heartbeat via ISP-connected neighbor |
| ⏳ | IF-24.1.2 | `[CODE]` | Multi-SAS coordination: single-SAS preference for fleet, fallback SAS provider rotation |
| ⏳ | IF-24.2.1 | `[CODE]` | CBRS spectrum monitoring: track GAA spectrum auction risk (FCC proceedings), alert on regulatory changes |
| ⏳ | IF-24.2.2 | `[CODE]` | Point-to-point CBRS backhaul: Baicells Nova 436H Cat B integration for hub-to-hub links |
| ⏳ | IF-24.3.1 | `[CODE]` | Althea L1 integration evaluation: cross-network bandwidth settlement, Liquid Infrastructure NFT compatibility |
| ⏳ | IF-24.3.2 | `[CODE]` | Multi-metro expansion framework: replicate Atlanta deployment model to other MSAs |

**Dependencies**: IF-15, IF-18
**RFC Sections**: S35.13, S35.15, S35.18

---

## Dependency Map

```
Phase 1 (Hardware)
  IF-01 (Edge HW) --> IF-04 (Edge System Image)
  IF-02 (Gateway HW) --> IF-05 (Gateway FW)
  IF-03 (Adapter HW) --> IF-06 (Adapter FW)
  |
Phase 2 (Firmware)
  IF-04 --> IF-08 (Device Mgmt)
  IF-05 --> IF-06 (shared Sparkplug)
  IF-07 (Sensor FW) -- independent
  |
Phase 3 (Software)
  IF-08 --> IF-09 (Streaming RPCs), IF-10, IF-11, IF-12
  IF-08 + existing iiot/* --> IF-13 (Reticulum)
  |
Phase 4 (Mesh)
  IF-13 --> IF-14 (SAS), IF-15 (Modes), IF-16 (LoRa)
  IF-13 to IF-16 --> IF-17 (PoR), IF-18 (Seed Network)
  |
Phase 5 (DePIN)
  IF-17 --> DP-12 (depin-architect boundary, token economics, attestation)
  IF-18 --> IF-22 (coverage expansion)
  |
Phase 6 (Manufacturing)
  IF-01 (finalized HW) --> IF-19 (Certification) --> IF-20 (Manufacturing)
  IF-20 --> IF-21 (Field Testing)
  |
Phase 7 (Scale)
  IF-18 --> IF-22, IF-23, IF-24
```

---

## Cross-Domain Dependencies

| Item | Expert | Why |
|------|--------|-----|
| DePIN token economics (IF-17 SettlementBridge interface) | **depin-architect** (DP-04 to DP-07) | Proof-of-Relay generates receipts; token economics defines reward distribution. SettlementBridge interface contract in DP-04. |
| DePIN device attestation (IF-13, tasks IF-13.6.3-IF-13.6.6) | **depin-architect** (DP-12) | **Interface agreed.** Infra owns TPM signing + heartbeat emission on `tmnl.depin.attestation.<org_id>.<device_id>`; depin-architect owns oracle challenges + on-chain verification (DP-12.2.4 depends on IF-04.2.5, IF-04.2.6, IF-13.6.3-IF-13.6.6). NATS subjects include `<org_id>` for multi-tenant JWT isolation per S21. Heartbeat schema includes `tpmType: 'hardware' \| 'optee'` for trust tier differentiation. |
| Edge-first architecture tier model (IF-10) | **network-architect** (NW-xx) | T0-T3 tier definitions, NATS leaf node topology, JetStream retention policies |
| Deployment kit UX (IF-12) | **product-architect** (PR-xx) | Earl's Kit unboxing experience, Quick Start Guide, mobile app flows |
| IT/OT segmentation (IF-15, IF-21.1.3) | **security-architect** (SC-xx) | NIST SP 800-82, firewall DMZ rules, NATS JWT isolation for enterprise deployments |
| Schema patterns (all `[CODE]` epics) | **platform-architect** (PL-xx) | Effect Schema discipline, Service authoring patterns, existing iiot/* conventions |
| CI/CD and fleet management (IF-04, IF-08, IF-18) | **devex-architect** (DX-xx) | Firmware build pipeline, OTA delivery, monitoring infrastructure |

---

## SP Summary by Category

| Category | Epics | Story Points |
|----------|-------|-------------|
| `[HW]` Hardware Design | IF-01, IF-02, IF-03 | 48 SP |
| `[FW]` Firmware | IF-04, IF-05, IF-06, IF-07, IF-23 (partial) | 58 SP |
| `[CODE]` Effect-TS Code | IF-08, IF-09, IF-10, IF-11, IF-12, IF-13, IF-14, IF-15, IF-17, IF-18, IF-22, IF-23, IF-24 | 226 SP |
| `[RF]` RF Engineering | IF-14, IF-16, IF-18, IF-22 (partial) | 25 SP |
| `[MFG]` Manufacturing | IF-19, IF-20, IF-21 | 34 SP |
| `[DEVOPS]` DevOps | IF-04, IF-18, IF-21 (partial) | ~15 SP (included in epic totals) |

## Entity Classification Summary

### Machine-Backed Entities (12-layer stack)

| Entity | Epic | State Graph | Key States |
|--------|------|-------------|------------|
| **Device** | IF-08 | `device-graph.ts` (V1) | provisioned -> online -> offline -> faulted -> firmware_update -> decommissioned |
| **OtaDeployment** | IF-08 | `ota-deployment-graph.ts` | pending -> downloading -> flashing -> rebooting -> verified / failed -> rolled_back |
| **MeshNode** | IF-13 | `mesh-node-graph.ts` | discovered -> announcing -> reachable -> unreachable -> expired |
| **ReticularBridge** | IF-13 | `reticular-bridge-graph.ts` | initializing -> connected -> failover -> disconnected |
| **RewardBatch** | IF-17 | `reward-batch-graph.ts` | pending -> submitted -> verified -> distributed / disputed |

### CRUD Entities (8-layer stack)

| Entity | Epic | Nature |
|--------|------|--------|
| **FirmwareVersion** | IF-08 | Immutable data record |
| **SensorCalibration** | IF-08 | Config record |
| **RelayReceipt** | IF-17 | Immutable append-only record |
| **EpochSummary** | IF-17 | Computed aggregate |
| **DeploymentKit** | IF-12 | Configuration record — full CRUD stack |

### Config Constants (NOT entities — no CRUD stack needed)

| Concept | Epic | Nature |
|---------|------|--------|
| **DeploymentMode** | IF-10 | Schema.Literal enum (T0/T1/T2/T3) — consumed by DeploymentTopologyService internally, not persisted/client-facing |

## E2E Stack Coverage Matrix

### Machine-Backed Entities (full 12-layer + Streaming + EventDistribution)

| Entity | Schema | Model | DDL | Repo | Errors | L2 Svc | Machine | ES Handler | Entity | Observer + StateChanged Schema | RPC | HTTP | Streaming | EvtDist (`iiot:entity-changes`) |
|--------|--------|-------|-----|------|--------|--------|---------|-----------|--------|-------------------------------|-----|------|-----------|-------------------------------|
| Device | IF-08.1.1 | IF-08.2.1 | IF-08.3.1 | IF-08.4.1 | IF-08.5.1 | IF-08.6.1 | V1 | IF-08.8.1 | IF-08.9.1 | IF-08.10.1 + IF-08.10.3 | IF-08.11.1 | IF-08.12.1 | IF-09.1.1 | IF-09.2.1 |
| OtaDeployment | IF-08.1.2 | IF-08.2.2 | IF-08.3.1 | IF-08.4.2 | IF-08.5.2 | IF-08.6.4 | IF-08.7.1 | IF-08.8.2 | IF-08.9.2 | IF-08.10.2 + IF-08.10.4 | IF-08.11.2 | IF-08.12.1 | IF-09.1.2 | IF-09.2.1 |
| MeshNode | IF-13.2.1 | IF-13.3.1 | IF-13.4.1 | IF-13.4.2 | IF-13.5.1 | IF-13.6.7 | IF-13.7.1 | IF-13.8.1 | IF-13.9.1 | IF-13.10.1 + IF-13.10.3 | IF-13.11.1 | IF-13.12.1 | IF-13.13.2 | IF-13.13.1 |
| ReticularBridge | IF-13.2.2 | IF-13.3.2 | IF-13.4.1 | IF-13.4.2 | IF-13.5.2 | IF-13.6.9 | IF-13.7.3 | IF-13.8.2 | IF-13.9.2 | IF-13.10.2 + IF-13.10.4 | IF-13.11.2 | IF-13.12.1 | IF-13.13.3 | IF-13.13.1 |
| RewardBatch | IF-17.1.3 | IF-17.2.3 | IF-17.3.1 | IF-17.4.2 | IF-17.5.2 | IF-17.6.11 | IF-17.7.1 | IF-17.8.1 | IF-17.9.1 | IF-17.10.1 + IF-17.10.2 | IF-17.11.2 | IF-17.12.1 | IF-17.13.4 | IF-17.13.1 |

### CRUD Entities (8-layer)

| Entity | Schema | Model | DDL | Repo | Errors | L2 Svc | RPC | HTTP |
|--------|--------|-------|-----|------|--------|--------|-----|------|
| FirmwareVersion | IF-08.1.3 | IF-08.2.2 | IF-08.3.1 | IF-08.4.2 | shared | IF-08.6.3 | IF-08.11.3 | IF-08.12.1 |
| SensorCalibration | IF-08.1.3 | IF-08.2.2 | IF-08.3.1 | IF-08.4.2 | shared | IF-08.6.2 | shared | IF-08.12.1 |
| RelayReceipt | IF-17.1.1 | IF-17.2.1 | IF-17.3.1 | IF-17.4.1 | IF-17.5.1 | IF-17.6.1 | IF-17.11.1 | IF-17.12.1 |
| EpochSummary | IF-17.1.2 | IF-17.2.2 | IF-17.3.1 | IF-17.4.2 | shared | IF-17.6.3 | IF-17.11.1 | IF-17.12.1 |
| DeploymentKit | IF-12.1.1 | IF-12.2.1 | IF-12.3.1 | IF-12.4.1 | IF-12.5.1 | IF-12.6.1 | IF-12.7.1 | IF-12.8.1 |

---

## Open Questions Requiring Committee Input

| ID | Question | From RFC | Decision Needed By |
|----|----------|----------|-------------------|
| HW-1 | Manufacture carrier boards in-house or license to hardware partner (OnLogic, Seeed)? | S34.18 | PR-xx (product-architect) |
| HW-2 | Open-source ESP32 gateway firmware for community designs? | S34.18 | PR-xx, SC-xx |
| HW-3 | Minimum viable adapter catalog for GA launch — all 11 or subset? | S34.18 | PR-xx |
| HW-6 | Include HDMI output on T2 edge device (BOM +$2-3)? | S34.18 | PR-xx |
| NET-1 | QCS6490 CBRS relay mode — can integrated modem do UE + relay? | S35.18 Q1 | Qualcomm engagement |
| NET-2 | Reticulum scaling at 10K+ nodes — empirical validation plan? | S35.18 Q2 | NW-xx (network-architect) |
| NET-3 | SAS heartbeat over mesh — circular dependency resolution confirmed? | S35.18 Q3 | NW-xx |
| NET-6 | GAA spectrum auction risk — monitoring cadence? | S35.18 Q6 | SC-xx (security-architect) |
| NET-8 | Receipt storage at 2.5M/day scale — PostgreSQL or ClickHouse? | S35.18 Q8 | PL-xx (platform-architect) |
| NET-10 | Free-rider mitigation — baseline LoRa announce reward? | S35.18 Q10 | DP-xx (depin-architect) |
