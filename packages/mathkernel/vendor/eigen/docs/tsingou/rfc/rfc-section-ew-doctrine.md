# RFC Section TSG.36: Electronic Warfare and SIGINT Doctrine Alignment

```
Section:       Electronic Warfare and SIGINT Doctrine Alignment
Section ID:    TSG.36
Parent RFC:    RFC-TSG (Tsingou System Specification)
Status:        DRAFT
Author:        EW Doctrine Advisor
Created:       2026-02-18
Research Base: research-ew-doctrine.md (12 sections, 4 doctrine
               frameworks, 3 process models, 30+ citations)
```

> This section establishes the Electronic Warfare (EW), Electromagnetic
> Spectrum Operations (EMSO), and Cyber Electromagnetic Activities (CEMA)
> doctrinal foundations that constrain and validate the Tsingou SIGINT
> visualization architecture. Every architectural component traces to
> published doctrine from the Joint Chiefs of Staff, Department of the
> Army, and Department of the Air Force. Implementations MUST satisfy
> doctrine-derived requirements; deviations require explicit justification
> against the cited framework. The key words "MUST", "MUST NOT", "SHOULD",
> "SHOULD NOT", and "MAY" are to be interpreted as described in [RFC2119]
> and [RFC8174].

---

## Table of Contents

