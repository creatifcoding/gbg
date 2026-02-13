# RFC-001 Section 17: Physical Infrastructure — Edge Hardware, Networking & Deployment Kits

```
Section:       Physical Infrastructure
Parent RFC:    RFC-001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        infra-analyst (Val)
Created:       2026-02-12
Research Base: rfc-section-edge-architecture-v2.md (Section 15 — Tier Model)
               rfc-section-deployment-topology.md (Section 16 — NATS Layout)
               rfc-section-competitive-analysis.md (Competitor Hardware)
               research-manufacturing-commons.md (Earl Test, Small Mfg Economics)
Bibliography:  docs/specifications/bibliography.md
```

<!-- INTEGRATION NOTES (for RFC assembly)
- This section is the PHYSICAL COMPANION to Section 15 (Edge-First Architecture)
  and Section 16 (Deployment Topology). Section 15 defines software tier capabilities;
  this section maps those tiers to actual hardware SKUs, BOMs, and wire diagrams.
- Should be placed AFTER Section 16 (Deployment Topology) and BEFORE the
  security/trust sections.
- Cross-references: rfc-section-edge-architecture-v2.md (T0/T1/T2/T3 software profiles),
  rfc-section-deployment-topology.md (NATS cluster layout),
  rfc-section-competitive-analysis.md (competitor hardware costs for comparison),
  rfc-section-security-trust.md (JWT provisioning, hardware security modules).
- Dependencies: Section 15 MUST define tier software requirements before this section
  maps them to hardware. Section 16 MUST define NATS topology before this section
  specifies network infrastructure.
- All pricing researched Feb 2026. Volume pricing assumes 1K+ unit orders unless noted.
  Memory pricing reflects 2026 LPDDR4/5 escalation (Raspberry Pi price rises of Feb 2026).
-->

---

Every existing IIoT platform treats hardware as a profit center — $200/month leases, $5,000 gateways, $50K edge servers. TMNL treats hardware as a network-growth accelerator. A $450 edge device that connects 200,000 shops is worth more than a $5,000 server that connects 200.

---

## Table of Contents

