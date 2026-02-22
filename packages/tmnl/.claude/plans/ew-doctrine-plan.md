# EW Doctrine Advisor — Plan

## Deliverables

1. `docs/tsingou/research/research-ew-doctrine.md` — Raw research findings
2. `docs/tsingou/rfc/rfc-section-ew-doctrine.md` — Formal RFC section (TSG.EW)

## RFC Section Structure (TSG.EW)

### TSG.EW.1 — Introduction and Scope
- Purpose: ground Tsingou in professional EW/SIGINT doctrine
- Audience: AOC members, DoD/IC EW practitioners

### TSG.EW.2 — EMSO Doctrinal Framework
- JP 3-85 overview
- Three pillars: EA, EP, ES
- ES as the SIGINT-relevant pillar
- EMOE: congested, contested, constrained
- DoD EMS Superiority Strategy 2020

### TSG.EW.3 — CEMA Integration Framework
- FM 3-12 / FM 3-38 overview
- CEMA = CO + EW + SMO
- CEMA cell structure
- MDMP integration
- MDO and LSCO context

### TSG.EW.4 — TPED Processing Chain Mapping
- Tasking → Processing → Exploitation → Dissemination
- Map each TPED phase to Tsingou subsystem
- Intelligence Cycle (6-phase) alignment with ADR-010

### TSG.EW.5 — Doctrine-to-Architecture Mapping Table
- EOB → BaseSignal + SchemaRegistry
- EMBM → d2ts derived graph + OutputBridge
- JEMSOC → Session configuration (Direction phase)
- DF/TDOA/FDOA → SDR adapter + geolocation operators
- EWIRDB → SchemaRegistry (threat library)
- Spectrum awareness → 4-layer rendering

### TSG.EW.6 — Terminology Alignment Guide
- Professional EW/SIGINT terms → Tsingou equivalents
- AOC/JED vocabulary integration

### TSG.EW.7 — Four-Layer Rendering and EMSO SA
- How 4-layer rendering maps to Endsley SA levels
- Spectrum visualization (p5 waterfall) as Level 1
- Correlation displays (visx) as Level 2
- Trend/projection (R3F) as Level 3
- Controls/annotation (DOM) as analyst workstation

### TSG.EW.8 — AOC-Relevant Use Cases
- EW training and simulation
- Spectrum awareness and monitoring
- Threat analysis and EOB maintenance
- CEMA planning support

### TSG.EW.9 — References

## Research Sources
- JP 3-85 (Joint Electromagnetic Spectrum Operations)
- FM 3-12 (Cyberspace Operations and EW)
- FM 3-38 (Cyber Electromagnetic Activities)
- DoD EMS Superiority Strategy 2020
- AFDP 3-85 (Air Force EMS Ops)
- AOC publications and JED
- EWIRDB documentation
- CEMA 2024 conference proceedings