1.  [Introduction and Scope](#1-introduction-and-scope)
2.  [EMSO Doctrinal Framework](#2-emso-doctrinal-framework)
3.  [The Three Pillars of Electronic Warfare](#3-the-three-pillars-of-electronic-warfare)
4.  [ES vs. SIGINT: The Critical Distinction](#4-es-vs-sigint-the-critical-distinction)
5.  [DoD EMS Superiority Strategy and EMBM](#5-dod-ems-superiority-strategy-and-embm)
6.  [CEMA Integration Framework](#6-cema-integration-framework)
7.  [CEMA in Multi-Domain Operations](#7-cema-in-multi-domain-operations)
8.  [JADC2 and Spectrum Integration](#8-jadc2-and-spectrum-integration)
9.  [TPED Processing Chain](#9-tped-processing-chain)
10. [TPED-to-Tsingou Architectural Mapping](#10-tped-to-tsingou-architectural-mapping)
11. [Intelligence Cycle Extension Beyond TPED](#11-intelligence-cycle-extension-beyond-tped)
12. [Doctrine-to-Architecture Mapping](#12-doctrine-to-architecture-mapping)
13. [Signal Schema as EOB Data Model](#13-signal-schema-as-eob-data-model)
14. [SchemaRegistry as Threat Library](#14-schemaregistry-as-threat-library)
15. [EW Reprogramming and Adaptive Threat Response](#15-ew-reprogramming-and-adaptive-threat-response)
16. [Geolocation Techniques and Architecture](#16-geolocation-techniques-and-architecture)
17. [Terminology Alignment Guide](#17-terminology-alignment-guide)
18. [SIGINT Subdiscipline Mapping](#18-sigint-subdiscipline-mapping)
19. [Four-Layer Rendering and EMSO Situational Awareness](#19-four-layer-rendering-and-emso-situational-awareness)
20. [Cognitive Task Analysis for SIGINT Analysts](#20-cognitive-task-analysis-for-sigint-analysts)
21. [Intelligence Preparation of the Battlespace](#21-intelligence-preparation-of-the-battlespace)
22. [Recognized Electromagnetic Picture](#22-recognized-electromagnetic-picture)
23. [Signal Metadata and Interoperability Standards](#23-signal-metadata-and-interoperability-standards)
24. [AOC-Relevant Use Cases](#24-aoc-relevant-use-cases)
25. [Normative Requirements Derived from Doctrine](#25-normative-requirements-derived-from-doctrine)
26. [Open Questions and Doctrinal Gaps](#26-open-questions-and-doctrinal-gaps)
27. [Bibliography](#27-bibliography)

---

## 1. Introduction and Scope

### 1.1 Purpose

This section grounds the Tsingou SIGINT/OSINT visualization platform in
the professional doctrine of the Electronic Warfare (EW) and
Electromagnetic Spectrum Operations (EMSO) community. The target audience
includes practitioners from the Association of Old Crows (AOC),
Department of Defense (DoD) EW professionals, Intelligence Community (IC)
analysts, and defense industry engineers who operate within the doctrinal
frameworks of JP 3-85, FM 3-12, and the DoD EMS Superiority Strategy.

Tsingou is designed to operate within the Electronic Warfare Support (ES)
domain — the SIGINT-relevant pillar of EW. Its architecture addresses the
full TPED (Tasking, Processing, Exploitation, and Dissemination) cycle
and extends coverage to all six phases of the Intelligence Cycle as
established in ADR-010 [ADR-010].

### 1.2 Doctrinal Context

The modern Electromagnetic Operating Environment (EMOE) is characterized
by the DoD as "congested, contested, and constrained" [EMS-STRAT]. This
tripartite condition — referred to as the "3C environment" throughout
EMSO literature — drives four categories of operational requirements that
directly constrain Tsingou's architecture:

**Dynamic spectrum awareness**: Real-time monitoring of the EMS across
multiple frequency bands, modulation types, and geographic areas. The
system MUST ingest and process signals at rates sufficient to maintain
a current picture of the electromagnetic environment. Tsingou addresses
this through its 8 source adapter types with hot-plug lifecycle
management and the d2ts differential dataflow pipeline for incremental
computation.

**Rapid exploitation**: Automated processing of intercepted signals at
machine speed, with human-in-the-loop oversight for classification and
assessment decisions. The d2ts derived graph provides incremental
computation that processes only changed data, enabling exploitation
latency proportional to the change rate rather than the total dataset
size.

**Multi-source fusion**: Correlation across SIGINT, OSINT, and other INT
disciplines using cross-source join operators. The d2ts `join` operator
maintains state from both sides of a correlation, enabling continuous
fusion as new signals arrive from any source.

**Agile dissemination**: Delivery of intelligence products at machine
speed through multiple channels — real-time rendering, alert
notifications, STIX/TAXII export, and NATS fabric distribution. The
OutputBridge service manages the d2ts-to-rendering pipeline with
backpressure-aware Effect.Queue intermediation.

### 1.3 Professional Community Alignment

The Association of Old Crows (AOC) serves as the principal professional
body for the global EW and EMSO community [AOC]. Founded in 1964, the
organization maintains:

- **70+ chapters** across 19 countries
- **~14,000 members** spanning military, government, industry, and
  academic sectors
- **Annual International Symposium & Convention** bringing ~2,500
  professionals from 40+ countries
- **Journal of Electromagnetic Dominance (JED)** — the community's
  flagship publication covering tactical SIGINT programs, CEMA
  operations, spectrum management, and EW policy [JED]
- **CEMA conferences** — dedicated forums for Cyber Electromagnetic
  Activities integration
- **Professional development courses** — EW workforce education and
  certification

The renaming of JED from "Journal of Electronic Defense" to "Journal of
Electromagnetic Dominance" mirrors the doctrinal shift from reactive
electronic defense to proactive electromagnetic spectrum dominance — a
shift that Tsingou's architecture embraces through its offensive-analysis
posture (active correlation, anomaly detection, pattern-of-life tracking)
rather than a purely passive collection stance.

### 1.4 Fort Eisenhower and the Augusta Ecosystem

Fort Eisenhower (renamed from Fort Gordon in 2023, Augusta, Georgia)
represents the geographic and institutional convergence of Army Signals,
Cyber, and Intelligence operations [CCOE]. The installation hosts:

- **U.S. Army Cyber Center of Excellence (CCoE)**: Force modernization
  proponent for Cyberspace Operations, Signal/Communications Networks,
  and Electromagnetic Warfare. Develops DOTMLPF-P solutions (Doctrine,
  Organization, Training, Materiel, Leadership, Personnel, Facilities,
  Policy) for EW capabilities.

- **U.S. Army Cyber Command (ARCYBER)**: Operational headquarters for
  Army cyber and EW forces. Conducts offensive and defensive cyberspace
  operations in support of combatant commands.

- **NSA/CSS Georgia (NSAG)**: The Georgia Cryptologic Center — a
  600,000 sq ft facility opened in 2012. Conducts signals intelligence
  operations in coordination with Army Intelligence and Security
  Command (INSCOM).

- **Army Intelligence and Security Command (INSCOM)**: Provides
  intelligence and security support to Army and joint operations.

The Augusta "Cyber City" corridor creates an ecosystem where AOC chapter
members interact daily with the doctrine, tools, and operational
frameworks that Tsingou aims to support. Tsingou's documentation adopts
AOC-aligned terminology and doctrinal references to ensure that
practitioners from this community recognize doctrine-aligned thinking in
the platform's architecture.

### 1.5 Scope Boundaries

This section addresses the doctrinal grounding of Tsingou's architecture.
It does NOT address:

- Classified operational procedures or TTPs (Tactics, Techniques,
  Procedures)
- Specific weapons system integration beyond SDR hardware
- Operational security (OPSEC) or emissions security (EMSEC) protocols
- Acquisition program requirements or JCIDS documentation
- Alliance-specific interoperability standards (NATO STANAG, Five Eyes)

These topics MAY be addressed in future sections or annexes as the
platform matures.

---

## 2. EMSO Doctrinal Framework

### 2.1 JP 3-85: Joint Electromagnetic Spectrum Operations

Joint Publication 3-85 [JP3-85] is the foundational joint doctrine for
Electromagnetic Spectrum Operations (EMSO). Published 22 May 2020, it
provides guidance on planning, executing, and assessing EMSO across all
services and joint force levels.

JP 3-85 defines the following key concepts that constrain Tsingou's
architecture:

**Electromagnetic Spectrum Operations (EMSO)**: Coordinated military
actions to exploit, attack, protect, and manage the electromagnetic
environment. EMSO integrates traditional Electronic Warfare (EW) with
Spectrum Management Operations (SMO) and Signals Intelligence (SIGINT)
under a unified operational framework [JP3-85, Ch. I].

**Electromagnetic Operating Environment (EMOE)**: The resulting product
of the power and time distribution, in various frequency ranges, of the
radiated or conducted electromagnetic emission levels that may be
encountered by a military force, system, or platform. The modern EMOE is
assessed as "congested, contested, and constrained" (3C) [JP3-85, Ch. II;
EMS-STRAT].

**Electromagnetic Spectrum Superiority**: That degree of control in the
electromagnetic spectrum that permits the conduct of operations at a
given time and place without prohibitive interference, while affecting an
adversary's ability to do the same [JP3-85, Glossary].

### 2.2 EMSO Hierarchical Organization

EMSO encompasses more than traditional EW. Per JP 3-85 and EMSOPEDIA
[EMSOPEDIA], EMSO integrates multiple operational disciplines:

```
EMSO (Electromagnetic Spectrum Operations)
├── Electronic Warfare (EW)
│   ├── Electronic Attack (EA)
│   ├── Electronic Protection (EP)
│   └── Electronic Warfare Support (ES)   ◄── Tsingou primary
├── Spectrum Management Operations (SMO)
│   ├── Frequency Assignment
│   ├── EMI Resolution
│   └── Spectrum Planning
├── Signals Intelligence (SIGINT)          ◄── Tsingou output
│   ├── COMINT (Communications Intelligence)
│   ├── ELINT (Electronic Intelligence)
│   ├── FISINT (Foreign Instrumentation Signals)
│   └── MASINT (Measurement and Signature Intelligence)
├── Cyber Electromagnetic Activities (CEMA)
│   ├── Cyberspace Operations (CO)
│   └── EW + SMO Integration
└── Information Operations (IO)
    └── EMS-related influence activities
```

The doctrinal evolution from "Electronic Warfare" to "Electromagnetic
Spectrum Operations" reflects recognition that the EMS is a warfighting
domain — not merely a support function. This evolution is mirrored in
the JED renaming from "Journal of Electronic Defense" to "Journal of
Electromagnetic Dominance" [JED].

Tsingou adopts the EMSO vocabulary throughout its documentation. When
referring to EW-specific concepts (the three pillars), EW terminology is
used. When referring to the broader operational framework (spectrum
management, CEMA integration, SIGINT production), EMSO terminology is
used. Implementations SHOULD follow this convention in all user-facing
documentation and interface labeling.

### 2.3 Joint Electromagnetic Spectrum Operations Cell (JEMSOC)

JP 3-85 establishes the JEMSOC as the lead staff element for JEMSO
planning at the combatant command / JTF level [JP3-85, Ch. III]. The
JEMSOC comprises J2 (Intelligence), J3 (Operations), and J6
(Communications) personnel and coordinates EMS actions across both the
functional staff elements and the joint force's components.

JEMSOC functions map to Tsingou capabilities as specified in Table 36-1.

**Table 36-1: JEMSOC Function Mapping**

| JEMSOC Function | Tsingou Equivalent | Implementation |
|----------------|-------------------|----------------|
| EMS planning and coordination | Session Configuration (Direction phase) | Declarative session schema |
| Frequency management (JFMO) | SchemaRegistry tracking of observed frequencies | NATS KV watch |
| EMI resolution | d2ts anomaly detection on interference patterns | Statistical operators |
| Cross-component coordination | NATS fan-out to multiple subscribers | Pub/sub fabric |
| EMS assessment | d2ts derived graph → statistical analysis | visx displays |
| Intelligence integration | Cross-source correlation via d2ts join | Multi-adapter fusion |
| Threat warning | Anomaly detection → alert atoms → DOM layer | Real-time alerting |

In July 2023, U.S. Strategic Command established the Joint
Electromagnetic Spectrum Operations Center (JEC) to implement the EMS
Superiority Strategy at the operational level [JEC-STRATCOM]. The JEC
raises the readiness of the joint force within the electromagnetic
spectrum and coordinates EMS actions across services. Tsingou's
architecture supports JEC-aligned workflows through its STIX/TAXII export
capability (intelligence sharing) and NATS fabric (distributed sensor
integration).

---

## 3. The Three Pillars of Electronic Warfare

### 3.1 Pillar Definitions

EW remains the core combat discipline within EMSO, organized into three
pillars as defined in JP 3-85 and affirmed in AFDP 3-85 [AFDP3-85]:

**Table 36-2: EW Pillars and Tsingou Relevance**

| Pillar | Abbreviation | Definition | Scope | Tsingou Relevance |
|--------|-------------|-----------|-------|-------------------|
| **Electronic Attack** | EA | Use of electromagnetic energy, directed energy, or anti-radiation weapons to attack personnel, facilities, or equipment for degrading, neutralizing, or destroying enemy combat capability | Offensive: jamming, deception, directed energy, anti-radiation | Tsingou monitors EA effects as observable signals; visualizes jamming patterns in derived graph anomaly detection |
| **Electronic Protection** | EP | Actions taken to protect personnel, facilities, and equipment from any effects of friendly or enemy use of the EMS | Defensive: hardening, emission control (EMCON), ECCM | Tsingou detects EP signatures; maps friendly emission patterns for EMCON compliance monitoring |
| **Electronic Warfare Support** | ES | Actions tasked by, or under direct control of, an operational commander to search for, intercept, identify, and locate or localize sources of intentional and unintentional radiated electromagnetic energy | Reconnaissance: search, intercept, identify, locate | **Primary Tsingou domain** — ES is the SIGINT-relevant pillar |

### 3.2 Tsingou as an ES Platform

Tsingou operates primarily within the **ES pillar**. This positioning
is architecturally significant because it determines the system's
relationship to the other two pillars:

**Relationship to EA**: Tsingou does not conduct electronic attack.
However, EA effects are observable in the electromagnetic environment —
jamming manifests as anomalous energy in target frequency bands,
deception manifests as unexpected signal characteristics, and directed
energy manifests as signal disruption patterns. Tsingou's d2ts derived
graph SHOULD detect these EA indicators through anomaly detection
operators. The system MUST NOT provide EA capabilities (transmission,
jamming, deception) without explicit authorization under applicable
legal frameworks.

**Relationship to EP**: Tsingou supports EP by providing spectrum
awareness that informs emission control (EMCON) decisions. The 4-layer
rendering system can display friendly emission patterns alongside threat
data, enabling EP planners to identify signature vulnerabilities. The
system SHOULD support EMCON compliance monitoring as a future capability.

**ES as primary mission**: Tsingou's collection adapters (8 source
types, per SPEC.md Section 4) correspond to ES sensors. The d2ts
processing pipeline corresponds to ES exploitation. The rendering layers
correspond to the analyst workstation where ES-derived intelligence is
consumed. The NATS fabric corresponds to the SIGINT distribution network
that delivers ES products to operational consumers.

---

## 4. ES vs. SIGINT: The Critical Distinction

### 4.1 Definitional Boundaries

JP 3-85 distinguishes between ES and SIGINT along several axes that
directly affect Tsingou's design [JP3-85, Ch. II]:

**Table 36-3: ES vs. SIGINT Comparison**

| Dimension | Electronic Warfare Support (ES) | Signals Intelligence (SIGINT) |
|-----------|--------------------------------|------------------------------|
| **Authority** | Operational commander (Title 10) | National/theater intelligence authority (Title 50 or Title 10) |
| **Timeliness** | Near-real-time (tactical) | Both NRT and deliberate (strategic) |
| **Scope** | Immediate threat environment | Full spectrum of adversary comms and electronics |
| **Output** | Threat warnings, targeting data, force protection | Intelligence products, technical analysis, trend assessment |
| **Legal framework** | Title 10 (military operations) | Title 50 (intelligence activities) or Title 10 |
| **SIGINT subdisciplines** | N/A (ES feeds SIGINT) | COMINT, ELINT, FISINT, MASINT |
| **Collection focus** | Known threats in current AO | Named threats + emerging/unknown threats globally |
| **Processing depth** | Signal detection, classification | Full technical exploitation, content analysis |
| **Retention** | Temporary (operational period) | Long-term (intelligence archive) |
| **Distribution** | Tactical consumers (unit-level) | Strategic through tactical consumers |

### 4.2 Dual-Mode Architecture

Tsingou MUST support both ES and SIGINT modalities simultaneously.
This dual-mode requirement produces specific architectural constraints:

**ES mode** (real-time, tactical priority):
- Adapter streams flow through d2ts ingest graph with minimal latency
- Anomaly detection operators fire on threshold breach
- Alert atoms propagate to DOM layer within sub-second budget
- SchemaRegistry validates against known threat parameters
- Output emphasis: DOM alerts, p5 real-time spectrum display
- Latency budget: < 500ms from adapter ingestion to rendering

**SIGINT mode** (analytical, deeper exploitation):
- JetStream historical replay feeds d2ts derived graph
- Cross-source correlation via `join` operators
- Temporal analysis via `window` operators spanning hours to days
- Pattern-of-life analysis via `iterate` convergence operators
- Output emphasis: visx analytical overlays, R3F spatial visualization
- Analysis horizon: hours to days; latency tolerance: seconds

Implementations SHOULD expose a session-level toggle between ES-priority
(low-latency, high-throughput, limited analysis depth) and
SIGINT-priority (deeper analysis, historical correlation, higher latency
tolerance) operational modes. This toggle SHOULD be implemented as a
Session Configuration parameter that adjusts d2ts graph topology and
operator parameters without requiring graph reconstruction.

### 4.3 Legal and Oversight Implications

The ES/SIGINT distinction has legal implications that constrain Tsingou's
data retention and sharing architecture:

- ES data collected under Title 10 authority MAY be retained for the
  duration of the operational period and MUST be handled according to
  the unit's records management policy
- SIGINT data collected under Title 50 authority MUST comply with
  Executive Order 12333 minimization procedures and USSID 18
  requirements
- Cross-authority data sharing MUST be handled through established
  intelligence oversight channels

Tsingou's NATS JetStream retention policies SHOULD be configurable per
session to reflect the applicable legal authority. Implementations MUST
support configurable retention windows and MUST NOT default to
indefinite retention without explicit authorization.

---

## 5. DoD EMS Superiority Strategy and EMBM

### 5.1 Strategy Overview

The 2020 DoD Electromagnetic Spectrum Superiority Strategy [EMS-STRAT]
establishes five interdependent goals. Each goal produces requirements
that Tsingou's architecture addresses:

**Table 36-4: EMS Strategy Goals and Tsingou Alignment**

| Goal | Description | Tsingou Alignment | Implementation Status |
|------|-----------|-------------------|----------------------|
| **G1** | Develop superior EMS capabilities | d2ts differential dataflow provides computational superiority for incremental signal processing | Built (stubs) |
| **G2** | Evolve to agile, fully integrated EMS infrastructure | NATS fabric + hot-plug adapters enable agile sensor integration without system restart | Built |
| **G3** | Pursue total force readiness in the EMS | 4-layer rendering supports EW training and spectrum awareness exercises via JetStream scenario replay | Design |
| **G4** | Secure enduring partnerships for EMS advantage | STIX/TAXII interoperability enables intelligence sharing with coalition partners using NATO-standard formats | Design |
| **G5** | Establish effective EMS governance | Session Configuration (Direction phase) provides structured collection management aligned with JEMSOC planning | Design |

### 5.2 Electromagnetic Battle Management (EMBM)

The Strategy defines EMBM as:

> "A comprehensive framework for dynamic monitoring, assessing, planning,
> and directing of operations in the EMS in support of the commander's
> concept of operations. EMBM leverages trusted data sources to provide
> EMS situational awareness and decision support and interfaces with
> systems and networks (including broadband and software-defined).
> The Department must develop EMBM capabilities that can monitor,
> identify, characterize, and adapt to the operational environment,
> while providing dynamic control of real-time operations in the EMS
> via machine-machine and human-machine collaboration."
> [EMS-STRAT, p. 8]

This definition produces eight discrete EMBM requirements, each of which
maps to specific Tsingou subsystems:

**Table 36-5: EMBM Requirement Mapping**

| EMBM Requirement | Tsingou Implementation | Component Reference |
|-----------------|----------------------|-------------------|
| Dynamic monitoring | 8 source adapters with hot-plug lifecycle | `AdapterManager.register()` |
| Identify | d2ts ingest graph schema validation + kind classification | `schemaValidate` operator |
| Characterize | d2ts derived graph statistical operators | `window`, `reduce`, `count`, `topK` |
| Adapt | Hot-plug adapter lifecycle + runtime graph reconfiguration | `AdapterManager.unregister()` |
| Assess | d2ts derived graph → statistical analysis → rendering | `OutputBridge` → atoms → visx |
| Plan | Session Configuration (Direction phase) | `SessionConfig` schema |
| Dynamic control | Adapter control subjects via NATS | `tsingou.adapter.{id}.control` |
| Machine-machine | NATS fabric (pub/sub, KV, JetStream) | `NatsAdapter`, `HolonetBridgeAdapter` |
| Human-machine | DOM control surface + alert atoms + 4-layer rendering | framer-motion + React |
| Trusted data sources | Schema-validated signals (SchemaRegistry + d2ts ingest) | `SchemaRegistry.lookup()` |

EMBM further requires that the system provide "dynamic control of
real-time operations via machine-machine and human-machine
collaboration." This maps directly to Tsingou's architecture:

- **Machine-machine**: NATS pub/sub enables automated sensor tasking,
  alert distribution, and cross-station coordination without human
  intermediation
- **Human-machine**: The DOM rendering layer provides interactive
  controls for session configuration, adapter management, threshold
  adjustment, and annotation — preserving the analyst's role in the
  comprehension and decision processes per Endsley's out-of-the-loop
  constraint [ENDSLEY-OOTL]

### 5.3 DISA EMBM Prototype

In April 2024, the Defense Information Systems Agency (DISA) awarded
Palantir Technologies a contract for an Electromagnetic Battle Management
prototype [DISA-EMBM]. This indicates DoD operational interest in
software-defined EMBM platforms — the same architectural category that
Tsingou occupies. While Palantir's Gotham platform approaches EMBM from
a data integration perspective [PALANTIR], Tsingou approaches it from a
differential dataflow perspective — optimizing for incremental
computation over streaming signal data rather than batch analysis over
stored datasets.

---

## 6. CEMA Integration Framework

### 6.1 FM 3-12: Cyberspace Operations and Electromagnetic Warfare

Army Field Manual 3-12 [FM3-12] (August 2021) defines Cyber
Electromagnetic Activities (CEMA) as:

> "The process of planning, integrating, and synchronizing cyberspace
> operations and electronic warfare in support of unified land
> operations."

CEMA unifies three operational functions:

```
CEMA (Cyber Electromagnetic Activities)
├── Cyberspace Operations (CO)
│   ├── Offensive Cyberspace Operations (OCO)
│   ├── Defensive Cyberspace Operations (DCO)
│   └── DoD Information Network Operations (DINO)
├── Electronic Warfare (EW)
│   ├── Electronic Attack (EA)
│   ├── Electronic Protection (EP)
│   └── Electronic Warfare Support (ES)
└── Spectrum Management Operations (SMO)
    ├── Frequency assignment and allocation
    ├── Electromagnetic interference (EMI) resolution
    ├── Host nation spectrum coordination
    └── Joint Restricted Frequency List (JRFL) management
```

The proponent for FM 3-12 is the U.S. Army Cyber Center of Excellence
at Fort Eisenhower — the same installation that hosts ARCYBER, NSA/CSS
Georgia, and INSCOM elements [CCOE].

### 6.2 CEMA Cell Structure and Operations

At division level and above, the CEMA cell operates within the
operations center to integrate cyber and EW effects into the Military
Decision Making Process (MDMP) [FM3-12, Ch. 3]:

```
Division/Corps Operations Center
├── Current Operations (CUOPS)
│   └── Battle tracking, immediate response
├── Future Operations (FUOPS)
│   └── 24-72hr planning horizon
├── CEMA Cell
│   ├── EW Planner
│   │   └── ES/EA/EP coordination, EWIR mgmt
│   ├── Cyber Planner
│   │   └── OCO/DCO coordination, cyber effects
│   ├── Spectrum Manager
│   │   └── Frequency assignment, deconfliction, JRFL
│   └── Intel Liaison
│       └── SIGINT integration, EOB maintenance
├── Fires Cell
│   └── Kinetic effects coordination
├── Intel Cell (G2/S2)
│   └── IPB, threat assessment, PIR management
└── Signal Cell (G6/S6)
    └── Communications network management
```

Tsingou's Session Configuration (Direction phase) SHOULD model the CEMA
cell's planning workflow. This mapping is specified in Table 36-6.

**Table 36-6: CEMA Planning Workflow Mapping**

| CEMA Planning Step | Tsingou Direction Phase Equivalent | Implementation Notes |
|-------------------|----------------------------------|---------------------|
| Define intelligence requirements | Define collection priority sources, focus areas, PIR keywords | Session Config `focusAreas` field |
| Identify collection assets | Select and configure source adapters from available inventory | `AdapterManager.list()` + `register()` |
| Task collection assets | Activate adapters with frequency/band/protocol parameters | Adapter `connect(config)` |
| Coordinate spectrum use | Define frequency monitoring ranges in adapter configs | SDR adapter `centerFrequency`, `bandwidth` |
| Establish analysis parameters | Configure d2ts derived graph operators (windowing, thresholds) | Session Config `analysisParams` |
| Plan dissemination | Define STIX export targets, alert conditions, rendering priorities | Session Config `disseminationRules` |
| Integrate with fires | Cross-reference anomaly alerts with fires cell requirements | (Gap — external integration) |
| Deconfliction | Coordinate collection with friendly emissions schedule | (Gap — EMCON integration not implemented) |

### 6.3 FM 3-38: Legacy CEMA Doctrine

FM 3-38 (2014) was the original CEMA doctrine, superseded by FM 3-12
but still referenced for foundational concepts [FM3-38]. It established
the CEMA framework as integrating CO, EW, and SMO under unified command.
Key concepts from FM 3-38 that persist in current doctrine:

- **Convergence**: The integration of capabilities from multiple domains
  to create combined effects that exceed the sum of individual effects
- **Cross-domain synergy**: Using success in one domain to create
  advantage in another
- **Electromagnetic superiority as precondition**: EMS control enables
  operations in all other domains

These concepts map to Tsingou's multi-source adapter architecture, which
treats signals from different domains (network, RF, serial, file) as
inputs to a unified differential dataflow graph, producing cross-domain
correlation through the d2ts `join` operator.

---

## 7. CEMA in Multi-Domain Operations

### 7.1 MDO Concept Overview

Multi-Domain Operations (MDO) is the Army's transformational operational
concept for 2030+, replacing AirLand Battle as the governing warfighting
doctrine [MDO-WIKI]. MDO requires convergence of effects across five
domains (land, maritime, air, space, cyberspace) plus the electromagnetic
spectrum.

The MDO concept identifies three critical requirements for EMS operations:

1. **Sensor fusion**: Integrating signals from multiple domains into a
   unified operational picture
2. **Effects convergence**: Synchronizing cyber and EW effects with
   kinetic fires at machine speed
3. **Distributed operations**: Edge processing at tactical echelons
   with reach-back to higher-level analysis

### 7.2 MDO Requirements Mapping

**Table 36-7: MDO-to-Tsingou Capability Mapping**

| MDO Requirement | Tsingou Capability | Implementation | Status |
|----------------|-------------------|----------------|--------|
| Multi-domain sensor fusion | 8 adapter types spanning network, RF, serial, file sources | `AdapterManager` + 8 adapter services | Built |
| Cross-source correlation | d2ts `join` operator maintains state from both sides | `DerivedGraph.join()` | Built (stubs) |
| Machine-speed processing | d2ts incremental computation (differential dataflow) | `IngestGraph.run()`, `DerivedGraph.run()` | Built (stubs) |
| Edge processing | NATS leaf node architecture (sidecar → NATS leaf → cluster) | `NatsAdapter` + NATS leaf config | Design |
| Distributed operations | NATS fabric enables multi-station deployment | `HolonetBridgeAdapter` | Built |
| Rapid decision cycles | Adapter → d2ts → OutputBridge → alert atom in sub-second | Full pipeline | Built (stubs) |
| Cross-domain deconfliction | d2ts anomaly detection identifies interference patterns | `anomalyDetect` operator | Design |

### 7.3 Multi-Domain Effects Platoon (MDEP)

The Army is fielding Multi-Domain Effects Platoons (MDEPs) at brigade
level to bring EW capabilities to the tactical edge [ARMY-MDEP]. The
MDEP converges capabilities across the EMS, cyber, and physical domains.
Tsingou's architecture supports MDEP-aligned workflows:

- **Detection**: SDR adapters + d2ts ingest for real-time emitter
  detection at tactical range
- **Classification**: SchemaRegistry-based signal identification against
  known threat parameters
- **Geolocation**: DF/TDOA/FDOA data ingestion and correlation in
  derived graph
- **Targeting**: Alert atoms + STIX indicator generation for fires
  integration
- **Assessment**: JetStream replay for battle damage assessment (BDA)
  of EW effects

---

## 8. JADC2 and Spectrum Integration

### 8.1 JADC2 Overview

Joint All-Domain Command and Control (JADC2) aims to connect sensors to
shooters across all domains at machine speed [JADC2-AFCEA]. CEMA
provides the EMS effects integration layer for JADC2. The Indo-Pacific
Command area of operations has been a focus for JADC2 initiatives,
particularly around higher-level spectrum deconfliction to optimize
mission effectiveness.

### 8.2 JADC2 Challenges and Tsingou Responses

**Table 36-8: JADC2 Challenge Mapping**

| JADC2 Challenge | Tsingou Response | Mechanism |
|----------------|-----------------|-----------|
| Spectrum deconfliction in contested environments | d2ts anomaly detection identifies interference patterns and frequency conflicts | Statistical operators on spectral data |
| Joint sensor data integration | NATS fabric provides transport-agnostic sensor bus with subject-based routing | NATS subjects encode sensor type and identity |
| Real-time EMS awareness for commanders | 4-layer rendering provides multi-modal SA display covering all three Endsley levels | R3F + visx + p5 + DOM composite |
| Intelligence sharing across services/partners | STIX/TAXII export enables standardized intelligence exchange using NATO-compatible formats | STIX 2.1 bundle generation |
| Cultural integration of cyber + EW | Unified adapter framework treats all signal sources identically regardless of domain origin | Common `SourceAdapterShape` interface |
| Sensor-to-shooter latency | d2ts incremental computation processes only changed data | Differential dataflow |

---

## 9. TPED Processing Chain

### 9.1 TPED Cycle Definition

The TPED (Tasking, Processing, Exploitation, and Dissemination) cycle is
the ISR operational model for intelligence production [GLOBALSEC-TPED].
Every ISR system, from satellite constellations to tactical SIGINT
platforms, operates within this framework.

**Table 36-9: TPED Phase Definitions**

| Phase | Definition | Military Function | Temporal Character |
|-------|-----------|-------------------|-------------------|
| **Tasking** | Directing new collection based on intelligence requirements | Priority Intelligence Requirements (PIR), Collection Management, sensor allocation | Pre-collection planning |
| **Processing** | Converting raw data to exploitable form | Signal conditioning, demodulation, protocol decoding, format conversion, quality assessment | Near-real-time |
| **Exploitation** | Reviewing processed data to create derived information | Analysis, pattern recognition, entity extraction, threat assessment, correlation | Analytical (minutes to hours) |
| **Dissemination** | Delivering derived information to end users for decision-making | Intelligence reports, alerts, COP updates, feeds to C2 systems, partner sharing | Continuous/on-demand |

The TPED cycle includes an implicit feedback loop: end-user feedback
drives new tasking, closing the cycle. This feedback mechanism maps to
Tsingou's Intelligence Cycle Phase 6 (Feedback) as established in
ADR-010.

### 9.2 TPED Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                       TPED CYCLE                         │
│                                                          │
│  ┌──────────┐     ┌──────────────┐     ┌─────────────┐  │
│  │ TASKING  │────►│ PROCESSING   │────►│EXPLOITATION │  │
│  │          │     │              │     │             │  │
│  │ PIR      │     │ Condition    │     │ Correlate   │  │
│  │ Allocate │     │ Demodulate   │     │ Analyze     │  │
│  │ Schedule │     │ Decode       │     │ Assess      │  │
│  │ Prioritize│    │ Normalize    │     │ Classify    │  │
│  └────▲─────┘     └──────────────┘     └──────┬──────┘  │
│       │                                        │         │
│       │          ┌──────────────┐               │         │
│       │          │DISSEMINATION │◄──────────────┘         │
│       │          │              │                          │
│       └──────────│ Report       │                          │
│       Feedback   │ Alert        │                          │
│                  │ Share        │                          │
│                  │ Archive      │                          │
│                  └──────────────┘                          │
└─────────────────────────────────────────────────────────┘
```

---

## 10. TPED-to-Tsingou Architectural Mapping

### 10.1 Tasking → Session Configuration (Direction Phase)

**Table 36-10: TPED Tasking Element Mapping**

| TPED Tasking Element | Tsingou Implementation | Schema Field | Status |
|---------------------|----------------------|-------------|--------|
| Priority Intelligence Requirements (PIR) | Focus area keywords, entity names, IP ranges | `SessionConfig.focusAreas` | Design |
| Collection asset designation | Source adapter selection and configuration | `SessionConfig.adapters[]` | Design |
| Frequency/band assignment | Adapter config (SDR center frequency, bandwidth) | `SdrAdapterConfig.centerFreq` | Design |
| Time window specification | Session duration, historical replay range | `SessionConfig.timeWindow` | Design |
| ATT&CK technique targeting | ATT&CK technique IDs in session config | `SessionConfig.attackTechniques[]` | Design |
| Collection priority ranking | Ordered adapter list with priority weights | `SessionConfig.priorities[]` | Design |
| Deconfliction constraints | Frequency avoidance lists, time restrictions | `SessionConfig.deconfliction` | Design |

Implementations MUST support structured tasking through the Session
Configuration service. Tasking SHOULD be expressible as a declarative
Effect.Schema document that can be versioned in NATS KV, shared with
partner stations, and replayed for training scenarios.

### 10.2 Processing → d2ts Ingest Graph

**Table 36-11: TPED Processing Element Mapping**

| TPED Processing Element | Tsingou Implementation | d2ts Operator | Status |
|------------------------|----------------------|--------------|--------|
| Signal conditioning | BaseSignal normalization in ingest graph | `map(normalize)` | Built (stubs) |
| Protocol decoding | SchemaRegistry lookup + decode | `schemaValidate(registry)` | Built (stubs) |
| Format conversion | Signal type extension (MidiSignal, SdrSignal, etc.) | `map(toExtension)` | Built |
| Metadata enrichment | Ingest graph source tagging with adapter metadata | `map(enrich)` | Built (stubs) |
| Deduplication | MultiSet consolidation removing duplicate entries | `consolidate()` | Built (stubs) |
| Quality assessment | Schema validation with quality scoring | `filter(isValid)` | Built (stubs) |
| Timestamp normalization | UTC normalization across heterogeneous sources | `map(normalizeTimestamp)` | Built (stubs) |

The d2ts ingest graph MUST perform all Processing-phase functions before
signals enter the Derived Graph. Signals that fail schema validation
MUST be logged via `Effect.log` but MUST NOT propagate to the
Exploitation phase. This implements the doctrine requirement that
processing produces "exploitable" data — invalid signals are not
exploitable [JP3-85, Ch. IV].

### 10.3 Exploitation → d2ts Derived Graph

**Table 36-12: TPED Exploitation Element Mapping**

| TPED Exploitation Element | Tsingou Implementation | d2ts Operator | Status |
|--------------------------|----------------------|--------------|--------|
| Pattern recognition | Iterative convergence on signal patterns | `iterate(convergeFn)` | Built (stubs) |
| Cross-source correlation | Multi-input state-maintaining join | `join(leftInput, rightInput)` | Built (stubs) |
| Temporal analysis | Sliding time window over signal streams | `window(durationMs)` | Built (stubs) |
| Anomaly detection | Statistical operators (rolling avg, stddev, z-score) | `map(zScore)` + `filter(threshold)` | Built (stubs) |
| Entity extraction | Named entity recognition on signal payloads | `map(extractEntities)` | Design |
| Threat assessment | STIX indicator generation from derived intelligence | `map(toStixIndicator)` | Design |
| ATT&CK mapping | Pattern matching against technique signatures | `filter(matchesTechnique)` | Design |
| Pattern-of-life analysis | Temporal aggregation over extended time windows | `window(hours)` + `reduce(poflProfile)` | Design |
| Frequency hopping detection | Rapid frequency change detection across SDR data | `map(detectHop)` + `reduce(hopPattern)` | Design |

The Exploitation phase MUST produce intelligence products that are
immediately actionable through the Dissemination phase. Implementations
SHOULD compute confidence scores (0.0-1.0) for all derived intelligence
products. Confidence scores MUST be included in STIX indicator objects
as the `confidence` field.

### 10.4 Dissemination → OutputBridge + Export

**Table 36-13: TPED Dissemination Element Mapping**

| TPED Dissemination Element | Tsingou Implementation | Component | Status |
|---------------------------|----------------------|-----------|--------|
| Analyst workstation display | OutputBridge → atoms → 4-layer rendering | `OutputBridge.set(atoms)` | Built |
| Alert generation | Threshold breach → anomalyAtom → DOM alert | `alertAtom` + framer-motion | Design |
| Intelligence reports | STIX 2.1 bundle generation | `StixBundleGenerator` | Design |
| Partner sharing | TAXII server (HTTP API) | `TaxiiServer` service | Design |
| Internal distribution | NATS fan-out to subscribers | NATS `tsingou.derived.*` | Built |
| Database feed | NATS JetStream persistence | `TSINGOU_SIGNALS` stream | Built |
| Integration connectors | OpenCTI, TheHive, MISP, Cortex adapters | Connector services | Design |
| CSV/NDJSON export | File export for offline analysis | `FileExport` service | Design |

---

## 11. Intelligence Cycle Extension Beyond TPED

### 11.1 Six-Phase Coverage

TPED is a subset of the full Intelligence Cycle. ADR-010 [ADR-010]
extends Tsingou to cover all six phases:

**Table 36-14: Intelligence Cycle to TPED to Tsingou Mapping**

| IC Phase | TPED Phase | Tsingou Subsystem | Implementation Status |
|----------|-----------|-------------------|----------------------|
| 1. Direction | Tasking | Session Configuration | Design |
| 2. Collection | (Pre-Processing) | 8 Source Adapters | **Built** |
| 3. Processing | Processing | d2ts Ingest Graph | Built (stubs) |
| 4. Analysis | Exploitation | d2ts Derived Graph | Built (stubs) |
| 5. Dissemination | Dissemination | OutputBridge + STIX/TAXII | Partial |
| 6. Feedback | (Post-Dissemination) | Accuracy tracking, graph tuning | Design |

### 11.2 Direction Phase (Phase 1)

The Direction phase establishes intelligence requirements before
collection begins. This maps to the JEMSOC's planning function and the
CEMA cell's MDMP integration [FM3-12, Ch. 3].

Direction phase implementation requires:

1. A declarative Session Configuration schema (Effect.Schema) capturing
   PIR, collection assets, analysis parameters, and dissemination rules
2. Session versioning in NATS KV for audit trail and training replay
3. Template library for common collection scenarios (spectrum survey,
   specific emitter search, COMINT collection)
4. Integration with threat library (SchemaRegistry) for known-threat
   tasking

### 11.3 Feedback Phase (Phase 6)

The Feedback phase measures intelligence quality and adjusts the cycle.
This maps to the DoD EMS Strategy's requirement for "adaptive" EMBM
capabilities that learn from operational outcomes [EMS-STRAT].

Feedback phase implementation requires:

1. Analyst annotation capability — marking derived intelligence as
   confirmed, false positive, or uncertain
2. Confidence calibration — tracking confirmed vs. false positive rates
   per analysis rule
3. Automatic collection adjustment — increasing polling frequency on
   high-yield sources, pausing low-yield adapters
4. Graph tuning — adjusting anomaly thresholds and window durations
   based on feedback data
5. Session journal — immutable log of Direction-through-Feedback
   decisions for institutional learning

---

## 12. Doctrine-to-Architecture Mapping

### 12.1 Comprehensive Mapping Table

This table provides the authoritative mapping between EW/SIGINT doctrine
concepts and Tsingou architecture components. Implementations MUST
maintain this mapping as the architecture evolves.

**Table 36-15: Doctrine-to-Architecture Master Mapping**

| Doctrine Concept | Source | Tsingou Component | Notes |
|-----------------|--------|-------------------|-------|
| Electronic Order of Battle (EOB) | [JP3-85], [SISO-2023] | `BaseSignal` + `SdrSignal` + `SchemaRegistry` | EOB entries map to BaseSignal records with kind "sdr" |
| Electromagnetic Battle Management (EMBM) | [EMS-STRAT] | d2ts pipeline + OutputBridge + 4-layer rendering | Dynamic monitoring via incremental computation |
| JEMSOC planning | [JP3-85] | Session Configuration (Direction phase) | Collection requirements, analysis parameters |
| EMOE characterization | [JP3-85], [EMS-STRAT] | d2ts derived graph statistical operators | "3C" assessment via spectrum occupancy analysis |
| Direction Finding (DF) | [CRFS-DF] | SDR adapter → geolocation metadata | DF bearings from external processors via NATS |
| TDOA geolocation | [CRFS-DF] | SDR adapter → derived graph correlation | Multi-sensor position fixes |
| FDOA geolocation | [CRFS-DF] | SDR adapter → Doppler metadata | Satellite/airborne collector data |
| EWIRDB (threat library) | [EWIRDB] | SchemaRegistry (NATS KV) | Dynamic, runtime-updateable |
| EW Reprogramming (EWIR) | [EWIRDB], [DEFSCOOP-EWIR] | SchemaRegistry watch + anomaly detection | Automated change detection |
| Spectrum Management (SMO) | [FM3-12] | Adapter config + NATS subjects | Frequency/band via adapter parameters |
| Recognized Electromagnetic Picture (REP) | [JP3-85] | 4-layer rendering composite | R3F + visx + p5 + DOM |
| Common Operating Picture (COP) | [JP3-85] | NATS fan-out + STIX export | EMS layer contribution |
| SIGINT distribution | [JP3-85], [FM3-12] | NATS fabric (subjects, JetStream) | Transport-agnostic |
| Tactical data links | [JP3-85] | NATS leaf node architecture | Edge nodes for tactical echelon |
| Collection assets | [JP3-85] | 8 Source Adapters | Each adapter = asset category |
| Sensor-to-shooter chain | [MDO-WIKI] | Adapter → d2ts → alert → action | End-to-end pipeline |
| Multi-Domain Operations (MDO) | [MDO-WIKI] | Multi-source adapters + d2ts join | Cross-domain convergence |
| CEMA cell workflow | [FM3-12] | Session Config + adapter mgmt + graph config | MDMP-aligned planning |
| Intelligence Preparation of Battlespace (IPB) | [ATP2-01.3] | d2ts derived graph + R3F terrain overlay | EMS annex production |
| Signal of Interest (SOI) | [JP3-85] | BaseSignal matching session criteria | `SessionConfig.focusAreas` |
| SigMF interoperability | [SIGMF] | SDR adapter IQ recording metadata | Standard metadata format |
| Mission Data (MD) | [EWIRDB] | SchemaRegistry entries + adapter configs | Threat awareness data |

---

## 13. Signal Schema as EOB Data Model

### 13.1 EOB Data Element Mapping

The BaseSignal schema (FLOW_ARCHITECTURE.md, Section 3.1) maps to
Electronic Order of Battle data elements as follows:

**Table 36-16: EOB-to-BaseSignal Field Mapping**

| EOB Data Element | BaseSignal Field | Extension Field | Notes |
|-----------------|-----------------|-----------------|-------|
| Emitter identifier | `id` (SignalId) | — | Globally unique, branded string |
| Platform/source association | `sourceId` (SourceId) | — | Links to collection asset |
| Time of intercept | `timestamp` | — | UTC DateFromSelf |
| Sequence ordering | `version` ([tick, source_seq]) | — | Multi-dimensional d2ts version |
| Signal type classification | `kind` | — | Discriminator for schema lookup |
| Operating frequency | — | `SdrSignal.payload.frequency` | Hz, center frequency |
| Bandwidth | — | `SdrSignal.payload.bandwidth` | Hz, occupied bandwidth |
| Modulation type | — | `SdrSignal.payload.modulation` | Enum: AM, FM, PSK, QAM, etc. |
| Pulse characteristics | — | `SdrSignal.payload.pulseParams` | PRF, PW, PRI for radar |
| Antenna pattern | — | `SdrSignal.payload.antennaType` | Directional, omni, phased |
| Geolocation | `metadata.geolocation` | — | {lat, lon, alt, accuracy} |
| Confidence ellipse | `metadata.confidence` | — | Position error estimate |
| Threat assessment | — | Derived graph output | STIX indicator |
| Unit association | — | Cross-source correlation | d2ts join with OSINT |
| First observed | `timestamp` (min) | — | Earliest intercept timestamp |
| Last observed | `timestamp` (max) | — | Most recent intercept timestamp |
| Signal count | — | d2ts `count` operator | Number of intercepts |

### 13.2 SdrSignal Extension Requirements

Implementations MUST ensure that the SdrSignal extension schema includes
fields sufficient to populate a complete EOB record. This is a normative
requirement derived from [JP3-85] and [SISO-2023].

The SdrSignal extension SHOULD include:

```typescript
const SdrSignal = Schema.extend(BaseSignal, Schema.Struct({
  kind: Schema.Literal('sdr'),
  payload: Schema.Struct({
    frequency:      Schema.Number,     // Hz, center frequency
    bandwidth:      Schema.Number,     // Hz, occupied bandwidth
    sampleRate:     Schema.Number,     // samples/second
    modulation:     Schema.optional(Schema.String),
    power:          Schema.optional(Schema.Number),  // dBm
    snr:            Schema.optional(Schema.Number),  // dB
    pulseParams:    Schema.optional(Schema.Struct({
      prf:  Schema.Number,   // Pulse Repetition Frequency
      pw:   Schema.Number,   // Pulse Width (seconds)
      pri:  Schema.Number,   // Pulse Repetition Interval
    })),
    antennaType:    Schema.optional(Schema.String),
    polarization:   Schema.optional(Schema.String),
    deviceId:       Schema.String,     // SDR hardware identifier
    deviceType:     Schema.optional(Schema.String),
  })
}))
```

---

## 14. SchemaRegistry as Threat Library

### 14.1 EWIRDB Functional Equivalence

The NATS KV-backed SchemaRegistry (FLOW_ARCHITECTURE.md, Section 3.3)
serves the same architectural role as the Electronic Warfare Integrated
Reprogramming Database (EWIRDB) [EWIRDB] at the tactical level:

**Table 36-17: EWIRDB-to-SchemaRegistry Mapping**

| EWIRDB Function | SchemaRegistry Function | Implementation |
|----------------|------------------------|----------------|
| Store emitter technical parameters | Store signal schema definitions | NATS KV `tsingou-schemas` bucket |
| Provide validated emitter data | Validate incoming signals against registered schemas | `SchemaRegistry.lookup(kind)` |
| Support mission data file generation | Generate d2ts graph configurations from schema metadata | Schema → operator config |
| Enable reprogramming | Runtime schema updates via NATS KV watch | `SchemaRegistry.watch()` |
| Version management | Schema version field + KV revision tracking | `SchemaRegistryEntry.version` |
| Emitter parametric data | Frequency ranges, modulation, pulse params per kind | Schema field constraints |
| Weapon system association | Signal kind → platform/system mapping | Schema `metadata.platform` |
| Update distribution | KV watch → downstream consumer notification | NATS KV watcher |

### 14.2 Watch Capability

The SchemaRegistry MUST support a "watch" capability that notifies the
d2ts pipeline when schema definitions change. This implements the EWIR
change detection process [EWIRDB]:

1. National-level intelligence updates emitter parameters
2. Updated schema published to `tsingou-schemas` KV bucket
3. NATS KV watch fires notification to SchemaRegistry service
4. SchemaRegistry invalidates cached schema for affected `kind`
5. d2ts ingest graph reprocesses incoming signals against updated schema
6. d2ts derived graph replays historical signals (JetStream) against
   new parameters
7. Anomaly operators flag previously-unclassified signals matching
   new threat parameters

---

## 15. EW Reprogramming and Adaptive Threat Response

### 15.1 EWIR Process

Electronic Warfare Integrated Reprogramming (EWIR) consists of four
processes [EWIRDB]:

**Table 36-18: EWIR Process Mapping**

| EWIR Process | Definition | Tsingou Equivalent |
|-------------|-----------|-------------------|
| **Change Detection** | Identify changes in threat technical capabilities | d2ts anomaly detection operators flag parameter shifts |
| **Impact Determination** | Assess how changes affect friendly EW systems | Derived graph correlation with known friendly emissions |
| **Reprogramming** | Update mission data, missionware, OFPs, or hardware | SchemaRegistry update + session reconfiguration |
| **Change Delivery** | Distribute reprogrammed data to fielded systems | NATS KV watch propagation to all subscribers |

The overall process is referred to by the unclassified code name PACER
WARE and includes mission data changes, missionware changes, operational
flight program (OFP) changes, or minor hardware changes.

### 15.2 Rapid Reprogramming Requirements

Lessons learned from Ukraine (2024) demonstrate that the EW landscape
changes between 3 weeks and 3 months [DEFSCOOP-EWIR]. Traditional
reprogramming cycles measured in months are too slow for near-peer
conflict. The Army is conducting data pilots for rapid EW reprogramming.

Tsingou's architecture addresses rapid reprogramming through:

- **SchemaRegistry** (NATS KV) = runtime-updateable threat library with
  sub-second propagation via KV watch
- **d2ts derived graph** = automated change detection via anomaly
  operators that flag parameter shifts against known baselines
- **Hot-plug adapters** = rapid sensor integration without system restart
- **STIX interop** = standardized threat data exchange with national
  intelligence feeds
- **JetStream replay** = baseline comparison by replaying historical
  signals against updated schemas

---

## 16. Geolocation Techniques and Architecture

### 16.1 Direction Finding (DF)

Direction Finding provides a bearing to a transmission by using the angle
from the sensor to the transmitter [CRFS-DF]. Key characteristics:

- Requires fewer sensors (1-2 DF arrays)
- Accuracy degrades linearly with range to emitter
- Well-suited for space-constrained tactical deployments
- Output: bearing angle (degrees from true north) with confidence

### 16.2 Time Difference of Arrival (TDOA)

TDOA pinpoints geographic coordinates using time differences between 3+
receivers [CRFS-DF]:

- Requires precise time synchronization (GPS-disciplined clocks)
- Requires accurate station location knowledge
- Less range-dependent than DF
- Higher accuracy but requires more infrastructure
- Output: latitude/longitude with confidence ellipse

### 16.3 Frequency Difference of Arrival (FDOA)

FDOA uses Doppler shift differences measured by moving receivers
[CRFS-DF]:

- Requires relative motion between stations and emitter
- Particularly effective with satellite-based collection
- Often combined with TDOA for hybrid T/FDOA geolocation
- Output: position estimate refined by Doppler measurements

### 16.4 Geolocation Architecture in Tsingou

Tsingou does NOT perform DF, TDOA, or FDOA computation internally.
External geolocation processors (GNU Radio flow graphs, dedicated DF
systems, national-level platforms) compute position fixes and publish
results to NATS. Tsingou ingests these results through its adapter
framework:

```
External DF/TDOA/FDOA Processor
    │
    ▼ NATS publish: tsingou.signal.sdr.geoloc.{device}
    │
┌───▼──────────────────────────────────────────────┐
│ Tsingou d2ts Ingest Graph                         │
│   • Validate geolocation schema                   │
│   • Normalize coordinate system (WGS-84)          │
│   • Tag with source metadata                      │
│   • Forward to derived graph                      │
└───┬──────────────────────────────────────────────┘
    │
┌───▼──────────────────────────────────────────────┐
│ Tsingou d2ts Derived Graph                        │
│   • Correlate position fixes across sensors       │
│   • Apply temporal windowing for track maint.     │
│   • Cross-reference with OSINT geolocation data   │
│   • Compute movement vectors and patterns         │
│   • Feed to R3F 3D rendering layer                │
└──────────────────────────────────────────────────┘
```

Geolocation data MUST be stored in WGS-84 coordinate system with
associated accuracy metadata (confidence ellipse parameters: semi-major
axis, semi-minor axis, orientation angle).

---

## 17. Terminology Alignment Guide

### 17.1 Professional Vocabulary Mapping

This guide maps professional EW/SIGINT terminology to Tsingou-specific
terms. All Tsingou documentation SHOULD use the professional term when
communicating with the EW community.

**Table 36-19: Professional Term to Tsingou Mapping**

| Professional Term | Abbr. | Tsingou Equivalent | Context |
|------------------|------|-------------------|---------|
| Electromagnetic Spectrum Operations | EMSO | Platform mission scope | Tsingou operates within EMSO |
| Electronic Warfare Support | ES | Adapter + ingest pipeline | Primary EW pillar |
| Signals Intelligence | SIGINT | End-to-end platform function | Full TPED cycle output |
| Communications Intelligence | COMINT | HTTP/WS/NATS/RSS processing | Communications sources |
| Electronic Intelligence | ELINT | SDR adapter → non-comms processing | Radar, nav emissions |
| Foreign Instrumentation Signals Intelligence | FISINT | Serial/OSC adapter → telemetry | Foreign telemetry |
| Measurement and Signature Intelligence | MASINT | SDR + FileWatch → spectral analysis | IQ recordings |
| Electronic Order of Battle | EOB | BaseSignal registry + derived state | d2ts incremental state |
| Electromagnetic Battle Management | EMBM | d2ts + OutputBridge + rendering | Dynamic monitoring |
| Electromagnetic Operating Environment | EMOE | Active signal space | The "3C" environment |
| Joint EMS Operations Cell | JEMSOC | Session Configuration service | Planning function |
| EMS Operations Cell | ESOC | Session Config + adapter mgmt | Service-level JEMSOC |
| Recognized Electromagnetic Picture | REP | 4-layer rendering composite | EMS COP contribution |
| TPED | TPED | Direction → adapters → d2ts → OutputBridge | ISR cycle |
| EW Integrated Reprogramming | EWIR | SchemaRegistry update workflow | Threat library maint. |
| EWIR Database | EWIRDB | SchemaRegistry (NATS KV) | Emitter parameter store |
| Direction Finding | DF | Geolocation metadata in BaseSignal | Angular bearing |
| Time Difference of Arrival | TDOA | Multi-sensor correlation | Precision geolocation |
| Frequency Difference of Arrival | FDOA | Doppler-based metadata | Motion-dependent geoloc. |
| Spectrum Dependent Systems | SDS | Source adapters + consumers | EMS-using systems |
| Electromagnetic Interference | EMI | Anomaly detection output | Unintentional disruption |
| Intentional jamming | Jamming | EA-observable in derived graph | Deliberate disruption |
| Cyber Electromagnetic Activities | CEMA | Unified cyber + EW session | Integrated planning |
| Multi-Domain Operations | MDO | Multi-source convergence | Cross-domain fusion |
| Mission Data | MD | SchemaRegistry + adapter configs | Threat awareness data |
| Signal of Interest | SOI | BaseSignal matching criteria | Collection target |
| Emitter | — | Source (via sourceId) | EM energy producer |
| Intercept | — | BaseSignal (adapter capture) | Collected emission |
| Collection asset | — | Source Adapter instance | Sensor system |
| Exploitation tool | — | d2ts operator | Processing function |
| Signal Metadata Format | SigMF | SDR recording metadata | IQ file standard |
| Intelligence Preparation of Battlespace | IPB | d2ts + R3F terrain overlay | Planning product |
| Pattern of Life | PoL | Temporal aggregation in derived graph | Behavioral analysis |
| Electronic Warfare Planning & Management Tool | EWPMT | Session Config + 4-layer rendering | EW commander tool |

---

## 18. SIGINT Subdiscipline Mapping

### 18.1 Adapter-to-Subdiscipline Alignment

Tsingou's adapter architecture maps to SIGINT subdisciplines as
established in JP 3-85 [JP3-85]:

**Table 36-20: SIGINT Subdiscipline to Adapter Mapping**

| Subdiscipline | Definition | Adapters | Signal Kinds | Collection Focus |
|--------------|-----------|----------|-------------|-----------------|
| **COMINT** | Intelligence from communications | HTTP, WebSocket, RSS, NATS | `http`, `websocket`, `rss`, `nats` | Network traffic, social media, news feeds, messaging |
| **ELINT** | Intelligence from non-comms EM emissions | SDR (via sidecar) | `sdr` | Radar, navigation beacons, telemetry links |
| **FISINT** | Intelligence from foreign instrumentation signals | Serial, OSC | `serial`, `osc` | Foreign sensor telemetry, instrumentation data |
| **MASINT** | Intelligence from quantitative/qualitative analysis | SDR + FileWatch | `sdr`, `file-watch` | IQ recordings, spectral analysis, seismic/acoustic |

### 18.2 Cross-Subdiscipline Correlation

The d2ts `join` operator enables correlation across subdisciplines —
a capability that doctrine identifies as essential for intelligence
production but that is rarely automated in existing platforms:

- **COMINT + ELINT**: Correlate communications traffic patterns with
  radar emission schedules to identify command relationships
- **ELINT + MASINT**: Correlate radar parameters with spectral
  signatures for weapon system identification
- **COMINT + OSINT**: Correlate intercepted communications with
  open-source reports for context enrichment
- **FISINT + ELINT**: Correlate foreign telemetry with associated
  emission patterns for system characterization

---

## 19. Four-Layer Rendering and EMSO Situational Awareness

### 19.1 Endsley SA Levels in EMSO Context

EMSO doctrine requires situational awareness across Endsley's three SA
levels [ENDSLEY-1995]. The theoretical foundations section establishes
this requirement for the IIoT domain. This section extends the SA
framework to the EMSO domain with specific rendering layer assignments.

**Table 36-21: SA Level to Rendering Layer Mapping**

| SA Level | Cognitive Function | EMSO Requirement | Rendering Layer | Display Components |
|----------|-------------------|-----------------|----------------|-------------------|
| **Level 1: Perception** | Raw data intake | Real-time spectrum display, emitter detection | **p5 (z:2)** | Waterfall, FFT, constellation diagram, spectrogram |
| **Level 2: Comprehension** | Pattern recognition | Cross-source correlation, EOB status, classification | **visx (z:1)** | Network graphs, timelines, distributions, EOB matrix |
| **Level 3: Projection** | Trend extrapolation | Movement prediction, PoL analysis, campaign assessment | **R3F (z:0)** | 3D terrain, emitter tracks, propagation models, trends |
| **Control** | Operator interaction | Session config, adapter mgmt, threshold adjustment | **DOM (z:3)** | Controls, alerts, annotations, status indicators |

### 19.2 SA Level 1: Perception via p5 Canvas Layer

The p5 rendering layer (z:2) provides raw spectrum perception — the
EMSO equivalent of SA Level 1 [ENDSLEY-1995]. This layer MUST support:

- **Waterfall display**: Frequency x time x intensity heatmap showing
  spectrum occupancy evolution. Scrolling time axis, color-mapped
  intensity. Resolution: configurable FFT size (256-8192 bins).
- **FFT magnitude plot**: Real-time frequency spectrum showing current
  power distribution across monitored bandwidth. Linear or logarithmic
  amplitude scale.
- **Signal constellation diagram**: IQ scatter plot for modulation
  analysis. Essential for ELINT classification (PSK, QAM, FSK
  identification).
- **Spectrogram**: Combined time-frequency-amplitude display with
  configurable color mapping and zoom controls.

### 19.3 SA Level 2: Comprehension via visx SVG Layer

The visx rendering layer (z:1) provides analytical comprehension — the
EMSO equivalent of SA Level 2. This layer MUST support:

- **Cross-source correlation graphs**: Network visualization showing
  relationships between signals from different adapters
- **Signal count timelines**: Time-series charts showing intercept rate
  evolution per source and per signal kind
- **Frequency distribution histograms**: Statistical distribution of
  intercepted frequencies, modulations, and power levels
- **EOB status matrix**: Grid display of known emitters with current
  status (active, inactive, new, changed)
- **Threat classification displays**: Color-coded threat assessment
  visualizations based on derived intelligence

### 19.4 SA Level 3: Projection via R3F 3D Layer

The R3F rendering layer (z:0) provides spatial projection — the EMSO
equivalent of SA Level 3. This layer SHOULD support:

- **Emitter positions on 3D terrain**: WebGL rendering of geolocated
  emitters overlaid on terrain data
- **Signal propagation modeling**: RF propagation visualization showing
  estimated coverage areas based on emitter parameters
- **Movement tracks**: Historical trajectories of mobile emitters
  derived from sequential geolocation fixes
- **Network topology**: 3D graph showing emitter-to-unit associations
  and communication network structure
- **Trend projection overlays**: Predicted future positions and
  activity patterns based on pattern-of-life analysis

### 19.5 Analyst Out-of-the-Loop Prevention

Per Endsley's out-of-the-loop research [ENDSLEY-OOTL], the system
MUST NOT replace the analyst's comprehension process entirely. Automated
processing supports but does not substitute for human judgment.

Implementations MUST:
- Present raw signal data alongside derived intelligence products
- Allow the analyst to drill from any SA Level 2/3 display into the
  underlying SA Level 1 data
- Provide confidence indicators on all automated classifications
- Support manual override of automated threat assessments
- Log all analyst-initiated corrections for feedback calibration

---

## 20. Cognitive Task Analysis for SIGINT Analysts

### 20.1 Rasmussen's SRK Framework Applied to SIGINT

Rasmussen's Skills-Rules-Knowledge (SRK) framework [RASMUSSEN-1983]
describes three levels of cognitive processing. Applied to the SIGINT
analyst task domain:

**Table 36-22: SRK Framework Applied to SIGINT Analysis**

| Level | Cognitive Mode | SIGINT Analyst Behavior | Tsingou Support |
|-------|---------------|------------------------|-----------------|
| **Skill-based** | Automatic, pattern recognition without conscious reasoning | Recognizing known emitter signatures, reading waterfall displays, identifying modulation types by visual pattern | p5 spectrum displays with familiar layout, alert sounds/indicators |
| **Rule-based** | Conditional: "if X then Y" pattern matching | "If frequency hopping detected → mark as military comms", "If new emitter in known frequency band → generate SOI alert" | d2ts anomaly rules, SchemaRegistry known-threat matching, configurable alert thresholds |
| **Knowledge-based** | First-principles reasoning for novel situations | Analyzing unknown signal characteristics, determining emitter purpose from spectral analysis, correlating disparate sources to identify new threat | d2ts join operators for cross-source analysis, R3F spatial visualization for pattern discovery, JetStream replay for historical comparison |

### 20.2 Decision Ladder in SIGINT Context

The Decision Ladder model [RASMUSSEN-1986] describes the cognitive
process from observation to action. Expert SIGINT analysts use
**shunts** (skipping intermediate steps) and **leaps** (jumping from
data to action) that the system MUST support:

- **Data → Action shunt**: Experienced analyst sees known threat pattern
  in waterfall, immediately generates alert without formal analysis.
  System MUST support direct annotation from p5 display to alert system.
- **Observation → Procedure leap**: Analyst observes anomaly, applies
  known procedure from training. System MUST provide procedure lookup
  from anomaly context.
- **Full ladder traversal**: Novel situation requiring complete analysis
  cycle. System MUST support unrestricted navigation across all four
  rendering layers without enforced workflow.

Implementations MUST NOT enforce sequential navigation workflows per the
Cognitive Work Analysis (CWA) formative design principle [CWA-VICENTE].

---

## 21. Intelligence Preparation of the Battlespace

### 21.1 IPB and the Electromagnetic Environment

Intelligence Preparation of the Battlespace (IPB) is the systematic,
continuous process of analyzing the threat and environment in a specific
geographic area [ATP2-01.3]. The battlespace includes the electromagnetic
spectrum as a distinct environment that requires analysis.

The EMS component of IPB includes:

1. **Define the electromagnetic environment**: Identify frequency bands
   in use, spectrum occupancy, interference sources, terrain effects on
   RF propagation
2. **Describe environmental effects on the EMS**: Atmospheric conditions,
   terrain masking, urban RF clutter, seasonal variations
3. **Evaluate the threat**: Known emitters (EOB), expected EA
   capabilities, adversary SIGINT capabilities, adversary EP posture
4. **Determine threat courses of action**: Likely EW actions, frequency
   management patterns, communication security measures

### 21.2 IPB Products from Tsingou

Tsingou's architecture supports generation of IPB products for the EMS
annex of operations orders (OPORD):

**Table 36-23: IPB Product Generation**

| IPB Product | Tsingou Generation Method | Rendering Layer |
|------------|-------------------------|----------------|
| Spectrum occupancy table | d2ts derived graph `count` + `reduce` by frequency band | visx histogram |
| EOB overlay | BaseSignal registry + geolocation data | R3F terrain overlay |
| Emitter density map | d2ts `window` + `count` by geographic grid cell | R3F heatmap |
| Communication network topology | d2ts `join` across COMINT intercepts | visx network graph |
| Frequency deconfliction chart | d2ts `reduce` by frequency + time block | visx gantt chart |
| Signal propagation estimate | Emitter parameters + terrain data → propagation model | R3F 3D visualization |

---

## 22. Recognized Electromagnetic Picture

### 22.1 REP Definition and Requirements

The Recognized Electromagnetic Picture (REP) is the EMS equivalent of
the Common Operating Picture (COP) [JP3-85]. It provides real-time
visualization of the electromagnetic environment to support commander
decision-making.

### 22.2 REP Composition from Tsingou Rendering Layers

```
┌──────────────────────────────────────────────────────┐
│            RECOGNIZED ELECTROMAGNETIC PICTURE          │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ DOM (z:3) — Analyst Workstation Controls          │  │
│  │  • Alert panels (threshold breach, new emitter)   │  │
│  │  • Session controls (adapter, graph parameters)   │  │
│  │  • Annotation overlay (analyst notes, markings)   │  │
│  │  • Status indicators (adapter health, proc load)  │  │
│  │  • Classification handling (TLP, CAPCO markers)   │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ p5 (z:2) — Real-Time Spectrum (SA Level 1)       │  │
│  │  • Waterfall display (freq x time x intensity)    │  │
│  │  • FFT magnitude plot (real-time spectrum)         │  │
│  │  • Signal constellation (modulation analysis)      │  │
│  │  • Spectrogram (scrolling time-frequency)          │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ visx (z:1) — Analytical Overlays (SA Level 2)    │  │
│  │  • Cross-source correlation graphs                 │  │
│  │  • Signal count timelines                          │  │
│  │  • Frequency distribution histograms               │  │
│  │  • EOB status matrix                               │  │
│  │  • Threat classification displays                  │  │
│  │  • Pattern-of-life timeline                        │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ R3F (z:0) — Spatial Visualization (SA Level 3)   │  │
│  │  • Emitter positions on 3D terrain                 │  │
│  │  • Signal propagation modeling                     │  │
│  │  • Movement tracks (historical trajectories)       │  │
│  │  • Network topology (emitter-unit associations)    │  │
│  │  • Trend projection overlays                       │  │
│  │  • RF propagation coverage estimates               │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### 22.3 REP Display Requirements

Per JP 3-85 and the DoD EMS Superiority Strategy, spectrum SA displays
MUST support the requirements in Table 36-24.

**Table 36-24: REP Display Requirements**

| Requirement | Layer | Implementation | Priority |
|------------|-------|----------------|----------|
| Frequency vs. time (spectrogram) | p5 | Waterfall display component | P1 |
| Frequency vs. amplitude (spectrum) | p5 | FFT magnitude plot | P1 |
| Geographic emitter overlay | R3F | Emitter positions on terrain | P1 |
| Temporal trending | visx | Time-series charts with rolling windows | P1 |
| Alerting on threshold breach | DOM | Alert atoms → framer-motion notifications | P1 |
| Emitter characterization display | visx + DOM | EOB data cards with spectral detail | P2 |
| Cross-source correlation | visx | Network graph showing relationships | P2 |
| Historical replay | All layers | JetStream replay → d2ts re-render | P2 |
| RF propagation modeling | R3F | Terrain-aware coverage estimation | P3 |
| Pattern-of-life display | visx | Temporal activity patterns | P3 |

---

## 23. Signal Metadata and Interoperability Standards

### 23.1 SigMF (Signal Metadata Format)

SigMF [SIGMF] is the standard file format for storing and organizing
digitized RF signals and corresponding metadata. Originated at the DARPA
Brussels Hackfest 2017 and now maintained by the GNU Radio Foundation,
SigMF provides interoperability between SDR tools and signal analysis
platforms.

SigMF metadata includes:

```json
{
  "global": {
    "core:datatype": "cf32_le",
    "core:sample_rate": 2400000,
    "core:hw": "RTL-SDR v4",
    "core:version": "1.0.0"
  },
  "captures": [
    {
      "core:sample_start": 0,
      "core:frequency": 433920000,
      "core:datetime": "2026-02-18T14:30:00Z"
    }
  ],
  "annotations": [
    {
      "core:sample_start": 0,
      "core:sample_count": 2400000,
      "core:label": "ISM Band 433MHz"
    }
  ]
}
```

### 23.2 SigMF Integration with Tsingou

Tsingou's SDR adapter pipeline (ADR-011 [ADR-011-SDR]) SHOULD support
SigMF metadata for IQ recording ingestion. The FileWatch adapter can
monitor directories for new `.sigmf-meta` + `.sigmf-data` file pairs and
ingest them as historical SDR signals.

SigMF metadata fields map to BaseSignal fields:

| SigMF Field | BaseSignal/SdrSignal Mapping |
|------------|---------------------------|
| `core:sample_rate` | `SdrSignal.payload.sampleRate` |
| `core:frequency` | `SdrSignal.payload.frequency` |
| `core:hw` | `SdrSignal.payload.deviceType` |
| `core:datetime` | `BaseSignal.timestamp` |
| `core:datatype` | `metadata.sigmf.datatype` |
| Annotation `core:label` | `metadata.sigmf.label` |

### 23.3 MISP Integration

MISP (Malware Information Sharing Platform) supports SigMF as a data
format [MISP-SIGMF], enabling the exchange of RF signal recordings
through established threat intelligence sharing infrastructure. Tsingou's
STIX/TAXII export pipeline SHOULD support SigMF-annotated signal data
as STIX observed-data objects, enabling RF intelligence sharing through
MISP-compatible channels.

---

## 24. AOC-Relevant Use Cases

### 24.1 Use Case 1: EW Training and Spectrum Awareness

**Persona**: EW training officer at Fort Eisenhower CCoE
**Doctrinal alignment**: DoD EMS Strategy G3 (readiness), FM 3-12 CEMA
training requirements

**Scenario**: Conduct a classroom exercise where students monitor a
simulated electromagnetic environment, identify emitters, and produce
an EOB.

**Tsingou workflow**:

1. **Direction**: Configure session with simulated adapter sources
   (NATS subjects carrying pre-recorded signal data from JetStream).
   Load training scenario session config from template library.
2. **Collection**: NatsAdapter ingests simulated signals from training
   scenario. Multiple signal types (COMINT, ELINT, FISINT) provide
   realistic multi-INT environment.
3. **Processing**: d2ts ingest graph normalizes and validates signals
   against training scenario schemas.
4. **Exploitation**: Students use visx analytical overlays to correlate
   signals, identify emitter types, and build EOB entries. R3F terrain
   overlay shows geolocated emitters.
5. **Dissemination**: Students export STIX bundles as training products.
   Instructor reviews submissions against ground truth.
6. **Feedback**: Instructor reviews accuracy metrics. System calculates
   detection rate, false positive rate, and classification accuracy per
   student. Adjusts scenario parameters for next iteration.

### 24.2 Use Case 2: Tactical SIGINT Analysis

**Persona**: SIGINT analyst at a brigade CEMA cell
**Doctrinal alignment**: ES pillar, TPED cycle, FM 3-12 CEMA cell
workflow, EMBM dynamic monitoring

**Scenario**: Monitor real-time SDR collection from multiple RTL-SDR
receivers deployed in an exercise area, correlate with OSINT feeds,
produce tactical intelligence products.

**Tsingou workflow**:

1. **Direction**: Configure SDR adapters for exercise frequency bands
   (VHF: 30-300 MHz, UHF: 300-3000 MHz). Enable RSS/HTTP adapters for
   OSINT context (news feeds, social media APIs).
2. **Collection**: SDR sidecar → GNU Radio (demodulation, decoding) →
   NATS publish → Tsingou NatsAdapter. HTTP adapter polls OSINT APIs
   on configurable intervals.
3. **Processing**: d2ts ingest validates against SDR and HTTP signal
   schemas, enriches with source metadata and timestamps.
4. **Exploitation**: d2ts derived graph correlates SDR intercepts with
   OSINT data using `join` operator. Temporal `window` operator tracks
   emitter patterns of life over 30-minute sliding windows.
5. **Dissemination**: Alerts via DOM layer for new emitters detected.
   R3F displays geolocated emitter positions with confidence ellipses.
   visx shows cross-source correlation network.
6. **Feedback**: Analyst adjusts SDR center frequencies based on initial
   findings. Narrows analysis parameters. Flags false positives for
   threshold calibration.

### 24.3 Use Case 3: Threat Library Maintenance

**Persona**: EW intelligence analyst maintaining unit threat database
**Doctrinal alignment**: EWIR processes, EWIRDB maintenance, rapid
reprogramming (Ukraine lessons)

**Scenario**: Process new emitter characterization data from
national-level intelligence, update local threat library, validate
against collected signals.

**Tsingou workflow**:

1. **Ingest**: Receive updated emitter parameters via STIX/TAXII feed
   from national intelligence source.
2. **Update**: SchemaRegistry receives new/updated signal schemas via
   NATS KV put. Watch notification propagates to all consumers.
3. **Validate**: d2ts derived graph replays last 72 hours of historical
   signals from JetStream against updated schemas.
4. **Detect**: Anomaly operators flag signals that match new threat
   parameters but were previously classified as "unknown" or
   "unassociated."
5. **Report**: Generate STIX indicators for newly identified threats.
   Export via TAXII for distribution to partner units.

### 24.4 Use Case 4: CEMA Planning Support

**Persona**: CEMA planner at division operations center
**Doctrinal alignment**: CEMA cell MDMP integration, JEMSOC planning,
MDO convergence requirements, IPB

**Scenario**: Develop the EMS annex for a division OPORD by analyzing
the electromagnetic environment in the area of operations.

**Tsingou workflow**:

1. **Ingest**: Pull existing EOB data, OSINT, and historical collection
   from JetStream. Import national-level EMS assessment products via
   STIX/TAXII.
2. **Analyze**: d2ts derived graph produces spectrum occupancy analysis,
   emitter density maps, and communication network topology from
   historical data.
3. **Visualize**: R3F 3D terrain overlay shows emitter positions and
   estimated propagation ranges. visx shows frequency allocation charts
   for deconfliction. p5 shows spectrum occupancy waterfall for the AO.
4. **Export**: Generate EMS annex products — spectrum occupancy tables,
   EOB summaries, frequency deconfliction recommendations. Export as
   STIX bundle and formatted report.

---

## 25. Normative Requirements Derived from Doctrine

The following normative requirements are derived from the doctrinal
frameworks analyzed in this section. Each requirement traces to a
specific doctrine source and is assigned a priority level.

### 25.1 Collection Requirements

**Table 36-25: Collection Requirements**

| ID | Requirement | Source | Priority |
|----|-----------|--------|----------|
| EW-C1 | The system MUST support simultaneous collection from multiple signal source types | [JP3-85] ES definition | P1 |
| EW-C2 | The system MUST support hot-plug addition and removal of collection assets at runtime without system restart | [FM3-12] CEMA sensor integration | P1 |
| EW-C3 | The system SHOULD support SDR hardware integration via sidecar architecture with GNU Radio bridge | [JP3-85] ES collection, [ADR-011] | P2 |
| EW-C4 | The system SHOULD support STIX/TAXII ingestion as a collection source for threat intelligence feeds | [JP3-85] SIGINT distribution | P2 |
| EW-C5 | The system MUST support configurable data retention periods per session reflecting applicable legal authority | [JP3-85] ES/SIGINT distinction | P1 |
| EW-C6 | The system SHOULD support SigMF metadata for IQ recording ingestion | [SIGMF] interoperability | P3 |

### 25.2 Processing Requirements

**Table 36-26: Processing Requirements**

| ID | Requirement | Source | Priority |
|----|-----------|--------|----------|
| EW-P1 | The system MUST validate all incoming signals against registered schemas before exploitation | [JP3-85] TPED Processing | P1 |
| EW-P2 | The system MUST normalize signals to a common format (BaseSignal) before exploitation | [JP3-85] TPED Processing | P1 |
| EW-P3 | The system MUST maintain a runtime-updateable schema registry (threat library) | [EWIRDB] EWIR process | P1 |
| EW-P4 | The system MUST support schema change notification for downstream consumers via watch mechanism | [EWIRDB] Change Detection | P1 |
| EW-P5 | Invalid signals MUST be logged but MUST NOT propagate to the exploitation phase | [JP3-85] TPED quality | P1 |
| EW-P6 | The system SHOULD normalize all timestamps to UTC | [JP3-85] multi-source correlation | P2 |

### 25.3 Exploitation Requirements

**Table 36-27: Exploitation Requirements**

| ID | Requirement | Source | Priority |
|----|-----------|--------|----------|
| EW-E1 | The system MUST support cross-source correlation (join) across signal types | [JP3-85] ES exploitation | P1 |
| EW-E2 | The system MUST support temporal windowing for pattern analysis | [JP3-85] ES exploitation | P1 |
| EW-E3 | The system MUST support anomaly detection against established baselines | [EMS-STRAT] EMBM adaptive | P1 |
| EW-E4 | The system MUST support incremental computation for real-time exploitation | [EMS-STRAT] machine-speed | P1 |
| EW-E5 | The system SHOULD support historical replay for retrospective analysis | [JP3-85] SIGINT analysis | P2 |
| EW-E6 | The system SHOULD compute confidence scores for all derived intelligence | [JP3-85] intelligence production | P2 |
| EW-E7 | The system SHOULD support pattern-of-life analysis via extended temporal windowing | [JP3-85] SIGINT | P2 |
| EW-E8 | The system SHOULD support frequency hopping detection for military communications | [FM3-12] CEMA | P3 |

### 25.4 Dissemination Requirements

**Table 36-28: Dissemination Requirements**

| ID | Requirement | Source | Priority |
|----|-----------|--------|----------|
| EW-D1 | The system MUST display intelligence products through a multi-modal rendering system supporting all three Endsley SA levels | [JP3-85], [ENDSLEY-1995] | P1 |
| EW-D2 | The system MUST support real-time alerting on threshold breaches with sub-second latency | [EMS-STRAT] EMBM real-time | P1 |
| EW-D3 | The system SHOULD support STIX 2.1 export for intelligence sharing with partner organizations | [JP3-85] SIGINT distribution | P2 |
| EW-D4 | The system SHOULD support NATS-based internal distribution of intelligence products | [FM3-12] CEMA coordination | P2 |
| EW-D5 | The system SHOULD support REP generation as a composite of all four rendering layers | [JP3-85] SA display | P2 |

### 25.5 Situational Awareness Requirements

**Table 36-29: Situational Awareness Requirements**

| ID | Requirement | Source | Priority |
|----|-----------|--------|----------|
| EW-SA1 | The system MUST support SA Level 1 (Perception) through real-time spectrum displays in the p5 rendering layer | [ENDSLEY-1995], [JP3-85] | P1 |
| EW-SA2 | The system MUST support SA Level 2 (Comprehension) through correlation and classification displays in the visx rendering layer | [ENDSLEY-1995], [JP3-85] | P1 |
| EW-SA3 | The system SHOULD support SA Level 3 (Projection) through trend analysis and spatial visualization in the R3F rendering layer | [ENDSLEY-1995], [EMS-STRAT] | P2 |
| EW-SA4 | The system MUST NOT allow automated processing to replace the analyst's comprehension process entirely | [ENDSLEY-OOTL] | P1 |
| EW-SA5 | The system MUST support drill-down from SA Level 2/3 displays to underlying SA Level 1 data | [CWA-VICENTE] formative | P1 |
| EW-SA6 | The system MUST NOT enforce sequential navigation workflows between SA levels | [RASMUSSEN-1986] Decision Ladder | P1 |

### 25.6 Training and Simulation Requirements

**Table 36-30: Training Requirements**

| ID | Requirement | Source | Priority |
|----|-----------|--------|----------|
| EW-T1 | The system SHOULD support scenario replay from historical data via JetStream | [EMS-STRAT] Goal 3 | P2 |
| EW-T2 | The system SHOULD support simulated signal injection for training scenarios via NATS subjects | [FM3-12] CEMA training | P3 |
| EW-T3 | The system MAY support distributed multi-station training exercises via NATS fabric | [EMS-STRAT] Goal 4 | P3 |
| EW-T4 | The system SHOULD support training scenario templating via Session Configuration schemas | [FM3-12] CEMA training | P3 |

### 25.7 Interoperability Requirements

**Table 36-31: Interoperability Requirements**

| ID | Requirement | Source | Priority |
|----|-----------|--------|----------|
| EW-I1 | The system SHOULD support SigMF metadata for SDR recording interoperability | [SIGMF] | P2 |
| EW-I2 | The system SHOULD support STIX/TAXII bidirectional exchange with partner platforms | [JP3-85] SIGINT sharing | P2 |
| EW-I3 | The system SHOULD support MISP-compatible RF signal data objects | [MISP-SIGMF] | P3 |
| EW-I4 | The system MAY support NATS-based federation with partner Tsingou instances | [FM3-12] CEMA coordination | P3 |

---

## 26. Open Questions and Doctrinal Gaps

### 26.1 Unresolved Alignment Issues

1. **Emission deconfliction**: EMSO doctrine requires spectrum
   deconfliction between friendly and adversary emissions. Tsingou
   currently has no model for friendly emission scheduling or EMCON
   compliance monitoring. The Session Configuration SHOULD include
   JRFL (Joint Restricted Frequency List) integration in a future
   iteration.

2. **EA simulation**: Tsingou is a passive ES platform. It does not
   simulate or model EA effects (jamming, deception). For EW training
   use cases, the ability to inject simulated EA effects into the
   signal environment would increase training realism. This MAY be
   addressed through a dedicated training scenario adapter.

3. **Classification handling**: EMSO operations involve classified
   data at multiple security levels. Tsingou's current architecture
   does not include formal classification marking, handling, or
   cross-domain solution integration. Future iterations SHOULD support
   Traffic Light Protocol (TLP) marking at minimum.

4. **OPSEC and EMSEC**: Tsingou's own RF emissions (when operating
   with SDR hardware) could be detectable by adversary ES systems.
   The system SHOULD include guidance on EMSEC considerations for
   operational deployments.

5. **Alliance interoperability**: NATO STANAG standards and Five Eyes
   intelligence sharing agreements define specific data formats and
   handling procedures that are not currently addressed.

### 26.2 Empirical Validation Required

1. **SA level effectiveness**: The mapping of rendering layers to
   Endsley SA levels (Table 36-21) is theoretically grounded but
   untested. User studies with experienced SIGINT analysts SHOULD
   validate this mapping.

2. **Alert latency budgets**: The sub-second ES mode latency budget
   is derived from doctrine but has not been validated against Tsingou's
   actual processing pipeline. Performance testing MUST establish
   baseline latency under realistic signal loads.

3. **Cross-source correlation effectiveness**: The d2ts `join` operator
   for cross-subdiscipline correlation is architecturally capable but
   has not been validated with realistic multi-INT data. Evaluation
   scenarios SHOULD include ground-truth data for accuracy measurement.

---

## 27. Bibliography

### 27.1 Primary Doctrine Sources

| Key | Citation |
|-----|---------|
| [JP3-85] | Joint Chiefs of Staff. Joint Publication 3-85: Joint Electromagnetic Spectrum Operations. 22 May 2020. |
| [FM3-12] | Department of the Army. FM 3-12: Cyberspace Operations and Electromagnetic Warfare. August 2021. |
| [FM3-38] | Department of the Army. FM 3-38: Cyber Electromagnetic Activities. 2014. |
| [AFDP3-85] | Department of the Air Force. AFDP 3-85: Electromagnetic Spectrum Operations. December 2023. |
| [EMS-STRAT] | Department of Defense. Electromagnetic Spectrum Superiority Strategy. October 2020. |
| [ATP2-01.3] | Department of the Army. ATP 2-01.3: Intelligence Preparation of the Battlespace. March 2019. |

### 27.2 Organizational Sources

| Key | Citation |
|-----|---------|
| [AOC] | Association of Old Crows. Mission & History. https://crows.org/mission-and-history/ |
| [JED] | Journal of Electromagnetic Dominance. Association of Old Crows. https://www.jedonline.com/ |
| [CCOE] | U.S. Army Cyber Center of Excellence. https://cybercoe.army.mil/ |
| [JEC-STRATCOM] | U.S. Strategic Command. Joint Electromagnetic Spectrum Operations Center. July 2023. |
| [CEMA-2024] | Association of Old Crows. CEMA 2024 Conference. Aberdeen Proving Ground. April-May 2024. |

### 27.3 Technical Sources

| Key | Citation |
|-----|---------|
| [EWIRDB] | Electronic Warfare Integrated Reprogramming Database. GlobalSecurity.org. |
| [CRFS-DF] | CRFS. Radio Direction Finding Techniques and Applications for EW and SIGINT. |
| [SISO-2023] | SISO. Establishing EOB Requirements for Division Planning. 2023 SIW. |
| [GLOBALSEC-TPED] | GlobalSecurity.org. Tasking, Processing, Exploitation & Dissemination. |
| [DEFSCOOP-EWIR] | DefenseScoop. Army EW Data Pilot for Rapid Reprogramming. May 2024. |
| [ARMY-EWPMT] | U.S. Army. 4ID Soldiers Test New EW Spectrum Management Tool. |
| [ARMY-MDEP] | U.S. Army. Multi-Domain Effects Platoon: Brigade-Level MDO Solution. |
| [EMSOPEDIA] | EMSOPEDIA. Electromagnetic Spectrum Operations. |
| [SIGMF] | SigMF. Signal Metadata Format Specification. https://sigmf.org/ |
| [MISP-SIGMF] | MISP Project. SigMF Support Announcement. August 2023. |
| [DISA-EMBM] | The Defense Post. DISA Orders EMBM Prototype from Palantir. April 2024. |
| [PALANTIR] | Palantir Technologies. Gotham Platform. https://www.palantir.com/platforms/gotham/ |

### 27.4 Theoretical Sources

| Key | Citation |
|-----|---------|
| [ENDSLEY-1995] | Endsley, M.R. Toward a Theory of Situation Awareness in Dynamic Systems. Human Factors, 37(1), 32-64. 1995. |
| [ENDSLEY-OOTL] | Endsley, M.R. and Kiris, E.O. The Out-of-the-Loop Performance Problem. Human Factors, 37(2), 381-394. 1995. |
| [RASMUSSEN-1983] | Rasmussen, J. Skills, Rules, and Knowledge: Signals, Signs, and Symbols. IEEE SMC-13(3), 257-266. 1983. |
| [RASMUSSEN-1986] | Rasmussen, J. Information Processing and Human-Machine Interaction. North-Holland. 1986. |
| [CWA-VICENTE] | Vicente, K.J. Cognitive Work Analysis. Lawrence Erlbaum Associates. 1999. |
| [MDO-WIKI] | Multi-Domain Operations. Wikipedia. |
| [JADC2-AFCEA] | AFCEA. Joint EW, Cyber and Spectrum Operations Need Work. |

### 27.5 Tsingou Internal References

| Document | Location | Relevance |
|----------|----------|-----------|
| System Specification | `docs/tsingou/SPEC.md` | Platform overview, architecture |
| Flow Architecture | `docs/tsingou/FLOW_ARCHITECTURE.md` | d2ts pipeline, signal schema |
| ADR-010 | `docs/tsingou/adr/ADR-010-full-intelligence-cycle.md` | Intelligence Cycle |
| ADR-011 | `docs/tsingou/adr/ADR-011-sdr-gnu-radio-bridge.md` | SDR integration |
| Theoretical Foundations | `docs/specifications/rfc-section-theoretical-foundations.md` | SA, cognitive science |
| EW Doctrine Research | `docs/tsingou/research/research-ew-doctrine.md` | Raw research base |

### 27.6 Normative References

| Key | Citation |
|-----|---------|
| [RFC2119] | Bradner, S. Key words for use in RFCs to Indicate Requirement Levels. BCP 14. March 1997. |
| [RFC8174] | Leiba, B. Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words. BCP 14. May 2017. |

---

<!-- INTEGRATION NOTES

Section dependencies:
- TSG.36 depends on: TSG.TF (theoretical foundations, Endsley SA model)
- TSG.36 is referenced by: TSG.2/TSG.3 (SIGINT domain), TSG.16-19 (SDR)
- TSG.36 cross-references: ADR-010, ADR-011, FLOW_ARCHITECTURE.md

Table numbering: 36-1 through 36-31 (31 tables)
Figure numbering: 36-1 through 36-4 (ASCII diagrams)

Requirement IDs: EW-C1 through EW-C6, EW-P1 through EW-P6,
EW-E1 through EW-E8, EW-D1 through EW-D5, EW-SA1 through EW-SA6,
EW-T1 through EW-T4, EW-I1 through EW-I4
Total normative requirements: 35

Voice: passive technical throughout per style guide
Citations: [KEY] format, collected in Section 27
-->
