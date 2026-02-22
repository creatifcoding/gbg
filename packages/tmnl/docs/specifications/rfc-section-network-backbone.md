# RFC-001 Section 18: Network Backbone — Reticulum Mesh over CBRS 3.5GHz

```
Section:       Network Backbone — Sovereign Metropolitan Mesh
Parent RFC:    RFC-001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        infra-analyst (Val)
Created:       2026-02-12
Research Base: rfc-section-physical-infrastructure.md (Section 17 — Hardware BOMs)
               rfc-section-deployment-topology.md (Section 16 — NATS Layout)
               rfc-section-edge-architecture-v2.md (Section 15 — Tier Model)
               rfc-section-competitive-analysis.md (Competitor Analysis)
               rfc-section-depin-token-economics.md (Token Incentives)
Bibliography:  docs/specifications/bibliography.md
```

<!-- INTEGRATION NOTES (for RFC assembly)
- This section is the NETWORK COMPANION to Section 17 (Physical Infrastructure)
  and Section 16 (Deployment Topology). Section 17 defines hardware SKUs and BOMs;
  this section specifies the radio network that interconnects those devices without
  dependency on consumer ISPs.
- Should be placed AFTER Section 17 (Physical Infrastructure) and BEFORE the
  security/trust sections.
- Cross-references: rfc-section-physical-infrastructure.md (T2 edge QCS6490 has 5G/PCIe),
  rfc-section-deployment-topology.md (NATS leaf node topology rides over this backbone),
  rfc-section-edge-architecture-v2.md (T0/T1/T2/T3 software tier requirements),
  rfc-section-competitive-analysis.md (no incumbent offers sovereign networking),
  rfc-section-depin-token-economics.md (network node incentives).
- Dependencies: Section 17 MUST define hardware BOMs before this section adds radio
  module cost addendums. Section 16 MUST define NATS topology before this section
  specifies the transport fabric beneath it.
- Key regulatory reference: FCC 47 CFR Part 96 (CBRS rules), current as of Feb 2026.
  The FCC NPRM FCC-24-86A1 (Aug 2024) proposes CBRS framework modifications — monitor
  for final rules that may affect GAA power limits or SAS requirements.
-->

---

Every existing IIoT platform assumes "bring your own internet" — consumer cable, business fiber, or cellular. TMNL builds its own network. Every edge device is a compute node AND a network node. The mesh grows with every deployment. No ISP required.

---

## Table of Contents

