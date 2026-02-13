---
id: "S1"
title: "Physical Layer — Sensor Firmware & SenML Encoding"
commitHash: "6656064"
status: "draft"
date: "2026-01-02"
tier: "isolated"
stages: ["S1"]
---

# ADR-S1: Physical Layer

## Context

### Stages Covered
- S1 (Physical)

### Problem

The Physical layer is the data origin — sensors capturing environmental telemetry (temperature, humidity, pressure) on resource-constrained microcontrollers. The challenge is maximizing signal fidelity while minimizing bandwidth consumption, power draw, and firmware complexity. Naive "transmit every sample" approaches waste 70-90% of bandwidth on insignificant noise, drain batteries, and flood downstream stages with redundant data.

### Constraints

- **Hardware**: ESP32-S3 (240MHz dual-core, 512KB SRAM, 8MB flash)
- **Sensors**: I2C/SPI environmental sensors (BME280-class)
- **Power budget**: Battery-operated, target 30+ days runtime
- **Bandwidth**: WiFi 802.11n, shared medium, intermittent connectivity
- **Latency tolerance**: 500ms-5s acceptable for environmental monitoring
- **Signal preservation**: Must capture meaningful changes (HVAC events, weather fronts)

### Assumptions

- Environmental sensors produce continuous streams with high temporal correlation (slow-moving physical processes)
- Significant events (0.1°C temperature delta, 0.5% humidity shift) are rare relative to sample rate
- Network connectivity is intermittent but eventually consistent (store-and-forward acceptable)
- Firmware updates via OTA, not physical access
- Sensors share I2C bus, sequential polling model

## Decision

### Summary

Implement **firmware-level dead-band filtering** (OPC UA standard) with **SenML JSON encoding** and **adaptive buffering**. The ESP32 samples sensors at fixed 1Hz, applies zero-allocation dead-band thresholds (0.1°C, 0.5%RH, 0.1hPa), and transmits only significant changes. Readings are encoded as SenML packs and buffered in SRAM for batch transmission over WiFi. Timestamps use NTP-synchronized RTC with fallback to monotonic uptime counter.

### Technologies

| Technology | Version | Purpose | File Reference |
|------------|---------|---------|----------------|
| ESP-IDF | v5.x | Firmware framework, FreeRTOS, WiFi stack | `../embedded/esp32s3-qemu/` |
| ESP32-S3 | FN8 | Dual-core Xtensa LX7, WiFi, BLE | M5Stamp-S3 hardware |
| BME280 | - | I2C temperature/humidity/pressure sensor | Driver via ESP-IDF component |
| SenML | RFC 8428 | JSON telemetry encoding | `FermionTestbed.tsx` (schema patterns) |
| NTP | SNTPv4 | Clock synchronization | ESP-IDF SNTP component |

### Patterns

- **Dead-Band Filtering**: OPC UA Part 8 standard. O(1) time, zero allocation. Transmit only when `|current - lastTransmitted| > threshold`. Preserves amplitude accuracy, quantizes timing. See: `FermionTestbed.tsx:110-230`, `SENSOR_DELTA_COMPRESSION_STRATEGIES.md`.

- **Atomic Buffering**: Ring buffer in SRAM (4KB, ~40 readings). Batch transmit when buffer is 75% full OR 30s elapsed. Survives brief network outages without data loss.

- **Timestamp Discipline**: Primary: NTP-synced RTC (absolute Unix epoch). Fallback: Monotonic `esp_timer_get_time()` with boot offset marker. Edge gateway reconciles timestamps during ingestion.

- **Graceful Degradation**: If WiFi unavailable > 5 minutes, discard oldest buffered readings (FIFO). Preserves recent history, prevents OOM crash.

### Interfaces

| Interface | Protocol | Schema |
|-----------|----------|--------|
| S1→S2 | WiFi HTTP POST | SenML JSON array, `Content-Type: application/senml+json` |

**SenML Payload Example**:
```json
[
  {
    "bn": "urn:dev:m5:sensor-alpha-01:",
    "bt": 1735819200,
    "bu": "Cel",
    "n": "temperature",
    "v": 22.5,
    "t": 0
  },
  {
    "n": "humidity",
    "u": "%RH",
    "v": 45.2,
    "t": 0
  },
  {
    "n": "pressure",
    "u": "hPa",
    "v": 1013.25,
    "t": 0
  }
]
```

**Key SenML Fields**:
- `bn` (base name): Device URN (includes sensor ID)
- `bt` (base time): Unix epoch timestamp
- `bu` (base unit): Unit for all values (Celsius, %RH, hPa)
- `n` (name): Measurement type
- `v` (value): Numeric reading
- `t` (time offset): Relative to `bt` (0 for first reading)

## Rationale

### Alternatives Considered

1. **Transmit every sample at 1Hz**
   **Why rejected**: 70-90% bandwidth waste on noise. Battery life < 7 days. Floods downstream stages with redundant data. No semantic filtering.

2. **Swinging Door Trending (SDT)**
   **Why rejected**: Higher complexity (slope calculations, pivot tracking). Minimal benefit over dead-band for slow environmental processes. Harder to tune thresholds. See `SENSOR_DELTA_COMPRESSION_STRATEGIES.md:72-142`.

3. **Binary encoding (CBOR, Protobuf)**
   **Why rejected**: Minimal size benefit over gzip-compressed JSON for small payloads (<10 readings). Loses human-readability for debugging. SenML JSON is RFC standard, widely supported.