1. [Conventions](#171-conventions)
2. [Design Principles](#172-design-principles)
3. [Platform Selection Rationale](#173-platform-selection-rationale)
4. [TMNL Edge Device — The T2 Workhorse](#174-tmnl-edge-device--the-t2-workhorse)
5. [TMNL Gateway — The T1 Protocol Bridge](#175-tmnl-gateway--the-t1-protocol-bridge)
6. [Universal Protocol Adapters](#176-universal-protocol-adapters)
7. [Wireless Sensor Nodes](#177-wireless-sensor-nodes)
8. [Deployment Kits — Three Tiers](#178-deployment-kits--three-tiers)
9. [Networking Infrastructure](#179-networking-infrastructure)
10. [Power Infrastructure](#1710-power-infrastructure)
11. [Environmental Specifications](#1711-environmental-specifications)
12. [Physical Signal Chain](#1712-physical-signal-chain)
13. [Competitor Hardware Comparison](#1713-competitor-hardware-comparison)
14. [BOM Sensitivity Analysis](#1714-bom-sensitivity-analysis)
15. [Certification & Compliance](#1715-certification--compliance)
16. [Manufacturing & Supply Chain](#1716-manufacturing--supply-chain)
17. [Codebase Grounding](#1717-codebase-grounding)
18. [Open Questions](#1718-open-questions)
19. [References](#1719-references)

---

## 17.1 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

All pricing is in USD, researched February 2026. Volume pricing assumes orders of
1,000+ units unless otherwise noted. Component prices are subject to market
fluctuations — particularly LPDDR4/5 memory, which has experienced 2x+ price
increases since Q3 2025 due to AI infrastructure demand [RPI-PRICE-2026].

---

## 17.2 Design Principles

### 17.2.1 Hardware as Network Growth Accelerator

The TMNL hardware strategy inverts the industry model:

| Property | Industry Standard | TMNL |
|----------|------------------|------|
| **Hardware role** | Profit center (lease/subscription) | Network growth accelerator |
| **Pricing model** | $200-500/month per machine | One-time purchase, own forever |
| **Margin target** | 60-80% gross margin on hardware | 15-25% (cover costs + warranty) |
| **Upgrade path** | Vendor lock-in, forced replacement | Modular SoM swap, same carrier board |
| **Repair model** | RMA to vendor, 2-week turnaround | Field-replaceable modules, same-day |
| **Software tie-in** | Hardware gates software access | Software runs on any Linux ARM/x86 |

**Rationale**: The manufacturing commons thesis [research-manufacturing-commons.md Section 7]
depends on network density. Every dollar removed from hardware cost adds 2-3 participants
to the network. At 200,000 target organizations, a $100 price reduction on the edge device
represents $20M in reduced adoption friction across the network.

### 17.2.2 The Bill of Materials Discipline

Every hardware design decision MUST be justified by the **BOM Discipline**:

1. **Every component earns its place.** No "nice to have" peripherals. If a CAN bus
   controller adds $3 to BOM but only 15% of deployments need CAN, it goes on an
   expansion module, not the base board.

2. **SoM + Carrier Board architecture.** The System-on-Module (SoM) contains the
   processor, RAM, storage, and wireless. The carrier board contains I/O, power
   regulation, and mechanical mounting. This separation enables:
   - SoM upgrades without carrier board redesign
   - Multiple carrier board variants (DIN-rail, panel-mount, IP67 outdoor)
   - Lower NRE cost per variant

3. **Volume pricing or walk.** No component is selected at single-unit pricing.
   All BOMs are costed at 1K, 5K, and 10K unit quantities. If a part does not
   have a clear volume pricing path, it is replaced.

4. **Second-source everything.** No single-vendor dependency for any critical
   component. The SoM MUST have at least one pin-compatible alternative.

### 17.2.3 The Earl Test — Hardware Edition

Every hardware SKU MUST pass the hardware Earl Test:

- **Can Earl afford it?** A 2-person machine shop with $5K annual equipment budget
  MUST be able to deploy a monitoring solution for under $600 total (edge + gateway + adapter).
- **Can Earl install it?** No special tools beyond a screwdriver and wire strippers.
  DIN-rail snap-on or adhesive mounting. Screw terminals, not soldering.
- **Can Earl maintain it?** LED status indicators. Factory reset button. No SSH
  required for basic operation. Mobile app for initial configuration via BLE.
- **Can Earl expand?** When Earl adds a second machine, does he need a second edge
  device or just a $50 adapter? (Answer: just the adapter.)

---

## 17.3 Platform Selection Rationale

### 17.3.1 Candidate Platform Evaluation

Six platform families were evaluated for the TMNL edge device (T2 tier) and gateway
(T1 tier). Selection criteria: compute capability, industrial I/O, volume pricing,
Linux support quality, thermal envelope, longevity commitment, and supply chain resilience.

#### Candidate Matrix

| Platform | Role | CPU | AI/NPU | RAM | Volume Price (SoM) | Longevity | Linux Quality | Industrial Temp | Verdict |
|----------|------|-----|--------|-----|-------------------|-----------|--------------|----------------|---------|
| **Qualcomm QCS6490** (Dragonwing) | T2 Edge | 8-core Kryo 670 (2.7+2.4+1.8 GHz) | 12 TOPS Hexagon 770 | Up to 16GB LPDDR5 | ~$80-120 @10K | 2036+ | Good (Yocto, Ubuntu) | -40 to +105C | **PRIMARY T2** |
| **NXP i.MX 8M Plus** | T2 Edge (alt) | 4x Cortex-A53 @ 1.8GHz + M7 | 2.3 TOPS NPU | Up to 8GB LPDDR4 | ~$50-80 @10K | 2033+ | Excellent (Yocto, mainline) | -40 to +105C | **SECONDARY T2** |
| **TI AM625x** | T2 Edge (budget) | 4x Cortex-A53 @ 1.4GHz + M4F + PRU | None | Up to 4GB DDR4 | ~$33-55 @10K | 2037+ | Excellent (mainline, TI SDK) | -40 to +105C | **BUDGET T2** |
| **ESP32-S3** | T1 Gateway | Xtensa LX7 dual-core @ 240MHz | None | 512KB + PSRAM | ~$2.50-3.50 @10K | 2035+ | ESP-IDF (RTOS, not Linux) | -40 to +105C | **PRIMARY T1** |
| **Nordic nRF5340** | Sensor Node | Dual Cortex-M33 @ 128MHz | None | 512KB + 256KB | ~$7-8 @1K module | 2035+ | Zephyr RTOS | -40 to +105C | **SENSOR NODE** |
| **Nordic nRF9160** | Cellular Node | Cortex-M33 @ 64MHz | None | 1MB + 256KB | ~$25-33 @1K module | 2035+ | Zephyr RTOS | -40 to +85C | **CELLULAR NODE** |

**Raspberry Pi CM5 was evaluated and rejected as primary platform** despite its excellent
developer ecosystem. Reasons:

1. **Memory pricing volatility**: As of Feb 2026, Raspberry Pi has announced 2x+
   LPDDR4 price increases. A 4GB CM5 now costs $60+ (up from $45), making BOM
   targets unreliable [RPI-PRICE-2026].
2. **No industrial temp range**: CM5 is rated 0-80C, not -40 to +85C industrial.
3. **Supply chain history**: 2021-2023 chip shortage caused 12+ month lead times.
4. **Single-source SoC**: Broadcom BCM2712 has no pin-compatible alternative.

However, Raspberry Pi CM4/CM5 SHOULD be supported as a community/maker tier for
hobbyist deployments via a compatible carrier board design. The TMNL software stack
runs on any ARMv8 Linux system.

### 17.3.2 Primary Platform: Qualcomm Dragonwing QCS6490

The Qualcomm QCS6490 is selected as the primary T2 edge platform for the following
reasons:

**Compute**: 8-core Kryo 670 CPU architecture delivers ~3x the single-threaded
performance of Cortex-A53 platforms (i.MX8M Plus, TI AM62x). This headroom is
critical for running the full TMNL stack concurrently:
- NATS server (leaf node mode) + JetStream persistence
- @effect/cluster SingleRunner with SQL-backed storage
- Sparkplug-B adapter (MQTT bridge)
- 12 entity state machines with full graph validation
- WebSocket server for T0 clients
- Local alarm detection pipeline

**AI/ML at the Edge**: The Hexagon 770 DSP delivers 12 TOPS of neural network
inference without CPU load. This enables:
- Vibration signature anomaly detection (bearing failure prediction)
- Vision-based quality inspection (connected camera modules via MIPI CSI)
- Acoustic anomaly detection (spindle wear, tool breakage patterns)

These are SHOULD capabilities for T2 (see Section 15.2.1), but the hardware makes
them achievable without an external accelerator, which would add $50-100 to BOM.

**Connectivity**: Built-in Wi-Fi 6E and Bluetooth 5.2. Gigabit Ethernet via RGMII.
PCIe 3.0 lane for NVMe storage or 5G modem expansion. CAN-FD controller on-chip
(critical for automotive-adjacent manufacturing).

**Longevity**: Qualcomm has committed to QCS6490 availability through 2036+
[QCS6490-BRIEF]. The pin-compatible QCS5430 provides a cost-down path, and the
QCS8550 provides a performance-up path, all on the same carrier board design.

**Volume Economics**: Lantronix Open-Q 6490CS SoM is priced at $224 retail (4GB
LPDDR5/32GB eMMC) [LANTRONIX-6490]. At 10K volume with direct Qualcomm/ODM
engagement, SoM pricing of $80-120 is achievable based on industry norms for 6nm
SoCs at this density. Thundercomm TurboX C6490 SoM is an alternative supply path.

### 17.3.3 Secondary Platform: NXP i.MX 8M Plus

The i.MX 8M Plus serves as the secondary/alternative T2 platform:

**Strengths**: Mainline Linux kernel support (no vendor BSP dependency). NPU at 2.3
TOPS. Extensive SoM ecosystem (Variscite VAR-SOM-MX8M-PLUS, Toradex Verdin iMX8M
Plus, Compulab). Variscite SoM starts at ~$80 retail; volume pricing of $50-70 @10K
is documented. Dual camera ISP, CAN-FD, dual GbE.

**Tradeoffs vs. QCS6490**: Lower single-thread CPU performance (Cortex-A53 vs Kryo
670). Lower AI throughput (2.3 TOPS vs 12 TOPS). LPDDR4 (not LPDDR5). No Wi-Fi 6E
(only 802.11ac). These are acceptable for deployments that prioritize Linux mainline
support and long-term community maintenance over peak performance.

**Role**: The i.MX 8M Plus is RECOMMENDED as the platform for organizations that
require fully open-source firmware stacks, defense/aerospace supply chain compliance,
or prefer NXP's industrial ecosystem.

### 17.3.4 Budget Platform: TI AM625x

The TI AM625x serves as the budget T2 platform:

**Strengths**: Extremely cost-effective — Variscite VAR-SOM-AM62 starts at **$33**
retail [VARISCITE-AM62]. At 10K volume, SoM cost of $25-35 is achievable. Quad
Cortex-A53 @ 1.4GHz + Cortex-M4F + dual PRU-ICSS real-time co-processors. The PRUs
provide hardware-level protocol handling (EtherCAT, PROFINET) that other platforms
require external PHYs for. Excellent mainline Linux support. 15-year longevity
commitment from TI. Industrial temp rated.

**Tradeoffs**: No AI/NPU (ML inference requires CPU cycles). Lower RAM ceiling (4GB
DDR4). Limited GPU capabilities. No on-chip Wi-Fi (requires external module).

**Role**: The AM62x is RECOMMENDED for cost-sensitive deployments where the full
TMNL T2 stack runs without ML inference requirements. At a $25-35 SoM cost, the
complete edge device BOM target drops to $250-350 — enabling an aggressive
entry-level price point.

### 17.3.5 Gateway Platform: Espressif ESP32-S3

The ESP32-S3 is selected as the primary T1 gateway platform:

**Rationale**: The T1 gateway role (Section 15.2.1) requires: Sparkplug-B adapter
(MQTT client), NATS leaf node (lightweight), sensor reading buffering, and protocol
bridging. These are fundamentally I/O-bound tasks, not compute-bound. An RTOS on
a 240MHz dual-core Xtensa processor with 8MB PSRAM handles this workload.

**Specifications**:
- Dual-core Xtensa LX7 @ 240MHz
- 512KB SRAM + up to 8MB octal PSRAM
- Wi-Fi 802.11 b/g/n + Bluetooth 5 (LE)
- 2x 13-bit SAR ADCs (up to 20 channels)
- 4x SPI, 3x UART, 2x I2C, 2x I2S, SDIO, LCD, camera
- USB OTG
- -40C to +105C operating temperature
- SoC cost: ~$2.50-3.50 @10K from LCSC/Mouser [LCSC-ESP32S3]

**Why not ESP32-C6?** The C6 adds Wi-Fi 6, Bluetooth 5.3, Zigbee, and Thread on
a RISC-V core. For TMNL T1 gateways, the C6 is RECOMMENDED for new designs
starting Q3 2026, as the Matter/Thread ecosystem matures. The S3's dual-core
Xtensa and vector extensions provide better compute throughput for MQTT client
processing in current designs.

---

## 17.4 TMNL Edge Device — The T2 Workhorse

### 17.4.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    TMNL EDGE DEVICE (T2)                     │
│                                                              │
│  ┌──────────────────────────────────────┐   ┌────────────┐  │
│  │           SoM Module                  │   │  Expansion  │  │
│  │  ┌──────────┐  ┌──────────────────┐  │   │   Slot(s)   │  │
│  │  │ QCS6490  │  │ 4-8GB LPDDR5    │  │   │             │  │
│  │  │ 8-core   │  │ 32-128GB eMMC   │  │   │  M.2 Key-E  │  │
│  │  │ Kryo 670 │  │ Wi-Fi 6E + BT5  │  │   │  (5G/LTE    │  │
│  │  │ 12 TOPS  │  │ TPM 2.0         │  │   │   or NVMe)  │  │
│  │  │ NPU      │  │                  │  │   │             │  │
│  │  └──────────┘  └──────────────────┘  │   └────────────┘  │
│  └──────────────────┬───────────────────┘                    │
│                     │ SoM Connector (SMARC 2.1 / custom)     │
│  ┌──────────────────┴───────────────────────────────────────┐│
│  │                  Carrier Board                            ││
│  │                                                           ││
│  │  ┌────────┐ ┌────────┐ ┌──────┐ ┌──────┐ ┌───────────┐ ││
│  │  │ GbE x2 │ │ RS-485 │ │ USB  │ │ HDMI │ │ 24VDC     │ ││
│  │  │ (M12)  │ │ x2     │ │ 3.0  │ │ (opt)│ │ Power In  │ ││
│  │  │        │ │        │ │ x2   │ │      │ │ + PoE     │ ││
│  │  └────────┘ └────────┘ └──────┘ └──────┘ └───────────┘ ││
│  │  ┌────────┐ ┌────────┐ ┌──────────────────────────────┐ ││
│  │  │ CAN-FD │ │ DIO    │ │ Status LEDs + Reset Button   │ ││
│  │  │ (opt)  │ │ 4in/4o │ │ + BLE Config Button          │ ││
│  │  └────────┘ └────────┘ └──────────────────────────────┘ ││
│  └───────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  Enclosure: DIN-rail mount, aluminum, IP40 (IP65 opt) │   │
│  │  Dimensions: 120mm x 80mm x 40mm (approx)             │   │
│  │  Thermal: Fanless, -40C to +70C                        │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 17.4.2 Bill of Materials — Three Price Points

#### BOM Option A: Premium ($450 Target — QCS6490)

| Component | Part / Description | Qty | Unit Cost @1K | Unit Cost @10K | Notes |
|-----------|-------------------|-----|---------------|----------------|-------|
| **SoM** | QCS6490 SoM (8GB LPDDR5, 64GB eMMC, Wi-Fi 6E, BT5.2) | 1 | $140 | $95 | Lantronix/Thundercomm ODM path. 2026 memory prices. |
| **Carrier PCB** | Custom 6-layer PCB, SMARC 2.1 connector | 1 | $18 | $12 | Includes dual GbE PHY (Realtek RTL8211F), RS-485 transceivers, USB hub |
| **Ethernet** | 2x Gigabit Ethernet, M12 D-coded connectors | 2 | $8 | $5 | Industrial-grade IP67 connectors |
| **Serial** | 2x RS-485 isolated, screw terminal | 2 | $4 | $3 | MAX3485 + ADM2587E isolator per channel |
| **USB** | 2x USB 3.0 Type-A | 2 | $2 | $1.50 | Via on-chip USB controller |
| **Digital I/O** | 4-in / 4-out optoisolated, 24VDC | 1 | $6 | $4 | TLP291 optocouplers |
| **Storage** | M.2 Key-M 2242 NVMe slot (SSD not included) | 1 | $3 | $2 | User-supplied NVMe for extended JetStream storage |
| **Expansion** | M.2 Key-E slot (Wi-Fi/5G/LTE module) | 1 | $2 | $1.50 | Optional cellular failover |
| **Power** | 9-36VDC input, wide-range PSU (24VDC nominal) | 1 | $12 | $8 | Mean Well-class DC-DC converter, reverse polarity protection |
| **PoE** | 802.3af/at PoE PD module (optional, populated) | 1 | $8 | $5 | Ag9800 or equivalent |
| **Enclosure** | Aluminum extrusion, DIN-rail clip, IP40 | 1 | $15 | $10 | Powder-coated, thermal pad to case |
| **Thermal** | Thermal pad + aluminum spreader (fanless) | 1 | $3 | $2 | 15W TDP managed via case conduction |
| **Misc** | LEDs (power/status/network x5), buttons (reset/BLE), antenna pigtails, assembly hardware | 1 | $8 | $5 | |
| **Assembly** | SMT + through-hole, test, flash firmware | 1 | $15 | $10 | Contract manufacturer |
| **Certification** | FCC/CE/UL amortized per unit | 1 | $8 | $4 | One-time cost ~$40K amortized over production run |
| | | | **TOTAL @1K** | **TOTAL @10K** | |
| | | | **$252** | **$168** | |

**Target retail price**: **$449** @1K volume (78% markup covers distribution, warranty,
support, firmware updates). **$399** @10K volume (138% markup).

At $449 retail, this device delivers 8-core CPU + 12 TOPS NPU + 8GB RAM + Wi-Fi 6E +
dual GbE + industrial I/O. Comparable industrial PCs (OnLogic Helix 511 at $1,355,
Advantech UNO-2484G at $1,200+, Beckhoff C7015 at $2,000+) cost 3-5x more for
equivalent or lesser compute capability.

#### BOM Option B: Standard ($350 Target — i.MX 8M Plus)

| Component | Part / Description | Qty | Unit Cost @1K | Unit Cost @10K |
|-----------|-------------------|-----|---------------|----------------|
| **SoM** | i.MX 8M Plus SoM (4GB LPDDR4, 32GB eMMC, Wi-Fi 5, BT5) | 1 | $95 | $65 |
| **Carrier PCB** | Custom 6-layer PCB, Verdin/SMARC connector | 1 | $18 | $12 |
| **Ethernet** | 2x Gigabit Ethernet, M12 D-coded | 2 | $8 | $5 |
| **Serial** | 2x RS-485 isolated | 2 | $4 | $3 |
| **USB** | 2x USB 3.0 Type-A | 2 | $2 | $1.50 |
| **Digital I/O** | 4-in / 4-out optoisolated | 1 | $6 | $4 |
| **Storage** | M.2 2242 NVMe slot | 1 | $3 | $2 |
| **Expansion** | M.2 Key-E | 1 | $2 | $1.50 |
| **Power** | 9-36VDC wide-range PSU | 1 | $12 | $8 |
| **Enclosure** | Aluminum, DIN-rail, IP40 | 1 | $15 | $10 |
| **Thermal** | Thermal pad + spreader | 1 | $3 | $2 |
| **Misc** | LEDs, buttons, antennas, hardware | 1 | $8 | $5 |
| **Assembly** | SMT + test + flash | 1 | $15 | $10 |
| **Certification** | FCC/CE/UL amortized | 1 | $8 | $4 |
| | | | **$199** | **$133** |

**Target retail price**: **$349** @1K (75% markup). **$299** @10K (125% markup).

The i.MX 8M Plus variant trades AI inference headroom (2.3 vs 12 TOPS) and RAM
(4GB vs 8GB) for a $100 lower price point. It runs the full TMNL T2 software
stack without ML inference capabilities.

#### BOM Option C: Budget ($250 Target — TI AM62x)

| Component | Part / Description | Qty | Unit Cost @1K | Unit Cost @10K |
|-----------|-------------------|-----|---------------|----------------|
| **SoM** | TI AM62x SoM (2GB DDR4, 16GB eMMC, no Wi-Fi) | 1 | $55 | $38 |
| **Carrier PCB** | Custom 4-layer PCB, VAR-SOM connector | 1 | $14 | $9 |
| **Ethernet** | 2x Gigabit Ethernet, RJ45 | 2 | $4 | $3 |
| **Serial** | 2x RS-485 isolated | 2 | $4 | $3 |
| **USB** | 2x USB 2.0 Type-A | 2 | $1.50 | $1 |
| **Digital I/O** | 4-in / 4-out optoisolated | 1 | $6 | $4 |
| **Storage** | microSD slot (NVMe optional via PRU) | 1 | $1 | $0.75 |
| **Wi-Fi** | External USB Wi-Fi adapter (optional) | 0 | $0 | $0 |
| **Power** | 9-36VDC PSU | 1 | $10 | $7 |
| **Enclosure** | Steel/aluminum, DIN-rail, IP20 | 1 | $10 | $7 |
| **Thermal** | Thermal pad (fanless, 2W TDP) | 1 | $2 | $1.50 |
| **Misc** | LEDs, buttons, hardware | 1 | $6 | $4 |
| **Assembly** | SMT + test + flash | 1 | $12 | $8 |
| **Certification** | FCC/CE amortized | 1 | $6 | $3 |
| | | | **$132** | **$89** |

**Target retail price**: **$249** @1K (89% markup). **$199** @10K (124% markup).

The TI AM62x variant is the **Earl's price point** — the cheapest possible device
that runs the full TMNL T2 software stack. It proves the manufacturing commons
thesis: a $249 device that provides the same entity processing, alarm detection,
and work order management as a $50,000 enterprise SCADA system.

**Tradeoff**: No ML inference, 2GB RAM limits concurrent entity count to ~200,
no on-board Wi-Fi (Ethernet-only or USB dongle), microSD instead of NVMe.
The PRU co-processors compensate by handling EtherCAT/PROFINET in hardware,
reducing CPU load for protocol-heavy environments.

### 17.4.3 Edge Device Comparison Summary

| Spec | Option A (QCS6490) | Option B (iMX8MP) | Option C (AM62x) |
|------|-------------------|-------------------|------------------|
| **Target Price** | $449 / $399 | $349 / $299 | $249 / $199 |
| **CPU** | 8-core Kryo 670, up to 2.7GHz | 4x A53 @ 1.8GHz + M7 | 4x A53 @ 1.4GHz + M4F + PRU |
| **RAM** | 8GB LPDDR5 | 4GB LPDDR4 | 2GB DDR4 |
| **Storage** | 64GB eMMC + NVMe slot | 32GB eMMC + NVMe slot | 16GB eMMC + microSD |
| **AI/NPU** | 12 TOPS | 2.3 TOPS | None |
| **Wi-Fi** | 6E (built-in) | 5 (built-in) | Optional USB dongle |
| **Ethernet** | 2x GbE (M12) | 2x GbE (M12) | 2x GbE (RJ45) |
| **Max Entities** | 500+ | 500 | 200 |
| **ML Inference** | Yes (on-chip NPU) | Yes (limited) | No |
| **Best For** | Full-featured shops, ML-ready | Open-source purists, defense | Earl's shop, budget deployments |

---

## 17.5 TMNL Gateway — The T1 Protocol Bridge

### 17.5.1 Architecture Overview

The T1 gateway is a low-cost protocol bridge that connects legacy equipment to the
TMNL network. It does NOT run the full entity processing stack — it bridges sensor
data from industrial protocols to MQTT/Sparkplug-B, which the T2 edge device consumes.

```
┌─────────────────────────────────────────────────────┐
│                TMNL GATEWAY (T1)                     │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │              ESP32-S3 Module                      │ │
│  │  Dual-core Xtensa LX7 @ 240MHz                   │ │
│  │  512KB SRAM + 8MB PSRAM                           │ │
│  │  Wi-Fi 802.11 b/g/n + BLE 5.0                    │ │
│  │  16MB flash (firmware + config + buffer)          │ │
│  └───────────────────┬─────────────────────────────┘ │
│                      │                                │
│  ┌──────────┐ ┌──────┴─────┐ ┌─────────┐ ┌────────┐ │
│  │ RS-485   │ │ 4x Analog  │ │ Ethernet│ │ 24VDC  │ │
│  │ x2 (iso) │ │ Input      │ │ (RJ45)  │ │ Power  │ │
│  │ Modbus   │ │ 4-20mA /   │ │ 10/100  │ │ 9-36V  │ │
│  │ RTU      │ │ 0-10V      │ │         │ │        │ │
│  └──────────┘ └────────────┘ └─────────┘ └────────┘ │
│  ┌──────────┐ ┌────────────┐ ┌──────────────────────┐│
│  │ 4x DIO   │ │ USB-C      │ │ Status LEDs x3       ││
│  │ (24VDC)  │ │ (config +  │ │ BLE config button    ││
│  │          │ │  power alt)│ │ DIN-rail clip         ││
│  └──────────┘ └────────────┘ └──────────────────────┘│
│                                                      │
│  Enclosure: ABS/PC, DIN-rail, IP40                   │
│  Dimensions: 90mm x 70mm x 35mm                      │
│  Thermal: Passive, -40C to +85C                       │
└─────────────────────────────────────────────────────┘
```

### 17.5.2 Bill of Materials — Three Price Points

#### Gateway Option A: Full-Featured ($150 Target)

| Component | Part / Description | Qty | Unit Cost @1K | Unit Cost @10K |
|-----------|-------------------|-----|---------------|----------------|
| **MCU Module** | ESP32-S3-WROOM-1 (N16R8: 16MB flash, 8MB PSRAM) | 1 | $4.50 | $3.20 |
| **PCB** | Custom 4-layer PCB | 1 | $8 | $5 |
| **Ethernet** | W5500 SPI Ethernet controller + RJ45 jack | 1 | $3 | $2 |
| **RS-485** | 2x isolated RS-485 (MAX3485 + ADM2587E) | 2 | $4 | $3 |
| **Analog Input** | 4x 4-20mA / 0-10V input (ADS1115 16-bit ADC + signal conditioning) | 1 | $8 | $5 |
| **Digital I/O** | 4x optoisolated DIO (24VDC) | 1 | $4 | $3 |
| **USB** | USB-C connector (config, power alt, firmware update) | 1 | $1 | $0.75 |
| **Power** | 9-36VDC input, buck converter to 3.3V/5V | 1 | $5 | $3.50 |
| **Enclosure** | ABS/polycarbonate, DIN-rail clip, IP40 | 1 | $6 | $4 |
| **Misc** | LEDs x3, BLE config button, antenna, screw terminals, assembly hw | 1 | $5 | $3.50 |
| **Assembly** | SMT + test + flash | 1 | $8 | $5 |
| **Certification** | FCC/CE amortized | 1 | $4 | $2 |
| | | | **$60.50** | **$40** |

**Target retail price**: **$149** @1K (146% markup). **$99** @10K (148% markup).

This gateway delivers: 2x Modbus RTU ports + 4x analog inputs + 4x DIO +
Ethernet + Wi-Fi + BLE. It handles the majority of brownfield equipment
connectivity scenarios (CNC machines with Modbus, legacy sensors with 4-20mA,
discrete machines with dry contacts).

#### Gateway Option B: Ethernet-Only ($100 Target)

| Component | Part / Description | Qty | Unit Cost @1K | Unit Cost @10K |
|-----------|-------------------|-----|---------------|----------------|
| **MCU Module** | ESP32-S3-WROOM-1 (N8R2: 8MB flash, 2MB PSRAM) | 1 | $3.50 | $2.50 |
| **PCB** | Custom 4-layer PCB (reduced I/O) | 1 | $6 | $4 |
| **Ethernet** | W5500 + RJ45 | 1 | $3 | $2 |
| **RS-485** | 1x isolated RS-485 | 1 | $2.50 | $1.75 |
| **Digital I/O** | 4x optoisolated DIO | 1 | $4 | $3 |
| **USB** | USB-C | 1 | $1 | $0.75 |
| **Power** | 9-36VDC buck converter | 1 | $5 | $3.50 |
| **Enclosure** | ABS, DIN-rail, IP20 | 1 | $4 | $3 |
| **Misc** | LEDs, button, hardware | 1 | $4 | $3 |
| **Assembly** | SMT + test + flash | 1 | $6 | $4 |
| **Certification** | FCC/CE amortized | 1 | $3 | $1.50 |
| | | | **$42** | **$29** |

**Target retail price**: **$99** @1K (136% markup). **$69** @10K (138% markup).

Reduced variant: 1x RS-485 (not 2), no analog inputs (use external adapter),
Ethernet only (Wi-Fi available but no dedicated antenna for range). This is
the minimum viable gateway for machines with digital protocols (Modbus RTU,
MTConnect over Ethernet).

#### Gateway Option C: Minimal ($50 Target)

| Component | Part / Description | Qty | Unit Cost @1K | Unit Cost @10K |
|-----------|-------------------|-----|---------------|----------------|
| **MCU Module** | ESP32-S3-MINI-1 (N4R2: 4MB flash, 2MB PSRAM) | 1 | $2.80 | $2.00 |
| **PCB** | Custom 2-layer PCB (minimal I/O) | 1 | $3 | $2 |
| **Ethernet** | W5500 + RJ45 | 1 | $3 | $2 |
| **USB** | USB-C | 1 | $1 | $0.75 |
| **Power** | 5VDC via USB-C only | 1 | $1 | $0.75 |
| **Enclosure** | 3D-printed or injection-molded ABS, adhesive mount | 1 | $2 | $1.50 |
| **Misc** | LED x1, button, hardware | 1 | $2 | $1.50 |
| **Assembly** | SMT + test + flash | 1 | $4 | $3 |
| | | | **$19** | **$14** |

**Target retail price**: **$49** @1K. **$39** @10K.

The absolute minimum: an ESP32-S3 with Ethernet and Wi-Fi. No analog inputs,
no RS-485, no DIO. Connects to machines that already speak Ethernet protocols
(MTConnect, OPC UA, EtherNet/IP) or to USB sensors. Powered via USB-C. This
is the "just get data flowing" option for Earl's first day.

### 17.5.3 Gateway Comparison Summary

| Spec | Option A (Full) | Option B (Ethernet) | Option C (Minimal) |
|------|-----------------|--------------------|--------------------|
| **Target Price** | $149 / $99 | $99 / $69 | $49 / $39 |
| **Analog Inputs** | 4x 4-20mA/0-10V | None | None |
| **RS-485** | 2x isolated | 1x isolated | None |
| **Digital I/O** | 4x 24VDC | 4x 24VDC | None |
| **Ethernet** | 10/100 | 10/100 | 10/100 |
| **Wi-Fi** | Yes (antenna) | Yes (PCB antenna) | Yes (PCB antenna) |
| **Power** | 9-36VDC | 9-36VDC | 5VDC USB-C |
| **DIN Rail** | Yes | Yes | Adhesive/optional |
| **Best For** | Legacy analog + Modbus | Digital protocol machines | Modern Ethernet machines |

---

## 17.6 Universal Protocol Adapters

Protocol adapters are standalone modules that convert specific industrial protocols
to Modbus RTU or Ethernet, which the T1 gateway then bridges to MQTT/Sparkplug-B.
The adapter strategy is: **one adapter type per protocol family**.

### 17.6.1 Adapter Catalog

| Adapter | Protocol | Physical Interface | Conversion Target | Est. BOM @1K | Target Retail | Notes |
|---------|----------|-------------------|-------------------|-------------|---------------|-------|
| **TMNL-ADA-485** | Modbus RTU/ASCII | RS-485 (screw terminal) | Direct to Gateway RS-485 | $8 | $29 | Passive cable adapter with termination resistor + ESD protection. Cheapest possible. |
| **TMNL-ADA-AIO** | 4-20mA / 0-10V Analog | Screw terminal (4ch) | Modbus RTU via RS-485 | $25 | $79 | 4-channel 16-bit ADC (ADS1115), isolated, galvanic separation. Powered by loop or 24VDC. |
| **TMNL-ADA-AIO8** | 4-20mA / 0-10V Analog | Screw terminal (8ch) | Modbus RTU via RS-485 | $40 | $119 | 8-channel variant for multi-sensor machines. Industrial: Datexel DAT10017-I class. |
| **TMNL-ADA-DIO** | Dry Contact / 24VDC | Screw terminal (8ch) | Modbus RTU via RS-485 | $20 | $59 | 8-channel optoisolated digital input. Detects machine on/off, door open/close, cycle complete. |
| **TMNL-ADA-232** | RS-232 Serial | DB9 / screw terminal | Modbus RTU via RS-485 | $12 | $39 | RS-232 to RS-485 converter with auto-baud detection. For legacy CNCs with serial output. |
| **TMNL-ADA-OPC** | OPC UA Client | Ethernet (RJ45) | MQTT / Sparkplug-B | $45 | $129 | ESP32-S3 based. Runs lightweight OPC UA client, maps OPC UA nodes to Sparkplug topics. |
| **TMNL-ADA-ENET** | EtherNet/IP | Ethernet (RJ45) | MQTT / Sparkplug-B | $45 | $129 | ESP32-S3 based. Scans EtherNet/IP CIP objects, publishes via Sparkplug. Allen-Bradley/Rockwell. |
| **TMNL-ADA-MTC** | MTConnect | Ethernet (RJ45) | MQTT / Sparkplug-B | $35 | $99 | ESP32-S3 based. HTTP client polls MTConnect agent, maps to Sparkplug. FANUC/Haas/Mazak. |
| **TMNL-ADA-PNET** | PROFINET | Ethernet (RJ45) | MQTT / Sparkplug-B | $55 | $149 | Requires real-time Ethernet PHY. TI AM62x PRU-based for wire-speed packet inspection. Siemens. |
| **TMNL-ADA-CT** | Current Transformer | CT clamp (split-core) | 4-20mA → Modbus RTU | $18 | $49 | Non-invasive power monitoring. Split-core CT + signal conditioner. Detects machine on/off by power draw. |
| **TMNL-ADA-BACNET** | BACnet/IP | Ethernet (RJ45) | MQTT / Sparkplug-B | $40 | $119 | Facilities/HVAC integration. Maps BACnet objects to Sparkplug namespace. |

### 17.6.2 The "Magical Adapter" Strategy

The Prime's vision of "magical adapters and PLCs that connect to everything" is
realized through three principles:

1. **Auto-Discovery**: Every Ethernet-based adapter (OPC, ENET, MTC, PNET, BACNET)
   MUST support automatic device discovery on the local network segment. When
   connected, the adapter scans for compatible devices and presents discovered
   nodes via BLE to the mobile configuration app.

2. **Zero-Configuration Mapping**: For the most common equipment brands (FANUC,
   Haas, Mazak, Siemens, Allen-Bradley, Okuma), the adapter firmware MUST include
   pre-built Sparkplug topic mappings. Connecting a TMNL-ADA-MTC to a FANUC CNC
   with MTConnect should produce structured Sparkplug data within 60 seconds of
   physical connection.

3. **Universal Physical Interface**: All adapters use the same screw terminal
   pitch (3.5mm / 3.81mm) and the same 9-36VDC power input. Wiring is color-coded
   and labeled. Adapters snap onto standard 35mm DIN rail or attach via adhesive
   pads.

### 17.6.3 Legacy Equipment Tier Mapping

This table maps the equipment age tiers (from manufacturing process documentation)
to the recommended adapter + gateway combination:

| Equipment Tier | Age | Typical Interface | Recommended Adapter | Gateway Required | Total Adapter Cost |
|---------------|-----|-------------------|-------------------|-----------------|-------------------|
| **Tier 0** (pre-1980) | 40+ years | No electronic interface, mechanical only | TMNL-ADA-CT (current transformer) | Yes (any) | $49 |
| **Tier 1** (1980-1995) | 30-45 years | 4-20mA analog, RS-232 serial | TMNL-ADA-AIO + TMNL-ADA-232 | Yes (Option A) | $118 |
| **Tier 2** (1995-2010) | 15-30 years | RS-485 Modbus RTU | TMNL-ADA-485 | Yes (any) | $29 |
| **Tier 3** (2010-2020) | 5-15 years | Ethernet: MTConnect, OPC UA | TMNL-ADA-MTC or TMNL-ADA-OPC | Yes (Option B+) | $99-129 |
| **Tier 4** (2020+) | <5 years | Ethernet: EtherNet/IP, PROFINET, OPC UA, MQTT | TMNL-ADA-ENET or TMNL-ADA-PNET | Optional (direct to T2) | $0-149 |
| **Tier 5** (new) | Brand new | Native MQTT / Sparkplug-B | None needed | None needed | $0 |

---

## 17.7 Wireless Sensor Nodes

### 17.7.1 Nordic nRF5340 Sensor Node

For applications where wired connectivity is impractical (vibration sensors on
rotating equipment, environmental sensors in hard-to-reach locations), TMNL
specifies a wireless sensor node platform based on the Nordic nRF5340.

```
┌──────────────────────────────────────┐
│         TMNL SENSOR NODE              │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │  Nordic nRF5340                  │  │
│  │  Dual Cortex-M33 @ 128MHz       │  │
│  │  BLE 5.3 + Thread + Zigbee      │  │
│  │  1MB Flash + 512KB RAM          │  │
│  │  PSA Level 2 Certified          │  │
│  └───────────┬─────────────────────┘  │
│              │                         │
│  ┌───────┐ ┌┴───────┐ ┌────────────┐ │
│  │ Accel │ │ Temp/  │ │ Battery    │ │
│  │ (ADXL│ │ Humid  │ │ CR2477 or  │ │
│  │  345) │ │ (SHT40)│ │ LiPo 500mA│ │
│  └───────┘ └────────┘ └────────────┘ │
│                                       │
│  Enclosure: IP67, adhesive/magnetic   │
│  Battery life: 2-5 years (BLE)        │
│  Range: 100m (BLE), 500m (Thread)     │
└──────────────────────────────────────┘
```

**BOM Estimate**:

| Component | Cost @1K |
|-----------|----------|
| nRF5340 module (BT40E class) | $7.65 |
| Accelerometer (ADXL345) | $3 |
| Temp/Humidity (SHT40) | $2.50 |
| PCB (2-layer) | $2 |
| Battery holder + CR2477 | $1.50 |
| IP67 enclosure (small) | $3 |
| Assembly + flash | $4 |
| **Total** | **$24** |

**Target retail**: **$59** (146% markup)

### 17.7.2 Nordic nRF9160 Cellular Sensor Node

For remote or outdoor equipment (tanks, HVAC units, substations) without local
Wi-Fi or Ethernet coverage:

| Component | Cost @1K |
|-----------|----------|
| nRF9160 + nRF5340 combo module (LN60E40F class) | $49 |
| Sensors (accel + temp/humid) | $5.50 |
| PCB (4-layer, antenna matching) | $5 |
| LTE antenna + GPS antenna | $4 |
| SIM card holder + eSIM | $2 |
| LiPo battery 2000mAh | $4 |
| IP67 enclosure | $5 |
| Assembly + flash | $6 |
| **Total** | **$81** |

**Target retail**: **$179** (121% markup). Requires cellular data plan ($2-5/month
for LTE-M/NB-IoT).

---

## 17.8 Deployment Kits — Three Tiers

### 17.8.1 Earl's Kit (Micro Shop, 1-5 Machines)

**Target customer**: 1-5 employees, 1-5 machines, no IT staff, $0-5K equipment
monitoring budget. This is the "15 minutes to first data" kit.

| Item | SKU | Qty | Unit Price | Total |
|------|-----|-----|-----------|-------|
| TMNL Edge Device (Budget, AM62x) | TMNL-EDGE-C | 1 | $249 | $249 |
| TMNL Gateway (Full) | TMNL-GW-A | 1 | $149 | $149 |
| Current Transformer Adapter | TMNL-ADA-CT | 2 | $49 | $98 |
| 4-20mA Analog Adapter (4ch) | TMNL-ADA-AIO | 1 | $79 | $79 |
| Pre-made RS-485 cable (3m) | TMNL-CBL-485 | 1 | $12 | $12 |
| Pre-made Ethernet cable (3m, shielded) | TMNL-CBL-ETH | 2 | $8 | $16 |
| 24VDC DIN-rail power supply (60W) | TMNL-PSU-60 | 1 | $25 | $25 |
| Quick-start guide + mobile app QR card | TMNL-QSG | 1 | $0 | $0 |
| **Kit Total** | | | | **$628** |

**Earl's all-in cost**: ~$628 for monitoring 2-3 machines. Compare to MachineMetrics
at ~$200/month/machine ($400-600/month for 2-3 machines = $4,800-7,200/year), or
Tulip at ~$500/month platform fee + hardware.

**TMNL payback**: The kit is a one-time purchase. At $628, it pays for itself
versus MachineMetrics in ~2 months. After that, Earl's ongoing cost is $0
(software is included, runs locally, no cloud subscription required).

### 17.8.2 Professional Kit (Small-Medium, 5-20 Machines)

**Target customer**: 5-50 employees, 5-20 machines, part-time IT or tech-savvy
owner, $5K-20K equipment monitoring budget.

| Item | SKU | Qty | Unit Price | Total |
|------|-----|-----|-----------|-------|
| TMNL Edge Device (Standard, iMX8MP) | TMNL-EDGE-B | 1 | $349 | $349 |
| TMNL Gateway (Full) | TMNL-GW-A | 3 | $149 | $447 |
| TMNL Gateway (Ethernet) | TMNL-GW-B | 2 | $99 | $198 |
| Current Transformer Adapter | TMNL-ADA-CT | 5 | $49 | $245 |
| 4-20mA Analog Adapter (4ch) | TMNL-ADA-AIO | 3 | $79 | $237 |
| 8ch Analog Adapter | TMNL-ADA-AIO8 | 2 | $119 | $238 |
| Modbus RTU Adapter | TMNL-ADA-485 | 4 | $29 | $116 |
| MTConnect Adapter | TMNL-ADA-MTC | 2 | $99 | $198 |
| RS-232 Adapter | TMNL-ADA-232 | 2 | $39 | $78 |
| Industrial Ethernet switch (8-port, unmanaged) | TMNL-SW-8 | 2 | $75 | $150 |
| Cabling bundle (RS-485, Ethernet, power, assorted) | TMNL-CBL-PRO | 1 | $120 | $120 |
| 24VDC DIN-rail power supply (120W) | TMNL-PSU-120 | 2 | $45 | $90 |
| **Kit Total** | | | | **$2,466** |

**Per-machine cost**: $123-247 for 10-20 machines (one-time).

### 17.8.3 Enterprise Kit (50+ Machines)

**Target customer**: 50-500 employees, 50+ machines, dedicated IT/OT staff,
$20K+ equipment monitoring budget.

| Item | SKU | Qty | Unit Price | Total |
|------|-----|-----|-----------|-------|
| TMNL Edge Device (Premium, QCS6490) x2 (HA pair) | TMNL-EDGE-A | 2 | $449 | $898 |
| TMNL Gateway (Full) | TMNL-GW-A | 10 | $149 | $1,490 |
| TMNL Gateway (Ethernet) | TMNL-GW-B | 5 | $99 | $495 |
| Current Transformer Adapter | TMNL-ADA-CT | 15 | $49 | $735 |
| 4ch Analog Adapter | TMNL-ADA-AIO | 10 | $79 | $790 |
| 8ch Analog Adapter | TMNL-ADA-AIO8 | 5 | $119 | $595 |
| Modbus RTU Adapter | TMNL-ADA-485 | 10 | $29 | $290 |
| MTConnect Adapter | TMNL-ADA-MTC | 8 | $99 | $792 |
| OPC UA Adapter | TMNL-ADA-OPC | 5 | $129 | $645 |
| EtherNet/IP Adapter | TMNL-ADA-ENET | 5 | $129 | $645 |
| PROFINET Adapter | TMNL-ADA-PNET | 3 | $149 | $447 |
| Digital I/O Adapter | TMNL-ADA-DIO | 8 | $59 | $472 |
| Wireless Sensor Node (BLE) | TMNL-WSN-BLE | 20 | $59 | $1,180 |
| Industrial managed switch (24-port, PoE) | TMNL-SW-24P | 2 | $350 | $700 |
| Industrial unmanaged switch (8-port) | TMNL-SW-8 | 5 | $75 | $375 |
| NVMe SSD (256GB, for edge devices) | TMNL-SSD-256 | 2 | $40 | $80 |
| Cabling bundle (enterprise, structured) | TMNL-CBL-ENT | 1 | $500 | $500 |
| 24VDC DIN-rail PSU (240W) | TMNL-PSU-240 | 3 | $85 | $255 |
| UPS battery backup (DIN-rail, 30min) | TMNL-UPS-30 | 2 | $150 | $300 |
| **Kit Total** | | | | **$11,684** |

**Per-machine cost**: $175-234 for 50-67 machines (one-time).

### 17.8.4 Kit Comparison

| Metric | Earl's Kit | Professional Kit | Enterprise Kit |
|--------|-----------|-----------------|----------------|
| **Total Cost** | $628 | $2,466 | $11,684 |
| **Machines Covered** | 2-3 | 10-20 | 50-67 |
| **Per-Machine (one-time)** | $209-314 | $123-247 | $175-234 |
| **Equivalent Monthly (3yr amort)** | $6-9/machine/mo | $3-7/machine/mo | $5-6/machine/mo |
| **Edge Device Tier** | T2 Budget (AM62x) | T2 Standard (iMX8MP) | T2 Premium (QCS6490) x2 HA |
| **AI/ML Capable** | No | Limited (2.3 TOPS) | Yes (12 TOPS x2) |
| **HA/Redundancy** | No | No | Yes (dual edge) |
| **Offline Operation** | Full | Full | Full |

**Versus Competition (3-year TCO for 10 machines)**:

| Platform | Year 1 | Year 2 | Year 3 | 3-Year Total |
|----------|--------|--------|--------|-------------|
| **TMNL Professional Kit** | $2,466 | $0 | $0 | **$2,466** |
| MachineMetrics | $24,000+ | $24,000+ | $24,000+ | **$72,000+** |
| Tulip (platform + edge) | $12,000+ | $8,000+ | $8,000+ | **$28,000+** |
| Sight Machine | $30,000+ | $25,000+ | $25,000+ | **$80,000+** |
| ThingWorx + Advantech | $60,000+ | $15,000+ | $15,000+ | **$90,000+** |

---

## 17.9 Networking Infrastructure

### 17.9.1 The Factory Floor Reality

Factory floor networking faces challenges that enterprise IT never encounters:

1. **Electromagnetic Interference (EMI)**: Welders, VFDs (variable frequency drives),
   induction heaters, and plasma cutters generate EMI that disrupts Wi-Fi and
   unshielded Ethernet. A 400A MIG welder arcing 3 meters from an access point
   can cause 10-30 second connectivity drops.

2. **Physical Obstacles**: CNC machines, press brakes, and material handling equipment
   are metal boxes that block and reflect radio signals. A typical machine shop has
   the RF propagation characteristics of a Faraday cage.

3. **Temperature Extremes**: Foundry areas exceed 60C ambient. Refrigerated storage
   drops below -20C. Outdoor loading docks swing from -30C to +45C seasonally.

4. **Vibration and Movement**: Overhead cranes, forklifts, and conveyors create
   continuous vibration. Cable management must account for moving equipment.

5. **Legacy Cabling**: Many shops have existing conduit runs from the 1970s-1990s
   carrying RS-232/RS-485 wiring. These conduits are valuable infrastructure that
   SHOULD be reused for new Ethernet or RS-485 runs.

### 17.9.2 Recommended Network Topologies

#### Topology A: Star (Micro Shop, 1-5 Machines)

```
                    ┌──────────┐
                    │  TMNL    │
                    │  Edge    │ ← Uplink: Wi-Fi/Ethernet to internet
                    │  Device  │
                    └────┬─────┘
                         │ Ethernet (switch or direct)
           ┌─────────────┼─────────────┐
           │             │             │
     ┌─────┴────┐  ┌─────┴────┐  ┌─────┴────┐
     │ Gateway  │  │ Gateway  │  │  T0      │
     │ (Machine │  │ (Machine │  │  Phone/  │
     │  1+2)   │  │  3)      │  │  Tablet  │
     └─────────┘  └──────────┘  └──────────┘
```

- All gateways connect to the edge device via a single switch or daisy-chain.
- Wi-Fi is acceptable for T0 devices (phones/tablets) and non-critical gateways.
- **RECOMMENDED** for Earl's Kit deployments.

#### Topology B: Ring (Medium Shop, 5-20 Machines)

```
     ┌──────────┐                         ┌──────────┐
     │ Gateway  │─── Ethernet ring ───────│ Gateway  │
     │ (Area 1) │                         │ (Area 2) │
     └────┬─────┘                         └────┬─────┘
          │                                    │
     ┌────┴─────┐                         ┌────┴─────┐
     │ Switch   │                         │ Switch   │
     │ (8-port) │                         │ (8-port) │
     └────┬─────┘                         └────┬─────┘
          │                                    │
    ┌─────┼─────┐                        ┌─────┼─────┐
    │     │     │                        │     │     │
   GW1   GW2   GW3                      GW4   GW5   GW6
                                               │
                                          ┌────┴─────┐
                                          │  TMNL    │
                                          │  Edge    │
                                          │  Device  │
                                          └──────────┘
```

- Two switches form a ring for redundancy (Rapid Spanning Tree).
- Gateways connect to nearest switch.
- Edge device connects to one switch; if that switch fails, traffic re-routes.
- **RECOMMENDED** for Professional Kit deployments.

#### Topology C: Mesh + Backbone (Large Facility, 50+ Machines)

```
     ┌───────────────── Fiber backbone (1GbE/10GbE) ──────────────────┐
     │                           │                                     │
┌────┴─────┐              ┌─────┴────┐                          ┌─────┴────┐
│ Managed  │              │ Managed  │                          │ Managed  │
│ Switch   │              │ Switch   │                          │ Switch   │
│ (Area A) │              │ (Area B) │                          │ (Area C) │
│ 24-port  │              │ 24-port  │                          │ 24-port  │
│ PoE      │              │ PoE      │                          │ PoE      │
└────┬─────┘              └────┬─────┘                          └────┬─────┘
     │                         │                                     │
  GW x10                    GW x10                                GW x10
                               │
                    ┌──────────┴──────────┐
                    │   TMNL Edge HA Pair  │
                    │   (Active + Standby)  │
                    └──────────────────────┘
```

- Fiber backbone between areas (immune to EMI).
- Managed PoE switches power gateways (one cable = data + power).
- Dual TMNL edge devices in active/standby HA configuration.
- **RECOMMENDED** for Enterprise Kit deployments.

### 17.9.3 Wireless Connectivity

| Technology | Range (indoor industrial) | Throughput | Latency | EMI Resilience | Cost | TMNL Use Case |
|-----------|--------------------------|-----------|---------|----------------|------|--------------|
| **Wi-Fi 5 (5GHz)** | 30-50m | 200-400 Mbps | 5-20ms | Low (EMI vulnerable) | Low ($30-50 AP) | T0 client devices, non-critical gateways |
| **Wi-Fi 6E (6GHz)** | 20-40m | 500-1000 Mbps | 2-10ms | Medium (wider channels = more resilient) | Medium ($100-200 AP) | Edge device uplink, camera feeds |
| **Private 5G/LTE** | 200-500m | 100-1000 Mbps | 1-10ms | High (licensed spectrum) | High ($20K-50K base station) | Enterprise only, mission-critical mobility |
| **BLE 5.3** | 50-100m | 2 Mbps | 10-50ms | Medium | Very low (built into gateway) | Sensor nodes, mobile configuration |
| **Thread / Zigbee** | 30-100m (mesh) | 250 kbps | 15-100ms | Medium | Low ($7-10 per node) | Low-rate sensor mesh (temp, humidity, vibration) |
| **LoRa** | 1-5 km | 0.3-27 kbps | 500ms-5s | High | Low ($15-25 per node) | Outdoor/remote: tank levels, weather stations |
| **LTE-M / NB-IoT** | Carrier coverage | 375 kbps / 127 kbps | 50-200ms | High (cellular) | $25-33 module + $2-5/mo data | Cellular backup, remote sites |

**TMNL Recommendation by Tier**:

| Deployment Tier | Primary | Backup | Wireless Sensors |
|----------------|---------|--------|-----------------|
| Earl's Kit | Wi-Fi 5 or Ethernet | None (single path) | BLE (optional) |
| Professional Kit | Ethernet (wired) | Wi-Fi 6 | BLE + Thread mesh |
| Enterprise Kit | Ethernet (fiber backbone) | Private 5G or Wi-Fi 6E | BLE + Thread + LoRa |

### 17.9.4 EMI Mitigation

For factory environments with heavy welding, VFDs, or induction equipment:

1. **Shielded Ethernet cables (S/FTP Cat6A)** MUST be used within 10m of welding
   stations or VFDs. Cost premium: ~$0.50/meter vs. UTP.

2. **Industrial M12 Ethernet connectors** SHOULD replace RJ45 in areas with
   vibration (IEC 61076-2-101). D-coded for 100Mbps, X-coded for 10GbE.

3. **Wi-Fi access points MUST be placed away from EMI sources**. Minimum 5m
   separation from arc welders. Use 5GHz/6GHz bands (less interference than 2.4GHz).

4. **Ferrite chokes on gateway power and data cables** in high-EMI areas. Cost: $0.50/each.

5. **Fiber optic runs for backbone** in environments where copper is impractical
   due to EMI. Single-mode fiber between buildings, multimode within a building.
   SFP modules: $15-25 each.

### 17.9.5 Bandwidth Requirements

| Data Source | Rate Per Source | Sources per Machine | Total per Machine | Notes |
|------------|----------------|--------------------|--------------------|-------|
| Sensor readings (1Hz) | 100 bytes/s | 5-20 | 0.5-2 KB/s | Temperature, pressure, vibration RMS |
| Sensor readings (100Hz) | 10 KB/s | 1-3 | 10-30 KB/s | Vibration waveform, acoustic |
| Machine state events | ~200 bytes/event | 10-50 events/hr | ~3 KB/hr | On/off, cycle start/end, alarm |
| Entity state updates | ~500 bytes/update | 1-5 updates/min | ~2.5 KB/min | State machine transitions |
| Camera feed (if applicable) | 1-5 Mbps | 0-2 | 0-10 Mbps | Quality inspection (Enterprise only) |

**Report-by-exception** reduces telemetry by 80-90%: instead of streaming every
reading at 1Hz, the gateway only transmits when values change beyond a configurable
deadband. A stable temperature sensor reading 72.3F every second transmits once,
then stays silent until the reading changes by >0.5F.

**Per-machine bandwidth (typical, with report-by-exception)**: 0.1-0.5 KB/s.
**Per-shop (10 machines)**: 1-5 KB/s. Easily handled by any network technology.

---

## 17.10 Power Infrastructure

### 17.10.1 Power Input Specifications

| Device | Input Voltage | Power Consumption | Connector | Notes |
|--------|--------------|-------------------|-----------|-------|
| TMNL Edge (QCS6490) | 9-36VDC (24VDC nominal) | 10-15W typical, 25W peak | 2-pin screw terminal | Also supports PoE (802.3at, 25.5W) |
| TMNL Edge (iMX8MP) | 9-36VDC | 8-12W typical, 18W peak | 2-pin screw terminal | PoE (802.3af, 12.95W) sufficient |
| TMNL Edge (AM62x) | 9-36VDC | 3-5W typical, 8W peak | 2-pin screw terminal | PoE (802.3af) sufficient |
| TMNL Gateway (Full) | 9-36VDC | 2-3W typical, 5W peak | 2-pin screw terminal | Also USB-C 5V |
| TMNL Gateway (Minimal) | 5VDC | 1-2W | USB-C | USB power only |
| Sensor Node (BLE) | 3V (CR2477 battery) | <100uW avg | N/A (battery) | 2-5 year battery life |
| Sensor Node (Cellular) | 3.7V (LiPo) | 5mW avg, 2W peak (LTE TX) | USB-C (charging) | 6-12 month battery life |

### 17.10.2 Recommended Power Supplies

| PSU | Capacity | DIN-Rail | Output | Est. Cost | Use With |
|-----|----------|----------|--------|----------|----------|
| Mean Well HDR-60-24 | 60W | Yes | 24VDC / 2.5A | $25 | Earl's Kit (1 edge + 1-2 gateways) |
| Mean Well HDR-100-24 | 100W | Yes | 24VDC / 4.2A | $35 | 1 edge + 4-5 gateways |
| Mean Well NDR-120-24 | 120W | Yes | 24VDC / 5A | $45 | Professional Kit |
| Mean Well NDR-240-24 | 240W | Yes | 24VDC / 10A | $85 | Enterprise Kit (per area) |

### 17.10.3 UPS / Battery Backup

For deployments requiring continuous operation during power interruptions:

| UPS | Capacity | Runtime (15W load) | DIN-Rail | Est. Cost |
|-----|----------|-------------------|----------|----------|
| PULS UF20.241 | 20Ah (24VDC) | ~30 hours | Yes | $350 |
| Mean Well DRC-40B | 40W buffer | ~15 minutes | Yes | $50 |
| Phoenix Contact QUINT-UPS | 20Ah | ~30 hours | Yes | $400+ |
| Custom LiFePO4 pack (12V, 20Ah) | 20Ah | ~15 hours | Shelf | $80 |

**TMNL Recommendation**: For Earl's Kit, no UPS is needed (data buffers on eMMC
survive power loss). For Professional/Enterprise, a Mean Well DRC-40B ($50) provides
15 minutes of ride-through, sufficient for the edge device to flush JetStream
buffers and perform a clean shutdown. For mission-critical deployments, PULS or
Phoenix Contact 20Ah units provide 30+ hours of fully autonomous operation.

---

## 17.11 Environmental Specifications

### 17.11.1 Operating Conditions by Device

| Parameter | Edge Device | Gateway | Sensor Node (BLE) | Sensor Node (Cell) |
|-----------|------------|---------|-------------------|-------------------|
| **Operating temp** | -40C to +70C | -40C to +85C | -40C to +105C | -40C to +85C |
| **Storage temp** | -40C to +85C | -40C to +85C | -40C to +125C | -40C to +85C |
| **Humidity** | 10-95% RH, non-condensing | 10-95% RH, non-condensing | 0-100% RH (IP67) | 0-100% RH (IP67) |
| **Vibration** | IEC 60068-2-6 (5-500Hz, 2g) | IEC 60068-2-6 (5-500Hz, 2g) | IEC 60068-2-6 (5-2000Hz, 10g) | IEC 60068-2-6 (5-500Hz, 2g) |
| **Shock** | IEC 60068-2-27 (30g, 11ms) | IEC 60068-2-27 (30g, 11ms) | IEC 60068-2-27 (50g, 11ms) | IEC 60068-2-27 (30g, 11ms) |
| **EMC/EMI** | IEC 61000-4-2, -3, -4, -5, -6 | IEC 61000-4-2, -3, -4, -5, -6 | IEC 61000-4-2 | IEC 61000-4-2 |
| **Ingress (base)** | IP40 (DIN-rail panel) | IP40 (DIN-rail panel) | IP67 | IP67 |
| **Ingress (option)** | IP65 (factory floor) | IP65 (factory floor) | IP68 (submersible) | N/A |
| **Altitude** | 0-5000m | 0-5000m | 0-5000m | 0-5000m |

### 17.11.2 Enclosure Options

| Variant | Material | IP Rating | Mount | Use Case | Cost Premium |
|---------|----------|-----------|-------|----------|-------------|
| **Standard** | Aluminum extrusion | IP40 | DIN-rail | Panel cabinet, clean environments | $0 (base) |
| **Factory Floor** | Die-cast aluminum | IP65 | DIN-rail or wall | Exposed factory floor, dust/splash | +$15-25 |
| **Washdown** | 316 stainless steel | IP67 | Wall or pole | Food/pharma, high-pressure wash | +$40-60 |
| **Outdoor** | Powder-coated aluminum | IP66 | Wall or pole | Outdoor yards, loading docks | +$25-35 |
| **ATEX/IECEx** | Stainless, intrinsic safety barriers | IP66, Zone 2 | Wall | Hazardous atmospheres (explosive dust/gas) | +$200-400 |

---

## 17.12 Physical Signal Chain

### 17.12.1 Reference Signal Chain: 1987 Lathe with 4-20mA Output

This is the canonical "Earl's lathe" signal chain — the simplest possible
deployment for legacy analog equipment.

```
PHYSICAL SIGNAL CHAIN: 1987 Bridgeport Lathe → TMNL Cloud

┌──────────────┐     4-20mA (2-wire)     ┌──────────────┐
│  LATHE       │─────────────────────────│ TMNL-ADA-AIO │
│  (1987)      │  ┌─────────────────┐    │  4ch Analog   │
│              │  │ Pressure sensor │    │  Adapter      │
│  Spindle     │──│ (existing)      │────│  Ch 1: spindle│
│  motor       │  └─────────────────┘    │  Ch 2: coolant│
│              │  ┌─────────────────┐    │  Ch 3: (spare)│
│  Coolant     │──│ Temp sensor     │────│  Ch 4: (spare)│
│  pump        │  │ (existing)      │    └───────┬──────┘
│              │  └─────────────────┘            │ RS-485
│              │                                 │ Modbus RTU
│  [No         │                                 │
│   Ethernet]  │                                 │
└──────────────┘                         ┌───────┴──────┐
                                         │ TMNL-GW-A    │
                                         │ Gateway      │
                                         │ (Full)       │
                                         │              │
                                         │ Converts:    │
                                         │ Modbus RTU → │
                                         │ MQTT →       │
                                         │ Sparkplug-B  │
                                         └───────┬──────┘
                                                 │ Wi-Fi / Ethernet
                                                 │
                                         ┌───────┴──────┐
                                         │ TMNL Edge    │
                                         │ (AM62x)      │
                                         │              │
                                         │ NATS leaf    │
                                         │ JetStream    │
                                         │ Entity state │
                                         │ machines     │
                                         │ Alarm detect │
                                         │ Dashboard    │
                                         └───────┬──────┘
                                                 │ Internet (when available)
                                                 │ NATS leaf node → hub
                                         ┌───────┴──────┐
                                         │ TMNL Cloud   │
                                         │ Hub (Atlanta)│
                                         │              │
                                         │ Marketplace  │
                                         │ Analytics    │
                                         │ Backup       │
                                         └──────────────┘

WIRING:
  Sensor → Adapter:  2-wire shielded (18-22 AWG), max 300m
  Adapter → Gateway: RS-485 (2-wire + GND, twisted pair), max 1200m
  Gateway → Edge:    Ethernet Cat5e/Cat6 or Wi-Fi
  Edge → Cloud:      Internet (any: DSL, cable, fiber, cellular)

INSTALLATION TIME: ~45 minutes
  - Mount DIN-rail (5 min)
  - Snap gateway + adapter onto rail (2 min)
  - Wire sensors to adapter screw terminals (15 min)
  - Wire RS-485 between adapter and gateway (5 min)
  - Connect gateway to edge via Ethernet (3 min)
  - Power on, scan QR code with phone, run auto-config (15 min)

COST:
  Adapter (TMNL-ADA-AIO):   $79
  Gateway (TMNL-GW-A):      $149
  Cable + misc:             ~$20
  TOTAL per machine:        ~$248
```

### 17.12.2 Reference Signal Chain: Modern CNC with EtherNet/IP

```
PHYSICAL SIGNAL CHAIN: 2019 Haas VF-2 CNC → TMNL Cloud

┌──────────────┐    EtherNet/IP (RJ45)   ┌──────────────┐
│  HAAS VF-2   │─────────────────────────│ TMNL-ADA-MTC │
│  (2019)      │                          │  MTConnect   │
│              │  MTConnect Agent built   │  Adapter     │
│  FANUC 0i-TF │  into control. Exposes: │              │
│  control     │  - Spindle speed/load   │  Polls HTTP  │
│              │  - Feed rate            │  MTConnect    │
│  Ethernet    │  - Program name/block   │  agent every │
│  port on     │  - Alarms/messages      │  1 second.   │
│  back panel  │  - Axis positions       │              │
│              │  - Execution state      │  Maps to     │
└──────────────┘                          │  Sparkplug-B │
                                          └───────┬──────┘
                                                  │ Ethernet / Wi-Fi
                                                  │ MQTT + Sparkplug-B
                                          ┌───────┴──────┐
                                          │ TMNL Edge    │
                                          │ (any tier)   │
                                          └───────┬──────┘
                                                  │ → Cloud
                                                  ▼

WIRING:
  CNC → Adapter:  Ethernet Cat5e patch cable (supplied)
  Adapter → Edge: Same Ethernet switch, or Wi-Fi

INSTALLATION TIME: ~15 minutes
  - Connect Ethernet cable from CNC to adapter (2 min)
  - Connect adapter to network switch (2 min)
  - Power adapter via PoE or 24VDC (1 min)
  - Adapter auto-discovers MTConnect agent (30 sec)
  - Confirm data flow in mobile app (5 min)
  - Map Sparkplug topics to entity in TMNL (5 min)

COST:
  Adapter (TMNL-ADA-MTC):  $99
  Ethernet cable:          ~$5
  TOTAL per machine:       ~$104
```

### 17.12.3 Reference Signal Chain: No-Interface Machine (Power Monitoring Only)

For equipment with zero electronic interface — mechanical presses, manual mills,
hydraulic systems — the current transformer provides non-invasive monitoring.

```
PHYSICAL SIGNAL CHAIN: 1975 Hydraulic Press → TMNL Cloud

┌──────────────┐                          ┌──────────────┐
│  HYDRAULIC   │                          │ TMNL-ADA-CT  │
│  PRESS       │  ┌────────────────────┐  │  Current     │
│  (1975)      │  │ Split-core CT clamp│  │  Transformer │
│              │  │ clips around motor │  │  Adapter     │
│  No          │  │ power cable.       │  │              │
│  electronics.│  │ NO wire cutting.   │──│  Converts:   │
│  No sensors. │  │ NO machine mod.    │  │  Current →   │
│  Just a      │  │                    │  │  4-20mA →    │
│  motor and   │  │ Detects:           │  │  Modbus RTU  │
│  a pump.     │  │ - Machine ON/OFF   │  │              │
│              │  │ - Load level       │  │  Threshold   │
└──────────────┘  │ - Cycle detection  │  │  detection:  │
                  │   (power spikes)   │  │  ON = >2A    │
                  └────────────────────┘  │  CYCLE = spike│
                                          └───────┬──────┘
                                                  │ RS-485
                                          ┌───────┴──────┐
                                          │ TMNL Gateway │
                                          └───────┬──────┘
                                                  │
                                          ┌───────┴──────┐
                                          │ TMNL Edge    │
                                          └──────────────┘

INSTALLATION TIME: ~20 minutes
  - Open electrical panel (caution: may require licensed electrician)
  - Clip CT around ONE phase of motor power cable (5 min)
  - No wire cutting, no splicing. CT is split-core, opens like a clamp.
  - Connect CT output to adapter screw terminals (5 min)
  - Mount adapter on DIN rail near panel (3 min)
  - Wire RS-485 to gateway (5 min)
  - Verify power detection in mobile app (2 min)

COST:
  CT Adapter (TMNL-ADA-CT): $49
  TOTAL per machine:        $49

NOTE: This provides ONLY power-based monitoring (on/off, load, cycles).
For actual process data (pressure, temperature, position), additional
sensors and a TMNL-ADA-AIO are required.
```

---

## 17.13 Competitor Hardware Comparison

### 17.13.1 Competitor Hardware Pricing Model

| Vendor | Hardware Model | Pricing Model | Upfront Cost | Monthly/Annual | Data Ownership | Offline Capable |
|--------|---------------|--------------|-------------|----------------|---------------|----------------|
| **MachineMetrics** | Custom IoT gateway + cloud | SaaS subscription | ~$0 (included in sub) | ~$200-400/machine/month | Vendor-hosted | No (cloud-required) |
| **Tulip** | Edge MC, Edge IO | Platform subscription + hardware purchase | $300-800 per device | ~$500-800/month (platform) | Vendor-hosted | Partial (runs apps offline) |
| **Sight Machine** | Partner hardware (Advantech, etc.) | Enterprise license | $5,000-20,000 setup | $25K-100K/year | Vendor-hosted | No |
| **ThingWorx + KEPServerEX** | Advantech + Kepware license | License + subscription | $5,000-15,000 (gateway+license) | $15K-50K/year | Customer-hosted (option) | Yes (on-prem) |
| **AWS IoT Greengrass** | Customer-supplied (Advantech, RPi) | Pay-per-use | $500-5,000 (hardware) | $0.10-0.50/device/month + data costs | AWS cloud | Partial (Lambda@Edge) |
| **Ignition by Inductive** | Customer-supplied | License (one-time + annual) | $500-5,000 (hardware) | $2,500-25,000/year (software) | Customer-hosted | Yes (on-prem) |
| **TMNL** | TMNL Edge + Gateway + Adapters | **One-time purchase** | **$249-449 (edge) + $49-149 (gateway)** | **$0** | **Customer-owned** | **Yes (full offline)** |

### 17.13.2 Cost-per-Machine-per-Year Comparison

| Vendor | Year 1 (1 machine) | Year 1 (10 machines) | Year 3 (10 machines) |
|--------|-------------------|---------------------|---------------------|
| **MachineMetrics** | $2,400-4,800 | $24,000-48,000 | $72,000-144,000 |
| **Tulip** | $6,600-10,400 | $10,000-16,000 | $22,000-40,000 |
| **Sight Machine** | $25,000+ | $30,000+ | $80,000+ |
| **ThingWorx** | $20,000+ | $40,000+ | $90,000+ |
| **TMNL** | **$350-600** | **$2,500-3,000** | **$2,500-3,000** |

TMNL's one-time hardware purchase model means **Year 2 and Year 3 costs are $0**
(excluding optional cloud services, which are priced at $0-5/organization/month
for the manufacturing commons network fee).

---

## 17.14 BOM Sensitivity Analysis

### 17.14.1 Memory Price Sensitivity

The single largest BOM risk is LPDDR4/5 memory pricing. As of Feb 2026, memory
costs have approximately doubled from Q3 2025 levels due to AI datacenter demand
[RPI-PRICE-2026].

| Scenario | LPDDR5 8GB Cost (SoM impact) | Edge Device Price Impact |
|----------|------------------------------|-------------------------|
| **Current (Feb 2026)** | ~$30-40 in SoM | Baseline ($449) |
| **Memory +50%** | ~$45-60 in SoM | +$15-20 → $469 |
| **Memory +100%** | ~$60-80 in SoM | +$30-40 → $489 |
| **Memory normalization (Q1 2027 est.)** | ~$20-30 in SoM | -$10-20 → $429 |

**Mitigation**: The TMNL Edge Device Option B (iMX8MP, 4GB LPDDR4) and Option C
(AM62x, 2GB DDR4) use lower-density memory that is less affected by LPDDR5 spot
pricing. The three-SKU strategy provides natural hedging.

### 17.14.2 SoC Availability Risk

| Platform | Supply Chain Risk | Mitigation |
|----------|------------------|------------|
| QCS6490 | Medium (Qualcomm fab via Samsung/TSMC) | Pin-compatible QCS5430 fallback; iMX8MP as alt |
| i.MX 8M Plus | Low (NXP, multiple fabs, mature process) | VAR-SOM Pin2Pin family provides 6+ SoC options |
| TI AM62x | Low (TI internal fab + TSMC, excellent history) | Multiple SoM vendors (Variscite, Toradex, Phytec) |
| ESP32-S3 | Very Low (Espressif, TSMC 40nm, high volume) | ESP32-C6 as pin-compatible next-gen |
| nRF5340 | Low (Nordic, TSMC, high volume) | nRF54L15 as next-gen upgrade path |

### 17.14.3 Tariff & Trade Risk

All recommended SoCs are fabbed in Taiwan (TSMC) or South Korea (Samsung).
Carrier board PCB assembly can be sourced from multiple regions:

| Assembly Region | Unit Cost Premium vs. China | Lead Time | Notes |
|----------------|---------------------------|-----------|-------|
| China (Shenzhen) | Baseline | 4-6 weeks | Lowest cost, highest volume |
| Vietnam | +5-10% | 6-8 weeks | Growing capacity, tariff hedge |
| Mexico | +15-25% | 4-6 weeks | USMCA trade zone, nearshore |
| USA (Texas/California) | +40-80% | 2-4 weeks | Lowest risk, highest cost |
| India | +10-20% | 6-10 weeks | Emerging, government incentives |

**TMNL Recommendation**: Primary assembly in Vietnam or Mexico for tariff resilience.
Qualify at least two assembly partners in different regions. For U.S. government or
defense-adjacent customers, maintain a USA-assembled SKU at premium pricing.

---

## 17.15 Certification & Compliance

### 17.15.1 Required Certifications

| Certification | Scope | Estimated Cost | Timeline | Notes |
|--------------|-------|---------------|----------|-------|
| **FCC Part 15** (USA) | EMC, radio emissions | $10,000-15,000 | 6-8 weeks | Required for all devices sold in USA |
| **CE (RED + LVD + EMC)** (EU) | Radio, safety, EMC | $8,000-12,000 | 8-12 weeks | Required for EU market |
| **UL/cUL 62368-1** | Product safety | $15,000-25,000 | 12-16 weeks | Audio/video, IT, communication equipment |
| **IC** (Canada) | Radio emissions | $5,000-8,000 | 4-6 weeks | Often tested alongside FCC |
| **RoHS / REACH** | Hazardous substances | $2,000-5,000 | 4-6 weeks | Environmental compliance |

### 17.15.2 Optional / Industry-Specific Certifications

| Certification | Industry | Estimated Cost | When to Pursue |
|--------------|----------|---------------|----------------|
| **IECEx / ATEX** | Oil & gas, chemical | $50,000-100,000 | When targeting hazardous environment customers |
| **UL 508A** | Industrial control panels | $10,000-20,000 | When selling as part of complete panel assemblies |
| **FDA 21 CFR Part 11** | Pharmaceutical/medical device mfg | Software compliance | Required for pharma customers (software-level) |
| **ITAR** | Defense manufacturing | Process compliance | Required for defense-adjacent shops |
| **Class I Div 2 / Zone 2** | Hazardous locations | $30,000-60,000 | Hazardous environment variant |

### 17.15.3 Certification Amortization

At a production run of 5,000 units (first year target):

| Certification | One-Time Cost | Per-Unit Amortized |
|--------------|--------------|-------------------|
| FCC + CE + IC + RoHS | ~$35,000 | $7.00 |
| UL 62368-1 | ~$20,000 | $4.00 |
| **Total regulatory per unit** | | **$11.00** |

At 10,000 units: $5.50/unit. At 50,000 units: $1.10/unit.

---

## 17.16 Manufacturing & Supply Chain

### 17.16.1 Production Phases

| Phase | Volume | Pricing Target | Assembly | QA | Timeline |
|-------|--------|---------------|----------|-----|---------|
| **EVT (Engineering Validation)** | 20-50 units | N/A (internal cost) | In-house / prototype house | 100% manual test | Months 1-4 |
| **DVT (Design Validation)** | 100-500 units | BOM + 200% | Contract manufacturer (pilot line) | 100% automated test fixture | Months 5-8 |
| **PVT (Production Validation)** | 500-2,000 units | BOM + 100% | Contract manufacturer (production line) | Statistical sampling + automated | Months 9-11 |
| **MP (Mass Production)** | 2,000+ units/quarter | Target retail pricing | Contract manufacturer | Statistical + random deep test | Month 12+ |

### 17.16.2 Test Fixtures

Each TMNL device SKU requires a custom test fixture for manufacturing QA:

| Test | Edge Device | Gateway | Adapter |
|------|------------|---------|---------|
| Power-on self-test | Boot to Linux, check all peripherals | Boot to RTOS, check all I/O | Power LED, RS-485 loopback |
| Network test | Ping both Ethernet ports, Wi-Fi scan | Ethernet + Wi-Fi connectivity | N/A |
| I/O test | RS-485 loopback, DIO toggle, ADC calibration | RS-485 loopback, ADC calibration, DIO | Loopback on all channels |
| Firmware flash | eMMC flash via USB | SPI flash via USB-C | SPI flash via ISP header |
| Thermal test | 10-min burn-in at max load, check throttling | 5-min burn-in | N/A |
| Label + pack | Serial number, MAC address, QR code | Serial number, MAC, QR | Serial, QR |

Estimated test fixture cost: $5,000-15,000 per SKU. Amortized over production run.

---

## 17.17 Codebase Grounding

The physical hardware specified in this section maps directly to software tiers
defined in Section 15 (Edge-First Architecture). The following table connects
hardware SKUs to codebase components:

| Hardware SKU | Software Tier | Key Software Components | Source Files |
|-------------|--------------|------------------------|-------------|
| **TMNL-EDGE-A** (QCS6490) | T2 Full + ML | NATS server, @effect/cluster SingleRunner, SparkplugPipelineLayer, EntityStack, WebSocket server, ML inference | `lib/holonet/nats/connection.ts`, `lib/iiot/entity/EntityStack.ts:54-67`, `lib/iiot/adapters/sparkplug-adapter.ts:406-407`, `lib/iiot/realtime/websocket-server.ts:68-137` |
| **TMNL-EDGE-B** (iMX8MP) | T2 Full | Same as A minus ML inference | Same as A |
| **TMNL-EDGE-C** (AM62x) | T2 Budget | Same as A minus ML, reduced entity count (200) | Same as A, with entity count limits in `lib/iiot/infrastructure/deployment-mode.ts` |
| **TMNL-GW-A/B/C** (ESP32) | T1 | Sparkplug-B adapter (MQTT client), NATS leaf node (lightweight), telemetry buffer | `lib/iiot/adapters/sparkplug-adapter.ts` (protocol logic, compiled to ESP-IDF), `lib/holonet/nats/` (NATS protocol, lightweight client) |
| **TMNL-ADA-**** (Adapters) | N/A (passive/MCU) | Protocol conversion firmware (ESP32 or bare-metal) | Adapter firmware repository (separate, not in packages/tmnl) |
| **TMNL-WSN-**** (Sensors) | N/A (BLE/Thread) | Sensor firmware (Zephyr RTOS, nRF Connect SDK) | Sensor firmware repository (separate) |

### 17.17.1 Software Tier to Hardware Mapping

The four-tier capability model from Section 15.2.1 maps to hardware as follows:

| Tier | Hardware Options | Section 15 Requirements Met |
|------|-----------------|---------------------------|
| **T0** (Client) | Any smartphone/tablet/laptop | WebSocket client to T1/T2/T3 |
| **T1** (Minimal Edge) | TMNL-GW-A/B/C (ESP32-S3) | Sparkplug bridge, NATS leaf, 1-day buffer |
| **T2** (Industrial Edge) | TMNL-EDGE-A/B/C (QCS6490/iMX8MP/AM62x) | Full entity processing, 30-day retention, @effect/cluster |
| **T3** (Edge Server) | Dell PowerEdge / HPE ProLiant / custom rack | Multi-runner cluster, 1-year retention, ML inference, HA |

**T3 is NOT a TMNL-designed device.** T3 deployments use enterprise server hardware
from Dell, HPE, Lenovo, or Supermicro running the TMNL software stack on standard
Linux. TMNL provides:
- Installation ISO / container images
- Ansible playbooks for automated deployment
- Hardware compatibility list (HCL) for certified T3 configurations

---

## 17.18 Open Questions

| ID | Question | Impact | Owner | Status |
|----|----------|--------|-------|--------|
| **HW-1** | Should TMNL manufacture its own carrier boards or license the design to a hardware partner (OnLogic, Advantech, Seeed Studio)? | Manufacturing complexity vs. margin control | Product | Open |
| **HW-2** | Should the ESP32 gateway firmware be open-sourced to enable community hardware designs? | Community growth vs. quality control | Product | Open |
| **HW-3** | What is the minimum viable adapter catalog for GA (General Availability)? All 11 adapters or a subset? | Launch scope | Product | Open |
| **HW-4** | Should cellular (LTE-M/NB-IoT) be an on-board option for the edge device or strictly an M.2 expansion? | BOM cost vs. connectivity flexibility | Hardware | Open |
| **HW-5** | What is the thermal validation plan for the -40C to +70C range? In-house thermal chamber or outsourced? | Certification timeline | Hardware | Open |
| **HW-6** | Should the T2 edge device include an HDMI output for direct-connect display (local HMI panel)? | BOM +$2-3, useful for T2 deployments without T0 devices | Hardware | Leaning Yes |
| **HW-7** | Is 4GB RAM sufficient for the iMX8MP variant (Option B) given LPDDR4 memory pressure? Should we drop to 2GB or push to 8GB? | Price/capability tradeoff | Hardware | Open |

---

## 17.19 References

| Key | Reference |
|-----|-----------|
| [RFC2119] | Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels." RFC 2119, March 1997. |
| [QCS6490-BRIEF] | Qualcomm. "Dragonwing QCS6490/QCM6490 Processors Product Brief." Rev F, November 2025. docs.qualcomm.com/doc/87-28733-1 |
| [QCS8550-BRIEF] | Qualcomm. "Dragonwing QCS8550/QCM8550 Processors Product Brief." Rev D, February 2025. docs.qualcomm.com/doc/87-61717-1 |
| [LANTRONIX-6490] | Lantronix. "Open-Q 6490CS SOM (System on Module)." estore.lantronix.com. Retail: $224.04 (4GB LPDDR5/32GB eMMC). |
| [THUNDERCOMM-C6490] | Thundercomm. "TurboX C6490 SOM." thundercomm.com/product/c6490-som/. QCS6490-based, long lifecycle through 2036. |
| [VARISCITE-AM62] | Variscite. "VAR-SOM-AM62 System on Module." Starting from $33.00. shop.variscite.com. |
| [VARISCITE-MX8MP] | Variscite. "VAR-SOM-MX8M-PLUS System on Module." variscite.com. Pin2Pin family compatibility. |
| [TORADEX-MX8MP] | Toradex. "Verdin iMX8M Plus System on Module." toradex.com. NPU 2.3 TOPS, -40C to +85C. |
| [LCSC-ESP32S3] | LCSC Electronics. "ESPRESSIF ESP32-S3." Part C2913192. QFN-56 package. lcsc.com. |
| [NRF5340-SPEC] | Nordic Semiconductor. "nRF5340 SoC." Dual Cortex-M33, BLE 5.3/Thread/Zigbee, PSA Level 2. nordicsemi.com/Products/nRF5340 |
| [NRF9160-SPEC] | Nordic Semiconductor. "nRF9160 SiP." LTE-M/NB-IoT + GNSS, Cortex-M33, CryptoCell 310. nordicsemi.com/Products/nRF9160 |
| [FANSTEL-MODULES] | Fanstel. "BLE, 802.15.4, LTE, LoRa, WiFi6 Modules." Q1 2025 catalog. nRF5340 modules from $7.65 @1K. fanstel.com |
| [RPI-PRICE-2026] | Upton, E. "More memory-driven price rises." Raspberry Pi Blog, February 2, 2026. 2GB +$10, 4GB +$15, 8GB +$30, 16GB +$60. |
| [RPI-CM5-BRIEF] | Raspberry Pi Ltd. "Raspberry Pi Compute Module 5 Product Brief." December 2025. Priced from $45 (1GB, no Wi-Fi). |
| [ONLOGIC-HX511] | OnLogic. "Helix 511 Fanless Intel 12th Gen Edge Computer." From $1,354.95. onlogic.com. |
| [ADVANTECH-UNO127] | Advantech. "UNO-127 Pocket-Size DIN-Rail Edge Industrial PC." Intel Atom x6413E, -20C to +60C. |
| [BECKHOFF-C7015] | Beckhoff. "C7015 Industrial PC in IP65." Ultra-compact, multi-core, IP65/67, EtherCAT P. beckhoff.com. |
| [MACHINEMETRICS-HW] | MachineMetrics. "Industrial IoT Gateways." machinemetrics.com/connectivity/hardware/iiot-gateways |
| [TULIP-EDGE] | Tulip. "Edge Devices — Connect Your Operations." tulip.co/products/edge-devices |
| [TULIP-MACHINE-KIT] | Tulip. "Introducing Machine Kit." September 2023. tulip.co/blog/introducing-machine-kit |
| [UBIDOTS-GATEWAYS] | Ubidots. "Industrial IoT & Edge IoT Gateways: 10+ Best Models for 2025." ubidots.com/blog/top-industrial-iot-gateways |
| [ADVANTECH-EKI1242] | Advantech. "EKI-1242OUMS Modbus TCP/RTU to OPC UA Fieldbus Gateway." From EUR 671. |
| [HMS-GATEWAYS] | HMS Networks. "Gateways & Protocol Converters." 250+ models. hms-networks.com/protocol-converters |
| [SCADALINK-A485] | SCADALink. "A-485: 4-20mA to Modbus RS485 Adapter." scadalink.com |
| [DATEXEL-10017I] | Datexel. "DAT10017-I: 4-20mA to Modbus RTU, 8 Channel." datexel.com |
| [FANUC-MTCONNECT] | FANUC America. "MTConnect Server — FANUC MT Connect Adapter." fanucamerica.com |
| [MTCONNECT-DEVICES] | MTConnect Institute. "Step 2 — Supported Devices." mtconnect.org/step-2-supported-devices |
| [BOSCH-PRIVATE-5G] | Bosch SDS. "Rewiring Industry 4.0: Why Private 5G is Built for Smart Factories." June 2025. |
| [BERG-PRIVATE-LTE] | Berg Insight. "Private LTE & 5G Network Ecosystem 2025-2030." Market reached $2.4B in 2025. |
| [ISA-95-1] | ISA. "ISA-95: Enterprise-Control System Integration, Part 1." |
| [NATS-LEAFNODE] | NATS.io. "Leaf Nodes." docs.nats.io/running-a-nats-service/configuration/leafnodes |
| [EFFECT-CLUSTER] | Effect-TS. "@effect/cluster." github.com/Effect-TS/effect/tree/main/packages/cluster |
| [SPARKPLUG-B] | Eclipse Foundation. "Sparkplug B Specification." sparkplug.eclipse.org |