1. [Conventions](#181-conventions)
2. [The Connectivity Problem](#182-the-connectivity-problem)
3. [Architecture Overview — Dual-Band Sovereign Mesh](#183-architecture-overview--dual-band-sovereign-mesh)
4. [Reticulum Protocol Deep Dive](#184-reticulum-protocol-deep-dive)
5. [CBRS 3.5GHz Spectrum — Free Metro Backbone](#185-cbrs-35ghz-spectrum--free-metro-backbone)
6. [LoRa Sub-GHz — The Control Plane](#186-lora-sub-ghz--the-control-plane)
7. [Hybrid Topology — LoRa Control + CBRS Data](#187-hybrid-topology--lora-control--cbrs-data)
8. [Range and Coverage Analysis — Atlanta MSA](#188-range-and-coverage-analysis--atlanta-msa)
9. [NATS-over-Reticulum Integration](#189-nats-over-reticulum-integration)
10. [Hardware Requirements and BOM Addendum](#1810-hardware-requirements-and-bom-addendum)
11. [DePIN Token Integration — Proof of Relay](#1811-depin-token-integration--proof-of-relay)
12. [Competitor and Alternative Analysis](#1812-competitor-and-alternative-analysis)
13. [Regulatory Considerations](#1813-regulatory-considerations)
14. [Deployment Phases](#1814-deployment-phases)
15. [Risk Analysis](#1815-risk-analysis)
16. [Codebase Grounding](#1816-codebase-grounding)
17. [Cross-References to Other RFC Sections](#1817-cross-references-to-other-rfc-sections)
18. [Open Questions](#1818-open-questions)
19. [References](#1819-references)

---

## 18.1 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

All pricing is in USD, researched February 2026. Regulatory references are to
FCC 47 CFR Part 96 as codified, with notes on pending NPRM FCC-24-86A1.
Range estimates use standard propagation models (ITM, eHata, Okumura-Hata) with
conservative assumptions unless otherwise noted.

### Terminology

| Term | Definition |
|------|-----------|
| **CBRS** | Citizens Broadband Radio Service, 3550-3700 MHz |
| **GAA** | General Authorized Access — lowest CBRS tier, license-free |
| **PAL** | Priority Access License — auctioned CBRS tier |
| **CBSD** | Citizens Broadband Radio Service Device |
| **SAS** | Spectrum Access System — automated frequency coordinator |
| **ESC** | Environmental Sensing Capability — incumbent detection |
| **RNS** | Reticulum Network Stack |
| **LXMF** | Lightweight eXchange Message Format |
| **RNode** | Reticulum-compatible LoRa transceiver hardware |

---

## 18.2 The Connectivity Problem

### 18.2.1 Why "Bring Your Own Internet" Fails at Scale

The current RFC-001 architecture (Sections 15-17) assumes TMNL edge devices connect
to NATS hub clusters via "existing internet" — whatever connectivity the manufacturing
establishment already has. For 200,000 target organizations across a 29-county Atlanta
MSA (8,376 sq mi), this assumption creates five structural vulnerabilities:

| Vulnerability | Impact | Prevalence |
|--------------|--------|-----------|
| **Single ISP dependency** | ISP outage = complete data loss | 85%+ of small manufacturers have one ISP |
| **Consumer-grade cable** | Shared medium, no SLA, 100-500ms jitter | Most sub-50-employee shops use residential service |
| **Rural fixed wireless** | Weather-dependent, 2-10 Mbps, high latency | Southern counties (Spalding, Pike, Lamar, Butts) |
| **Cost barrier** | Business fiber: $200-500/month minimum | Prohibitive for 2-person shops |
| **No sovereignty** | ISP can throttle, inspect, or terminate | Zero control over network path |

For Earl's Precision Machining — the canonical 2-person shop [research-manufacturing-commons.md] —
adding $300/month business internet on top of the $449 edge device turns a one-time capital
expense into an ongoing operating expense that exceeds the hardware cost within 18 months.

### 18.2.2 Earl's Comcast Story — Why "Bring Your Own" Is a Lie

It's Thursday at 2:17 PM. Earl is machining a titanium fitting — a $2,800 part for a defense subcontractor, due Friday morning. His Comcast Business modem drops. It does this about once a week, usually for 5-30 minutes. Comcast's SLA for business class in Doraville is "best effort." Earl's ticket from last month is still "under investigation."

If Earl's TMNL edge device depends on Comcast for connectivity to the NATS hub, then every Comcast outage is a data gap. 30 minutes of missing telemetry during a critical machining operation. No spindle load data. No alarm capability. No event history for the period. If the part fails QC later, Earl can't prove the machine was within parameters during that window.

**With mesh networking**: Earl's Comcast drops at 2:17 PM. His TMNL edge device detects the NATS connection loss. Within 200ms, the Reticulum transport layer activates the CBRS data plane. Earl's telemetry packets route through Metro Machine Works (1.2 km away, still online via AT&T Fiber) and reach the NATS hub cluster via a 3-hop mesh path. Earl's spindle load data has a 200ms gap — one missed reading — instead of a 30-minute blackout. Earl doesn't even notice. His phone dashboard never flickered.

At 2:43 PM, Comcast recovers. The edge device detects lower-latency path via Ethernet, gracefully migrates NATS traffic back to the ISP path, and CBRS radio enters sleep mode. The mesh relay through Metro Machine Works earned $0.003 in $TMNL tokens for forwarding Earl's traffic. Marcus at Metro Machine Works doesn't notice either — his edge device forwarded 12 KB of Earl's data, earned a fraction of a token, and kept machining.

This is not a hypothetical. Comcast's own service status page shows 14 reported outages in the Doraville/Chamblee area in Q4 2025. AT&T U-verse reported 8. For Earl, each outage is a potential compliance gap. For the mesh network, each outage is a routine failover that takes less time than Earl's coffee maker.

**Three failover stories across deployment scenarios**:

| Scenario | Primary Failure | Mesh Failover Path | Recovery Time | Data Lost |
|----------|----------------|-------------------|---------------|-----------|
| **Earl (urban, Comcast cable)** | ISP modem drops (weekly) | CBRS to Metro Machine Works (1.2 km, 3 hops) | 200ms | 1 reading |
| **Diana (suburban, AT&T fiber)** | Fiber cut during road construction | LoRa control to neighbor → CBRS to hub (2.4 km, 4 hops) | 2s (LoRa discovery) | 5-10 readings |
| **Rural shop (Pike County, fixed wireless)** | Weather-related wireless degradation | LoRa to relay tower (8 km) → CBRS hop to ISP-connected node → hub | 5-10s | 30-60 readings (LoRa rate-limited) |

The rural scenario is the weakest — LoRa-only paths carry telemetry at 250-1,000 bps, meaning data is significantly delayed but not lost. JetStream buffers locally and synchronizes when a higher-bandwidth path recovers. The critical insight: even the worst-case mesh scenario (rural LoRa-only) provides store-and-forward delivery. The current architecture (ISP-only) provides nothing during an outage.

### 18.2.3 Cross-Reference: Who Needs Mesh Most

The market analysis [rfc-section-market-analysis.md] identifies 4,043 manufacturing establishments in the Atlanta MSA. The product strategy [rfc-section-product-strategy.md] targets the "long tail" — shops with 1-50 employees that represent 85%+ of establishments by count but receive 0% of incumbent IIoT vendor attention because the per-customer revenue doesn't justify a sales call.

The manufacturing process taxonomy [rfc-section-manufacturing-processes.md] identifies bandwidth requirements by manufacturing vertical:

| Vertical | Typical Data Rate per Machine | ISP Adequate? | Mesh Benefit |
|----------|------------------------------|--------------|-------------|
| **CNC machining** (Earl) | 0.1-0.5 KB/s (report-by-exception) | Yes, when available | Failover, sovereignty |
| **Injection molding** | 0.5-2 KB/s (cycle data, cavity pressure) | Yes | Failover |
| **Stamping/forming** | 0.2-1 KB/s (press force, cycle count) | Yes | Failover |
| **Welding** | 1-5 KB/s (waveform capture, quality metrics) | Marginal (EMI disrupts Wi-Fi) | Wired mesh node bypasses Wi-Fi |
| **Assembly (vision QC)** | 5-50 KB/s (image thumbnails, pass/fail) | Yes | Burst capacity |
| **Food/beverage** | 0.1-0.5 KB/s (temp, humidity, cleaning cycles) | Yes | Regulatory failover critical |
| **Pharmaceutical** | 0.2-1 KB/s (environmental monitoring, batch records) | Yes | **Mandatory failover for FDA compliance** |

The pharmaceutical and food/beverage verticals are particularly mesh-sensitive: FDA 21 CFR Part 11 [FDA-CFR11] and FSMA require continuous monitoring records. An ISP outage during a batch run creates a compliance gap that can trigger a recall investigation. Mesh failover isn't a convenience for these shops — it's a regulatory requirement.

### 18.2.4 The Network Node Vision

TMNL inverts the model:

```
INDUSTRY:  [Device] → [ISP] → [Cloud] → [Platform]
           Customer pays ISP. Platform depends on ISP. ISP owns the path.

TMNL:      [Device] → [Mesh Node] → [Mesh Node] → [Hub]
           Every device IS a mesh node. Network grows with every deployment.
           No ISP required. The commons owns the path.
```

Every TMNL edge device (Section 17.4, $449 QCS6490) becomes both a compute node
running the NATS/entity/Sparkplug stack AND a network relay node forwarding traffic
for neighboring devices. The network effect is bidirectional: more devices improve
both compute density AND network coverage.

### 18.2.5 What This Section Specifies

This section defines the radio networking layer that turns the physical infrastructure
(Section 17) into a self-healing, sovereign metropolitan mesh:

1. **Control Plane**: Reticulum mesh over LoRa 915MHz (long range, low bandwidth)
2. **Data Plane**: Reticulum mesh over CBRS 3.5GHz (medium range, high bandwidth)
3. **Integration**: NATS leaf node traffic riding over Reticulum links
4. **Incentives**: $TMNL token rewards for relay service (DePIN model)

---

## 18.3 Architecture Overview — Dual-Band Sovereign Mesh

### 18.3.1 The Dual-Band Principle

No single radio technology meets all TMNL networking requirements. LoRa provides
range and penetration but lacks bandwidth. CBRS provides bandwidth but lacks range
and building penetration. The architecture uses both:

```
┌─────────────────────────────────────────────────────────┐
│                 DUAL-BAND MESH TOPOLOGY                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   LoRa 915MHz (Control Plane)                          │
│   ┌──────────────────────────────────────────────────┐ │
│   │ • Reticulum announce propagation                 │ │
│   │ • Path discovery & link establishment            │ │
│   │ • Heartbeat / keepalive (0.44 bps)               │ │
│   │ • LXMF store-and-forward messaging               │ │
│   │ • Network topology advertisements                │ │
│   │ • Range: 2-5km urban, 10-15km rural             │ │
│   │ • Throughput: 1-10 kbps                          │ │
│   │ • Always-on, always-available                    │ │
│   └──────────────────────────────────────────────────┘ │
│                                                         │
│   CBRS 3.5GHz (Data Plane)                             │
│   ┌──────────────────────────────────────────────────┐ │
│   │ • NATS leaf node traffic (pub/sub/JetStream)     │ │
│   │ • Entity state machine sync                      │ │
│   │ • Sparkplug-B telemetry forwarding               │ │
│   │ • Marketplace/settlement data bursts             │ │
│   │ • Range: 0.5-3km urban, 1-5km suburban          │ │
│   │ • Throughput: 10-100 Mbps per link               │ │
│   │ • Activated on demand, power-managed             │ │
│   └──────────────────────────────────────────────────┘ │
│                                                         │
│   Fallback: Existing ISP (when available)              │
│   ┌──────────────────────────────────────────────────┐ │
│   │ • Preferred for bulk data transfer               │ │
│   │ • Used when mesh hop count > 5                   │ │
│   │ • NATS reconnect falls back to ISP automatically │ │
│   └──────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 18.3.2 Layered Protocol Stack

```
┌─────────────────────────────────────────────────────────┐
│  Application Layer                                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │  NATS JetStream  │  Sparkplug-B  │  HTTP/WS    │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
│  Transport Layer                                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Reticulum Network Stack (RNS)                  │   │
│  │  • Identity (X25519/Ed25519)                    │   │
│  │  • Destination (128-bit hash addressing)        │   │
│  │  • Link (encrypted persistent connections)       │   │
│  │  • Transport (multi-hop routing)                │   │
│  │  • Resource (large file transfer)               │   │
│  │  • Channel (bidirectional streams)              │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
│  Interface Layer                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ RNode    │  │ TCP/UDP  │  │ AutoIface│            │
│  │ (LoRa)   │  │ (CBRS)   │  │ (LAN)    │            │
│  └──────────┘  └──────────┘  └──────────┘            │
│                          │                              │
│  Physical Layer                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ 915MHz   │  │ 3550-    │  │ Ethernet │            │
│  │ LoRa     │  │ 3700MHz  │  │ /WiFi    │            │
│  │ (ISM)    │  │ (CBRS)   │  │          │            │
│  └──────────┘  └──────────┘  └──────────┘            │
└─────────────────────────────────────────────────────────┘
```

### 18.3.3 Operating Modes

Each TMNL edge device operates in one of three network modes, selected automatically
based on available connectivity:

| Mode | Primary Path | Fallback | Mesh Role | Use Case |
|------|-------------|----------|-----------|----------|
| **ISP-Primary** | Existing internet | CBRS mesh → LoRa mesh | Relay (opportunistic) | Sites with business fiber |
| **Mesh-Primary** | CBRS mesh | LoRa mesh → ISP (if available) | Active relay | Sites without reliable ISP |
| **Mesh-Only** | CBRS mesh | LoRa mesh | Active relay (mandatory) | Sites with no ISP (rural) |

Mode selection is automatic and transparent to the NATS layer above. The NATS leaf
node sees a TCP connection; it does not know or care whether that TCP connection
rides over Ethernet, CBRS radio, or a multi-hop Reticulum path.

---

## 18.4 Reticulum Protocol Deep Dive

### 18.4.1 Why Reticulum

Reticulum [RNS-MANUAL] is a cryptographic networking stack designed for resilient
communication over diverse physical media. It was selected over alternatives
(Meshtastic, goTenna proprietary, custom mesh) for the following reasons:

| Requirement | Reticulum | Meshtastic | goTenna | Custom |
|------------|-----------|------------|---------|--------|
| **Transport agnostic** | Any medium ≥5 bps, 500-byte MTU | LoRa only | Proprietary radio | Must build |
| **End-to-end encryption** | X25519 + AES-256-CBC + HKDF | AES-256 | AES-256 | Must build |
| **Forward secrecy** | Per-link ECDH exchange | No | No | Must build |
| **Multi-hop routing** | Self-configuring, announce-based | Fixed flood | Proprietary | Must build |
| **No central infrastructure** | Zero — fully trustless | Partially (MQTT optional) | Cloud optional | Must build |
| **Link establishment cost** | 297 bytes / 3 packets | N/A (broadcast) | Proprietary | Must build |
| **Keepalive overhead** | 0.44 bits/second | Higher | Higher | Must build |
| **Open source** | MIT License | GPL v3 | Proprietary | Own IP |
| **Maturity** | Active since 2020, FOSDEM 2026 Rust port talk | Active, larger community | Commercial, limited | None |

**Critical differentiator**: Reticulum is a networking STACK, not a messaging app.
It provides the equivalent of TCP/IP for mesh networks — any application protocol
(including NATS) can ride on top. Meshtastic is a messaging application that happens
to use LoRa. goTenna is proprietary hardware. Only Reticulum provides the general-purpose
transport layer TMNL needs [ERETHON-COMPARISON].

### 18.4.2 Cryptographic Architecture

Reticulum's security model aligns with TMNL's sovereignty requirements:

```
Identity Generation:
  Private Key:  X25519 (256-bit)
  Public Key:   Derived from private key
  Signing Key:  Ed25519 (256-bit)
  Verify Key:   Derived from signing key

Destination Address:
  hash = truncate(SHA-256(app_name + identity_public_key + signing_key), 128 bits)
  → 16-byte globally unique address, no central registry needed

Link Establishment (3-packet handshake, 297 bytes total):
  1. LINKREQUEST:  Initiator → ephemeral X25519 pubkey + Ed25519 signature
  2. LRPROOF:      Responder → proof + ephemeral key
  3. CONFIRMATION:  Initiator → encrypted link_id

  → ECDH key exchange → AES-256-CBC tunnel with HKDF-derived keys

Per-Packet Encryption:
  • SINGLE destination: Encrypted to identity pubkey, ephemeral keys
  • GROUP destination:  Symmetric AES-128-CBC with shared key
  • LINK destination:   AES-256-CBC with link-specific derived keys
  • PLAIN destination:  Unencrypted (broadcast/announce only)
```

**Implication for TMNL**: Every TMNL edge device has a Reticulum identity. That identity
is derived from its cryptographic keys — no DHCP, no DNS, no NAT traversal, no IP
address management. A device's address IS its identity. This maps cleanly to the
NATS account-per-organization model (Section 16): each organization's Reticulum
identity can be bound to its NATS account JWT.

### 18.4.3 Routing and Path Discovery

Reticulum routing is announce-based and self-configuring [RNS-MANUAL]:

1. **Announce**: A destination broadcasts its reachability (public key + signature)
2. **Propagation**: Transport Nodes receive, store path in `path_table`, rebroadcast
3. **Rate Limiting**: Announces are rate-limited and prioritized by hop count
4. **Path Selection**: Packets routed via stored path entries toward destination
5. **Link Setup**: Once path known, 3-packet handshake establishes encrypted tunnel

```
Path Discovery Example (TMNL deployment):

  Earl's Edge   → LoRa → Node_A → LoRa → Node_B → CBRS → Hub_Cluster
  (announce)        1 hop           2 hops           3 hops

  path_table at Node_A:
    Earl's_hash → next_hop: direct (LoRa interface)
  path_table at Node_B:
    Earl's_hash → next_hop: Node_A (LoRa interface)
  path_table at Hub:
    Earl's_hash → next_hop: Node_B (CBRS interface)
```

**Scaling considerations**: Reticulum path tables grow linearly with the number of
known destinations. For 200,000 organizations with ~1M destinations (5 per org),
each path entry is approximately 64 bytes, yielding ~64MB of path state per transport
node. This is well within the 4-16GB RAM of the QCS6490 edge device.

### 18.4.4 LXMF — Reliable Messaging Layer

LXMF (Lightweight eXchange Message Format) [LXMF-SPEC] provides reliable,
store-and-forward messaging over Reticulum:

- **Delay tolerant**: Messages queue at Propagation Nodes until recipient is online
- **End-to-end encrypted**: Inherits Reticulum's cryptographic guarantees
- **Forward secrecy**: When sent over established Links
- **Efficient**: Designed for extremely low-bandwidth systems (LoRa, packet radio)

LXMF is used for TMNL's non-real-time messaging:
- Network management commands
- Firmware update notifications
- DePIN token settlement messages
- Alarm/alert propagation when NATS path is unavailable

### 18.4.5 Performance Envelope

| Metric | LoRa Interface | TCP/Ethernet | WiFi | CBRS (projected) |
|--------|---------------|-------------|------|-------------------|
| **Throughput** | 1-10 kbps | 10-100 Mbps | 10-100 Mbps | 10-50 Mbps |
| **Max tested** | ~21.9 kbps (SF7/BW500) | ~500 Mbps | ~300 Mbps | ~100 Mbps |
| **Latency (single hop)** | 50-500ms | 1-10ms | 2-20ms | 5-30ms |
| **Latency tolerance** | Seconds to minutes | Milliseconds | Milliseconds | Milliseconds |
| **MTU** | 500 bytes | 1500 bytes | 1500 bytes | 1500 bytes |
| **Link setup cost** | 297 bytes | 297 bytes | 297 bytes | 297 bytes |
| **Keepalive** | 0.44 bps | 0.44 bps | 0.44 bps | 0.44 bps |

### 18.4.6 Current Maturity Assessment

| Aspect | Status | Risk Level |
|--------|--------|-----------|
| **Python reference implementation** | Stable, v1.1.3 (2025) | Low |
| **Rust implementation (reticulum-rs)** | Active development, FOSDEM 2026 presentation | Medium |
| **RNode firmware** | Stable on 20+ board variants | Low |
| **LXMF protocol** | Stable | Low |
| **Meshchat (user-facing app)** | Active, Liam Cottle fork popular | Low |
| **Transport over TCP/UDP** | Production-ready | Low |
| **Transport over LoRa** | Production-ready | Low |
| **Transport over CBRS** | Not yet implemented — requires custom interface | High |
| **Large-scale deployment (>1000 nodes)** | Not proven at scale | High |
| **Embedded (non-Linux) support** | Limited — Python is CPU-heavy on constrained devices | Medium |

**Honest assessment**: Reticulum is production-quality for small-to-medium mesh networks
(10-500 nodes) over LoRa and TCP. Large-scale metro deployment (10,000+ nodes) and
CBRS transport are unproven. The Rust port (reticulum-rs) addresses the embedded
performance concern but is not yet production-ready. TMNL's phased deployment plan
(Section 18.14) accounts for this maturity gap.

---

## 18.5 CBRS 3.5GHz Spectrum — Free Metro Backbone

### 18.5.1 What Is CBRS

The Citizens Broadband Radio Service (CBRS) provides shared access to the 3550-3700 MHz
band under FCC 47 CFR Part 96 [FCC-PART96]. It uses a three-tier sharing framework:

| Tier | Name | Access | Protection | Cost |
|------|------|--------|-----------|------|
| **1 (Highest)** | Incumbent | Federal radar, FSS | Protected from all others | N/A (existing rights) |
| **2** | PAL (Priority Access License) | Auctioned, 10MHz channels, 10-year terms | Protected from GAA | $4.5B total (Auction 105, 2020) |
| **3 (Lowest)** | GAA (General Authorized Access) | License-by-rule, open to all | Must accept interference from Tier 1+2 | **FREE** |

**TMNL operates exclusively in the GAA tier.** No spectrum license is needed. No
auction participation. No recurring spectrum fees. Any FCC-certified CBSD can
transmit in the GAA tier after registering with a Spectrum Access System (SAS).

### 18.5.2 GAA Technical Parameters

Per 47 CFR 96.41 and 96.43 [FCC-96.41]:

| Parameter | Category A CBSD | Category B CBSD | End User Device |
|-----------|----------------|----------------|-----------------|
| **Max EIRP** | 30 dBm (1W) per 10MHz | 47 dBm (50W) per 10MHz | 23 dBm (200mW) |
| **Max PSD** | 20 dBm/MHz | 37 dBm/MHz | N/A |
| **Deployment** | Indoor or outdoor | Outdoor only (with ESC) | Any |
| **Height limit** | No specific limit | Professional install required | No limit |
| **SAS registration** | Required | Required | Not required |
| **Antenna** | Omnidirectional or directional | Professional install | Any |

**TMNL's CBSD classification**: The TMNL edge device operates as a **Category A CBSD**:
- 30 dBm (1W) EIRP — sufficient for 0.5-3km coverage
- No professional installation requirement for Category A
- Both indoor and outdoor deployment permitted
- SAS registration required but automated (API-based via Google SAS, Federated Wireless, etc.)

Category B CBSDs (50W, outdoor tower-mount) are reserved for TMNL hub infrastructure
at strategic elevated sites (water towers, rooftop, industrial parks).

### 18.5.3 SAS Registration Requirements

All CBSDs MUST register with an approved SAS before transmitting [FCC-96.57]:

1. **SAS providers**: Google SAS [GOOGLE-SAS], Federated Wireless, CommScope, Amdocs, Sony
2. **Registration data**: Device location (GPS), antenna height, antenna gain, device category
3. **Frequency assignment**: SAS assigns available GAA channels dynamically
4. **Heartbeat**: CBSD must maintain periodic heartbeat with SAS (confirm continued authorization)
5. **Power control**: SAS may reduce authorized power to protect incumbents/PAL holders

**TMNL implementation**: Each edge device runs a SAS client that auto-registers on
first boot and maintains the heartbeat. This is a background daemon, invisible to
the manufacturing user. The SAS client is part of the TMNL system image.

**Cost**: SAS registration for GAA devices is typically free or very low cost
($0-5/device/year depending on SAS provider). Google SAS offers a cloud-based
portal with API access. This is a negligible operating cost at scale.

### 18.5.4 CBRS Propagation at 3.5GHz

3.5GHz propagation is well-characterized. Key parameters for Atlanta metro:

| Environment | Typical Range (Cat A, 1W) | Path Loss Model | Key Factors |
|-------------|--------------------------|-----------------|-------------|
| **Indoor (office/factory)** | 50-200m | ITM / eHata indoor | ~22 dB median penetration loss [NOTRE-DAME-CBRS] |
| **Outdoor urban (Midtown/Downtown)** | 300m-1km | eHata urban | Building shadowing, multipath, foliage |
| **Outdoor suburban (Gwinnett, Cobb)** | 0.5-3km | eHata suburban | Line-of-sight opportunities, lower clutter |
| **Industrial park** | 0.5-2km | eHata suburban | Steel buildings: high penetration loss |
| **Outdoor rural (southern counties)** | 1-5km | ITM open terrain | Best-case LOS range at 1W |
| **Category B (50W, tower)** | 3-10km | eHata macro | Hub infrastructure only |

**Building penetration at 3.5GHz**: University of Notre Dame measurements in a real-world
CBRS deployment found >22 dB median penetration loss at 3.5GHz [NOTRE-DAME-CBRS].
This means outdoor-to-indoor coverage is significantly degraded. For factory-floor
coverage, the TMNL edge device SHOULD be mounted indoors with an external antenna
for mesh backhaul.

### 18.5.5 CBRS Bandwidth and Capacity

The GAA tier has access to up to 150 MHz of spectrum (3550-3700 MHz), divided into
15 channels of 10 MHz each. SAS dynamically assigns available channels.

| Configuration | Bandwidth | Throughput (LTE) | Throughput (5G NR) |
|--------------|-----------|-----------------|-------------------|
| Single 10MHz channel | 10 MHz | ~30 Mbps DL / ~10 Mbps UL | ~50 Mbps DL / ~20 Mbps UL |
| 2x Carrier Aggregation | 20 MHz | ~60 Mbps DL / ~20 Mbps UL | ~100 Mbps DL / ~40 Mbps UL |
| 4x Carrier Aggregation | 40 MHz | ~120 Mbps DL | ~200 Mbps DL |

For TMNL telemetry traffic (report-by-exception, KB/s per device), even a single
10MHz GAA channel provides 1000x more bandwidth than needed per link. The capacity
question is not bandwidth per link but aggregate capacity across many mesh hops.

---

## 18.6 LoRa Sub-GHz — The Control Plane

### 18.6.1 LoRa Physical Layer

LoRa (Long Range) uses Chirp Spread Spectrum (CSS) modulation in ISM bands:

| Parameter | US (FCC Part 15) |
|-----------|-----------------|
| **Frequency** | 902-928 MHz |
| **Channel BW** | 125 kHz, 250 kHz, 500 kHz |
| **Spreading Factor** | SF7 (fastest) to SF12 (longest range) |
| **Max EIRP** | 30 dBm (1W) — FCC Part 15.247 |
| **Duty cycle** | No restriction in US (unlike EU) |
| **Modulation** | Chirp Spread Spectrum |

### 18.6.2 LoRa Range in Atlanta Metro

Real-world LoRa range at 915MHz for TMNL deployments:

| Environment | Expected Range | Spreading Factor | Data Rate | Source |
|-------------|---------------|-----------------|-----------|--------|
| **Dense urban (Midtown)** | 1-3 km | SF10-SF12 | 250-980 bps | [LORA-URBAN-SURVEY] |
| **Suburban (Gwinnett/Cobb)** | 3-8 km | SF9-SF11 | 440-1760 bps | [LORA-SUBURBAN] |
| **Industrial park** | 2-5 km | SF9-SF10 | 980-1760 bps | Estimated from suburban + steel attenuation |
| **Rural (southern counties)** | 5-15 km | SF10-SF12 | 250-980 bps | [LORA-RURAL] |
| **Record (LOS, optimal)** | 700+ km | SF12/BW125 | ~250 bps | [LORA-RECORD] — not operational |

**For control plane use (Reticulum announces, path discovery, keepalives)**: Even the
slowest LoRa configuration (SF12/BW125, ~250 bps) is sufficient. A Reticulum announce
is ~150 bytes. At 250 bps, that's 4.8 seconds per announce — acceptable for control
plane traffic. Reticulum's keepalive is 0.44 bps, negligible on any LoRa configuration.

### 18.6.3 RNode Hardware for TMNL

RNode is Reticulum's native LoRa transceiver platform. Supported devices
[RNS-HARDWARE]:

| Device | LoRa Chip | Frequency | Price | Notes |
|--------|----------|-----------|-------|-------|
| **Heltec LoRa32 v3** | SX1262 | 868/915 MHz | ~$18 | Best value, ESP32-S3 based |
| **LilyGO T-Beam Supreme** | SX1262/SX1268 | 868/915 MHz | ~$35 | GPS included, high power |
| **RAK4631** | SX1262 | 868/915 MHz | ~$25 | nRF52840 based, BLE |
| **LilyGO T3S3** | SX1262 | 868/915 MHz | ~$22 | ESP32-S3, compact |
| **Seeed XIAO Wio-SX1262** | SX1262 | 868/915 MHz | ~$15 | Smallest form factor |

**TMNL selection**: The **Heltec LoRa32 v3** ($18) or **RAK4631** ($25) is
RECOMMENDED as the RNode module for TMNL edge devices. Connected via USB to
the QCS6490 carrier board, it provides the LoRa control plane interface.

**Critical note**: RNode supports ONLY sub-GHz LoRa bands (433, 868, 915 MHz).
It does NOT support 3.5GHz CBRS. The CBRS data plane requires a separate radio
module (Section 18.10).

---

## 18.7 Hybrid Topology — LoRa Control + CBRS Data

### 18.7.1 Why Hybrid

Neither LoRa alone nor CBRS alone meets all requirements:

| Requirement | LoRa Only | CBRS Only | Hybrid (LoRa + CBRS) |
|------------|-----------|-----------|---------------------|
| **Range (urban)** | 1-3 km | 0.3-1 km | 1-3 km (LoRa for discovery) |
| **Range (rural)** | 5-15 km | 1-5 km | 5-15 km (LoRa for discovery) |
| **Throughput** | 1-10 kbps | 10-100 Mbps | 10-100 Mbps (CBRS for data) |
| **Always-on feasibility** | Yes (µW idle power) | No (W-level power) | Yes (LoRa always-on, CBRS on demand) |
| **Building penetration** | Good (sub-GHz) | Poor (3.5GHz, 22dB loss) | Good (LoRa for control) |
| **License requirement** | ISM — none | GAA — SAS registration | Both manageable |
| **Telemetry (KB/s)** | Marginal | Excellent | Excellent |
| **Path discovery** | Excellent | Limited by range | Excellent |

### 18.7.2 Operational Flow

```
1. BOOT:
   Edge device starts RNode (LoRa) interface → always-on
   Edge device registers with SAS → CBRS ready but not transmitting

2. ANNOUNCE (LoRa control plane):
   Device broadcasts Reticulum announce over LoRa
   Neighboring Transport Nodes store path, rebroadcast
   → Network topology is discovered over LoRa's superior range

3. LINK REQUEST (LoRa → CBRS handoff):
   When NATS traffic needs to flow:
     a. LoRa control plane identifies best path to hub
     b. CBRS interface activated on both endpoints
     c. Reticulum link established over CBRS (297-byte handshake)
     d. NATS traffic flows over high-bandwidth CBRS link

4. DATA TRANSFER (CBRS data plane):
   NATS pub/sub messages serialized into Reticulum packets
   Forwarded hop-by-hop over CBRS links
   Each hop is an encrypted Reticulum link

5. IDLE (power conservation):
   When no NATS traffic for configurable timeout (default: 60s)
   CBRS radio enters sleep mode
   LoRa maintains topology awareness at 0.44 bps

6. FAILOVER:
   If CBRS link fails → LoRa carries critical telemetry (low-rate)
   If LoRa fails → CBRS uses last-known paths for direct links
   If both fail → ISP fallback (if available)
   If all fail → local JetStream buffer (30-day retention per Section 15)
```

### 18.7.3 Wire Diagram — Two Adjacent Manufacturing Sites

```
    Earl's Precision              Metro Machine Works
    (Site A)                      (Site B, 1.2km away)
    ┌────────────────┐            ┌────────────────┐
    │  QCS6490 Edge  │            │  QCS6490 Edge  │
    │  ┌──────────┐  │            │  ┌──────────┐  │
    │  │ NATS Leaf│  │            │  │ NATS Leaf│  │
    │  └────┬─────┘  │            │  └────┬─────┘  │
    │       │ TCP     │            │       │ TCP     │
    │  ┌────┴─────┐  │            │  ┌────┴─────┐  │
    │  │Reticulum │  │            │  │Reticulum │  │
    │  │Transport │  │            │  │Transport │  │
    │  └──┬───┬───┘  │            │  └──┬───┬───┘  │
    │     │   │      │            │     │   │      │
    │  ┌──┴┐ ┌┴──┐   │            │  ┌──┴┐ ┌┴──┐   │
    │  │LoRa│ │CBRS│  │            │  │LoRa│ │CBRS│  │
    │  │RNode│SAS │  │            │  │RNode│SAS │  │
    │  └──┬┘ └┬───┘  │            │  └──┬┘ └┬───┘  │
    └─────┼───┼──────┘            └─────┼───┼──────┘
          │   │                         │   │
          │   └────── CBRS 3.5GHz ──────┘   │
          │           (data: 50 Mbps)        │
          └──────── LoRa 915MHz ────────────┘
                    (control: 5 kbps)

    LoRa: Always-on, discovers neighbor, maintains heartbeat
    CBRS: Activated when NATS data needs to flow (telemetry burst)
```

---

## 18.8 Range and Coverage Analysis — Atlanta MSA

### 18.8.1 Atlanta MSA Geography

The Atlanta-Sandy Springs-Roswell Metropolitan Statistical Area spans 29 counties
covering approximately 8,376 square miles [ARC-FREIGHT-2024]. Manufacturing
establishments are not uniformly distributed:

| Zone | Counties | Area (sq mi) | Mfg Establishments | Density |
|------|----------|-------------|-------------------|---------|
| **Core urban** | Fulton, DeKalb | ~530 | ~800 | 1.5/sq mi |
| **Inner suburban** | Gwinnett, Cobb, Clayton | ~700 | ~1,200 | 1.7/sq mi |
| **Outer suburban** | Cherokee, Forsyth, Henry, Douglas | ~1,200 | ~600 | 0.5/sq mi |
| **Industrial corridors** | I-85 NE, I-75 NW, I-20 W, Airport S | ~300 | ~1,000 | 3.3/sq mi |
| **Rural** | Spalding, Pike, Lamar, Butts, etc. | ~5,600 | ~443 | 0.08/sq mi |
| **Total** | 29 counties | ~8,376 | ~4,043 | 0.48/sq mi |

Atlanta's industrial space totals over 600 million square feet across 10+ major
submarkets [TENANTSCIENCE-ATL]. Key concentrations:
- **I-85 NE corridor** (Chamblee → Buford): ~130M sq ft, highest activity
- **Fulton Industrial** (I-20 West): ~116M sq ft, oldest/cheapest
- **Airport/South**: ~50M sq ft, freight-adjacent
- **South I-75** (Henry, Spalding): ~68M sq ft

### 18.8.2 Coverage Modeling — LoRa Control Plane

**Assumption**: Every TMNL edge device is a LoRa relay node. What density
is required for full LoRa control plane coverage?

| Zone | Avg Distance Between Mfg Sites | LoRa Range (realistic) | Coverage Status |
|------|-------------------------------|----------------------|-----------------|
| **Industrial corridors** | 200-500m | 2-5 km | Fully covered at ~10% penetration |
| **Core urban** | 500m-1km | 1-3 km | Covered at ~20% penetration |
| **Inner suburban** | 1-3 km | 3-8 km | Covered at ~15% penetration |
| **Outer suburban** | 2-5 km | 3-8 km | Covered at ~30% penetration |
| **Rural** | 5-20 km | 5-15 km | Gaps likely — requires strategic relay placement |

**Key insight**: In the industrial corridor (where 1,000 of 4,043 establishments
are concentrated), even a 10% TMNL adoption rate (100 devices) provides dense
LoRa coverage because the inter-site distances (200-500m) are well within LoRa range.

**Bootstrap problem**: The first devices deployed have no mesh neighbors.
Solution: TMNL deploys 20-30 "seed nodes" at strategic elevated locations
(water towers, industrial park management offices, coworking spaces) before
the first customer deployments. Cost: ~$600/node × 30 = $18,000 for initial
coverage of the I-85 NE corridor.

### 18.8.3 Coverage Modeling — CBRS Data Plane

CBRS coverage is shorter range but higher bandwidth. For the data plane, the
question is not wall-to-wall coverage but point-to-point connectivity between
neighboring TMNL nodes:

| Scenario | Distance | CBRS Link Quality | Hops to Hub |
|----------|----------|------------------|-------------|
| **Industrial park neighbors** | 100-500m | Excellent (20+ dB margin) | 1-2 |
| **Suburban neighbors** | 0.5-2 km | Good (10-15 dB margin) | 2-4 |
| **Urban neighbors** | 200m-1 km | Moderate (5-15 dB margin, multipath) | 2-5 |
| **Rural isolated** | 2-5 km | Marginal (Cat A) / Good (Cat B relay) | 3-8 |

**Latency budget** per Section 15 (Edge Architecture):
- Factory floor data: 10ms requirement — handled locally, never crosses mesh
- Metro backbone (site-to-hub): 100-500ms acceptable
- At 5-30ms per CBRS hop, 5 hops = 25-150ms — within budget
- At 50-500ms per LoRa hop (fallback), 3 hops = 150ms-1.5s — marginal for real-time

### 18.8.4 Estimated Node Count for Full Coverage

| Coverage Target | LoRa (Control) | CBRS (Data) | Total Unique Nodes |
|----------------|---------------|-------------|-------------------|
| **Industrial corridors only** (1,000 sites) | ~150 nodes | ~300 nodes | ~300 |
| **Core + inner suburban** (3,000 sites) | ~500 nodes | ~1,200 nodes | ~1,200 |
| **Full MSA** (4,043 sites) | ~800 nodes | ~2,500 nodes | ~2,500 |
| **Full MSA + rural relay fill** | ~800 + 50 relays | ~2,500 + 100 relays | ~2,650 |

**Economics**: At 4,043 manufacturing establishments, TMNL needs ~60% adoption
(~2,500 devices) for self-sustaining CBRS mesh coverage across the MSA. Below
that threshold, ISP fallback is necessary for some sites. The phased deployment
plan (Section 18.14) targets industrial corridors first, where 10-25% adoption
provides sufficient density.

---

## 18.9 NATS-over-Reticulum Integration

### 18.9.1 Transport Binding

NATS requires a TCP connection between the leaf node and the hub cluster. Reticulum
provides this via its TCP-compatible interface layer:

```
NATS Leaf Node
    │
    │ TCP connect to nats://hub.tmnl.local:4222
    │
    ▼
Reticulum TCP Bridge (local loopback)
    │
    │ Reticulum Link (encrypted, multi-hop)
    │
    ▼
Reticulum TCP Bridge (hub side)
    │
    │ TCP connect to nats://localhost:4222
    │
    ▼
NATS Hub Cluster
```

The NATS leaf node connects to a local TCP port that is backed by a Reticulum link.
From NATS's perspective, it is a standard TCP connection. From Reticulum's perspective,
it is an encrypted tunnel that may traverse multiple radio hops.

**Implementation**: A `ReticularBridge` service runs on each TMNL edge device:
1. Listens on `127.0.0.1:4222` (local NATS connection point)
2. Establishes a Reticulum Link to the nearest hub's Reticulum identity
3. Forwards TCP traffic bidirectionally over the Reticulum Link
4. Handles reconnection, path changes, and interface failover transparently

### 18.9.2 Bandwidth Requirements

TMNL telemetry traffic is modest per device (Section 15, Edge Architecture):

| Traffic Type | Per Device | Frequency | Bandwidth |
|-------------|-----------|-----------|-----------|
| **Telemetry (report-by-exception)** | 50-200 bytes | 1-10/minute | ~30 bytes/sec avg |
| **Entity state changes** | 200-500 bytes | 1-50/hour | ~5 bytes/sec avg |
| **Sparkplug-B NBIRTH/NDEATH** | 1-5 KB | On connect/disconnect | Burst |
| **Alarm events** | 200-1000 bytes | 0-10/hour | ~1 byte/sec avg |
| **NATS heartbeat** | ~50 bytes | Every 30s | ~2 bytes/sec |
| **Total per device** | — | — | **~40 bytes/sec avg, ~5 KB/s burst** |

At 40 bytes/sec average per device, a CBRS link carrying traffic for 100 devices
needs only 4 KB/s sustained — trivial for even a single 10MHz CBRS channel
(30+ Mbps capacity).

**Bottleneck is hop aggregation**: A relay node forwarding traffic for N upstream
devices needs N × 40 bytes/sec. At 100 upstream devices, that's 4 KB/s. At
1,000 upstream devices (major relay), that's 40 KB/s. Still well within CBRS capacity.

### 18.9.3 Latency Analysis

| Path | Hops | Estimated Latency | Acceptable? |
|------|------|------------------|-------------|
| Factory floor (local) | 0 (direct Ethernet/WiFi) | <1ms | Yes — meets 10ms requirement |
| Site-to-hub (CBRS, 3 hops) | 3 | 15-90ms | Yes — within 100-500ms budget |
| Site-to-hub (LoRa fallback, 3 hops) | 3 | 150ms-1.5s | Marginal — acceptable for telemetry, not real-time |
| Site-to-hub (CBRS, 5 hops) | 5 | 25-150ms | Yes — within budget |
| Cross-metro (hub-to-hub) | 1 (hub backbone) | 5-20ms | Yes |
| Total end-to-end (worst case) | 5 mesh + 1 backbone | 30-170ms | Yes |

### 18.9.4 Disconnected Operation

When all network paths fail, the TMNL edge device continues operating:

1. **JetStream local buffer**: 30-day retention per Section 15
2. **LXMF queue**: Critical alerts queued for store-and-forward delivery
3. **Alarm state**: Local alarm detection continues (Section 17, Hexagon NPU)
4. **Reconnection**: Reticulum automatically re-establishes links when any path recovers

This matches the "edge-first, cloud-optional" sovereignty principle. No data is
lost. The mesh is a performance enhancer, not a dependency.

---

## 18.10 Hardware Requirements and BOM Addendum

### 18.10.1 Radio Module Options for CBRS

The QCS6490 has an integrated 5G modem supporting sub-6GHz bands including
CBRS Band 48 (3550-3700 MHz) [QCS6490-BRIEF]. However, for mesh relay operation,
dedicated CBRS radio hardware may be preferred:

**Option A: QCS6490 Integrated 5G (Preferred)**

The QCS6490's integrated Snapdragon X55/X62-class modem supports:
- 5G NR sub-6GHz (including n48/CBRS)
- 5G mmWave
- LTE (including B48/CBRS)
- TDD and FDD modes

This means the TMNL edge device can operate as a CBRS endpoint WITHOUT
additional radio hardware. The modem connects to the SAS as a standard
CBSD. No additional BOM cost for basic CBRS connectivity.

**Limitation**: The integrated modem is designed for client/UE operation, not
base station/relay. For full mesh relay where the device acts as both
transmitter and receiver on CBRS, a dedicated CBSD module may be needed.

**Option B: External CBRS Small Cell Module**

For devices designated as mesh relay nodes (not just endpoints):

| Module | Type | EIRP | Price | Form Factor |
|--------|------|------|-------|-------------|
| **Baicells Nova 430H** | Cat A outdoor eNB | 24 dBm (250mW) | $999 | Standalone |
| **Baicells Stellar 227** | Cat A indoor gNB (5G NR) | 30 dBm (1W) | $3,750 | Standalone |
| **CBRS M.2 module** (SIMCom SIM8262A) | Cat A endpoint | 23 dBm | ~$150-200 | M.2 card |
| **5G RedCap module** (Qualcomm X35) | Cat A endpoint | 23 dBm | ~$80-120 | M.2 card |

**TMNL recommendation**: For Phase 1-2, use the QCS6490's integrated modem in
endpoint/UE mode. Mesh relay is achieved by running Reticulum over the 5G
connection (treating each CBRS link as a TCP/UDP transport). Full CBSD relay
operation (base station mode) is a Phase 3+ capability requiring additional
regulatory and hardware work.

**Option C: Point-to-Point CBRS Backhaul**

For hub-to-hub or hub-to-relay-tower links:

| Solution | Throughput | Range | Price (pair) |
|----------|-----------|-------|-------------|
| **Baicells Nova 436H** (Cat B) | 100+ Mbps | 3-10 km | ~$5,000 |
| **Cambium 3.5GHz PMP** | 200+ Mbps | 5-15 km | ~$3,000 |
| **Ubiquiti airFiber** (5GHz alt) | 500+ Mbps | 10+ km | ~$1,500 |

### 18.10.2 LoRa Module for TMNL Edge

The LoRa RNode module is a USB-connected peripheral to the QCS6490 carrier board:

| Component | Specification | Cost (@1K) |
|-----------|--------------|-----------|
| **Heltec LoRa32 v3** (RNode) | SX1262, 915MHz, ESP32-S3, USB-C | $14-18 |
| **External antenna** (915MHz) | 3 dBi omnidirectional, RP-SMA | $3-5 |
| **Antenna cable** | U.FL to RP-SMA, 15cm | $1-2 |
| **USB cable** | USB-C to USB-A, 30cm | $1 |
| **Subtotal** | — | **$19-26** |

### 18.10.3 BOM Addendum — Network Node Upgrade

Adding mesh networking to the base TMNL edge device ($449, Section 17.4):

| Configuration | Added Components | Added Cost | Total Device Cost |
|--------------|-----------------|-----------|------------------|
| **Base (no mesh)** | None | $0 | $449 |
| **LoRa only (control plane)** | RNode + antenna | $25 | $474 |
| **LoRa + CBRS integrated** | RNode + antenna (CBRS via QCS6490 modem) | $25 | $474 |
| **LoRa + CBRS M.2 module** | RNode + SIM8262A M.2 + antenna | $200 | $649 |
| **Full relay node (Cat A)** | RNode + Baicells 430H + antennas | $1,050 | $1,499 |
| **Hub relay (Cat B)** | RNode + Baicells 436H + sector antenna | $5,200 | $5,649 |

**Recommended standard configuration**: **LoRa + CBRS integrated** at $474.
This adds only $25 to the base BOM while enabling both control plane (LoRa mesh)
and data plane (CBRS via integrated modem). The QCS6490's built-in 5G modem
provides CBRS Band 48 support at zero additional radio module cost.

### 18.10.4 Antenna Requirements

| Band | Antenna Type | Gain | Mounting | Cost |
|------|-------------|------|---------|------|
| **915MHz LoRa** | Omnidirectional whip | 3 dBi | SMA bulkhead on enclosure | $3-5 |
| **915MHz LoRa (extended range)** | Fiberglass collinear | 6-8 dBi | Mast mount, outdoor | $25-40 |
| **3.5GHz CBRS (integrated)** | QCS6490 module antenna | 2-5 dBi | Internal/PCB | Included in SoM |
| **3.5GHz CBRS (external)** | Panel/patch antenna | 9-12 dBi | Wall/pole mount | $30-60 |
| **3.5GHz CBRS (Cat B relay)** | Sector antenna | 15-17 dBi | Tower mount | $150-300 |

---

## 18.11 DePIN Token Integration — Proof of Relay

### 18.11.1 The Network Incentive Model

TMNL node operators earn $TMNL tokens for providing network relay service. This
creates a positive flywheel:

```
Deploy TMNL device → Earn $TMNL for relay → More devices deployed →
Better coverage → More relay opportunities → More $TMNL earned →
More devices deployed → ...
```

### 18.11.2 Proof of Relay (PoR) — TMNL's Coverage Verification

Unlike Helium's Proof of Coverage (PoC) — which suffered from widespread spoofing
via virtual hotspots and GPS manipulation [HELIUM-AUDIT] — TMNL's Proof of Relay
is based on **actual traffic forwarded**, not mere presence:

| Dimension | Helium PoC | TMNL Proof of Relay |
|-----------|-----------|-------------------|
| **What's proven** | "I exist at this location" | "I forwarded N bytes for M peers" |
| **Verification** | Challenge-response RF beacons | Cryptographic receipts from data recipients |
| **Spoofing vector** | Virtual hotspots, GPS spoofing | Must actually relay real traffic |
| **Reward basis** | Coverage area claimed | Bandwidth × hops × uptime |
| **Data dependency** | None — rewards for idle coverage | Requires actual usage |

### 18.11.3 Cryptographic Receipt Mechanism

Each relayed Reticulum packet generates a verifiable receipt:

```
Relay Receipt:
  relay_node_id:     Reticulum identity hash of relay
  source_hash:       Truncated source destination hash
  dest_hash:         Truncated destination hash
  bytes_forwarded:   Packet size
  timestamp:         Unix timestamp
  hop_number:        Position in path
  signature:         Ed25519 signature by relay node

Receipt Verification:
  • Destination node confirms receipt of packet (Reticulum proof mechanism)
  • Hub aggregates relay receipts per epoch (24h)
  • Receipts cross-referenced: source confirms send, dest confirms receive,
    intermediate relays must form a valid path
  • Invalid paths (no matching source/dest) are rejected
```

### 18.11.4 Token Reward Formula

```
reward(node, epoch) = base_rate
                    × relay_volume_multiplier(bytes_forwarded)
                    × uptime_multiplier(hours_online / 24)
                    × coverage_bonus(underserved_area?)
                    × hop_weight(avg_hop_position)

Where:
  base_rate:                Fixed per epoch (set by governance)
  relay_volume_multiplier:  log2(bytes / 1MB + 1) — logarithmic to prevent gaming
  uptime_multiplier:        Linear 0-1 (24h online = 1.0)
  coverage_bonus:           1.5x for underserved zones (rural, coverage gaps)
  hop_weight:               Interior hops weighted higher than leaf hops
```

**Logarithmic volume scaling** prevents gaming by self-generated traffic: forwarding
1TB earns only ~20x more than forwarding 1MB, making traffic generation attacks
economically unprofitable.

### 18.11.5 Lessons from Helium

Helium's DePIN model [HELIUM-PAPER] provides critical lessons:

| Helium Lesson | TMNL Response |
|--------------|--------------|
| **Virtual hotspot spoofing** was endemic (software phantoms claiming coverage without transmitting) | Proof of Relay requires actual data forwarding with cryptographic receipts |
| **PoC rewards decoupled from actual usage** — nodes earned tokens without carrying real traffic | Rewards directly proportional to traffic relayed |
| **Hotspot density gaming** — clusters of hotspots in one location farming rewards | Coverage bonus only for underserved areas; diminishing returns in dense zones |
| **Migration to Solana** added complexity; oracle-based PoC introduced centralization | Receipt verification is peer-to-peer via Reticulum proofs |
| **Hardware markup** — Helium hotspots cost $400-600 for $30 of components | TMNL edge device IS the relay node; no dedicated "mining" hardware |
| **Revenue reality** — most hotspot operators earned <$10/month by 2024 | TMNL tokens have utility value (pay for marketplace, compute, data access) beyond speculation |

### 18.11.6 On-Chain Receipt Submission Mechanism

Relay receipts are generated locally, aggregated per epoch, and submitted to the settlement layer. The process:

```
LOCAL (per packet):
  1. Relay node generates RelayReceipt (Section 18.11.3)
  2. Receipt signed with Ed25519 relay identity key
  3. Stored in local LevelDB receipt_store (SQLite fallback)
  4. Indexed by: epoch, source_hash, dest_hash, relay_node_id

LOCAL (per epoch, every 24h at UTC midnight):
  5. Receipt aggregator computes epoch_summary:
     {
       relay_node_id:     [Reticulum identity hash],
       epoch:             [UTC date, e.g., "2026-02-12"],
       total_bytes:       [sum of all bytes_forwarded],
       unique_sources:    [count of distinct source_hash values],
       unique_dests:      [count of distinct dest_hash values],
       receipt_count:     [number of individual receipts],
       merkle_root:       [SHA-256 Merkle root of all receipt hashes],
       uptime_seconds:    [seconds with LoRa + CBRS interfaces active],
       signature:         [Ed25519 over epoch_summary fields]
     }

  6. Epoch summary stored locally and queued for submission.

SUBMISSION (via NATS or LXMF when network available):
  7. Epoch summary published to NATS subject:
     tmnl.depin.receipts.submit.<relay_node_id>

  8. Hub aggregator receives, validates:
     a. Signature verification (Ed25519 from known relay identity)
     b. Cross-reference: Does the relay appear in any destination node's
        received_from table? (Destination nodes report which relays
        forwarded data to them)
     c. Plausibility check: bytes_forwarded consistent with
        known traffic patterns? (Flag anomalies > 3σ)

  9. Valid epoch summaries batched per settlement interval (configurable,
     default: 7 days / weekly settlement).

SETTLEMENT (on-chain, weekly):
  10. Hub settlement service computes reward_batch:
      - Applies reward formula (Section 18.11.4) to each valid epoch summary
      - Computes Merkle tree of all rewards in batch
      - Submits single transaction to settlement layer:
        RewardBatch {
          batch_id:          [incrementing counter],
          epoch_range:       ["2026-02-05" to "2026-02-11"],
          merkle_root:       [root of reward Merkle tree],
          total_tmnl_minted: [sum of all rewards in batch],
          relay_count:       [number of rewarded relays],
          signature:         [Hub cluster multisig]
        }

  11. Individual relays can claim rewards by submitting Merkle proof:
      ClaimReward {
        batch_id:      [from RewardBatch],
        relay_node_id: [claimer's identity],
        reward_amount: [calculated reward],
        merkle_proof:  [path from leaf to root],
        signature:     [relay Ed25519 signature]
      }

  12. Settlement contract verifies Merkle proof, mints $TMNL to relay's address.
```

**Gas cost optimization**: By batching all rewards into a single Merkle tree per week, the on-chain cost is one transaction per settlement interval regardless of relay count. At 1,000 active relays, the gas cost per relay per week is 1/1000th of a single L2 transaction. Individual claim transactions are initiated by the relay operator and pay their own gas — but the proof verification is a constant-cost Merkle path check, not a variable-cost computation.

**Off-chain verification fallback**: If on-chain settlement costs exceed acceptable thresholds (depends on L1/L2 gas market), the system supports off-chain settlement with periodic checkpointing:

| Settlement Mode | On-Chain Frequency | Gas Cost per Relay | Trust Model |
|----------------|-------------------|-------------------|-------------|
| **Full on-chain** | Weekly Merkle batch | ~$0.001-0.01 per relay/week (L2) | Trustless |
| **Hybrid** | Monthly checkpoint | ~$0.0003/relay/week | Hub-trusted for 30 days, then anchored |
| **Off-chain with audit** | Quarterly anchor | ~$0.0001/relay/week | Hub-trusted with cryptographic audit trail |

### 18.11.7 Reward Curve — First-Mover Bonus and Decay

The reward formula (Section 18.11.4) includes a temporal component that incentivizes early network deployment:

```
REWARD CURVE OVER NETWORK LIFETIME:

Phase 1 (Seed, months 1-6):     3x base_rate
  "Founders Relay" bonus — early nodes building coverage from scratch.
  Few nodes, low traffic, but critical infrastructure contribution.
  At 30 seed nodes: ~$15-25/node/month (mostly coverage_bonus).

Phase 2 (Growth, months 6-18):  2x base_rate
  "Builder Relay" bonus — customer nodes joining mesh.
  Growing traffic, increasing relay_volume_multiplier.
  At 250 nodes: ~$8-15/node/month (relay + coverage mix).

Phase 3 (Metro, months 18-36):  1.5x base_rate
  "Sustainer Relay" — mesh approaching self-sufficiency.
  Dense traffic, relay_volume_multiplier dominates.
  At 1,000 nodes: ~$5-10/node/month (relay-dominated).

Phase 4 (Mature, months 36+):   1x base_rate
  Standard relay rewards. Network is self-sustaining.
  At 2,500 nodes: ~$3-8/node/month.
  Rewards funded by marketplace transaction fees (not minting).

DECAY FUNCTION:
  temporal_multiplier(month) = max(1.0, 3.0 × e^(-0.03 × month))

  Month 1:   3.0×
  Month 6:   2.5×
  Month 12:  2.1×
  Month 18:  1.7×
  Month 24:  1.5×
  Month 36:  1.1×
  Month 48:  1.0× (floor)
```

**Anti-gaming note**: The first-mover bonus applies to the node's JOIN DATE, not its deployment date. A node deployed in Month 24 earns the Month 24 multiplier, regardless of when the hardware was purchased. This prevents warehouse-and-deploy timing attacks where operators buy hardware early and deploy late to maximize per-token reward.

### 18.11.8 Settlement Layer Interaction

The $TMNL token settlement layer is intentionally NOT specified in this section — it is the domain of rfc-section-depin-token-economics.md. However, the network backbone's receipt mechanism must interface with whatever settlement layer is chosen. The interface contract:

```typescript
// Settlement Interface (from network backbone perspective)
// This is the boundary between Section 18 (network) and the token economics RFC.

interface SettlementBridge {
  // Submit a batch of verified rewards for on-chain settlement
  submitRewardBatch(batch: RewardBatch): Effect<BatchReceipt, SettlementError>

  // Allow a relay to claim their reward from a verified batch
  claimReward(claim: ClaimReward): Effect<TransactionHash, ClaimError>

  // Query current reward parameters (base_rate, multipliers)
  getRewardParameters(epoch: string): Effect<RewardParameters, never>

  // Query node's unclaimed balance across all epochs
  getUnclaimedBalance(nodeId: ReticulumIdentity): Effect<TokenAmount, never>
}

// Settlement layer options (evaluated in token economics RFC):
// 1. Ethereum L2 (Arbitrum/Optimism) — lowest gas, EVM ecosystem
// 2. Solana — highest throughput, DePIN ecosystem precedent (Helium)
// 3. Althea L1 — purpose-built for bandwidth settlement, interop
// 4. NATS JetStream native (off-chain) — zero gas, hub-trust model
```

**Cross-reference**: The token economics section [rfc-section-depin-token-economics.md] MUST define:
- $TMNL token supply curve and emission schedule
- Marketplace transaction fee → relay reward funding mechanism
- Governance model for base_rate adjustments
- Staking/slashing for relay misbehavior (invalid receipts)
- Liquidity bootstrapping for token value

The network backbone provides the receipt generation and verification infrastructure. The token economics provides the value capture and distribution mechanism. The boundary is the `SettlementBridge` interface.

### 18.11.9 Earl's Relay Economics — A Concrete Example

Earl's edge device ($474 with LoRa + CBRS) sits in his Doraville shop. He doesn't think about mesh networking. His device was configured in ISP-Primary mode — Comcast handles his NATS traffic 99% of the time. But his device is also an opportunistic relay, forwarding traffic for neighboring devices when they need it.

**Earl's relay activity in a typical month (Month 12, Growth phase)**:

| Metric | Value | Notes |
|--------|-------|-------|
| Hours online | 672 (28 days × 24h) | Earl's shop power stays on 24/7 |
| Bytes relayed (total) | 42 MB | Forwarding for 3 neighbors' telemetry |
| Unique sources served | 3 | Metro Machine Works, Apex Gasket, ATL Hydraulics |
| Unique destinations | 1 | TMNL Atlanta Hub Cluster |
| Average hop position | 1.2 | Mostly direct relay (1 hop from source to Earl, 1 hop from Earl to hub) |
| CBRS active time | 47 hours | Activated during neighbors' ISP outages + burst traffic |
| LoRa active time | 672 hours | Always-on control plane |

**Earl's reward calculation**:

```
base_rate (Month 12):                    $0.50/epoch
temporal_multiplier (Month 12):          2.1×
relay_volume_multiplier:                 log2(42MB / 1MB + 1) = log2(43) = 5.43
uptime_multiplier:                       672/720 = 0.93 (720h in 30-day month)
coverage_bonus:                          1.0× (Doraville is well-covered)
hop_weight:                              1.1× (interior relay position)

reward_per_epoch = $0.50 × 2.1 × 5.43 × 0.93 × 1.0 × 1.1
                 = $0.50 × 11.53
                 = $5.77 per day

Monthly reward = $5.77 × 30 = ~$173/month
```

Earl earns ~$173/month in $TMNL tokens for doing absolutely nothing — his device relays traffic automatically. Over 12 months at this rate, he earns ~$2,076 in tokens. His device cost $474. **The mesh relay pays for the device in under 3 months** at Growth-phase rates.

**What Earl does with $TMNL tokens**: He can:
1. Hold them (speculative value appreciation as network grows)
2. Spend them on the TMNL marketplace (pay for compute services, data analytics, capability discovery when the marketplace activates)
3. Convert to USD via the DEX (if token has exchange liquidity)
4. Stake them to increase his relay reward multiplier (proposed in token economics)

**What Metro Machine Works does**: Marcus's device at Metro Machine Works relayed 15 GB of Earl's and other neighbors' traffic — earning approximately $312/month at the same Growth-phase rates. Marcus's device cost $474. Payback: 1.5 months. Marcus mentions this to his buddy who runs a welding shop on the next block. That buddy buys a TMNL edge device. The mesh gets denser. The flywheel turns.

---

## 18.12 Competitor and Alternative Analysis

### 18.12.1 Comparison Matrix

| Technology | Type | Range | Throughput | License | Mesh | Open | DePIN | TMNL Fit |
|-----------|------|-------|-----------|---------|------|------|-------|----------|
| **Reticulum** | Network stack | Medium-agnostic | Medium-agnostic | MIT | Native | Yes | Possible | **Primary** |
| **Meshtastic** | Chat app on LoRa | 2-15 km (LoRa) | 1-10 kbps | GPL v3 | Flood routing | Yes | No | Control plane alt |
| **MeshCore** | Meshtastic fork | 2-15 km (LoRa) | 1-10 kbps | BSD | Improved routing | Yes | No | Monitoring |
| **goTenna Pro** | Military mesh | 4-6 km | Proprietary | Proprietary | Yes | No | No | Incompatible |
| **Helium IoT** | LoRaWAN coverage | 2-15 km | 1-50 kbps | Open (protocol) | No (star) | Partial | Yes | Complementary |
| **Althea** | Incentivized ISP mesh | ISP range | ISP throughput | Open | No (routing) | Yes | Yes | Model reference |
| **Thread/Matter** | Factory-floor mesh | 30-100m | 250 kbps | Open | Yes | Yes | No | Intra-site only |
| **Private 5G (CBRS)** | Cellular | 1-10 km | 100+ Mbps | GAA/PAL | No | Partial | No | Data plane |
| **NATS over WireGuard** | VPN overlay | Internet range | Internet speed | MIT/Open | No | Yes | No | ISP-dependent |

### 18.12.2 Meshtastic vs Reticulum — Detailed Comparison

This comparison is frequently requested and often misunderstood [ERETHON-COMPARISON]:

| Aspect | Meshtastic | Reticulum |
|--------|-----------|-----------|
| **Core identity** | Off-grid messaging app | Cryptographic network stack |
| **Transport** | LoRa only | Any medium (LoRa, WiFi, Ethernet, TCP, I2P, serial) |
| **Routing** | Flood-based (broadcast to all) | Announce-based (directed paths) |
| **Encryption** | AES-256 (shared key) | X25519 + Ed25519 + AES-256-CBC per-link |
| **Forward secrecy** | No | Yes |
| **Scalability** | ~100 nodes (flood routing limit) | Theoretically unlimited (directed routing) |
| **Application protocol** | Built-in chat, telemetry, position | General-purpose (any app can use RNS) |
| **NATS bridge possible** | Would require custom gateway | Native — NATS runs over Reticulum TCP |
| **CBRS transport** | No — LoRa only | Yes — any TCP/UDP transport |
| **Community** | Larger (100K+ devices deployed) | Smaller but growing (4.4K GitHub stars, FOSDEM 2026 talk) |
| **Hardware** | Dedicated LoRa devices | Runs on Linux, Android, any platform |

**Verdict**: Meshtastic is an application. Reticulum is infrastructure. TMNL needs
infrastructure — a general-purpose transport layer that can carry NATS traffic over
heterogeneous radio links. Reticulum is the only open-source option that provides this.

### 18.12.3 Althea — Bandwidth Marketplace Model

Althea [ALTHEA-REVIEW] is the closest DePIN analog to TMNL's networking vision:

- **Model**: Bandwidth flows like water — automatic routing through lowest-cost paths
- **Encryption**: WireGuard tunnels between all nodes
- **Payment**: Micropayments per byte forwarded
- **L1**: Purpose-built blockchain (Althea L1, unlocked 2025) for machine-to-machine payments
- **Liquid Infrastructure**: NFTs representing revenue-generating network hardware

**TMNL lessons from Althea**:
1. Micropayments-per-byte is viable for incentivizing relay nodes
2. Purpose-built L1 (vs general-purpose chain) reduces settlement latency
3. Real network operators (WISPs) are the target deployers, not hobbyists
4. Althea focuses on ISP replacement; TMNL focuses on industrial IoT connectivity —
   complementary, not competing

### 18.12.4 Helium IoT — Complementary Network

Helium's LoRaWAN coverage network could complement TMNL for sensor-tier connectivity:

- **Helium IoT**: LoRaWAN gateways providing wide-area sensor coverage
- **TMNL use**: Nordic nRF9160/nRF5340 wireless sensor nodes (Section 17.7) could
  optionally use Helium LoRaWAN for uplink when no TMNL mesh node is in range
- **Cost**: Helium data credits (~$0.00001 per 24-byte uplink)
- **Limitation**: LoRaWAN is star topology (sensor → gateway → cloud), not mesh.
  Not suitable for NATS traffic or entity state synchronization.

### 18.12.5 Thread/Matter — Intra-Factory Mesh

Thread (IEEE 802.15.4, 2.4GHz) provides ultra-local mesh within a factory floor:

| Property | Thread/Matter | TMNL Reticulum Mesh |
|----------|-------------|-------------------|
| **Range** | 30-100m | 1-15 km |
| **Throughput** | 250 kbps | 1 kbps - 100 Mbps |
| **Power** | µW (battery sensors) | mW-W (mains powered) |
| **Role** | Sensor-to-gateway | Site-to-site, site-to-hub |
| **Overlap** | None — different scale | None |

Thread/Matter is complementary for ultra-low-power sensor nodes within a factory.
It does not compete with the metropolitan backbone.

---

## 18.13 Regulatory Considerations

### 18.13.1 FCC Part 96 — CBRS Rules

| Requirement | TMNL Compliance |
|------------|----------------|
| **Digital modulation** (§96.41(a)) | 5G NR / LTE are digital modulation |
| **Power limits** (§96.41(b)) | Cat A: ≤30 dBm EIRP — device is configured accordingly |
| **Power management** (§96.41(c)) | Minimum necessary power — Reticulum link quality triggers power reduction |
| **SAS registration** (§96.57) | Auto-registration on first boot via SAS API |
| **Heartbeat** (§96.57) | Background daemon maintains SAS heartbeat |
| **Location reporting** | GPS fix reported to SAS at registration |
| **Equipment certification** | QCS6490 modem module is FCC-certified for B48 operation |

### 18.13.2 FCC Part 15 — LoRa ISM Rules

| Requirement | TMNL Compliance |
|------------|----------------|
| **Frequency** (§15.247) | 902-928 MHz ISM band |
| **Max EIRP** | ≤30 dBm (1W) with frequency hopping or digital modulation |
| **Certification** | RNode hardware (Heltec, RAK, LilyGO) already FCC Part 15 certified |
| **No license required** | Confirmed — ISM band is license-free |

### 18.13.3 Pending CBRS Rule Changes

FCC NPRM FCC-24-86A1 (August 2024) [FCC-NPRM-2024] proposes modifications to CBRS rules:

| Proposed Change | Impact on TMNL |
|----------------|---------------|
| **Expanded ESC procedures** | May affect GAA availability near coastlines — minimal for Atlanta (inland) |
| **Modified CBSD information requirements** | May require additional telemetry to SAS — software update |
| **Potential auction of GAA spectrum** | CRITICAL RISK — if upper 50MHz of GAA is auctioned (per WISPA opposition [WISPA-CBRS]), TMNL loses free spectrum access. Monitor closely. |
| **CBRS 2.0 improvements** | Google SAS and others improving spectrum availability algorithms — net positive |

### 18.13.4 Mesh/Relay Regulatory Status

There is no explicit FCC prohibition on mesh/relay operations in CBRS GAA or
LoRa ISM bands. However:

1. **CBRS**: Each CBSD (relay node) MUST independently register with SAS and
   obtain frequency authorization. Relay does not exempt from SAS requirements.
2. **LoRa ISM**: Relay is unrestricted under Part 15 — standard LoRa mesh usage.
3. **Amateur radio exception**: Some Reticulum users operate under amateur radio
   licenses for higher power. TMNL does NOT use amateur radio spectrum (no
   commercial use permitted).

---

## 18.14 Deployment Phases

### 18.14.1 Phase 1 — Seed Network (Months 1-6)

**Objective**: Establish LoRa control plane coverage in I-85 NE industrial corridor.

| Activity | Quantity | Cost |
|----------|---------|------|
| Deploy seed relay nodes (elevated sites) | 20-30 | $600/node = $12K-18K |
| Each node: QCS6490 edge + RNode + external antenna | — | — |
| Sites: Industrial park offices, water towers, coworking spaces | — | Lease/agreement |
| Software: Reticulum Transport Node + SAS registration | — | Included |

**Coverage target**: LoRa control plane over I-85 NE corridor (Chamblee → Buford,
~20 miles). CBRS data links between seed nodes and early customer deployments.

**Network mode**: ISP-Primary for all nodes (mesh as secondary path).

### 18.14.2 Phase 2 — Customer Mesh (Months 6-18)

**Objective**: Customer TMNL edge devices join mesh, LoRa + CBRS coverage grows organically.

| Milestone | Threshold | Network Effect |
|-----------|----------|---------------|
| 50 devices deployed | I-85 NE corridor saturated | LoRa control plane fully meshed |
| 100 devices deployed | CBRS data plane viable in corridor | 2-3 hop paths to hub |
| 250 devices deployed | Inner suburban coverage begins | Mesh-Primary mode enabled for some |
| 500 devices deployed | Multi-corridor coverage | Fulton Industrial + Airport corridors |

**DePIN incentive**: $TMNL relay rewards activated at 100-device threshold.

### 18.14.3 Phase 3 — Metropolitan Mesh (Months 18-36)

**Objective**: Self-sustaining metropolitan mesh with ISP as fallback, not primary.

| Milestone | Threshold | Network Effect |
|-----------|----------|---------------|
| 1,000 devices | Core metro covered | Most sites have 2+ mesh paths |
| 2,500 devices | Full MSA coverage | Mesh-Primary for 60%+ of devices |
| Strategic Cat B relays | 10-20 tower-mount | Rural gap fill, hub backbone |

**Network mode transition**: As mesh density increases, devices automatically
switch from ISP-Primary to Mesh-Primary. The network has achieved sovereignty.

### 18.14.4 Phase 4 — Network Maturity (Months 36+)

- Reticulum-rs (Rust) replaces Python implementation for performance
- CBRS relay operation (base station mode) if regulatory pathway clears
- Integration with Althea L1 for cross-network bandwidth settlement
- Expansion beyond Atlanta MSA to other metro areas

---

## 18.15 Risk Analysis

### 18.15.1 Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| **GAA spectrum auctioned** | Medium (20-30%) | Critical — loses free spectrum | Monitor FCC proceedings; support WISPA opposition; PAL acquisition plan as backup |
| **Reticulum doesn't scale to 10K+ nodes** | Medium (30-40%) | High — mesh degrades | Phased deployment validates scaling; hierarchical routing; Rust port improves perf |
| **CBRS interference from competing GAA users** | Medium-High (40%) | Medium — throughput degradation | SAS frequency coordination; adaptive channel selection; mesh rerouting |
| **Customer adoption below mesh density threshold** | Medium (30%) | High — mesh gaps | Seed node network; ISP fallback always available; DePIN incentives for relay |
| **Reticulum project stalls/abandoned** | Low (10%) | High — stack dependency | MIT license allows fork; Rust port has independent maintainers; core protocol is simple enough to maintain |
| **SAS service cost increases** | Low (15%) | Low — operating expense | Multiple SAS providers (Google, Federated, CommScope); costs <$5/device/year |
| **FCC changes power limits** | Low (10%) | Medium — range reduction | Category B relays compensate; more seed nodes |
| **Building penetration worse than modeled** | Medium (30%) | Low — solved by external antenna | External antenna on every device; indoor/outdoor antenna splitter |

### 18.15.2 Critical Path Dependencies

```
Reticulum TCP Bridge    → NATS-over-mesh integration
CBRS integrated modem   → QCS6490 carrier board design includes B48 antenna
SAS client daemon       → Software development (Phase 1)
Seed node deployment    → Site agreements (Phase 1)
DePIN receipt system    → Smart contract development (Phase 2)
Reticulum-rs maturity   → Performance at scale (Phase 3+)
```

---

## 18.16 Codebase Grounding

The following existing codebase components are relevant to network backbone integration:

| Component | Path | Relevance |
|-----------|------|-----------|
| **NATS connection manager** | `src/lib/holonet/nats/connection.ts` | TCP connection that will ride over Reticulum bridge |
| **NATS leaf node config** | `src/lib/holonet/nats/` | Leaf node configuration — transport-agnostic by design |
| **Sparkplug adapter** | `src/lib/iiot/adapters/sparkplug-adapter.ts` | MQTT traffic that rides over NATS over Reticulum |
| **Entity state machines** | `src/lib/iiot/machines/` | State sync over NATS — latency-tolerant by design |
| **Channel service** | `src/lib/streams/constructs/ChannelService.ts` | Pub/sub channels — underlying transport is abstracted |
| **Deployment topology** | `docs/specifications/rfc-section-deployment-topology.md` | NATS hub-and-spoke layout that mesh topology extends |
| **Edge architecture** | `docs/specifications/rfc-section-edge-architecture-v2.md` | T0-T3 tier model, latency budgets, JetStream retention |
| **Physical infrastructure** | `docs/specifications/rfc-section-physical-infrastructure.md` | Hardware BOMs, QCS6490 specifications, connectivity options |

**Key architectural alignment**: The existing codebase abstracts transport at the
NATS level. NATS connects via TCP. The TCP connection can ride over any transport —
Ethernet, WiFi, or Reticulum. No application-level code changes are required to
adopt mesh networking. The mesh is invisible to the application layer.

---

## 18.17 Cross-References to Other RFC Sections

This section's mesh networking layer integrates with every other RFC-001 section. The following matrix maps specific dependencies and interactions:

### 18.17.1 Market Analysis Cross-References

The market analysis [rfc-section-market-analysis.md] provides the demand model that the mesh network must serve:

| Market Insight | Network Implication | Section Reference |
|---------------|--------------------|--------------------|
| 4,043 manufacturing establishments in Atlanta MSA | Node count target for full coverage: ~2,500 (62%) | 18.8.4 (coverage modeling) |
| 85%+ of shops have <50 employees | Self-install mesh hardware is non-negotiable | 18.10.2 (LoRa module, $25 add-on) |
| I-85 NE corridor: 1,000+ establishments in 300 sq mi | Highest-priority seed deployment zone (3.3/sq mi) | 18.14.1 (Phase 1 seed network) |
| Industrial vacancy rate 3.2% (near-zero) | Dense building occupancy = more relay candidates per km² | 18.8.2 (LoRa coverage modeling) |
| Avg shop revenue: $2.1M/yr (10-49 employees) | $474 mesh device is <0.025% of annual revenue | 18.10.3 (BOM addendum) |

### 18.17.2 Product Strategy Cross-References

The product strategy [rfc-section-product-strategy.md] defines pricing tiers that the mesh reward model must complement:

| Strategy Element | Network Interaction |
|-----------------|-------------------|
| **Free tier** ($0/month for monitoring-only) | Mesh relay rewards provide revenue even at zero subscription |
| **Professional tier** ($29/month) | Includes mesh participation — relay income offsets subscription cost |
| **Pricing differentiator: "Your hardware pays for itself"** | Relay reward economics (Section 18.11.9) prove this claim |
| **GTM: "Come for the tool, stay for the network"** | Mesh IS the network. Standalone monitoring value → mesh participation → network effects |
| **Self-serve onboarding SLA: 15 minutes** | Mesh auto-joins at boot. No mesh configuration step. Zero friction to become a relay. |

### 18.17.3 Manufacturing Process Cross-References

The manufacturing process taxonomy [rfc-section-manufacturing-processes.md] defines bandwidth requirements per vertical that determine mesh capacity planning:

| Process Type | Data Rate | Mesh Demand Pattern |
|-------------|-----------|-------------------|
| **Discrete machining** (CNC, lathe) | 0.1-0.5 KB/s (report-by-exception) | Steady low-rate. Ideal mesh citizen. 1 CBRS link serves 100+ machines. |
| **Continuous process** (extrusion, chemical) | 0.5-5 KB/s (trend data) | Moderate. 1 CBRS link serves 10-50 processes. |
| **Batch process** (food, pharma) | 0.2-1 KB/s (batch records) | Bursty at batch boundaries. Mesh handles burst via JetStream buffer. |
| **High-speed vision QC** | 5-50 KB/s (image thumbnails) | Requires CBRS data plane. LoRa-only insufficient. |
| **Acoustic/vibration waveform** | 10-100 KB/s (raw waveform capture) | Enterprise-only via CBRS or ISP. Mesh for metadata only. |

**Key insight**: 90%+ of manufacturing telemetry at the "long tail" shop level (Earl's, Diana's) generates <1 KB/s. The mesh network is massively over-provisioned for typical use. Even a single 10 MHz CBRS channel (30+ Mbps) can carry telemetry from 30,000+ machines simultaneously. The bottleneck is never bandwidth — it's coverage density and hop count.

### 18.17.4 Physical Infrastructure Cross-References

The physical infrastructure section [rfc-section-physical-infrastructure.md, Section 17] defines the hardware that the mesh runs on:

| Hardware SKU | Mesh Role | Radio Capability |
|-------------|-----------|-----------------|
| **TMNL-EDGE-A** (QCS6490, $449) | Primary mesh node | Integrated 5G modem (CBRS n48) + USB RNode (LoRa 915) |
| **TMNL-EDGE-B** (iMX8MP, $349) | Mesh node (no integrated 5G) | USB RNode (LoRa) + M.2 CBRS module (optional, +$150-200) |
| **TMNL-EDGE-C** (AM62x, $249) | Mesh node (LoRa only) | USB RNode (LoRa). CBRS via M.2 not supported (no PCIe). |
| **TMNL-GW-**** (ESP32, $49-149) | Not a mesh node | No radio. Connects to edge device via Ethernet/Wi-Fi. |
| **TMNL-WSN-**** (nRF5340/9160) | Not a mesh node | BLE/Thread/LTE-M. Sensor-tier only. |

The QCS6490 is the ideal mesh platform because its integrated 5G modem supports CBRS Band 48 at zero additional radio cost — the $25 RNode is the only mesh add-on. The iMX8MP and AM62x require external CBRS modules ($150-200) if data-plane mesh participation is desired, or operate as LoRa-only control plane relays.

### 18.17.5 Competitive Analysis Cross-References

The competitive analysis [rfc-section-competitive-analysis.md] identified Gap G-5 (Proprietary Lock-In) as a universal weakness. The mesh network deepens this advantage:

| Competitor Approach | TMNL Mesh Advantage |
|--------------------|-------------------|
| Siemens: Proprietary MindConnect gateway → Siemens cloud | TMNL device connects to sovereign mesh → NATS (open protocol) → local processing |
| AWS: Device → AWS IoT Core (vendor cloud) | TMNL device → mesh → NATS hub (customer-operated) |
| Helium: LoRaWAN hotspot → Helium oracle → Solana | TMNL: Reticulum relay → cryptographic receipts → settlement (customer-auditable) |
| All incumbents: ISP-dependent data path | TMNL: ISP-independent sovereign mesh. No ISP can throttle, inspect, or terminate. |

The mesh network is not just a connectivity feature. It is the physical manifestation of the commons model. Every node strengthens the network. No single entity — not TMNL the company, not Comcast, not AWS — controls the data path. This is architecture-level sovereignty that cannot be replicated by adding a feature to an existing platform.

---

## 18.18 Open Questions

**Note**: Questions 1-7 are carried forward from the initial draft. Questions 8-10 are added in this revision.

1. **QCS6490 CBRS relay mode**: Can the integrated modem operate as both UE (endpoint)
   and relay simultaneously? Or does relay require a dedicated CBSD module?
   → Requires hardware prototyping with Qualcomm/Lantronix.

2. **Reticulum scaling validation**: Has anyone tested Reticulum with >1,000 Transport
   Nodes? The path table analysis (Section 18.4.3) suggests it's feasible, but
   empirical validation is needed.
   → Propose simulation study (Phase 1) and progressive real-world testing.

3. **SAS heartbeat over mesh**: If a CBSD's only internet path is via Reticulum mesh,
   can the SAS heartbeat ride over the same mesh? Circular dependency risk.
   → Mitigation: LoRa control plane provides independent path for SAS heartbeat
   forwarding via a mesh neighbor with ISP access.

4. **DePIN receipt verification cost**: How much on-chain gas does receipt verification
   consume per epoch? Is L2 rollup or off-chain verification needed?
   → Depends on token economics design (separate RFC section).

5. **Reticulum-rs timeline**: When will the Rust implementation be production-ready
   for embedded deployment? The FOSDEM 2026 talk suggests active development but
   no production release yet.
   → Monitor development; Python implementation is adequate for Phase 1-2.

6. **CBRS spectrum auction risk**: The July 2025 budget legislation directs FCC to
   auction 800MHz. WISPA and others oppose CBRS inclusion. Final outcome unknown.
   → Track FCC proceedings quarterly.

7. **Multi-SAS coordination**: If different TMNL nodes register with different SAS
   providers, are there coordination issues for mesh relay?
   → SAS providers coordinate via the SAS-SAS protocol. Single-SAS preference
   recommended for TMNL fleet management.

8. **Receipt storage at scale**: At 2,500 active relays generating ~100-1,000 receipts/day
   each, the hub aggregator processes 250K-2.5M receipts daily. Storage and cross-validation
   at this scale requires indexed database (PostgreSQL/ClickHouse), not flat files.
   → Design receipt aggregation service as an @effect/cluster entity with SQL-backed storage.
   Cross-reference: Entity patterns in `src/lib/iiot/entity/EntityStack.ts`.

9. **Token utility bootstrapping**: Before the marketplace activates (Phase 3+), what utility
   does the $TMNL token have? Pure speculative value risks the "Helium trap" where token
   price decouples from network usage.
   → Propose: Pre-marketplace utility via "data credit" model — tokens buy JetStream storage
   extensions, premium alarm thresholds, or cross-organization capability queries.

10. **Mesh node incentive alignment with non-relay operators**: Some TMNL users (e.g., rural
    shops with no neighbors) will never relay traffic. They benefit from the mesh but contribute
    nothing to it. Free-rider problem.
    → Propose: Minimum uptime contribution (LoRa announce propagation counts as contribution
    even without data relay). Coverage announcements earn a baseline reward separate from
    relay volume.

---

## 18.19 References

| Key | Reference |
|-----|-----------|
| [RNS-MANUAL] | Reticulum Network Stack Manual, v1.1.3. https://reticulum.network/manual/ |
| [RNS-HARDWARE] | Reticulum Communications Hardware. https://reticulum.network/manual/hardware.html |
| [LXMF-SPEC] | LXMF — Lightweight eXchange Message Format. https://github.com/markqvist/LXMF |
| [ERETHON-COMPARISON] | Grigoropoulos, D. "Comparing Reticulum and Meshtastic." Jan 2024. https://blog.erethon.com/blog/2024/01/31/comparing-reticulum-and-meshtastic/ |
| [FOSDEM-2026-RS] | "Reticulum-rs: Porting the Trustless Mesh from Python to Rust." FOSDEM 2026. https://fosdem.org/2026/schedule/event/KF7STF-reticulum-rs_porting_the_trustless_mesh_from_python_to_rust/ |
| [FCC-PART96] | 47 CFR Part 96 — Citizens Broadband Radio Service. https://ecfr.io/Title-47/Part-96 |
| [FCC-96.41] | 47 CFR 96.41 — General radio requirements. https://www.govregs.com/regulations/title47_chapterI-i4_part96_subpartE_section96.41 |
| [FCC-96.43] | 47 CFR 96.43 — Additional requirements for Category A CBSDs. https://www.ecfr.gov/current/title-47/chapter-I/subchapter-D/part-96/subpart-E/section-96.43 |
| [FCC-96.45] | 47 CFR 96.45 — Additional requirements for Category B CBSDs. https://www.ecfr.gov/current/title-47/chapter-I/subchapter-D/part-96/subpart-E/section-96.45 |
| [FCC-96.57] | 47 CFR 96.57 — CBSD registration and authentication. https://www.ecfr.gov/current/title-47/chapter-I/subchapter-D/part-96/subpart-F/section-96.57 |
| [FCC-NPRM-2024] | FCC NPRM FCC-24-86A1, Promoting Investment in the 3550-3700 MHz band. Aug 2024. https://docs.fcc.gov/public/attachments/FCC-24-86A1.pdf |
| [GOOGLE-SAS] | Google Spectrum Access System. https://google.com/get/spectrumdatabase/register |
| [WISPA-CBRS] | WISPA to FCC: Don't Sell General Access CBRS Spectrum. Oct 2025. https://broadbandbreakfast.com/wispa-to-fcc-dont-sell-general-access-cbrs-spectrum/ |
| [NOTRE-DAME-CBRS] | Tusha, A. et al. "A Comprehensive Analysis of Secondary Coexistence in a Real-World CBRS Deployment." U. Notre Dame, 2025. |
| [BUFFALO-CBRS] | Dash, B.K. et al. "Experimental Network Performance Analysis from a CBRS-based Private Mobile Network." SUNY Buffalo, 2024. |
| [QCS6490-BRIEF] | Qualcomm QCS6490/QCM6490 Product Brief, Rev. F. Nov 2025. https://docs.qualcomm.com/doc/87-28733-1/ |
| [HELIUM-PAPER] | Haleem, A. et al. "Helium: A Decentralized Wireless Communication Network." 2024. |
| [HELIUM-AUDIT] | Teplov, A. "Helium Network: A Technical Audit of Post-Solana DePIN Architecture." Dec 2025. |
| [ALTHEA-REVIEW] | Althea blog: "2025 in Review." Jan 2026. https://blog.althea.net/althea-2025-in-review/ |
| [DEPIN-STATE-2024] | Messari: "State of DePIN 2024." Jan 2025. https://messari.io/report/state-of-depin-2024 |
| [DEPIN-TRENDS-2026] | Orochi Network: "Top 10 DePIN Projects & Emerging Trends in 2026." Feb 2026. https://orochi.network/blog/top-10-de-pin-projects-and-emerging-trends-in-2026 |
| [ARC-FREIGHT-2024] | Atlanta Regional Commission: "Land Use, Economic Impact, and E-Commerce Analysis Report." Sept 2024. |
| [TENANTSCIENCE-ATL] | TenantScience: "Summary of Atlanta Industrial Locations." https://tenantscience.com/summary-of-atlanta-industrial-locations/ |
| [CW-ATL-INDUSTRIAL] | Cushman & Wakefield: "Unpacking Atlanta's Industrial Landscape." Sept 2024. |
| [LORA-URBAN-SURVEY] | Real-world LoRa range measurements, multiple sources. Urban: 2-5 km. |
| [LORA-SUBURBAN] | LoRaWAN range studies, Minew (2025): suburban 5-15 km theoretical, 3-8 km practical. |
| [LORA-RURAL] | LoRa propagation study, Amazon region (2024): 945m threshold with dense vegetation. Extrapolated 5-15 km for open terrain. |
| [LORA-RECORD] | LoRaWAN theoretical maximum: 700+ km (controlled conditions, not operational). |
| [NATS-LEAF-EDGE] | NATS Adaptive Deployment Architectures. https://docs.nats.io/nats-concepts/service_infrastructure/adaptive_edge_deployment |
| [NATS-LEAF-BLOG] | Dang, T. "Bridging the Edge: Using NATS Leaf Nodes to Build Hybrid and Multi-Cloud Systems." Dec 2025. |
| [BAICELLS-430H] | Baicells Nova 430H outdoor CBRS small cell. ~$999. |
| [BAICELLS-436H] | Baicells Nova 436H high-power outdoor CBRS small cell. ~$4,995. |
| [BAICELLS-5G-KIT] | Baicells 2025 5G Starter Kit (Stellar 227 + Photon ID63H). $2,999. |
| [SIMCOM-8262A] | SIMCom SIM8262A-M2 5G module, Snapdragon X62. M.2 form factor. ~$150-200. |
| [REDCAP-HARDWARE] | 5G RedCap Hardware Guide, 2026. https://5gredcap.co.uk/5g-redcap-hardware/ |
| [CBRS-GROKIPEDIA] | Grokipedia: "Citizens Broadband Radio Service." https://grokipedia.com/page/Citizens_Broadband_Radio_Service |
| [CBRS-2.0] | "CBRS 2.0: Revolutionizing spectrum management." RCR Wireless, Apr 2025. |
| [GOTENNA-USCG] | "Integrating goTenna into USCG DSF Operations." May 2024. |
| [ARSOF-MESH] | "Transforming ARSOF Advantage with Enhanced Mesh Network Technology." Dec 2025. |
| [VLAD-MESHTASTIC] | Avramut, V. "Meshtastic Alternatives: What Actually Replaces It." Jan 2026. |
| [VLAD-LORA-LAYERS] | Avramut, V. "LoRa vs LoRaWAN vs Meshtastic: A Layered Architecture Guide." Jan 2026. |
| [QUALCOMM-5G-PL] | Sun, S. et al. "Propagation Path Loss Models for 5G Urban Micro- and Macro-Cellular Scenarios." Qualcomm/NYU, 2016. |
