# RFC-001 Section: Manufacturing Process Scope & Legacy Equipment Taxonomy

```
Section:       Manufacturing Process Scope & Legacy Equipment Taxonomy
RFC:           001 — Entity Lifecycle Event Distribution for Metropolitan-Scale IIoT
Status:        DRAFT (Revision 1)
Author:        process-analyst (Val)
Created:       2026-02-12
Source Data:   ISA-95/IEC 62264 process type classification
               HMS Networks industrial network market analysis 2024-2025
               Codebase entity schemas (src/lib/iiot/schemas/assets/*)
Bibliography:  docs/specifications/bibliography.md
```

<!-- INTEGRATION NOTES (for RFC assembly)
- This section is NEW content — does not replace any existing RFC-001 section.
- Should be placed AFTER the Competitive Differentiation section (rfc-section-competitive-analysis.md)
  and BEFORE the Effect Architecture section (rfc-section-effect-architecture.md).
- Cross-references: rfc-section-competitive-analysis.md (G-1 through G-5 gap analysis references
  entity schemas defined here), rfc-section-introduction.md (Earl's Precision Machining persona),
  rfc-section-multi-tenant-network.md (NATS subject hierarchy mirrors ISA-95 hierarchy here).
- Dependencies: rfc-section-competitive-analysis.md MUST define the five universal gaps before
  this section details how each vertical addresses them.
- Codebase grounding: ALL schema references verified against src/lib/iiot/schemas/assets/*.ts
  and src/lib/iiot/entity/*.ts as of 2026-02-12.
- Bibliography: Citation keys reference bibliography.md. New keys introduced:
  [ISA-95-1], [ISA-88], [ISA-18-2], [HMS-NETWORKS-2024], [HMS-NETWORKS-2025],
  [IATF-16949], [FDA-FSMA], [AS9100D], [ISO-14644], [ISO-22000], [IEC-61131-9],
  [SPARKPLUG-B], [OPC-UA-14], [MODBUS-ORG], [PROFINET-SPEC], [ETHERNET-IP-SPEC].
-->

---

TMNL targets all four ISA-95 manufacturing process types across 10 verticals, from a 2-person CNC shop with analog sensors to a pharmaceutical plant with 21 CFR Part 11 audit trails. This section defines the process scope, sensor profiles, legacy equipment taxonomy, and protocol conversion matrix that make metropolitan-scale manufacturing integration technically feasible.

---

## Table of Contents

1. [ISA-95 Process Type Classification](#1-isa-95-process-type-classification)
2. [TMNL Priority Ordering](#2-tmnl-priority-ordering)
3. [Sensor Profiles by Vertical](#3-sensor-profiles-by-vertical)
4. [Legacy Equipment Taxonomy](#4-legacy-equipment-taxonomy)
5. [Protocol Landscape](#5-protocol-landscape)
6. [Protocol Conversion Matrix to Sparkplug B](#6-protocol-conversion-matrix-to-sparkplug-b)
7. [Data Volume Estimation](#7-data-volume-estimation)
8. [Quality & Compliance by Vertical](#8-quality--compliance-by-vertical)
9. [ISA-95 Hierarchy Mapping to TMNL Schemas](#9-isa-95-hierarchy-mapping-to-tmnl-schemas)
10. [Codebase Grounding](#10-codebase-grounding)
11. [Schema Gap Analysis](#11-schema-gap-analysis)
12. [TypeScript Code Examples: Vertical-to-Entity Mapping](#12-typescript-code-examples-vertical-to-entity-mapping)
13. [Brownfield Integration Playbooks](#13-brownfield-integration-playbooks)
14. [References](#14-references)

---

## 1. ISA-95 Process Type Classification

ISA-95/IEC 62264 [ISA-95-1] classifies all manufacturing into four fundamental process types. TMNL supports all four, because a metropolitan manufacturing commons contains shops, plants, and facilities operating across every type simultaneously.

### 1.1 Discrete Manufacturing

**Definition.** Production of distinct, countable items where each unit is individually identifiable. Work orders track specific parts through defined operations.

**Characteristics:**
- Products are countable units (bolts, circuit boards, machined parts)
- Routing is operation-based: OP10 → OP20 → OP30
- Cycle times are per-part (seconds to hours)
- Quality is per-unit inspection
- Changeovers are tool/fixture swaps

**Atlanta examples:** CNC machine shops (Earl's Precision Machining), metal fabrication shops, electronics assembly, custom machining, 3D printing services, tool-and-die shops.

**ISA-95 equipment model:** Enterprise → Site → Area → Line → WorkCell → Machine → Sensor. All levels are meaningful — a 5-axis CNC center IS a WorkCell with multiple controlled axes (Machines) each with position/load Sensors.

**TMNL entity mapping:**
- EquipmentState entity tracks machine state (running/idle/faulted) for OEE calculation (`src/lib/iiot/entity/EquipmentStateEntity.ts`)
- WorkOrder entity tracks per-part routing with FDA-grade audit trail (`src/lib/iiot/entity/WorkOrderEntity.ts`)
- Alarm entity captures threshold violations on sensor readings (`src/lib/iiot/entity/AlarmEntity.ts`)

### 1.2 Process (Continuous) Manufacturing

**Definition.** Production in a continuous, uninterrupted flow where the product cannot be decomposed into discrete units. Output is measured in volume, weight, or flow rate over time.

**Characteristics:**
- Products are bulk materials (chemicals, refined petroleum, paper, glass)
- Process is flow-based: reactors, distillation columns, continuous furnaces
- Cycle concept does not apply — process runs 24/7
- Quality is statistical process control (SPC) on continuous samples
- Shutdowns are planned events (turnarounds) measured in days

**Atlanta examples:** Chemical processing (Eastman Chemical), paper/pulp mills, water treatment, asphalt plants, glass manufacturing, continuous steel rolling.

**ISA-95 equipment model:** Enterprise → Site → Area → Process Cell → Unit → Equipment Module. The hierarchy is deeper because process plants have interconnected units (reactors, columns, heat exchangers) that cannot be treated as independent machines.

**TMNL entity mapping:**
- Sensor entities with high-frequency sampling (100ms-1s) for flow, temperature, pressure, level, and composition (`src/lib/iiot/schemas/assets/sensor/schema.ts`)
- EquipmentState tracks unit states (running/standby/faulted) rather than machine states
- Alarm entity with ISA-18.2 lifecycle is critical — process plants generate hundreds of alarms per hour

### 1.3 Batch Manufacturing

**Definition.** Production in finite quantities of material processed together through a defined recipe. Each batch has a unique identity and follows a recipe-driven sequence of operations.

**Characteristics:**
- Products are lot/batch-identified (pharmaceutical batches, food production runs, paint batches)
- Recipe-driven: ISA-88 [ISA-88] defines procedure → unit procedure → operation → phase
- Batch records are the primary compliance artifact
- Quality is per-batch with extensive in-process testing
- Changeovers involve recipe changes, CIP (Clean-in-Place), SIP (Sterilize-in-Place)

**Atlanta examples:** Pharmaceutical compounding (Solvay), food & beverage production (Coca-Cola bottling), specialty chemicals, brewery/distillery operations, cosmetics manufacturing, adhesive/coating production.

**ISA-95 equipment model:** Enterprise → Site → Area → Process Cell → Unit → Equipment Module. Same physical hierarchy as process manufacturing, but with batch scheduling overlaid per ISA-88.

**TMNL entity mapping:**
- WorkOrder entity models the batch lifecycle (draft → approved → in_progress → completed) with full audit trail
- Sensor entities track recipe parameters (temperature profiles, pH curves, mixing speeds)
- EquipmentState tracks unit availability for batch scheduling
- Event sourcing is non-negotiable — 21 CFR Part 11 [FDA-CFR11] requires complete, unalterable batch records

### 1.4 Repetitive Manufacturing

**Definition.** High-volume, continuous production of identical or near-identical items on dedicated production lines. Combines elements of discrete and continuous — individual items are countable, but the process runs continuously.

**Characteristics:**
- Products are high-volume identical units (automotive components, beverage cans, consumer electronics)
- Line-based: dedicated production lines optimized for single product families
- Cycle times are seconds (takt time governs line speed)
- Quality is statistical — inspection is sampling-based, not 100%
- Changeovers are minimal (same product family)

**Atlanta examples:** Automotive parts suppliers (Kia Georgia supply chain), beverage canning, wire/cable production, fastener manufacturing, stamping operations.

**ISA-95 equipment model:** Enterprise → Site → Plant → Line → WorkCell → Machine → Sensor. Line-level monitoring dominates — the Line entity's `status` (running/idle/starved/blocked/changeover) is the primary OEE signal.

**TMNL entity mapping:**
- Line entity tracks line state with OEE-specific statuses (`src/lib/iiot/schemas/assets/line/schema.ts:63-77`)
- WorkCell entity models stations within the line with cycle time tracking (`src/lib/iiot/schemas/assets/workcell/schema.ts:135-138`)
- EquipmentState entity aggregates station-level states to line-level OEE
- Alarm entity fires on takt time violations, quality deviations, and starved/blocked conditions

---

## 2. TMNL Priority Ordering

Not all process types are equal in the Atlanta metropolitan context. Priority is based on: (a) number of organizations, (b) brownfield integration complexity, (c) standalone value at Phase 1.

| Priority | Process Type | Rationale | Phase 1 Value |
|----------|-------------|-----------|---------------|
| **P1** | Discrete | 80%+ of Atlanta's 5,000+ manufacturers are discrete (machine shops, fabrication, assembly). Simplest hierarchy — often just Organization → Machine → Sensor. Immediate OEE value. | Equipment monitoring, OEE, maintenance prediction |
| **P2** | Repetitive | Automotive supply chain (Kia Georgia) and consumer goods. Line-level monitoring directly maps to TMNL Line/WorkCell entities. High data volume drives network effects. | Line efficiency, takt compliance, defect tracking |
| **P3** | Batch | Pharmaceutical, food & beverage, specialty chemicals. WorkOrder entity's event-sourced audit trail is the killer feature. Compliance requirements make switching costs high once adopted. | Batch records, 21 CFR Part 11 compliance, recipe tracking |
| **P4** | Process (Continuous) | Fewest organizations in Atlanta metro. Highest sensor density and data volume. Requires process-specific hierarchy extensions (Process Cell, Unit). Deferred until Phase 2. | Process monitoring, alarm management, SPC |

**Architectural implication:** P1 and P2 are fully supported by the current schema hierarchy (Enterprise → Site → Area → Plant → Line → WorkCell → Machine → Device → Sensor). P3 requires WorkOrder entity enhancements for recipe management. P4 requires schema extensions for Process Cell and Unit abstractions (see Section 11).

---

## 3. Sensor Profiles by Vertical

Each vertical has a characteristic sensor profile — the set of measurement types, ranges, sampling rates, and communication protocols that define its monitoring requirements. These profiles directly map to TMNL's `SensorType` and `MeasurementUnit` schema literals (`src/lib/iiot/schemas/assets/sensor/schema.ts:55-128`).

### 3.1 CNC Machine Shop

The canonical TMNL participant. Earl's Precision Machining with 1 CNC mill, 1 lathe, zero IT staff.

| Sensor | Type | Unit | Range | Sample Rate | Protocol | TMNL SensorType |
|--------|------|------|-------|-------------|----------|-----------------|
| Spindle vibration | Accelerometer (piezo/MEMS) | mm/s or g | 0-50 g | 1-10 kHz | 4-20mA / IO-Link | `vibration` |
| Spindle load | Power transducer | watts / % | 0-100% rated | 100 ms | Modbus RTU | `power` |
| Spindle temperature | Thermocouple/RTD | celsius | 0-200°C | 1 s | 4-20mA | `temperature` |
| Tool wear (power proxy) | Current transducer | ampere | 0-50A | 100 ms | Modbus RTU | `current` |
| Coolant temperature | RTD/NTC | celsius | 0-80°C | 5 s | 4-20mA | `temperature` |
| Coolant flow | Turbine flow meter | l/min | 0-100 L/min | 1 s | 4-20mA | `flow` |
| Axis position (X/Y/Z) | Linear encoder | mm | ±2000 mm | 10 ms | Fieldbus (EtherCAT) | `position` |
| Coolant pressure | Pressure transducer | bar | 0-70 bar | 1 s | 4-20mA | `pressure` |

**Data volume per machine:** ~5 KB/s at typical sampling rates. Earl's 2-machine shop: ~10 KB/s = ~864 MB/day.

**Integration tier:** Typically Tier 1-2 (4-20mA and Modbus RTU). Newer machines may have Tier 4-5 (EtherNet/IP or MTConnect/MQTT).

### 3.2 Injection Molding

| Sensor | Type | Unit | Range | Sample Rate | Protocol | TMNL SensorType |
|--------|------|------|-------|-------------|----------|-----------------|
| Cavity pressure | Piezoelectric (quartz) | bar | 0-2500 bar | 1 ms | Charge amp → Modbus | `pressure` |
| Melt temperature | Thermocouple type J/K | celsius | 150-400°C | 100 ms | 4-20mA | `temperature` |
| Hydraulic pressure | Strain gauge | bar | 0-350 bar | 10 ms | 4-20mA / Modbus | `pressure` |
| Screw position | LVDT/encoder | mm | 0-500 mm | 1 ms | Fieldbus | `position` |
| Cycle time | Proximity/limit switch | count | N/A | Per cycle | Digital I/O | `other` |
| Mold temperature | RTD | celsius | 20-300°C | 1 s | 4-20mA | `temperature` |
| Clamp force | Load cell | newton | 0-5000 kN | 10 ms | Modbus RTU | `force` |
| Cooling water flow | Electromagnetic | l/min | 0-200 L/min | 1 s | 4-20mA | `flow` |

**Data volume per machine:** ~15 KB/s (higher due to 1ms cavity pressure sampling). 10-press shop: ~150 KB/s = ~12.6 GB/day.

**Integration tier:** Tier 2-4 (Modbus RTU to EtherNet/IP). Modern machines (Engel, Arburg) offer OPC UA.

### 3.3 Food & Beverage

| Sensor | Type | Unit | Range | Sample Rate | Protocol | TMNL SensorType |
|--------|------|------|-------|-------------|----------|-----------------|
| Product temperature | RTD/Thermocouple | celsius | -40 to 200°C | 1 s | 4-20mA / IO-Link | `temperature` |
| Ambient humidity | Capacitive | percent | 0-100% RH | 5 s | 4-20mA | `humidity` |
| pH | Glass electrode | unitless | 0-14 pH | 5 s | 4-20mA / Modbus | `ph` |
| Flow rate | Electromagnetic/Coriolis | l/min | 0-5000 L/min | 1 s | 4-20mA / PROFINET | `flow` |
| Weight/mass | Load cell | kg | 0-10000 kg | 100 ms | Modbus RTU | `weight` |
| Fill level | Ultrasonic/radar | meters | 0-30 m | 1 s | 4-20mA / HART | `level` |
| Water activity (Aw) | Capacitive | unitless | 0-1.0 | 30 s | RS-485 | `other` |
| CIP conductivity | Inductive | mS/cm | 0-500 mS/cm | 1 s | 4-20mA | `conductivity` |

**Data volume per line:** ~8 KB/s. Mid-size facility with 5 lines: ~40 KB/s = ~3.4 GB/day.

**Compliance:** FDA FSMA [FDA-FSMA], HACCP, ISO 22000 [ISO-22000]. Temperature records must be maintained for 2+ years with 21 CFR Part 11 data integrity.

### 3.4 Chemical Processing

| Sensor | Type | Unit | Range | Sample Rate | Protocol | TMNL SensorType |
|--------|------|------|-------|-------------|----------|-----------------|
| Process pressure | Differential pressure | bar / kpa | 0-400 bar | 100 ms | 4-20mA / HART | `pressure` |
| Process temperature | Thermocouple/RTD | celsius | -200 to 1000°C | 500 ms | 4-20mA / HART | `temperature` |
| Flow | Coriolis/vortex | m3/h | 0-5000 m³/h | 500 ms | 4-20mA / FOUNDATION Fieldbus | `flow` |
| Level | Guided wave radar | meters | 0-50 m | 1 s | 4-20mA / HART | `level` |
| Gas composition | Analyzer (GC/FTIR) | percent | 0-100% | 30 s-5 min | Modbus TCP / OPC UA | `other` |
| pH | Industrial electrode | unitless | 0-14 | 5 s | 4-20mA | `ph` |
| Conductivity | Toroidal/contacting | mS/cm | 0-2000 mS/cm | 5 s | 4-20mA | `conductivity` |
| Vibration (rotating) | Accelerometer | mm/s | 0-50 mm/s | 1 kHz | 4-20mA / Modbus | `vibration` |

**Data volume per unit:** ~20 KB/s. Chemical plant with 50 units: ~1 MB/s = ~86 GB/day.

**Compliance:** OSHA PSM (29 CFR 1910.119), EPA RMP, ISA-18.2 alarm management [ISA-18-2].

### 3.5 Automotive Assembly

| Sensor | Type | Unit | Range | Sample Rate | Protocol | TMNL SensorType |
|--------|------|------|-------|-------------|----------|-----------------|
| Torque (fastening) | Rotary torque | nm | 0-500 Nm | Per event | EtherNet/IP / PROFINET | `torque` |
| Force (press-fit) | Strain gauge load cell | newton | 0-100 kN | 1 ms | EtherNet/IP | `force` |
| Weld current | Hall effect CT | ampere | 0-50 kA | 1 ms | PROFINET / DeviceNet | `current` |
| Weld voltage | Voltage divider | volt | 0-50 V | 1 ms | PROFINET | `voltage` |
| Vision (defect) | Camera + ML | unitless | Pass/Fail | Per part | GigE Vision / EtherNet/IP | `other` |
| Barcode/RFID | Scanner/reader | unitless | Tag ID | Per event | EtherNet/IP | `other` |
| Electrode force | Quartz force washer | newton | 0-30 kN | 1 ms | Charge amp → Modbus | `force` |
| Line speed | Encoder/tachometer | rpm / m/min | 0-100 m/min | 100 ms | PROFINET | `speed` |

**Data volume per line:** ~50 KB/s (vision data bursts much higher). Assembly plant with 10 lines: ~500 KB/s = ~42 GB/day.

**Compliance:** IATF 16949 [IATF-16949], AIAG Core Tools (PPAP, MSA, SPC), customer-specific requirements.

### 3.6 Electronics/PCB Assembly

| Sensor | Type | Unit | Range | Sample Rate | Protocol | TMNL SensorType |
|--------|------|------|-------|-------------|----------|-----------------|
| Solder paste height | 3D laser scanner | mm | 0-0.5 mm | Per pad | GigE / SMEMA | `other` |
| Pick-and-place force | Load cell | newton | 0-20 N | Per component | Fieldbus | `force` |
| Reflow temp profile | Thermocouple array | celsius | 25-300°C | 500 ms | Modbus TCP | `temperature` |
| AOI defect detection | Camera + ML | unitless | Pass/Fail | Per board | GigE Vision | `other` |
| Wave solder temperature | Thermocouple | celsius | 200-280°C | 1 s | 4-20mA | `temperature` |
| Nitrogen flow (reflow) | Mass flow meter | l/min | 0-500 L/min | 1 s | 4-20mA | `flow` |
| Board warp | Laser profilometer | mm | 0-5 mm | Per board | GigE | `other` |
| Component placement | Encoder feedback | mm | ±0.025 mm | 10 ms | EtherCAT | `position` |

**Data volume per line:** ~30 KB/s (vision data dominant). SMT facility with 4 lines: ~120 KB/s = ~10 GB/day.

**Compliance:** IPC-A-610 (acceptability), J-STD-001 (soldering), ISO 9001 [ISO-9001], customer-specific (automotive → IATF 16949).

### 3.7 Pharmaceutical Manufacturing

| Sensor | Type | Unit | Range | Sample Rate | Protocol | TMNL SensorType |
|--------|------|------|-------|-------------|----------|-----------------|
| Clean room particulate | Optical particle counter | count/m³ | 0.5/5.0 µm classes | 1 min | Modbus TCP / OPC UA | `other` |
| Room pressure differential | DP transducer | pascal | -50 to +50 Pa | 1 s | 4-20mA / BACnet | `pressure` |
| Temperature (critical) | Calibrated RTD | celsius | 15-25°C (±0.5°C) | 1 s | 4-20mA / HART | `temperature` |
| Humidity (critical) | Chilled mirror | percent | 30-65% RH (±2%) | 5 s | 4-20mA | `humidity` |
| Batch weight | Precision load cell | kg | 0-1000 kg (±0.01%) | 100 ms | Modbus RTU | `weight` |
| Filter integrity | Pressure decay | pascal | 0-5000 Pa | Per test | RS-485 | `pressure` |
| UV/TOC water | Spectrophotometer | unitless | 0-500 ppb | 30 s | Modbus TCP | `other` |
| Autoclave temperature | Calibrated RTD | celsius | 100-135°C | 1 s | 4-20mA | `temperature` |

**Data volume per facility:** ~25 KB/s (lower frequency but higher precision). Pharma facility: ~2.1 GB/day.

**Compliance:** 21 CFR Parts 210/211 (cGMP), 21 CFR Part 11 (electronic records) [FDA-CFR11], EU GMP Annex 1, ISO 14644 (cleanroom) [ISO-14644], ICH Q7/Q10. This is the most heavily regulated vertical. TMNL's event-sourced entities provide ALCOA-compliant audit trails by architecture.

### 3.8 Metal Fabrication

| Sensor | Type | Unit | Range | Sample Rate | Protocol | TMNL SensorType |
|--------|------|------|-------|-------------|----------|-----------------|
| Weld current | Hall effect CT | ampere | 0-500A | 1 ms | 4-20mA / Modbus | `current` |
| Weld voltage | Voltage divider | volt | 0-50V | 1 ms | 4-20mA / Modbus | `voltage` |
| Wire feed speed | Encoder | m/min | 0-25 m/min | 10 ms | Modbus RTU | `speed` |
| Plasma torch temp | Thermocouple | celsius | 0-30000°C | 100 ms | 4-20mA | `temperature` |
| Sheet thickness | Ultrasonic gauge | mm | 0.5-50 mm | Per part | RS-485 | `other` |
| Bend angle | Rotary encoder | degrees | 0-180° | 10 ms | Fieldbus | `position` |
| Press tonnage | Strain gauge | newton | 0-5000 kN | 1 ms | 4-20mA / Modbus | `force` |
| Gas flow (shielding) | Mass flow | l/min | 0-50 L/min | 1 s | 4-20mA | `flow` |

**Data volume per shop:** ~10 KB/s (burst during welding operations). Mid-size fab shop: ~864 MB/day.

**Compliance:** AWS D1.1 (structural welding), ASME BPVC (pressure vessels), ISO 3834 (welding quality), customer-specific.

### 3.9 Plastics/Rubber Extrusion

| Sensor | Type | Unit | Range | Sample Rate | Protocol | TMNL SensorType |
|--------|------|------|-------|-------------|----------|-----------------|
| Extruder barrel temp | Thermocouple array | celsius | 100-350°C per zone | 500 ms | 4-20mA / Modbus | `temperature` |
| Screw speed | Encoder/tachometer | rpm | 0-300 RPM | 100 ms | Modbus RTU | `speed` |
| Die pressure | Melt pressure sensor | bar | 0-700 bar | 100 ms | 4-20mA | `pressure` |
| Melt temperature | Infrared pyrometer | celsius | 100-400°C | 100 ms | 4-20mA | `temperature` |
| Haul-off speed | Encoder | m/min | 0-100 m/min | 100 ms | Modbus RTU | `speed` |
| Product dimension | Laser micrometer | mm | 0-300 mm (±0.01) | 10 ms | RS-485 / Modbus | `other` |
| Motor current | CT | ampere | 0-200A | 100 ms | 4-20mA | `current` |
| Cooling water temp | RTD | celsius | 5-40°C | 1 s | 4-20mA | `temperature` |

**Data volume per line:** ~8 KB/s. Extrusion plant with 8 lines: ~64 KB/s = ~5.4 GB/day.

**Compliance:** ISO 9001, customer-specific dimensional specifications, UL/CSA for electrical components.

### 3.10 Packaging

| Sensor | Type | Unit | Range | Sample Rate | Protocol | TMNL SensorType |
|--------|------|------|-------|-------------|----------|-----------------|
| Line speed | Encoder/photoeye | count/min | 0-1200 ppm | 100 ms | EtherNet/IP / PROFINET | `speed` |
| Fill weight | Check weigher | kg | 0-50 kg (±0.1g) | Per unit | Modbus TCP / EtherNet/IP | `weight` |
| Seal integrity | Vacuum/burst test | bar | 0-2 bar | Per unit | Digital I/O / Modbus | `pressure` |
| Label position | Vision camera | mm | ±2 mm | Per unit | GigE Vision | `other` |
| Temperature (sealer) | Thermocouple | celsius | 100-250°C | 500 ms | 4-20mA | `temperature` |
| Carton count | Photoeye counter | count | N/A | Per event | Digital I/O | `other` |
| Print quality | Vision/barcode | unitless | Pass/Fail grade | Per unit | GigE / RS-232 | `other` |
| Reject rate | Counter + divider | percent | 0-100% | 1 s (rolling) | Modbus TCP | `other` |

**Data volume per line:** ~12 KB/s (vision bursts higher). Packaging facility with 6 lines: ~72 KB/s = ~6.0 GB/day.

**Compliance:** FDA (food/drug packaging), GS1 (barcode standards), customer-specific (labeling accuracy), tamper-evidence requirements.

---

## 4. Legacy Equipment Taxonomy

The defining challenge of metropolitan-scale IIoT is not greenfield deployment — it is brownfield integration. Over 70% of manufacturing equipment in North America is more than 20 years old [HMS-NETWORKS-2024]. The average US manufacturing asset is nearly 20 years old. TMNL must integrate equipment spanning six decades of technology.

### 4.1 The Six-Tier Classification

| Tier | Era | Communication | Typical Equipment | Estimated Prevalence (Installed Base) | Integration Strategy |
|------|-----|---------------|-------------------|---------------------------------------|---------------------|
| **Tier 0: Manual** | Pre-1970 | None (visual gauges, manual recording) | Manual lathes, hand-operated presses, analog gauges | 10-15% of small shops | External sensor retrofit. Clamp-on CTs, bolt-on accelerometers, magnetic temperature probes. TMNL provides the first digital signal these machines have ever produced. |
| **Tier 1: Analog** | 1970-1990 | 4-20mA current loops, 0-10V signals, thermocouple/RTD direct wiring | Early PLCs (AB PLC-5), analog instruments, chart recorders, pneumatic controllers | 15-20% of installed base | Analog-to-digital conversion via I/O modules (e.g., Advantech ADAM-4000 series). Module converts 4-20mA → Modbus RTU → gateway → MQTT → Sparkplug B. Cost: $50-200 per channel. |
| **Tier 2: Serial** | 1985-2005 | RS-232, RS-485, Modbus RTU, DF1 | CNC controls (Fanuc 0i/16i/18i), AB SLC-500, Siemens S5, standalone instruments | 25-30% of installed base | Serial-to-Ethernet gateway. Modbus RTU → Modbus TCP gateway ($100-300) → TMNL Modbus adapter (`src/lib/iiot/adapters/modbus-adapter-stub.ts`) → Sparkplug B. Most common brownfield scenario. |
| **Tier 3: Fieldbus** | 1995-2010 | Profibus DP/PA, DeviceNet, FOUNDATION Fieldbus, CC-Link, INTERBUS | Siemens S7-300, AB ControlLogix (early), distributed I/O, motor drives | 15-20% of installed base | Fieldbus-to-Ethernet gateway. ProSoft PLX3x ($500-1500) converts Profibus/DeviceNet → EtherNet/IP → OPC UA → TMNL OPC UA adapter (`src/lib/iiot/adapters/opcua-adapter-stub.ts`) → Sparkplug B. |
| **Tier 4: Industrial Ethernet** | 2005-2020 | EtherNet/IP, PROFINET, Modbus TCP, EtherCAT, CC-Link IE | Modern PLCs (S7-1500, ControlLogix 5580), robots, drives, HMIs | 15-20% of installed base | Native protocol adapter or OPC UA server. Most Tier 4 controllers support OPC UA as a secondary protocol. Direct OPC UA → Sparkplug B conversion via TMNL OPC UA adapter. Lowest integration friction. |
| **Tier 5: Modern IIoT** | 2018-present | MQTT, OPC UA (pub/sub), Sparkplug B, REST/HTTP APIs, IO-Link | IIoT gateways, edge computers, smart sensors, collaborative robots | 5-10% of installed base | Native Sparkplug B. TMNL SparkplugAdapterLive (`src/lib/iiot/adapters/sparkplug-adapter.ts`) handles NBIRTH/DBIRTH auto-discovery. Zero conversion needed. This is the target state. |

### 4.2 Prevalence by Vertical

| Vertical | Tier 0-1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|----------|----------|--------|--------|--------|--------|
| CNC Machine Shop (small) | 40% | 35% | 10% | 10% | 5% |
| CNC Machine Shop (medium) | 15% | 30% | 20% | 25% | 10% |
| Injection Molding | 10% | 25% | 25% | 30% | 10% |
| Food & Beverage | 20% | 25% | 20% | 25% | 10% |
| Chemical Processing | 15% | 20% | 30% | 25% | 10% |
| Automotive Assembly | 5% | 10% | 25% | 45% | 15% |
| Electronics/PCB | 5% | 15% | 20% | 40% | 20% |
| Pharmaceutical | 10% | 20% | 25% | 30% | 15% |
| Metal Fabrication | 35% | 30% | 15% | 15% | 5% |
| Plastics/Rubber | 15% | 30% | 25% | 20% | 10% |
| Packaging | 10% | 20% | 20% | 35% | 15% |

**Key insight:** The verticals with the highest Tier 0-1 prevalence (CNC machine shops, metal fabrication) are ALSO the verticals with the highest organization count in a metropolitan area. TMNL's brownfield strategy must prioritize analog sensor retrofit and serial gateway integration above all else.

### 4.3 Cost Per Integration Tier

| Tier | Hardware Cost | Integration Time | Recurring Cost | TMNL Adapter |
|------|-------------|-----------------|----------------|--------------|
| Tier 0 → Sparkplug B | $200-500/machine (retrofit sensors + I/O module + gateway) | 2-4 hours | $0 (self-hosted edge) | MockAdapterLive → SparkplugAdapterLive |
| Tier 1 → Sparkplug B | $100-300/channel (4-20mA → Modbus converter + gateway) | 1-2 hours/channel | $0 | ModbusAdapterStub → SparkplugAdapterLive |
| Tier 2 → Sparkplug B | $100-300 (Modbus RTU → TCP gateway) | 30 min-1 hour | $0 | ModbusAdapterStub → SparkplugAdapterLive |
| Tier 3 → Sparkplug B | $500-1500 (fieldbus → EtherNet/IP gateway) | 2-4 hours | $0 | OpcUaAdapterStub → SparkplugAdapterLive |
| Tier 4 → Sparkplug B | $0-500 (OPC UA server license, if not included) | 30 min-2 hours | $0 | OpcUaAdapterStub → SparkplugAdapterLive |
| Tier 5 → Sparkplug B | $0 (native) | 15 min (config only) | $0 | SparkplugAdapterLive (native) |

**Earl's total cost:** 2 machines × $300 (retrofit sensors + gateway) = $600 one-time. $0/month for self-hosted edge on a $50 Raspberry Pi. Compare to Ignition at $5K/year minimum.

---

## 5. Protocol Landscape

### 5.1 Protocols by Layer

The industrial protocol stack can be organized by the ISA-95 automation pyramid layers they serve:

| ISA-95 Level | Layer | Protocols | TMNL Relevance |
|-------------|-------|-----------|----------------|
| Level 0 (Field) | Physical I/O | 4-20mA, 0-10V, thermocouples, RTDs, digital I/O | Sensors produce these signals. Not directly consumed by TMNL — converted at edge. |
| Level 1 (Control) | Fieldbus | Modbus RTU/TCP, Profibus DP/PA, DeviceNet, FOUNDATION Fieldbus, CC-Link, INTERBUS, CANopen, HART, IO-Link [IEC-61131-9] | Primary data source for Tier 2-3 equipment. TMNL needs adapters for Modbus and OPC UA (which encapsulates most fieldbuses). |
| Level 1-2 (Control-Supervisory) | Industrial Ethernet | EtherNet/IP [ETHERNET-IP-SPEC], PROFINET [PROFINET-SPEC], Modbus TCP, EtherCAT, CC-Link IE, POWERLINK | Primary data source for Tier 4 equipment. Most support OPC UA as overlay. |
| Level 2-3 (Supervisory-MES) | OPC | OPC DA (legacy), OPC UA [OPC-UA-14] | Universal aggregation layer. OPC UA is the lingua franca of modern industrial data. TMNL OPC UA adapter bridges this entire tier. |
| Level 3-4 (MES-Enterprise) | IT/IoT | MQTT [MQTT-5], Sparkplug B [SPARKPLUG-B], AMQP, HTTP/REST, NATS [NATS-PROTO] | TMNL's native transport. Sparkplug B on MQTT is the canonical inbound protocol. NATS is the internal distribution backbone. |

### 5.2 Market Share (Newly Installed Nodes, 2024-2025)

Per HMS Networks' annual industrial network market analysis [HMS-NETWORKS-2024] [HMS-NETWORKS-2025]:

| Protocol Category | 2023 Share | 2024 Share | 2025 Share | Trend |
|-------------------|-----------|-----------|-----------|-------|
| **Industrial Ethernet** | 68% | 71% | 76% | Growing +4-5%/year |
| EtherNet/IP | 20% | 21% | 22% | Leading Ethernet |
| PROFINET | 19% | 20% | 21% | Close second |
| EtherCAT | 9% | 10% | 11% | Fastest growing |
| Modbus TCP | 5% | 5% | 5% | Stable |
| Other Ethernet | 15% | 15% | 17% | — |
| **Fieldbus** | 24% | 22% | 17% | Declining -3-5%/year |
| PROFIBUS | 7% | 7% | 6% | Slow decline |
| Modbus RTU | 5% | 5% | 4% | Slow decline |
| CC-Link | 4% | 4% | 3% | — |
| Other Fieldbus | 8% | 6% | 4% | — |
| **Wireless** | 8% | 7% | 7% | Stable |

**Critical caveat:** These are **new installation** shares. The installed base is vastly different — HMS estimates the cumulative installed base includes billions of 4-20mA loops and hundreds of millions of Modbus devices that will operate for decades to come. For brownfield integration (TMNL's primary scenario), Tier 1-3 protocols dominate.

---

## 6. Protocol Conversion Matrix to Sparkplug B

Every sensor reading in the TMNL network ultimately arrives as a Sparkplug B payload on an MQTT topic. This matrix defines the conversion path from each source protocol.

| Source Protocol | Conversion Path | Gateway Hardware | TMNL Adapter | Latency Overhead | Data Fidelity |
|----------------|----------------|-----------------|--------------|-----------------|---------------|
| **4-20mA** | 4-20mA → ADC → Modbus RTU → Modbus TCP gateway → MQTT bridge → Sparkplug B | Advantech ADAM-4017+ ($150) + ADAM-4570 ($200) | `ModbusAdapterStub` → `SparkplugAdapterLive` | 50-200ms | Analog resolution limited by ADC (12-16 bit) |
| **0-10V** | Same as 4-20mA with voltage input module | Advantech ADAM-4019+ ($150) | Same as 4-20mA | 50-200ms | Same as 4-20mA |
| **Modbus RTU** | RS-485 → Modbus TCP gateway → MQTT bridge → Sparkplug B | USR-W610 ($50) or ADAM-4570 ($200) | `ModbusAdapterStub` → `SparkplugAdapterLive` | 20-100ms | Lossless (digital-to-digital) |
| **Modbus TCP** | Modbus TCP → MQTT bridge → Sparkplug B | Software only (runs on edge) | `ModbusAdapterStub` → `SparkplugAdapterLive` | 5-20ms | Lossless |
| **Profibus DP** | Profibus → EtherNet/IP gateway → OPC UA → Sparkplug B | ProSoft PLX32 ($1200) | `OpcUaAdapterStub` → `SparkplugAdapterLive` | 50-200ms | Lossless with proper data type mapping |
| **DeviceNet** | DeviceNet → EtherNet/IP gateway → OPC UA → Sparkplug B | ProSoft PLX31 ($1000) | `OpcUaAdapterStub` → `SparkplugAdapterLive` | 50-200ms | Lossless |
| **FOUNDATION Fieldbus** | FF → OPC UA gateway → Sparkplug B | Emerson DeltaV OPC server | `OpcUaAdapterStub` → `SparkplugAdapterLive` | 100-500ms | Status/quality preserved via OPC UA quality codes |
| **HART** | HART → WirelessHART → HART-IP gateway → OPC UA → Sparkplug B | Emerson Wireless Gateway ($2000) | `OpcUaAdapterStub` → `SparkplugAdapterLive` | 1-30s (wireless) | HART status mapped to OPC UA quality |
| **EtherNet/IP** | EtherNet/IP → OPC UA (CIP bridge) → Sparkplug B | Software (Kepware, Ignition) | `OpcUaAdapterStub` → `SparkplugAdapterLive` | 10-50ms | Lossless — CIP objects map cleanly to OPC UA |
| **PROFINET** | PROFINET → OPC UA (S7 native) → Sparkplug B | S7-1500 built-in OPC UA server | `OpcUaAdapterStub` → `SparkplugAdapterLive` | 10-50ms | Lossless — Siemens S7 provides native OPC UA |
| **EtherCAT** | EtherCAT → OPC UA (TwinCAT) → Sparkplug B | Beckhoff TwinCAT OPC UA | `OpcUaAdapterStub` → `SparkplugAdapterLive` | 5-20ms | Lossless |
| **OPC UA** | OPC UA → MQTT bridge → Sparkplug B | Software (OAS, Ignition) | `OpcUaAdapterStub` → `SparkplugAdapterLive` | 5-20ms | Full fidelity — OPC UA quality codes map to Sparkplug quality |
| **OPC DA (Classic)** | OPC DA → OPC UA wrapper → Sparkplug B | Matrikon OPC UA wrapper ($500) | `OpcUaAdapterStub` → `SparkplugAdapterLive` | 20-100ms | Quality preserved; DCOM eliminated |
| **MQTT (generic)** | MQTT → topic remapping → Sparkplug B | Software (Node-RED, custom) | `SparkplugAdapterLive` (with topic transform) | 1-5ms | Depends on payload structure |
| **Sparkplug B** | Native — no conversion | None required | `SparkplugAdapterLive` | 0ms | Perfect fidelity |
| **IO-Link** | IO-Link → IO-Link Master → OPC UA/MQTT → Sparkplug B | ifm IO-Link Master ($400) | `OpcUaAdapterStub` or `SparkplugAdapterLive` | 10-50ms | Lossless — IO-Link provides IODD metadata |
| **MTConnect** | MTConnect (HTTP/XML) → MQTT bridge → Sparkplug B | Software (MTConnect Agent) | Custom adapter needed | 100ms-1s | Schema mapping required (MTConnect → Sparkplug) |

### 6.1 The Two-Gateway Architecture

For Tier 0-3 equipment, the conversion path follows a two-gateway architecture:

```
[Sensor/PLC] → [Protocol Gateway] → [Edge Agent] → [MQTT Broker] → [TMNL]
                                      ↓
              Physical conversion     Software conversion
              (hardware gateway)      (TMNL adapter running on edge)
```

**Gateway 1 (Hardware):** Converts physical/legacy protocol to Ethernet-based protocol. This is a one-time hardware purchase. Examples: 4-20mA → Modbus TCP (Advantech ADAM), Profibus → EtherNet/IP (ProSoft PLX).

**Gateway 2 (Software):** Converts Ethernet protocol to Sparkplug B. This runs on the TMNL edge agent (Raspberry Pi, industrial PC, or Docker container). The TMNL adapter layer (`src/lib/iiot/adapters/`) provides the Effect-based pipeline: `IngestionAdapter.subscribe → ReadingProcessor → AlarmDetector → SparkplugPublisher`.

### 6.2 Quality Code Mapping

Signal quality is preserved across the conversion chain via the quality mapping service (`src/lib/iiot/adapters/quality-mapping.ts`):

```typescript
// Existing quality mapping functions in codebase
mapOpcUaStatusCode(statusCode)    // OPC UA → TMNL quality
mapSparkplugQuality(sparkplugQ)   // Sparkplug B → TMNL quality
qualityToScore(quality)           // TMNL quality → numeric score [0-1]
```

| Source Quality | OPC UA Status | Sparkplug Quality | TMNL Quality Score |
|---------------|--------------|-------------------|-------------------|
| Good/Valid | Good (0x00) | Good (192) | 1.0 |
| Uncertain | Uncertain (0x40) | Stale (0) | 0.5 |
| Bad/Invalid | Bad (0x80) | Bad (0) | 0.0 |
| Communication failure | Bad_CommFailure | Bad | 0.0 |

---

## 7. Data Volume Estimation

### 7.1 Per Size Tier

TMNL defines four participant size tiers based on the competitive analysis section's "Smallest customer" framing:

| Size Tier | Organization Profile | Machines | Sensors | Raw Data Rate | Daily Volume | Monthly Volume |
|-----------|---------------------|----------|---------|--------------|-------------|----------------|
| **Micro** (1-5 employees) | Earl's Precision: 2 CNC machines, 1 lathe | 2-5 | 10-25 | 5-15 KB/s | 0.5-1.3 GB | 15-40 GB |
| **Small** (5-50 employees) | 10-person injection molding shop | 5-20 | 50-200 | 15-100 KB/s | 1.3-8.6 GB | 40-260 GB |
| **Medium** (50-250 employees) | Mid-size auto parts supplier | 20-100 | 200-1000 | 100-500 KB/s | 8.6-43 GB | 260-1300 GB |
| **Large** (250+ employees) | Pharmaceutical plant, assembly plant | 100-500 | 1000-5000 | 500 KB/s-2.5 MB/s | 43-216 GB | 1.3-6.5 TB |

### 7.2 Metropolitan Aggregate

For Atlanta's estimated 5,000+ manufacturers at target penetration:

| Penetration | Micro | Small | Medium | Large | Total Orgs | Aggregate Daily Volume | Aggregate Monthly Volume |
|-------------|-------|-------|--------|-------|------------|----------------------|------------------------|
| 5% (Year 1) | 200 | 40 | 8 | 2 | 250 | ~200 GB/day | ~6 TB/month |
| 10% (Year 2) | 400 | 80 | 16 | 4 | 500 | ~500 GB/day | ~15 TB/month |
| 20% (Year 3) | 800 | 160 | 32 | 8 | 1,000 | ~1.2 TB/day | ~36 TB/month |
| 50% (Year 5) | 2000 | 400 | 80 | 20 | 2,500 | ~3.5 TB/day | ~105 TB/month |

**Infrastructure implication:** At Year 3 (20% penetration), the TMNL network handles ~1.2 TB/day of raw sensor data across 1,000 organizations. NATS [NATS-PROTO] is designed for exactly this scale — NATS Jetstream can sustain 10+ GB/s on commodity hardware. The bottleneck is not transport but storage (TimescaleDB for time-series, Effect Cluster entity state for event-sourced aggregates).

---

## 8. Quality & Compliance by Vertical

Each vertical operates under specific quality management frameworks that dictate data retention, audit trail, and traceability requirements. TMNL's event-sourced entities and Schema-validated payloads address these systematically.

| Vertical | Primary Standard | Audit Trail Requirement | Data Retention | Electronic Records | TMNL Feature |
|----------|-----------------|------------------------|----------------|-------------------|--------------|
| **CNC Machine Shop** | ISO 9001 [ISO-9001] | Recommended | 3-7 years | Optional | EquipmentState event log |
| **Injection Molding** | ISO 9001, IATF 16949 (if auto supply chain) | Required for auto | 15+ years (IATF) | Required (IATF) | WorkOrder + EquipmentState ES |
| **Food & Beverage** | FDA FSMA [FDA-FSMA], HACCP, ISO 22000 [ISO-22000] | Required | 2+ years (FDA) | 21 CFR Part 11 | WorkOrder ES (batch records) |
| **Chemical Processing** | OSHA PSM (29 CFR 1910.119), EPA RMP, ISO 9001 | Required | 5+ years | Recommended | Alarm ES + EquipmentState ES |
| **Automotive Assembly** | IATF 16949 [IATF-16949], AIAG Core Tools | Required | 15+ years | Required | WorkOrder ES + SPC integration |
| **Electronics/PCB** | IPC-A-610, J-STD-001, ISO 9001 | Required for auto/aero | 7-15 years | Standard-dependent | Traceability via WorkOrder ES |
| **Pharmaceutical** | 21 CFR Parts 210/211, 21 CFR Part 11 [FDA-CFR11], EU GMP Annex 1 | **Mandatory** | Product lifetime + 1 year | **Mandatory** | Full ES stack (ALCOA-compliant) |
| **Metal Fabrication** | AWS D1.1, ASME BPVC, ISO 3834 | Required for structural/pressure | 10+ years (ASME) | Recommended | Weld log via WorkOrder ES |
| **Plastics/Rubber** | ISO 9001, UL/CSA (electrical) | Per customer | Per customer | Optional | EquipmentState event log |
| **Packaging** | FDA (food/drug), GS1, ISO 9001 | Required (food/drug) | 2+ years (FDA) | 21 CFR Part 11 (food/drug) | WorkOrder ES (batch/lot) |
| **Aerospace** | AS9100D [AS9100D] | **Mandatory** | Product lifetime + 7 years | Required | Full ES stack + OASIS |

### 8.1 Event Sourcing as Compliance Primitive

The competitive analysis section (Gap G-1) established that no incumbent platform implements event sourcing. TMNL's three event-sourced entities directly address compliance requirements:

| Entity | Event Sourced? | Compliance Use Case | File |
|--------|---------------|---------------------|------|
| **AlarmEntity** | Yes | ISA-18.2 alarm lifecycle. Who acknowledged, when, what the process state was at alarm time. | `src/lib/iiot/entity/AlarmEntity.ts` |
| **WorkOrderEntity** | Yes | 21 CFR Part 11 batch records. Full transition history: who approved, who started, what was the result. ALCOA-compliant audit trail. | `src/lib/iiot/entity/WorkOrderEntity.ts` |
| **EquipmentStateEntity** | Yes | OEE calculation with temporal queries. "What was machine state at 14:32 on March 15?" — answerable by replaying events. | `src/lib/iiot/entity/EquipmentStateEntity.ts` |
| AssetEntity | No (mutable) | ISA-95 hierarchy queries. Asset configuration is mutable because hierarchy changes are operational, not compliance-critical. | `src/lib/iiot/entity/AssetEntity.ts` |
| SensorEntity | No (mutable) | TimescaleDB time-series reads. Sensor configuration is mutable; the raw readings are immutable in TimescaleDB. | `src/lib/iiot/entity/SensorEntity.ts` |

**Pharmaceutical example:** A pharma manufacturer using TMNL can produce a complete 21 CFR Part 11-compliant batch record by querying the WorkOrderEntity event log:

1. **Attributable** — Every event includes the actor (operator, system, or automated rule)
2. **Legible** — Events are Schema-validated, JSON-serialized, machine-readable
3. **Contemporaneous** — Events are appended at the time of occurrence with millisecond timestamps
4. **Original** — Append-only event log is immutable; no overwrite or deletion
5. **Accurate** — Schema validation ensures data type correctness at write time

---

## 9. ISA-95 Hierarchy Mapping to TMNL Schemas

The TMNL codebase implements a comprehensive ISA-95 equipment hierarchy using Effect Schema `TaggedClass` entities. This section maps the ISA-95 model to existing TMNL schemas with vertical-specific examples.

### 9.1 Hierarchy Model

```
ISA-95 Level 4 (Enterprise)     → Enterprise schema  (ENT-{slug})  [L4: Business Planning]
  ISA-95 Level 3 (Site)         → Site schema        (SIT-{slug})  [L3: MES/MOM - Geographic]
    ISA-95 Level 2 (Area)       → Area schema        (ARA-{slug})  [L2: Supervisory/SCADA]
      ISA-95 Level 3 (Plant)    → Plant schema       (PLT-{slug})  [L3: MES/MOM - Functional]
        ISA-95 Level 1 (Line)   → Line schema        (LIN-{slug})  [L1: PLC/DCS - Work Center]
          ISA-95 Level 1 (Cell) → WorkCell schema    (WCL-{slug})  [L1: PLC/DCS - Work Unit]
            ISA-95 Level 1 (Machine) → Machine schema (MCH-{slug})  [L1: Work Unit]
              ISA-95 Level 0    → Device schema      (DEV-{slug})  [L0: Actuator]
              ISA-95 Level 0    → Sensor schema      (SNS-{slug})  [L0: Measurement]
```

### 9.2 Vertical Hierarchy Examples

#### Earl's Precision Machining (Micro — Discrete)

Telescoped hierarchy — Enterprise/Site/Plant collapse into Organization:

```
ENT-earls-precision          Enterprise (= Organization)
  SIT-east-atlanta-shop      Site (= the single shop)
    PLT-main                 Plant (= the shop floor)
      LIN-machining          Line (= the machining area)
        MCH-cnc-haas-vf2     Machine: Haas VF-2 CNC Mill
          SNS-spindle-vib     Sensor: vibration (100 mV/g accelerometer)
          SNS-spindle-temp    Sensor: temperature (K-type thermocouple)
          SNS-spindle-load    Sensor: power (current transducer)
          SNS-coolant-temp    Sensor: temperature (RTD)
          SNS-coolant-flow    Sensor: flow (turbine meter)
          DEV-spindle-motor   Device: spindle motor (7.5 kW servo)
          DEV-coolant-pump    Device: coolant pump
        MCH-lathe-mori-nl    Machine: Mori NL2500 Lathe
          SNS-turret-vib      Sensor: vibration
          SNS-bearing-temp    Sensor: temperature
          DEV-turret-motor    Device: turret indexer
```

**Total entities:** 1 Enterprise, 1 Site, 1 Plant, 1 Line, 2 Machines, 7 Sensors, 3 Devices = **16 entities**

#### Metro Atlanta Automotive Supplier (Medium — Repetitive)

Full ISA-95 hierarchy:

```
ENT-precision-auto-parts     Enterprise
  SIT-marietta-facility      Site
    ARA-production           Area (production)
      PLT-stamping           Plant: Stamping
        LIN-press-line-1     Line: Progressive Stamping Line 1
          WCL-feed-station   WorkCell: Coil feed
            MCH-decoiler     Machine: Decoiler
              SNS-tension     Sensor: force (load cell)
              DEV-brake       Device: coil brake
          WCL-press-station  WorkCell: Press station
            MCH-press-200t   Machine: 200-ton progressive press
              SNS-tonnage     Sensor: force (strain gauge)
              SNS-spm         Sensor: speed (strokes/min)
              DEV-hydraulic   Device: hydraulic ram
          WCL-exit-station   WorkCell: Parts exit
            MCH-conveyor     Machine: Exit conveyor
              SNS-part-count  Sensor: count (photoeye)
    ARA-quality              Area (quality)
      PLT-inspection         Plant: Inspection
        LIN-cmm-line         Line: CMM inspection
          MCH-cmm-zeiss      Machine: Zeiss CMM
            SNS-probe-force   Sensor: force (touch trigger)
```

**Total entities:** 1 Enterprise, 1 Site, 2 Areas, 2 Plants, 2 Lines, 3 WorkCells, 5 Machines, 6 Sensors, 3 Devices = **25 entities**

#### Pharmaceutical Facility (Large — Batch)

Full hierarchy with compliance-critical classification:

```
ENT-atlanta-pharma           Enterprise
  SIT-decatur-campus         Site
    ARA-sterile-production   Area (production — cleanroom)
      PLT-solid-dose         Plant: Solid Dosage Forms
        LIN-granulation      Line: Wet Granulation
          WCL-mixing         WorkCell: High-shear mixer
            MCH-mixer-gea    Machine: GEA PharmaConnect
              SNS-torque      Sensor: torque (rotor torque)
              SNS-temp-prod   Sensor: temperature (product probe)
              SNS-humidity    Sensor: humidity (capacitive)
          WCL-drying         WorkCell: Fluid bed dryer
            MCH-dryer-gea    Machine: GEA FlexStream
              SNS-inlet-temp  Sensor: temperature (inlet air)
              SNS-exhaust-t   Sensor: temperature (exhaust)
              SNS-moisture    Sensor: humidity (NIR probe)
        LIN-compression      Line: Tablet Compression
          MCH-press-korsch   Machine: Korsch XL400 Press
            SNS-comp-force   Sensor: force (compression)
            SNS-eject-force  Sensor: force (ejection)
            SNS-weight       Sensor: weight (tablet weight)
    ARA-cleanroom-env        Area (environmental monitoring)
      PLT-env-monitoring     Plant: Environmental
        LIN-room-monitor     Line: Room Monitoring
          MCH-particle-cnt   Machine: Particle Counter (Grade B)
            SNS-05um-count   Sensor: count (≥0.5µm particles)
            SNS-50um-count   Sensor: count (≥5.0µm particles)
          MCH-dp-monitor     Machine: Differential Pressure
            SNS-room-dp      Sensor: pressure (room ΔP)
            SNS-room-temp    Sensor: temperature
            SNS-room-rh      Sensor: humidity
```

**Total entities:** 1 Enterprise, 1 Site, 2 Areas, 3 Plants, 3 Lines, 2 WorkCells, 6 Machines, 14 Sensors = **32 entities**

### 9.3 TMNL Schema → ISA-95 Level Mapping

| TMNL Schema | ISA-95 Level | Automation Level | ID Prefix | Status States | Container? | File |
|-------------|-------------|-----------------|-----------|---------------|-----------|------|
| `Enterprise` | Level 4 (Business) | 4 | `ENT-` | active, restructuring, merged, dissolved | Yes | `schemas/assets/enterprise/schema.ts` |
| `Site` | Level 3 (MES - Geographic) | 3 | `SIT-` | planned, under_construction, operational, seasonal_shutdown, closed, decommissioned | Yes | `schemas/assets/site/schema.ts` |
| `Area` | Level 2 (Supervisory) | 2 | `ARA-` | active, restricted, maintenance, inactive, decommissioned | Yes | `schemas/assets/area/schema.ts` |
| `Plant` | Level 3 (MES - Functional) | 3 | `PLT-` | commissioning, operational, scheduled_shutdown, emergency_shutdown, maintenance_shutdown, decommissioned | Yes | `schemas/assets/plant/schema.ts` |
| `Line` | Level 1 (Work Center) | 1 | `LIN-` | idle, running, changeover, starved, blocked, maintenance, decommissioned | Yes | `schemas/assets/line/schema.ts` |
| `WorkCell` | Level 1 (Work Unit) | 1 | `WCL-` | idle, setup, running, blocked, faulted, maintenance, decommissioned | Yes | `schemas/assets/workcell/schema.ts` |
| `Machine` | Level 1 (Work Unit) | 1 | `MCH-` | commissioned, operational, idle, faulted, scheduled_maintenance, unscheduled_maintenance, retired, decommissioned | Yes | `schemas/assets/machine/schema.ts` |
| `Device` | Level 0 (Actuator) | 0 | `DEV-` | provisioned, online, offline, faulted, firmware_update, decommissioned | No (leaf) | `schemas/assets/device/schema.ts` |
| `Sensor` | Level 0 (Measurement) | 0 | `SNS-` | active, calibrating, needs_calibration, faulted, offline, decommissioned | No (leaf) | `schemas/assets/sensor/schema.ts` |

---

## 10. Codebase Grounding

Every claim in this section maps to existing codebase artifacts. The following table traces assertions to source files.

### 10.1 Entity Schemas

| Schema | File | Key Lines | Verified Feature |
|--------|------|-----------|-----------------|
| Enterprise | `src/lib/iiot/schemas/assets/enterprise/schema.ts` | L29-36 (EnterpriseId), L56-66 (EnterpriseStatus), L96-150 (Enterprise class) | ISA-95 L4, industry field, branded IDs, `getAutomationLevel()` returns 4 |
| Site | `src/lib/iiot/schemas/assets/site/schema.ts` | L30-38 (SiteId), L57-70 (SiteStatus), L107-174 (Site class) | ISA-95 L3, timezone, geographic fields, required `enterpriseId` |
| Area | `src/lib/iiot/schemas/assets/area/schema.ts` | L32-40 (AreaId), L59-71 (AreaStatus), L81-94 (AreaType), L137-199 (Area class) | ISA-95 L2, areaType enum (production/warehouse/maintenance/quality/shipping/receiving) |
| Plant | `src/lib/iiot/schemas/assets/plant/schema.ts` | L28-36 (PlantId), L54-67 (PlantStatus), L99-150 (Plant class) | ISA-95 L3, timezone, ERP siteCode integration |
| Line | `src/lib/iiot/schemas/assets/line/schema.ts` | L32-40 (LineId), L63-77 (LineStatus), L118-182 (Line class) | OEE-specific statuses (idle/running/changeover/starved/blocked), capacity field |
| WorkCell | `src/lib/iiot/schemas/assets/workcell/schema.ts` | L33-41 (WorkCellId), L65-79 (WorkCellStatus), L121-185 (WorkCell class) | Cycle time tracking, sequence position, cell type classification |
| Machine | `src/lib/iiot/schemas/assets/machine/schema.ts` | L29-37 (MachineId), L62-77 (MachineStatus), L114-216 (Machine class) | machineType, manufacturer, model, serial, maintenance dates, `isMaintenanceOverdue()` |
| Device | `src/lib/iiot/schemas/assets/device/schema.ts` | L30-38 (DeviceId), L61-83 (DeviceType), L115-128 (DeviceStatus), L175-242 (Device class) | 15 device types, control mode, OPC-UA nodeId, `isActuator()` returns true |
| Sensor | `src/lib/iiot/schemas/assets/sensor/schema.ts` | L30-38 (SensorId), L55-79 (SensorType), L89-128 (MeasurementUnit), L203-319 (Sensor class) | 16 sensor types, 23 measurement units, threshold checking, calibration tracking |

### 10.2 Event-Sourced Entities

| Entity | File | Event Sourced? | Key Compliance Feature |
|--------|------|---------------|----------------------|
| AlarmEntity | `src/lib/iiot/entity/AlarmEntity.ts` | Yes | ISA-18.2 lifecycle (Create → Acknowledge → Clear) |
| WorkOrderEntity | `src/lib/iiot/entity/WorkOrderEntity.ts` | Yes | 12-state lifecycle (Create → Submit → Approve → Start → Complete → Close) with rejection/cancellation paths |
| EquipmentStateEntity | `src/lib/iiot/entity/EquipmentStateEntity.ts` | Yes | OEE tracking with GetDurations, GetOee, TransitionState RPCs |
| AssetEntity | `src/lib/iiot/entity/AssetEntity.ts` | No | ISA-95 hierarchy CRUD (Get, GetChildren, GetHierarchy, Update) |
| SensorEntity | `src/lib/iiot/entity/SensorEntity.ts` | No | Time-series aggregation (GetLatestReading, GetAggregatedReadings, GetReadingStats) |

### 10.3 Adapter Layer

| Adapter | File | Protocol | Status |
|---------|------|----------|--------|
| SparkplugAdapterLive | `src/lib/iiot/adapters/sparkplug-adapter.ts` | Sparkplug B (MQTT) | **Implemented** — NBIRTH/DBIRTH auto-discovery |
| SparkplugPublisher | `src/lib/iiot/adapters/sparkplug-publisher.ts` | Sparkplug B (MQTT) | **Implemented** — Outbound publishing |
| ModbusAdapterStub | `src/lib/iiot/adapters/modbus-adapter-stub.ts` | Modbus RTU/TCP | **Stub** — Protocol: 'modbus', subscribe/healthCheck die with "not yet implemented" |
| OpcUaAdapterStub | `src/lib/iiot/adapters/opcua-adapter-stub.ts` | OPC UA | **Stub** — Protocol: 'opcua', subscribe/healthCheck die with "not yet implemented" |
| MockAdapterLive | `src/lib/iiot/adapters/mock-adapter.ts` | Simulated | **Implemented** — For testing |

### 10.4 Pipeline Composition

| Component | File | Purpose |
|-----------|------|---------|
| IngestionAdapter (Service) | `src/lib/iiot/adapters/ingestion.ts` | Protocol-agnostic ingestion interface |
| TopicRouter | `src/lib/iiot/adapters/device-routing.ts` | Route readings to correct entity by topic/glob pattern |
| ReadingProcessor | `src/lib/iiot/adapters/reading-processor.ts` | Batch and process readings with configured routing |
| AlarmDetector | `src/lib/iiot/adapters/alarm-detection.ts` | Check sensor thresholds, fire alarms |
| QualityMapping | `src/lib/iiot/adapters/quality-mapping.ts` | Map OPC UA/Sparkplug quality codes to TMNL quality scores |
| IngestionService | `src/lib/iiot/adapters/ingestion-service.ts` | Composed pipeline (SparkplugPipelineLayer) |
| IngestionChannel | `src/lib/iiot/adapters/ingestion-channel.ts` | Effect ChannelService binding for ingestion |

### 10.5 EntityStack

The `EntityStack.ts` file (`src/lib/iiot/entity/EntityStack.ts:54-67`) composes all 12 entity handlers into a single `EntityHandlersLayer` via `Layer.mergeAll()`:

```typescript
// EntityHandlersLayer merges all entity handlers:
// - AlarmEntityHandlers (event-sourced)
// - WorkOrderEntityHandlers (event-sourced)
// - EquipmentStateEntityHandlers (event-sourced)
// - EnterpriseEntityHandlers, SiteEntityHandlers, AreaEntityHandlers,
//   PlantEntityHandlers, LineEntityHandlers, WorkCellEntityHandlers,
//   MachineAssetEntityHandlers, DeviceEntityHandlers, SensorAssetEntityHandlers
```

`EntityTestingStack` (`EntityStack.ts:90-93`) provides a test-ready composition with in-memory state services and feature flags disabled.

---

## 11. Schema Gap Analysis

Based on the vertical analysis and process type classification, the following gaps exist in the current TMNL schema:

### 11.1 Missing SensorType Literals

The current `SensorType` enum (`sensor/schema.ts:55-79`) covers 16 types. The vertical analysis reveals additional types needed:

| Missing Type | Vertical Need | Proposed Literal |
|-------------|---------------|-----------------|
| Particulate count | Pharmaceutical (clean room) | `particulate` |
| Composition/Analyzer | Chemical (gas chromatography) | `composition` |
| Displacement | CNC (tool wear via displacement) | `displacement` |
| Color/spectral | Automotive/Electronics (vision) | `spectral` |

**Impact:** Low — these can be represented by the existing `other` literal, but specific types enable better auto-classification and alarm thresholding.

### 11.2 Missing MeasurementUnit Literals

| Missing Unit | Vertical Need | Proposed Literal |
|-------------|---------------|-----------------|
| Parts per million | Chemical (composition), Pharma (TOC) | `ppm` |
| Parts per billion | Pharma (water quality) | `ppb` |
| Count per m³ | Pharma (particulate) | `count_per_m3` |
| Microsiemens/cm | Chemical/F&B (conductivity) | `uS_cm` |
| pH units | Chemical/F&B (currently using `unitless`) | `pH` |
| Degrees | Metal fab (bend angle) | `degrees` |
| Strokes/min | Automotive (press speed) | `spm` |

### 11.3 Process Manufacturing Extensions

The current schema supports discrete and repetitive manufacturing well. For P3 (batch) and P4 (continuous) support, the following extensions are needed:

| Extension | ISA-95 Concept | Current Gap | Proposed Solution |
|-----------|---------------|-------------|-------------------|
| **Recipe management** | ISA-88 Procedure/Phase model | WorkOrder tracks lifecycle but not recipe parameters | Add `Recipe` schema linked to WorkOrder |
| **Process Cell** | ISA-95 Process Cell | No equivalent in current hierarchy | Add ProcessCell schema between Area and Unit |
| **Unit (process)** | ISA-95 Unit | Machine schema doesn't model interconnected units | Extend Machine or add Unit schema with connection topology |
| **Batch scheduling** | ISA-95 Production Schedule | Not modeled | Add BatchSchedule schema linked to WorkOrder + Equipment |
| **SPC integration** | Statistical Process Control | No control chart or Cp/Cpk modeling | Add SPC schema for control limits, rules, trending |

### 11.4 Vertical-Specific Metadata

The current schemas use `AssetMetadata` (open-ended key-value) for extensibility. For compliance-critical verticals, typed metadata extensions would provide runtime validation:

| Vertical | Metadata Need | Proposed Approach |
|----------|--------------|-------------------|
| Pharmaceutical | GMP classification (Grade A/B/C/D), validated state, calibration certificates | Schema.TaggedStruct `PharmaMetadata` extending AssetMetadata |
| Automotive | IATF 16949 control plan reference, PPAP level, customer-specific codes | Schema.TaggedStruct `AutomotiveMetadata` |
| Food & Beverage | HACCP critical control point designation, allergen zone classification | Schema.TaggedStruct `FoodSafetyMetadata` |

---

## 12. TypeScript Code Examples: Vertical-to-Entity Mapping

The following TypeScript examples demonstrate how each vertical maps to TMNL entity creation using existing schemas. These are not hypothetical — they use the exact `Schema.TaggedClass`, branded IDs, and `CreateParams` structures from the codebase.

### 12.1 CNC Machine Shop — Earl's Onboarding

```typescript
import { Option, DateTime } from 'effect'
import { makeEnterpriseId } from '@gbg/tmnl/iiot/schemas/assets/enterprise'
import { makeSiteId, type SiteId } from '@gbg/tmnl/iiot/schemas/assets/site'
import { makePlantId, type PlantId } from '@gbg/tmnl/iiot/schemas/assets/plant'
import { makeLineId, type LineId } from '@gbg/tmnl/iiot/schemas/assets/line'
import { makeMachineId, type CreateMachineParams } from '@gbg/tmnl/iiot/schemas/assets/machine'
import { makeSensorId, type CreateSensorParams } from '@gbg/tmnl/iiot/schemas/assets/sensor'
import { makeDeviceId, type CreateDeviceParams } from '@gbg/tmnl/iiot/schemas/assets/device'

// Earl's hierarchy — telescoped (Enterprise = Organization = Site = Plant)
const enterpriseId = makeEnterpriseId('earls-precision')
const siteId = makeSiteId('east-atlanta-shop')
const plantId = makePlantId('main')
const lineId = makeLineId('machining')

// CNC Mill — the primary machine
const cncMill: CreateMachineParams = {
  slug: 'cnc-haas-vf2',
  name: 'Haas VF-2 CNC Mill',
  machineType: 'CNC Mill',
  manufacturer: Option.some('Haas Automation'),
  modelNumber: Option.some('VF-2'),
  serialNumber: Option.some('HV2-2019-001'),
  enterpriseId,
  siteId,
  plantId,
  lineId,
  workCellId: Option.none(),
  description: Option.some('3-axis vertical machining center, 30x16x20 travel'),
}

// Spindle vibration sensor — the most critical CNC sensor
const spindleVibration: CreateSensorParams = {
  slug: 'spindle-vib-vf2',
  name: 'VF-2 Spindle Vibration',
  machineId: makeMachineId('cnc-haas-vf2'),
  sensorType: 'vibration',
  unit: 'g',
  sampleRateMs: 1,           // 1 kHz for FFT analysis
  thresholdHigh: 2.5,        // Warning: 2.5g RMS
  thresholdCritical: 5.0,    // Critical: 5.0g RMS — stop machine
  thresholdLow: undefined,
  thresholdCriticalLow: undefined,
  opcUaNodeId: undefined,     // Earl has no OPC UA — 4-20mA via gateway
}

// Spindle motor — the primary actuator
const spindleMotor: CreateDeviceParams = {
  slug: 'spindle-motor-vf2',
  name: 'VF-2 Spindle Motor',
  machineId: makeMachineId('cnc-haas-vf2'),
  deviceType: 'servo',
  controlMode: 'auto',
  ratedPower: 22400,          // 22.4 kW (30 HP)
  powerUnit: 'watts',
}
```

### 12.2 Injection Molding — Cavity Pressure Monitoring

```typescript
import { Option } from 'effect'
import { makeSensorId, type CreateSensorParams } from '@gbg/tmnl/iiot/schemas/assets/sensor'
import { makeMachineId, type CreateMachineParams } from '@gbg/tmnl/iiot/schemas/assets/machine'

// Injection molding machine with process-critical sensors
const injectionPress: CreateMachineParams = {
  slug: 'engel-victory-200',
  name: 'Engel Victory 200T',
  machineType: 'Injection Molding Press',
  manufacturer: Option.some('Engel'),
  modelNumber: Option.some('Victory 200/50'),
  serialNumber: Option.some('EV200-2021-0042'),
  enterpriseId: makeEnterpriseId('atlanta-molding'),
  siteId: makeSiteId('industrial-park'),
  plantId: makePlantId('molding-floor'),
  lineId: makeLineId('press-line-1'),
  workCellId: Option.none(),
  description: Option.some('200-ton hydraulic injection molding press'),
}

// Cavity pressure — the gold standard sensor for part quality
const cavityPressure: CreateSensorParams = {
  slug: 'cavity-press-engel-1',
  name: 'Cavity Pressure Sensor 1',
  machineId: makeMachineId('engel-victory-200'),
  sensorType: 'pressure',
  unit: 'bar',
  sampleRateMs: 1,           // 1 ms — captures injection profile
  thresholdHigh: 1500,       // Warning: 1500 bar
  thresholdCritical: 2000,   // Critical: 2000 bar — flash risk
  thresholdLow: 50,          // Warning: short shot below 50 bar
  thresholdCriticalLow: 20,  // Critical: severe short shot
}

// Melt temperature — correlates with viscosity and part quality
const meltTemp: CreateSensorParams = {
  slug: 'melt-temp-engel-1',
  name: 'Barrel Melt Temperature',
  machineId: makeMachineId('engel-victory-200'),
  sensorType: 'temperature',
  unit: 'celsius',
  sampleRateMs: 100,
  thresholdHigh: 280,        // Material degradation threshold
  thresholdCritical: 310,    // Critical: material decomposition
  thresholdLow: 200,         // Too cold: incomplete fill
  thresholdCriticalLow: 180, // Critical: frozen melt
}
```

### 12.3 Pharmaceutical — Clean Room Monitoring (21 CFR Part 11)

```typescript
import { Option } from 'effect'
import { makeAreaId, type CreateAreaParams } from '@gbg/tmnl/iiot/schemas/assets/area'
import { makeSensorId, type CreateSensorParams } from '@gbg/tmnl/iiot/schemas/assets/sensor'

// Clean room area — Grade B classification
const sterileArea: CreateAreaParams = {
  slug: 'sterile-grade-b',
  name: 'Sterile Production Grade B',
  siteId: makeSiteId('decatur-campus'),
  status: Option.some('active' as const),
  areaType: 'production',
  building: 'Building 3',
  floor: '2nd Floor',
  zone: 'Zone B-1',
  description: 'Grade B cleanroom for aseptic filling operations',
}

// Particle counter — ≥0.5µm particles per m³
// ISO 14644-1 Grade B limit: 3,520 particles/m³ at rest
const particleCounter05: CreateSensorParams = {
  slug: 'particle-05um-b1',
  name: 'Grade B Zone B-1 Particle Counter (≥0.5µm)',
  machineId: makeMachineId('particle-counter-b1'),
  sensorType: 'other',       // Gap: needs 'particulate' type
  unit: 'count',             // Gap: needs 'count_per_m3' unit
  sampleRateMs: 60000,       // 1 minute continuous monitoring
  thresholdHigh: 2500,       // Warning: 71% of limit
  thresholdCritical: 3520,   // Critical: ISO 14644 Grade B limit
}

// Room differential pressure — critical for containment
const roomDP: CreateSensorParams = {
  slug: 'room-dp-b1',
  name: 'Grade B Zone B-1 Differential Pressure',
  machineId: makeMachineId('dp-monitor-b1'),
  sensorType: 'pressure',
  unit: 'pascal',
  sampleRateMs: 1000,        // 1 second
  thresholdLow: 10,          // Warning: ΔP below 10 Pa
  thresholdCriticalLow: 5,   // Critical: containment breach risk
}
```

### 12.4 Automotive Assembly — Torque Fastening with IATF 16949 Traceability

```typescript
import { Option } from 'effect'
import { makeWorkCellId, type CreateWorkCellParams } from '@gbg/tmnl/iiot/schemas/assets/workcell'
import { makeSensorId, type CreateSensorParams } from '@gbg/tmnl/iiot/schemas/assets/sensor'
import { makeLineId } from '@gbg/tmnl/iiot/schemas/assets/line'

// Fastening station — IATF 16949 requires torque monitoring on all safety-critical joints
const fasteningCell: CreateWorkCellParams = {
  slug: 'fastening-station-a3',
  name: 'Chassis Fastening Station A3',
  lineId: makeLineId('chassis-assembly'),
  status: Option.some('running' as const),
  cellType: 'fastening',
  cycleTimeSeconds: 35,       // 35 seconds per vehicle at this station
  position: 3,                // 3rd station in line sequence
  description: 'Front subframe mounting — 8 bolts, torque-to-yield spec',
}

// Torque sensor — every fastener on a safety-critical joint is monitored
// IATF 16949 Core Tool: MSA (Measurement System Analysis) requires Gage R&R < 10%
const torqueSensor: CreateSensorParams = {
  slug: 'torque-subframe-a3',
  name: 'Subframe Bolt Torque Station A3',
  machineId: makeMachineId('nutrunner-atlas-a3'),
  sensorType: 'torque',
  unit: 'nm',
  sampleRateMs: 1,           // Per fastening event (angle + torque curve)
  thresholdHigh: 135,        // Upper spec limit: 135 Nm
  thresholdCritical: 140,    // Critical: bolt yield territory
  thresholdLow: 115,         // Lower spec limit: 115 Nm
  thresholdCriticalLow: 110, // Critical: insufficient clamp load
}

// Weld current sensor — resistance spot welding on body-in-white
const weldCurrent: CreateSensorParams = {
  slug: 'weld-current-bw-1',
  name: 'Body-in-White Spot Weld Current',
  machineId: makeMachineId('spot-welder-bw-1'),
  sensorType: 'current',
  unit: 'ampere',             // Actually kA for spot welding, but ampere is closest
  sampleRateMs: 1,            // 1 ms during weld pulse
  thresholdHigh: 14000,       // 14 kA upper spec
  thresholdCritical: 16000,   // Critical: expulsion territory
  thresholdLow: 9000,         // 9 kA lower spec
  thresholdCriticalLow: 7000, // Critical: cold weld, no nugget
}
```

### 12.5 Food & Beverage — FSMA Temperature Monitoring

```typescript
import { Option } from 'effect'
import { makeSensorId, type CreateSensorParams } from '@gbg/tmnl/iiot/schemas/assets/sensor'

// Pasteurization temperature — HACCP Critical Control Point
// FDA FSMA requires continuous monitoring with tamper-evident records
const pasteurizationTemp: CreateSensorParams = {
  slug: 'temp-pasteurizer-1',
  name: 'Pasteurizer Zone 1 Temperature',
  machineId: makeMachineId('htst-pasteurizer-1'),
  sensorType: 'temperature',
  unit: 'celsius',
  sampleRateMs: 1000,        // 1 second — FSMA continuous monitoring
  thresholdLow: 71.5,        // Warning: approaching minimum pasteurization temp
  thresholdCriticalLow: 71.1, // Critical: below 71.1°C/15s = not pasteurized
  thresholdHigh: 78,         // Warning: over-pasteurization (quality impact)
  thresholdCritical: 85,     // Critical: product damage
  description: 'HTST pasteurizer zone 1 — HACCP CCP #2',
}

// pH monitoring — critical for fermented products
const phSensor: CreateSensorParams = {
  slug: 'ph-fermenter-1',
  name: 'Fermenter 1 pH',
  machineId: makeMachineId('fermenter-1'),
  sensorType: 'ph',
  unit: 'unitless',           // pH is dimensionless
  sampleRateMs: 5000,         // 5 seconds
  thresholdHigh: 4.6,         // Warning: pH above 4.6 = pathogen growth risk
  thresholdCritical: 5.0,     // Critical: HACCP CCP deviation
  thresholdLow: 3.0,          // Warning: too acidic — product quality
  thresholdCriticalLow: 2.5,  // Critical: product spoilage
}
```

### 12.6 Vertical Process Type Summary

```typescript
/**
 * Mapping of manufacturing verticals to ISA-95 process types,
 * primary TMNL entities, and compliance standards.
 *
 * This is a reference type — not runtime code. It demonstrates
 * how the TMNL schema system maps to real-world verticals.
 */
type VerticalProfile = {
  readonly vertical: string
  readonly processType: 'discrete' | 'process' | 'batch' | 'repetitive'
  readonly primaryEntities: readonly string[]
  readonly eventSourcedEntities: readonly string[]
  readonly complianceStandards: readonly string[]
  readonly typicalSensorCount: { min: number; max: number }
  readonly typicalDataRateKBs: { min: number; max: number }
}

const VERTICAL_PROFILES: readonly VerticalProfile[] = [
  {
    vertical: 'CNC Machine Shop',
    processType: 'discrete',
    primaryEntities: ['Machine', 'Sensor', 'Device'],
    eventSourcedEntities: ['EquipmentState', 'Alarm'],
    complianceStandards: ['ISO 9001'],
    typicalSensorCount: { min: 5, max: 25 },
    typicalDataRateKBs: { min: 5, max: 15 },
  },
  {
    vertical: 'Injection Molding',
    processType: 'discrete',
    primaryEntities: ['Machine', 'Sensor', 'WorkCell'],
    eventSourcedEntities: ['EquipmentState', 'Alarm', 'WorkOrder'],
    complianceStandards: ['ISO 9001', 'IATF 16949'],
    typicalSensorCount: { min: 8, max: 40 },
    typicalDataRateKBs: { min: 15, max: 100 },
  },
  {
    vertical: 'Food & Beverage',
    processType: 'batch',
    primaryEntities: ['Line', 'Machine', 'Sensor'],
    eventSourcedEntities: ['EquipmentState', 'Alarm', 'WorkOrder'],
    complianceStandards: ['FDA FSMA', 'HACCP', 'ISO 22000', '21 CFR Part 11'],
    typicalSensorCount: { min: 20, max: 200 },
    typicalDataRateKBs: { min: 8, max: 50 },
  },
  {
    vertical: 'Chemical Processing',
    processType: 'process',
    primaryEntities: ['Machine', 'Sensor', 'Line'],
    eventSourcedEntities: ['EquipmentState', 'Alarm'],
    complianceStandards: ['OSHA PSM', 'EPA RMP', 'ISA-18.2'],
    typicalSensorCount: { min: 100, max: 5000 },
    typicalDataRateKBs: { min: 20, max: 1000 },
  },
  {
    vertical: 'Automotive Assembly',
    processType: 'repetitive',
    primaryEntities: ['Line', 'WorkCell', 'Machine', 'Sensor'],
    eventSourcedEntities: ['EquipmentState', 'Alarm', 'WorkOrder'],
    complianceStandards: ['IATF 16949', 'AIAG Core Tools'],
    typicalSensorCount: { min: 50, max: 1000 },
    typicalDataRateKBs: { min: 50, max: 500 },
  },
  {
    vertical: 'Electronics/PCB',
    processType: 'repetitive',
    primaryEntities: ['Line', 'Machine', 'Sensor'],
    eventSourcedEntities: ['EquipmentState', 'Alarm', 'WorkOrder'],
    complianceStandards: ['IPC-A-610', 'J-STD-001', 'ISO 9001'],
    typicalSensorCount: { min: 30, max: 200 },
    typicalDataRateKBs: { min: 30, max: 150 },
  },
  {
    vertical: 'Pharmaceutical',
    processType: 'batch',
    primaryEntities: ['Area', 'Machine', 'Sensor'],
    eventSourcedEntities: ['EquipmentState', 'Alarm', 'WorkOrder'],
    complianceStandards: ['21 CFR Parts 210/211', '21 CFR Part 11', 'EU GMP Annex 1', 'ISO 14644'],
    typicalSensorCount: { min: 50, max: 500 },
    typicalDataRateKBs: { min: 25, max: 100 },
  },
  {
    vertical: 'Metal Fabrication',
    processType: 'discrete',
    primaryEntities: ['Machine', 'Sensor', 'Device'],
    eventSourcedEntities: ['EquipmentState', 'Alarm'],
    complianceStandards: ['AWS D1.1', 'ASME BPVC', 'ISO 3834'],
    typicalSensorCount: { min: 5, max: 50 },
    typicalDataRateKBs: { min: 10, max: 50 },
  },
  {
    vertical: 'Plastics/Rubber',
    processType: 'process',
    primaryEntities: ['Line', 'Machine', 'Sensor'],
    eventSourcedEntities: ['EquipmentState', 'Alarm'],
    complianceStandards: ['ISO 9001', 'UL/CSA'],
    typicalSensorCount: { min: 15, max: 80 },
    typicalDataRateKBs: { min: 8, max: 70 },
  },
  {
    vertical: 'Packaging',
    processType: 'repetitive',
    primaryEntities: ['Line', 'Machine', 'Sensor'],
    eventSourcedEntities: ['EquipmentState', 'Alarm', 'WorkOrder'],
    complianceStandards: ['FDA', 'GS1', 'ISO 9001'],
    typicalSensorCount: { min: 15, max: 100 },
    typicalDataRateKBs: { min: 12, max: 80 },
  },
] as const
```

---

## 13. Brownfield Integration Playbooks

Each tier requires a specific integration approach. These playbooks define the step-by-step path from legacy equipment to live Sparkplug B data in the TMNL network.

### 13.1 Tier 0 Playbook: Manual Equipment → First Digital Signal

**Target:** Manual lathe, hand-operated press, analog-gauge-only equipment.

**Hardware kit ($200-500):**
- Clamp-on current transformer (CT) for motor power monitoring ($30-50)
- Bolt-on MEMS accelerometer for vibration ($40-80)
- Magnetic-mount K-type thermocouple for surface temperature ($20-30)
- Advantech ADAM-4017+ 8-channel analog input module ($150)
- Advantech ADAM-4570 RS-485-to-Ethernet gateway ($200)
- Or: combined unit like Moxa ioLogik E1242 ($300, 4AI + 4DI + Ethernet)

**Integration steps:**
1. Attach sensors to machine (non-invasive, no electrical work required)
2. Wire sensors to analog input module (4-20mA/0-10V)
3. Connect module to gateway via RS-485
4. Configure gateway to expose readings as Modbus TCP registers
5. Install TMNL edge agent on Raspberry Pi ($50)
6. Configure Modbus adapter to poll gateway registers
7. Map registers to TMNL sensor entities via topic routing
8. Sparkplug B NBIRTH announces new sensors to TMNL network

**Time to first data:** 2-4 hours (physical installation) + 15 minutes (TMNL configuration).

**Earl's experience:** Earl clamps a CT on his CNC spindle motor, bolts an accelerometer to the spindle housing, and sticks a thermocouple on the bearing cap. He plugs these into an ADAM module, runs an Ethernet cable to a Raspberry Pi under his workbench, and opens the TMNL app on his phone. 15 minutes later, he sees spindle vibration trending, gets his first alert when the bearing temperature exceeds threshold, and discovers that his spindle draws 30% more power on Thursday afternoons (worn insert, discovered via power trend).

### 13.2 Tier 2 Playbook: Modbus RTU Equipment → Sparkplug B

**Target:** Fanuc CNC controls, Allen-Bradley SLC-500, standalone instruments with RS-485.

**Hardware kit ($100-300):**
- USR-W610 serial-to-WiFi/Ethernet module ($50) or Moxa NPort 5110 ($150)
- Ethernet cable to TMNL edge agent

**Integration steps:**
1. Identify Modbus register map from equipment manual (or use register scanner)
2. Connect serial gateway to equipment RS-485 port
3. Configure gateway: baud rate, parity, slave address
4. Configure TMNL Modbus adapter with register map:
   - Register address → sensor entity mapping
   - Data type (INT16, FLOAT32, UINT32)
   - Scaling factor (raw → engineering units)
5. Test poll cycle: verify readings match equipment display
6. Configure alarm thresholds in TMNL sensor entities
7. Sparkplug B DBIRTH announces new data points

**Time to first data:** 30 minutes (gateway setup) + 15 minutes (TMNL configuration).

### 13.3 Tier 4 Playbook: Industrial Ethernet → Sparkplug B

**Target:** Siemens S7-1500 (PROFINET), Allen-Bradley ControlLogix (EtherNet/IP), Beckhoff (EtherCAT).

**Hardware kit:** $0 (software only — most Tier 4 controllers have built-in OPC UA servers).

**Integration steps:**
1. Enable OPC UA server on the PLC/controller (Siemens: TIA Portal settings; Rockwell: FactoryTalk Linx)
2. Configure OPC UA security (certificate exchange, username/password)
3. Browse OPC UA address space to identify tag nodes
4. Configure TMNL OPC UA adapter with node IDs:
   - NodeId → sensor entity mapping
   - Subscribe to data change notifications (OPC UA Subscription)
5. Quality codes automatically mapped via `mapOpcUaStatusCode()`
6. Sparkplug B DBIRTH announces new data points with quality metadata

**Time to first data:** 30 minutes (OPC UA server config) + 15 minutes (TMNL configuration).

**Advantage over Tier 0-2:** No hardware purchase. No physical wiring. Pure software configuration. This is why Tier 4 equipment has the lowest integration friction and fastest time-to-value.

---

## 14. References

### Standards

- [ISA-95-1] — ANSI/ISA-95.00.01-2025, Enterprise-Control System Integration Part 1: Models and Terminology
- [ISA-88] — ANSI/ISA-88.00.01, Batch Control Part 1: Models and Terminology
- [ISA-18-2] — ANSI/ISA-18.2, Management of Alarm Systems for the Process Industries
- [IEC-61131-9] — IEC 61131-9, IO-Link standard for sensor/actuator communication
- [OPC-UA-14] — OPC Unified Architecture (IEC 62541)
- [SPARKPLUG-B] — Eclipse Sparkplug B v3.0 specification
- [MQTT-5] — OASIS MQTT v5.0 specification
- [MODBUS-ORG] — Modbus Organization protocol specifications
- [PROFINET-SPEC] — PROFINET specification (IEC 61158, IEC 61784)
- [ETHERNET-IP-SPEC] — EtherNet/IP specification (IEC 61158)

### Quality & Compliance Standards

- [ISO-9001] — ISO 9001:2015, Quality Management Systems
- [IATF-16949] — IATF 16949:2016, Automotive Quality Management System
- [AS9100D] — AS9100D:2016, Aerospace Quality Management System
- [FDA-CFR11] — 21 CFR Part 11, Electronic Records and Electronic Signatures
- [FDA-FSMA] — FDA Food Safety Modernization Act
- [ISO-22000] — ISO 22000:2018, Food Safety Management Systems
- [ISO-14644] — ISO 14644, Cleanrooms and Associated Controlled Environments

### Industry Analysis

- [HMS-NETWORKS-2024] — HMS Networks, "Annual Analysis Reveals Steady Growth in Industrial Network Market," June 2024
- [HMS-NETWORKS-2025] — HMS Networks, "Annual Report Confirms Growing Dominance of Industrial Ethernet," May 2025

### Protocols & Transport

- [NATS-PROTO] — NATS protocol specification
- [NATS-LEAFNODE] — NATS Leaf Node architecture
- [NATS-ACCOUNTS] — NATS Account-based multi-tenancy

### TMNL Internal

- [TMNL-UNS] — TMNL Unified Namespace design specification
- [EFFECT-TS] — Effect-TS ecosystem documentation
- [EFFECT-CLUSTER] — @effect/cluster distributed entity framework

### Theory

- [EVENT-SOURCING] — Fowler, M. "Event Sourcing." martinfowler.com, December 2005.
- [CQRS] — Young, G. "CQRS Documents." 2010.