4. **RTC-only timestamps (no NTP)**
   **Why rejected**: Clock drift (~50ppm = 4.3s/day). Multi-sensor time sync impossible. Edge gateway can't correlate events across devices.

5. **Adaptive sample rate (e.g., faster when changing)**
   **Why rejected**: Premature optimization. Fixed 1Hz simplifies firmware state machine. Dead-band already reduces transmission rate effectively. Future ADR if needed.

### Tradeoffs

| Gain | Cost |
|------|------|
| 70-90% bandwidth reduction (dead-band) | Loss of high-frequency transients (acceptable for environmental monitoring) |
| 30+ day battery life | Requires firmware complexity (buffering, NTP) |
| RFC-standard SenML JSON | 2-3x larger than binary (mitigated by gzip, batch transmission) |
| Absolute timestamps (NTP) | Dependency on network for time sync (fallback to monotonic) |
| Batch transmission (reduced TX events) | Higher latency for individual readings (acceptable: 5s budget) |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Dead-band thresholds miscalibrated | Medium | Miss significant events or transmit noise | Tunable via OTA config. Start conservative (0.1°C), monitor false-positive rate. |
| Buffer overflow during long network outage | Medium | Data loss (oldest readings) | 4KB buffer = 40 readings = 40s at worst-case rate. FIFO eviction policy. Alert on >50% fill. |
| NTP unavailable (firewall, offline) | Medium | Timestamp drift, correlation issues | Fallback to monotonic clock + boot marker. Edge gateway reconciles. |
| WiFi power draw exceeds budget | Low | Battery life < 30 days | Deep sleep between samples. WiFi TX only when buffer >75% full. Measured: 120mA TX, 10µA sleep. |
| I2C sensor hang (bus lockup) | Low | Firmware hang, watchdog reset | I2C timeout (500ms). Hardware watchdog (10s). Auto-recovery on reset. |

## Implementation

### Files

| Path | Action | Description |
|------|--------|-------------|
| `../embedded/esp32s3-qemu/sensor-firmware/` | create | New ESP-IDF project directory |
| `sensor-firmware/main/sensor_task.c` | create | FreeRTOS task: 1Hz I2C polling, dead-band filter |
| `sensor-firmware/main/deadband.c` | create | Dead-band filter implementation (OPC UA pattern) |
| `sensor-firmware/main/senml.c` | create | SenML JSON encoder, ring buffer management |
| `sensor-firmware/main/wifi_task.c` | create | WiFi connect, HTTP POST, NTP sync |
| `sensor-firmware/main/config.h` | create | Tunable parameters: dead-band thresholds, WiFi credentials, buffer size |
| `sensor-firmware/sdkconfig.defaults` | create | ESP-IDF config: enable WiFi, SNTP, HTTP client, reduce logging for power |

### Dependencies

- `esp-idf` (v5.x): Core framework
- `esp-idf/components/esp_http_client`: HTTP POST to edge gateway
- `esp-idf/components/esp_sntp`: NTP client
- `bme280-esp-idf` (or equivalent): I2C sensor driver (add via `idf.py add-dependency`)

### Test Strategy

**Unit Tests** (ESP-IDF Unity framework):
- Dead-band filter: Verify threshold enforcement, last-transmitted state tracking
- SenML encoder: Validate JSON structure, base-name/time/unit fields
- Ring buffer: Overflow behavior, FIFO eviction, batch flush

**Integration Tests** (QEMU + mock sensor):
- I2C polling task: Simulated sensor reads, verify 1Hz cadence
- WiFi transmission: Mock HTTP endpoint, verify SenML payload structure
- NTP sync: Mock SNTP server, verify RTC update
- Power profiling: Measure sleep/wake cycles, TX current draw

**Hardware Tests** (M5Stamp-S3 + BME280):
- End-to-end: Deploy firmware, monitor serial output, verify HTTP POST to staging edge gateway
- Battery life: 1000mAh LiPo, measure runtime to shutdown (target: 30+ days)
- Network resilience: Disconnect WiFi for 10 minutes, verify buffer behavior and recovery

**Validation Criteria**:
1. Dead-band reduces transmission rate by >70% vs. naive 1Hz (measured over 1 hour HVAC cycle)
2. Timestamp drift <5s over 24 hours (NTP sync every 6 hours)
3. No data loss during 5-minute WiFi outage (buffer capacity check)
4. Battery life >30 days (extrapolated from 48-hour test)

## Metadata

### Related ADRs
- **ADR-S1-S2** (Physical-Edge integration): HTTP endpoint contract, SenML parsing on Rust adapter
- **ADR-S1-S2-S3** (Sensor-Cloud triplet): End-to-end latency budget, timestamp reconciliation
- **ADR-S1-S9** (Physical-React end-to-end): Total pipeline latency, dead-band + UI decimation strategy
- **ADR-S7** (Filtering): Client-side dead-band (duplicate elimination if firmware thresholds change)

### Open Questions
1. **Multi-sensor packing**: Single SenML array with multiple `bn` entries vs. separate POST requests? (Affects S1→S2 contract)
2. **OTA update strategy**: ESP-IDF app rollback vs. dual-boot partition? (Firmware safety)
3. **Battery voltage telemetry**: Include in SenML pack or separate health endpoint? (Operational visibility)

### Future Considerations
- **Adaptive sampling**: Increase rate during rapid changes (e.g., door open event). Requires state machine extension.
- **BLE fallback**: Use BLE Mesh if WiFi unavailable (peer-to-peer sensor network). Major firmware rework.
- **Compression**: Evaluate CBOR vs. gzip JSON after 1 month of production telemetry size data.
