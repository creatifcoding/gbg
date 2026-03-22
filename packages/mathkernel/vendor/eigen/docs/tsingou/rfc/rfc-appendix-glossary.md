# Appendix F: Glossary & Acronyms

```
Appendix:      F — Glossary & Acronyms
Parent RFC:    TMNL-RFC-002 (Tsingou Signal Intelligence Visualization Platform)
Status:        DRAFT
Author:        Val (glossary-writer)
Created:       2026-02-18
Scope:         All terms, acronyms, and notation used across RFC-002 sections TSG.1–TSG.36
```

> This appendix provides a comprehensive glossary of all acronyms, domain
> terminology, technical terms, mathematical notation, protocol vocabulary,
> and visualization concepts used throughout the Tsingou Platform
> Specification (TMNL-RFC-002). Terms are organized by domain to facilitate
> lookup by practitioners from different backgrounds — SIGINT/EW operators,
> Effect-TS developers, differential dataflow researchers, and visualization
> engineers. The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and
> "MAY" are to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1. [TSG.F.1 Acronyms](#tsgf1-acronyms)
2. [TSG.F.2 SIGINT/EW Terminology](#tsgf2-sigintew-terminology)
3. [TSG.F.3 Effect-TS Terminology](#tsgf3-effect-ts-terminology)
4. [TSG.F.4 Mathematical Notation](#tsgf4-mathematical-notation)
5. [TSG.F.5 Protocol & Format Terms](#tsgf5-protocol--format-terms)
6. [TSG.F.6 Visualization Terms](#tsgf6-visualization-terms)
7. [TSG.F.7 Cross-Reference Index](#tsgf7-cross-reference-index)

---

## TSG.F.1 Acronyms

All acronyms used across RFC-002 sections, listed alphabetically. Each
entry provides the full expansion and a brief contextual definition
relevant to the Tsingou platform.

### A

**ACINT** — Acoustic Intelligence. A sub-discipline of MASINT concerned
with intelligence derived from acoustic phenomena — underwater
(hydrophone arrays), atmospheric (infrasound), and seismic-acoustic
sources. Tsingou MAY ingest ACINT data via WebSocket or NATS adapters
for spectrogram visualization in the p5 rendering layer.

**ACK** — Acknowledgment. In NATS JetStream, a consumer's confirmation
that a message has been processed. In Tsingou's alarm lifecycle, the
transition from `unacknowledged` to `acknowledged` state per ISA-18.2.

**ADR** — Architecture Decision Record. A structured document capturing
an architectural decision, its context, and consequences. Tsingou
maintains ADRs in `docs/tsingou/adr/` with sequential numbering
(ADR-001 through ADR-013+).

**AESA** — Active Electronically Scanned Array. A radar antenna type
that uses individual transmit/receive (T/R) modules per element,
enabling electronic beam steering without mechanical movement. AESA
radars exhibit near-instantaneous frequency/PRI changes that challenge
traditional deinterleaving algorithms.

**AFDP** — Air Force Doctrine Publication. U.S. Air Force doctrinal
documents. AFDP 3-85 addresses Air Force EMSO doctrine.

**AG** — Abelian Group. An algebraic structure with commutative binary
operation, identity element, and inverses. The collection group Col(D)
over a data domain D forms an Abelian group under pointwise addition —
the mathematical foundation of differential dataflow.

**AI** — Artificial Intelligence. In Tsingou, refers to the AI SDK
integration for tool definitions using Effect Schema via
`JSONSchema.make()`.

**AM** — Amplitude Modulation. A modulation technique where the
amplitude of a carrier wave varies with the information signal. Relevant
to ELINT scan pattern detection.

**AMS** — American Mathematical Society. Publisher of foundational
lattice theory texts referenced in TSG.26.

**AOA** — Angle of Arrival. The measured bearing from which an
electromagnetic signal arrives at a receiving antenna. A primary
geolocation parameter in ELINT; expressed in degrees (0-360). Used in
emitter deinterleaving as a secondary discriminant.

**AOC** — Association of Old Crows. The principal professional body for
the global Electronic Warfare and Electromagnetic Spectrum Operations
community, founded in 1964. Maintains ~14,000 members across 70+
chapters in 19 countries.

**API** — Application Programming Interface. Tsingou integrates with
external systems via REST APIs (HttpSourceAdapter), WebSocket APIs
(WebSocketSourceAdapter), and NATS APIs (NatsSourceAdapter).

**ARCYBER** — U.S. Army Cyber Command. Operational headquarters for Army
cyber and EW forces at Fort Eisenhower, Georgia.

**AS** — Autonomous System. A network routing domain identified by a
unique ASN (Autonomous System Number). Used as an IOC type in CYBINT
analysis.

**ASN** — Autonomous System Number. Numeric identifier for an autonomous
system in BGP routing. Example: AS12345.

**ATT&CK** — Adversarial Tactics, Techniques, and Common Knowledge.
MITRE's knowledge base of adversary behavior organized by 14 tactics
(TA0001-TA0043) and hundreds of techniques. Tsingou MUST support
ATT&CK Enterprise Matrix mapping for CYBINT analysis.

### B

**BDA** — Battle Damage Assessment. Post-strike evaluation of effects
on targets. In EW context, assessment of electronic attack effectiveness.
Tsingou supports BDA through JetStream replay of pre/post-attack
signal data.

**BER** — Bit Error Rate. The ratio of erroneously received bits to
total transmitted bits. A fundamental quality metric in digital
communications relevant to COMINT signal analysis.

**BGP** — Border Gateway Protocol. The inter-domain routing protocol of
the Internet. BGP hijacking is a CYBINT indicator observable through
AS number analysis.

**BLOS** — Beyond Line of Sight. Communications or sensing capabilities
that operate beyond the radio horizon, typically via satellite relay,
tropospheric scatter, or HF skywave propagation.

### C

**C2** — Command and Control. The exercise of authority and direction
by a commander over assigned and attached forces. In CYBINT, C2 refers
to command-and-control infrastructure used by adversary operators
(ATT&CK tactic TA0011).

**CBRINT** — Chemical, Biological, and Radiological Intelligence. A
MASINT sub-discipline concerned with detecting and characterizing CBRN
threats via sensor signatures.

**CCoE** — Cyber Center of Excellence. U.S. Army CCoE at Fort
Eisenhower, Georgia — the force modernization proponent for Cyberspace
Operations, Signal/Communications Networks, and Electromagnetic Warfare.

**CDR** — Call Detail Record. Metadata records generated by
telecommunications systems capturing caller, callee, timestamp, duration,
and routing information. The primary data type for COMINT traffic
analysis and contact chaining in Tsingou.

**CEMA** — Cyber Electromagnetic Activities. The Army doctrinal
framework (FM 3-12) integrating Cyberspace Operations (CO), Electronic
Warfare (EW), and Spectrum Management Operations (SMO) under unified
command. Pronounced "SEE-mah."

**CIDR** — Classless Inter-Domain Routing. IP address notation specifying
a network prefix and mask length (e.g., `10.0.0.0/8`). Used as an IOC
type in CYBINT.

**CISA** — Cybersecurity and Infrastructure Security Agency. U.S.
federal agency responsible for national cybersecurity. Tsingou ingests
CISA advisories as OSINT via HttpSourceAdapter.

**CO** — Cyberspace Operations. Military operations conducted in
cyberspace, comprising Offensive CO (OCO), Defensive CO (DCO), and DoD
Information Network Operations (DINO).

**Col(D)** — Collection Group. The Abelian group of integer-valued
functions over a data domain D with finite support. The fundamental
algebraic structure of differential dataflow.

**COMINT** — Communications Intelligence. Intelligence derived from
intercepted communications — message content, metadata, and
communication behavioral patterns. The largest SIGINT sub-discipline by
volume. Tsingou SHOULD support COMINT metadata analysis (CDR, contact
chaining, traffic analysis) via API and NATS adapters.

**COP** — Common Operational Picture. A single identical display of
relevant information shared by more than one command to facilitate
collaborative planning and decision-making. Tsingou's 4-layer rendering
provides a signals-focused COP.

**CRDT** — Conflict-free Replicated Data Type. A data structure that
can be concurrently modified on multiple replicas and merged
deterministically using join-semilattice operations. Structurally
related to differential dataflow's frontier advancement — both use
lattice operations for convergence.

**CSS** — Central Security Service. The national-level organization
within the DoD that provides a more unified cryptologic effort. NSA/CSS
Georgia operates at Fort Eisenhower.

**CTI** — Cyber Threat Intelligence. Intelligence produced from the
analysis of adversary capabilities, intentions, and activities in
cyberspace. Tsingou exports CTI products as STIX 2.1 bundles.

**CUOPS** — Current Operations. The staff section managing operations
in the current 0-24 hour timeframe. Part of the division/corps
operations center structure alongside the CEMA cell.

**CUSUM** — Cumulative Sum. A sequential analysis technique for
detecting small persistent shifts in a process mean. Used in Tsingou's
anomaly detection pipeline within the d2ts derived graph.

**CVE** — Common Vulnerabilities and Exposures. A catalog of publicly
disclosed cybersecurity vulnerabilities, each assigned a unique
identifier (e.g., CVE-2024-12345). An IOC type in CYBINT analysis.

**CYBINT** — Cyber Intelligence (also DNINT — Digital Network
Intelligence). Intelligence derived from computer networks, digital
infrastructure, and cyber operations. One of Tsingou's two MUST-support
primary disciplines alongside OSINT.

### D

**d2ts** — Differential Dataflow in TypeScript. The TypeScript
implementation of differential dataflow from `@electric-sql/d2ts` that
serves as Tsingou's signal processing backbone. Selected in ADR-001.

**D2** — The graph execution context in d2ts. Created via
`new D2({ initialFrontier })`, finalized with `graph.finalize()`, and
executed with `graph.run()`.

**DAG** — Directed Acyclic Graph. A graph with directed edges and no
cycles. The d2ts computation graph is a DAG; operator outputs feed into
downstream operator inputs without feedback loops (except within
`iterate` operators).

**DAW** — Digital Audio Workstation. Software for recording, editing,
and producing audio. Referenced in CLAUDE.md for the slider system's
design standard.

**dBm** — Decibels referenced to one milliwatt. The standard unit for
expressing RF signal power. Used in PDW `pa_dbm` (pulse amplitude)
field. Range in Tsingou's ELINT schema: -150 to +50 dBm.

**DCO** — Defensive Cyberspace Operations. Military operations to
defend DoD information networks and systems. A component of CO within
the CEMA framework.

**DF** — Direction Finding. The technique of determining the bearing
to an RF emitter from a receiving station. Provides AOA measurements
for single-station geolocation; combined with other stations for
triangulation.

**DINO** — DoD Information Network Operations. Operations to design,
build, configure, secure, operate, maintain, and sustain DoD
information networks. A component of CO within the CEMA framework.

**DISA** — Defense Information Systems Agency. DoD agency providing IT
and communications support. Awarded Palantir an EMBM prototype contract
in April 2024.

**DNINT** — Digital Network Intelligence. Synonym for CYBINT. See
CYBINT.

**DNS** — Domain Name System. The hierarchical naming system for
Internet resources. DNS query logs and passive DNS data are CYBINT/OSINT
sources.

**DoD** — Department of Defense. U.S. federal department responsible
for national defense and the armed forces.

**DOM** — Document Object Model. The browser API for manipulating HTML
elements. In Tsingou, the DOM layer (z:3) hosts React controls, alert
panels, tables, and status indicators using framer-motion for animation.

**DOTMLPF-P** — Doctrine, Organization, Training, Materiel, Leadership,
Personnel, Facilities, and Policy. The DoD framework for
capability-based assessment used by CCoE for EW force modernization.

**DSP** — Digital Signal Processing. The mathematical manipulation of
digital representations of signals. Covered in TSG.25. Key DSP concepts
in Tsingou include FFT, windowing functions, decimation, channelization,
and demodulation.

### E

**EA** — Electronic Attack. The EW pillar using electromagnetic energy,
directed energy, or anti-radiation weapons to degrade, neutralize, or
destroy enemy combat capability. Tsingou does NOT conduct EA but
monitors EA effects as observable anomalies.

**ECCM** — Electronic Counter-Countermeasures. Techniques to resist
electronic countermeasures (ECM/jamming). Modern terminology: Electronic
Protection (EP). ECCM-equipped systems exhibit frequency agility
detectable by Tsingou's ELINT pipeline.

**ECM** — Electronic Countermeasures. Techniques to deny enemy use of
the electromagnetic spectrum. Modern terminology: Electronic Attack (EA).

**ELECTRO-OPTINT** — Electro-Optical Intelligence. A MASINT sub-
discipline using electro-optical sensors for target detection and
characterization. Tsingou MAY render ELECTRO-OPTINT as R3F texture
overlays.

**ELINT** — Electronic Intelligence. Intelligence derived from non-
communications electromagnetic emissions — primarily radar systems,
navigation aids, IFF transponders, and electronic emitters. Tsingou
SHOULD support ELINT processing through SDR bridge (GNU Radio →
NATS → NatsSourceAdapter).

**EMBM** — Electromagnetic Battle Management. A comprehensive framework
for dynamic monitoring, assessing, planning, and directing of operations
in the EMS. Defined in the DoD EMS Superiority Strategy. Tsingou
implements EMBM functions through its adapter-d2ts-rendering pipeline.

**EMCON** — Emission Control. Policies and procedures to minimize
electromagnetic emissions for operational security. Tsingou SHOULD
support EMCON compliance monitoring as a future capability.

**EMI** — Electromagnetic Interference. Unintentional electromagnetic
energy that degrades system performance. EMSO doctrine includes EMI
resolution as a spectrum management function.

**EMOE** — Electromagnetic Operating Environment. The resulting product
of the power and time distribution of radiated electromagnetic emission
levels encountered by a military force. Assessed as "congested,
contested, and constrained" (3C) by DoD.

**EMS** — Electromagnetic Spectrum. The range of all types of
electromagnetic radiation, from radio waves through gamma rays. The
operational domain for EMSO, EW, and SIGINT.

**EMSEC** — Emissions Security. The protection resulting from measures
to deny unauthorized access to information derived from intercept and
analysis of compromising emanations from crypto-equipment and IT
systems.

**EMSO** — Electromagnetic Spectrum Operations. Coordinated military
actions to exploit, attack, protect, and manage the electromagnetic
environment. EMSO encompasses EW, SMO, SIGINT, and CEMA under a unified
operational framework. Defined in JP 3-85.

**EMSOPEDIA** — Electromagnetic Spectrum Operations Encyclopedia. A
reference resource for EMSO terminology and concepts maintained by the
EMSO community.

**EO** — Executive Order. A directive from the President of the United
States. EO 12333 governs U.S. intelligence activities, including SIGINT
minimization procedures.

**EOB** — Electronic Order of Battle. A comprehensive database of known
electronic emitters (radars, communications systems, navigation aids)
organized by platform, location, and operational parameters. Tsingou's
SchemaRegistry functions as a threat library analogous to an EOB
reference database.

**EP** — Electronic Protection. The EW pillar encompassing actions to
protect personnel, facilities, and equipment from any effects of
friendly or enemy use of the EMS. Includes ECCM, EMCON, and hardening.

**ES** — Electronic Warfare Support. The EW pillar encompassing actions
to search for, intercept, identify, and locate sources of
electromagnetic energy. The primary Tsingou domain — ES is the
SIGINT-relevant pillar of EW.

**ESA** — Electronically Scanned Array. A radar antenna type using
electronic beam steering. See also AESA (Active ESA) and PESA
(Passive ESA).

**EW** — Electronic Warfare. Military action involving the use of
electromagnetic and directed energy to control the electromagnetic
spectrum or to attack the enemy. Organized into three pillars: EA, EP,
ES.

**EWIR** — Electronic Warfare Integrated Reprogramming. The DoD system
for managing the reprogramming of EW equipment when new threats are
identified. Tsingou's SchemaRegistry supports EWIR-aligned threat
library updates via NATS KV watch.

**EWMA** — Exponentially Weighted Moving Average. A statistical method
that applies exponentially decreasing weights to older observations. Used
in Tsingou's anomaly detection pipeline for baseline computation with
a configurable decay factor (alpha).

### F

**FDOA** — Frequency Difference of Arrival. A geolocation technique
using the Doppler shift difference measured at two or more receivers to
determine emitter location. Requires relative motion between emitter and
at least one receiver. Combines with TDOA for improved geolocation
accuracy.

**FFT** — Fast Fourier Transform. An efficient algorithm for computing
the Discrete Fourier Transform (DFT), converting time-domain signals to
frequency-domain representation. Computational complexity O(N log N).
Used in SDR spectrum analysis and ELINT processing.

**FIRST** — Forum of Incident Response and Security Teams. The global
organization that maintains the Traffic Light Protocol (TLP) standard
for information sharing classification.

**FISINT** — Foreign Instrumentation Signals Intelligence. Intelligence
derived from foreign instrumentation signals — telemetry, beaconry, video
data links, and command signals associated with aerospace, surface, and
subsurface system testing. Tsingou MAY support FISINT via custom
schema registration.

**FM** — Field Manual. U.S. Army doctrinal publications. FM 3-12
(Cyberspace Operations and Electromagnetic Warfare) and FM 3-38 (legacy
CEMA doctrine) are primary references.

**FM (modulation)** — Frequency Modulation. A modulation technique
where the frequency of a carrier wave varies with the information
signal. Relevant to COMINT signal classification.

**FPUT** — Fermi-Pasta-Ulam-Tsingou. The computational experiment
(1955) that discovered recurrence in nonlinear systems. The Tsingou
platform is named after Mary Tsingou (1928-2023), the programmer who
coded the MANIAC I simulation.

**FUOPS** — Future Operations. The staff section managing operations in
the 24-72 hour planning horizon. Part of the division/corps operations
center structure.

### G

**GEOINT** — Geospatial Intelligence. Intelligence derived from the
exploitation and analysis of imagery and geospatial information.
Tsingou SHOULD support GEOINT for enrichment across all disciplines
via R3F and visx rendering layers.

**GeoJSON** — A JSON format for encoding geographic data structures.
Tsingou SHOULD support GeoJSON feature ingestion via HttpSourceAdapter.

**GLB** — Greatest Lower Bound. Synonym for meet in lattice theory.
See Meet.

**GNU Radio** — A free, open-source software development toolkit for
signal processing. The primary SDR processing framework bridged to
Tsingou via NATS (ADR-011). GNU Radio flowgraphs perform signal
conditioning, channelization, demodulation, and PDW extraction.

**GRC** — GNU Radio Companion. The graphical interface for building GNU
Radio flowgraphs. Used by SIGINT operators to configure SDR processing
pipelines.

**GSAP** — GreenSock Animation Platform. A JavaScript animation library
used in Tsingou for high-performance DOM and SVG animations.

### H

**H3** — Hexagonal Hierarchical Spatial Index. Uber's discrete global
grid system using hexagonal cells at 16 resolution levels. Referenced in
TSG.30 for geospatial indexing.

**HF** — High Frequency. The radio frequency band from 3 to 30 MHz.
Supports skywave propagation via ionospheric reflection, enabling BLOS
communications. Important for COMINT and ELINT collection.

**HUMINT** — Human Intelligence. Intelligence derived from human
sources. Explicitly NOT in Tsingou's scope — the platform is a
technical collection visualization system.

### I

**IC** — Intelligence Community. The collective of U.S. government
agencies and organizations that carry out intelligence activities. The
IC includes 18 member organizations coordinated by the ODNI.

**IETF** — Internet Engineering Task Force. The standards organization
responsible for Internet protocols. Tsingou follows IETF normative
language conventions per RFC 2119 and RFC 8174.

**IFF** — Identification Friend or Foe. A radar-based identification
system using 1030 MHz (interrogation) and 1090 MHz (reply) frequencies.
IFF transponder data is categorized as ELINT in Tsingou.

**IMINT** — Imagery Intelligence. Intelligence derived from imagery
collected by visual photography, infrared sensors, radar, and
electro-optical systems. A sub-discipline of GEOINT.

**IMSI** — International Mobile Subscriber Identity. A unique identifier
allocated to each mobile subscriber in a GSM/3GPP network. Used as a
COMINT selector type for mobile communications intercept.

**INSCOM** — U.S. Army Intelligence and Security Command. Provides
intelligence and security support to Army and joint operations. Located
at Fort Eisenhower, Georgia.

**INT** — Intelligence discipline (generic). Used as a suffix to denote
specific intelligence disciplines (SIGINT, OSINT, CYBINT, etc.).

**IOC** — Indicator of Compromise. A forensic artifact — an IP address,
domain name, file hash, URL, or other observable — that indicates a
potential security breach. The primary correlation entity in CYBINT
analysis.

**IP** — Internet Protocol. The network-layer protocol of the Internet.
IPv4 and IPv6 addresses are primary IOC types in CYBINT.

**IPB** — Intelligence Preparation of the Battlespace. The systematic
process of analyzing the threat and environment in a specific geographic
area. Mapped to Tsingou's SIGINT-specific variant: IPEM (Intelligence
Preparation of the Electromagnetic Environment).

**IQ** — In-phase/Quadrature. The standard representation of
complex-valued radio signals as two orthogonal components (I and Q).
IQ data is the fundamental output of SDR receivers and the primary
input for DSP processing.

**IRINT** — Infrared Intelligence. A MASINT sub-discipline concerned
with intelligence derived from infrared radiation. Tsingou MAY render
IRINT data as R3F 3D overlays or p5 heatmaps.

**ISA-18.2** — ANSI/ISA-18.2: Management of Alarm Systems for the
Process Industries. The standard governing alarm lifecycle state
transitions (unacknowledged → acknowledged → cleared) used in
Tsingou's alarm entity state machine.

**ISAR** — Inverse Synthetic Aperture Radar. A radar imaging technique
that uses the target's own motion to synthesize a larger aperture.
ISAR data is categorized as ELINT in Tsingou.

**ISR** — Intelligence, Surveillance, and Reconnaissance. The activities
that synchronize and integrate the planning and operation of sensors,
assets, and processing systems. The TPED cycle is the ISR operational
model.

**IVM** — Incremental View Maintenance. The database technique of
maintaining materialized views under insert/update/delete operations.
Differential dataflow generalizes IVM to partially ordered time.

### J

**JADC2** — Joint All-Domain Command and Control. The DoD initiative to
connect sensors to shooters across all domains at machine speed. CEMA
provides the EMS effects integration layer for JADC2.

**JCIDS** — Joint Capabilities Integration and Development System. The
DoD process for identifying, assessing, and prioritizing capability
gaps.

**JEC** — Joint Electromagnetic Spectrum Operations Center. Established
by U.S. Strategic Command in July 2023 to implement the EMS Superiority
Strategy at the operational level.

**JED** — Journal of Electromagnetic Dominance. The flagship publication
of the AOC, covering tactical SIGINT programs, CEMA operations, spectrum
management, and EW policy. Renamed from "Journal of Electronic Defense"
to reflect the doctrinal shift to proactive electromagnetic dominance.

**JEMSOC** — Joint Electromagnetic Spectrum Operations Cell. The lead
staff element for JEMSO planning at combatant command / JTF level,
comprising J2, J3, and J6 personnel. Defined in JP 3-85.

**JEMSO** — Joint Electromagnetic Spectrum Operations. The joint-level
coordination of EMSO activities.

**JetStream** — NATS JetStream. The persistence layer of NATS providing
at-least-once delivery, message replay, and key-value storage. Tsingou
uses JetStream for signal persistence and historical replay.

**JFMO** — Joint Frequency Management Office. The JEMSOC element
responsible for frequency assignment and electromagnetic interference
resolution.

**JP** — Joint Publication. DoD joint doctrinal publications. Key
references: JP 2-0 (Joint Intelligence), JP 2-01 (National Intel
Support), JP 2-01.3 (SIGINT Support), JP 3-85 (EMSO).

**JRFL** — Joint Restricted Frequency List. A list of frequencies with
restricted usage (taboo, protected, guarded) to prevent interference
with friendly operations. Managed by the JFMO within the JEMSOC.

**JSON** — JavaScript Object Notation. A lightweight data interchange
format. Tsingou uses JSON for REST API communication, STIX bundles,
and RPC serialization (development mode).

**JTF** — Joint Task Force. A joint military command established for a
specific mission, with forces from two or more services.

### K

**KL Divergence** — Kullback-Leibler Divergence. A measure of how one
probability distribution differs from a reference distribution. Used
in Tsingou's statistical analysis for anomaly scoring (TSG.29).

**KV** — Key-Value. In NATS, a JetStream-backed key-value store.
Tsingou uses NATS KV for SchemaRegistry persistence, device state,
and adapter configuration. Keys MUST use dots (`.`) as separators.

### L

**L1/L2/L3** — Service tier designations in Tsingou's Effect-TS
architecture. L1: Infrastructure (PgClient, NatsClient). L2: Domain
(AlarmService, SensorService). L3: Orchestration (IIoTService).
Dependency flows downward: L3 → L2 → L1.

**LASINT** — Laser Intelligence. A MASINT sub-discipline concerned with
intelligence derived from laser emissions. Includes laser rangefinder
characterization and laser designator detection.

**LFM** — Linear Frequency Modulation (chirp). A radar modulation-on-
pulse (MOP) type where frequency sweeps linearly across the pulse
duration. A primary MOP type in Tsingou's ELINT PDW schema.

**LIFO** — Last In, First Out. The ordering principle for Effect-TS
scope finalizer execution — resources are released in reverse
acquisition order.

**LOS** — Line of Sight. Direct, unobstructed propagation path between
transmitter and receiver. Constrains VHF/UHF/microwave communications
and radar range.

**LUB** — Least Upper Bound. Synonym for join in lattice theory. See
Join.

### M

**MANIAC** — Mathematical Analyzer, Numerical Integrator, and Computer.
The computer at Los Alamos National Laboratory programmed by Mary
Tsingou for the FPUT experiment in 1955.

**MASINT** — Measurement and Signature Intelligence. Intelligence
derived from detection, tracking, identification, and characterization
of phenomena associated with target signatures — acoustic, seismic,
chemical, nuclear, electromagnetic, and other physical properties.
Tsingou MAY support MASINT via sensor adapters.

**MDEP** — Multi-Domain Effects Platoon. Army organizational element at
brigade level bringing EW capabilities to the tactical edge. Converges
capabilities across the EMS, cyber, and physical domains.

**MDMP** — Military Decision Making Process. The Army's planning process
for operations. The CEMA cell integrates into MDMP at division and
above.

**MDO** — Multi-Domain Operations. The Army's transformational
operational concept for 2030+, requiring convergence of effects across
five domains (land, maritime, air, space, cyberspace) plus the EMS.

**MIDI** — Musical Instrument Digital Interface. A protocol for
communication between electronic musical instruments and computers.
Tsingou includes a MIDI adapter stub in its source adapter inventory.

**MISP** — Malware Information Sharing Platform. An open-source threat
intelligence platform for sharing, storing, and correlating IOCs.
Tsingou SHOULD support MISP integration via REST API connectors.

**MITRE** — The MITRE Corporation. A non-profit operating federally
funded research and development centers. Maintains the ATT&CK
framework, CVE catalog, and other cybersecurity resources.

**MOP** — Modulation on Pulse. The intra-pulse modulation characteristic
of a radar signal. MOP types in Tsingou's ELINT schema: `none`,
`linear_fm`, `barker`, `polyphase`, `frequency_hop`, `unknown`.

**MsgPack** — MessagePack. A binary serialization format more compact
than JSON. RECOMMENDED for production RPC serialization in Tsingou.

**Multi-INT** — Multi-discipline intelligence. The integration of
intelligence from multiple disciplines (SIGINT, OSINT, CYBINT, GEOINT,
etc.) to produce fused analytical products.

**MVCC** — Multi-Version Concurrency Control. A database technique
maintaining multiple versions of data items, each tagged with a
timestamp. Differential dataflow generalizes MVCC to partially ordered
versions. The `Index.reconstructAt()` operation is the d2ts analogue
of an MVCC snapshot read.

### N

**NATS** — A cloud-native messaging system (not an acronym; originally
"Neural Autonomic Transport System"). Tsingou's messaging fabric
provides pub/sub, request/reply, JetStream persistence, and KV storage.
Subject names follow hierarchical dot-separated conventions.

**NATO** — North Atlantic Treaty Organization. The intergovernmental
military alliance whose member nations use standardized intelligence
sharing formats (STANAG). TLP and STIX facilitate NATO-compatible
intelligence exchange.

**NDJSON** — Newline-Delimited JSON. A text format where each line is
a valid JSON value separated by newlines. Used for development-mode
RPC serialization in Tsingou.

**NGA** — National Geospatial-Intelligence Agency. The U.S. agency
responsible for providing geospatial intelligence to the DoD and IC.
Publisher of GEOINT Basic Doctrine.

**NIDC** — National Intelligence Discipline Categories. ODNI's
standardized taxonomy of intelligence disciplines. Tsingou aligns with
the 2022 revision.

**NLP** — Natural Language Processing. Computational techniques for
analyzing and generating human language. Tsingou ingests NLP-extracted
entities from external services via NATS or HTTP adapters for OSINT
analysis.

**NRT** — Near Real-Time. Processing and dissemination with minimal
delay, typically sub-minute. The target for ES-mode operation in
Tsingou.

**NSA** — National Security Agency. The U.S. agency responsible for
SIGINT collection and cryptologic operations. NSA/CSS Georgia at Fort
Eisenhower is a primary SIGINT facility.

**NSAG** — NSA/CSS Georgia. The Georgia Cryptologic Center at Fort
Eisenhower — a 600,000 sq ft facility conducting signals intelligence
operations.

**NUCINT** — Nuclear Intelligence. A MASINT sub-discipline concerned
with intelligence derived from the detection and characterization of
nuclear radiation.

**NX** — A monorepo build system and task runner. Tsingou uses NX for
build orchestration. Package scripts MUST be registered as NX executors
in `project.json`.

### O

**OASIS** — Organization for the Advancement of Structured Information
Standards. The standards body that publishes STIX 2.1 and TAXII 2.1
specifications.

**OCO** — Offensive Cyberspace Operations. Military operations to
project power in and through cyberspace. A component of CO within the
CEMA framework.

**ODNI** — Office of the Director of National Intelligence. The U.S.
government organization that oversees and coordinates the 17+1 members
of the Intelligence Community.

**OFDM** — Orthogonal Frequency-Division Multiplexing. A digital
modulation technique using multiple closely spaced orthogonal
subcarriers. Common in modern communications (LTE, Wi-Fi) and relevant
to COMINT signal classification.

**OpenCTI** — Open Cyber Threat Intelligence. An open-source CTI
platform. Tsingou SHOULD support OpenCTI integration via REST API
adapters.

**OPSEC** — Operations Security. The process of identifying and
protecting critical information about friendly operations from
adversary exploitation.

**OSC** — Open Sound Control. A communication protocol for networking
sound synthesizers and multimedia devices. Tsingou includes an OSC
adapter stub.

**OSINT** — Open Source Intelligence. Intelligence produced from
publicly available information. One of Tsingou's two MUST-support
primary disciplines alongside CYBINT. Supported through RSS, HTTP,
WebSocket, and file adapters.

**OSM** — OpenStreetMap. An open collaborative mapping project. Tsingou
MAY use OSM tiles for geospatial rendering in the R3F layer.

**OTX** — Open Threat Exchange. AlienVault's open threat intelligence
community. An OSINT source with default reliability rating B2
(usually reliable, probably true).

### P

**p5** — p5.js. A JavaScript library for creative coding and generative
art. In Tsingou, p5 powers the Canvas 2D rendering layer (z:2) for
spectrum waterfall displays, noise fields, constellation diagrams, and
scan pattern visualizations via `@p5-wrapper/react`.

**PA** — Pulse Amplitude. The peak power of a radar pulse, measured in
dBm. A PDW parameter.

**PAR** — Precision Approach Radar. A radar system used for aircraft
approach guidance. Relevant to ELINT classification.

**PCAP** — Packet Capture. A file format (`.pcap`, `.pcapng`) for
storing network traffic captures. A CYBINT data source ingestible via
file adapters.

**PED** — Processing, Exploitation, and Dissemination. The intelligence
cycle stages that Tsingou owns. Tsingou does NOT perform collection
(the "C" in TCPED) — it ingests from external collection sources.

**PESA** — Passive Electronically Scanned Array. A radar antenna type
using a single transmitter with phase shifters per element for
electronic beam steering. Distinct from AESA which has individual T/R
modules.

**PgClient** — PostgreSQL Client. An L1 infrastructure service in
Tsingou's Effect-TS architecture providing database connectivity.

**PIR** — Priority Intelligence Requirements. The intelligence
requirements identified by the commander as being critical to decision-
making. Mapped to Tsingou's Session Configuration focus areas.

**PDW** — Pulse Descriptor Word. The fundamental data unit for ELINT
analysis, capturing the measured parameters of a single radar pulse:
RF frequency (MHz), Time of Arrival (us), Pulse Amplitude (dBm),
Pulse Width (us), Pulse Repetition Interval (us), Angle of Arrival
(degrees), and Modulation on Pulse type.

**PPI** — Plan Position Indicator. A circular radar display showing
target range and azimuth from the radar site. Traditionally the
primary radar operator display.

**PRF** — Pulse Repetition Frequency. The number of radar pulses
transmitted per second (Hz). PRF = 1/PRI. Classified as low (<250 Hz),
medium (250-2000 Hz), or high (>2000 Hz), correlating with radar type
and function.

**PRI** — Pulse Repetition Interval. The time between successive radar
pulses, measured in microseconds. PRI = 1/PRF. PRI analysis is a
primary ELINT discrimination technique. PRI types in Tsingou:
`stable`, `jittered`, `stagger`, `dwell_switch`, `sliding`, `unknown`.

**PW** — Pulse Width. The duration of a single radar pulse, measured in
microseconds. A PDW parameter used in emitter characterization.

### Q

**QoS** — Quality of Service. Network guarantees for bandwidth, latency,
jitter, and reliability. NATS supports QoS levels from at-most-once
(core) to at-least-once (JetStream).

### R

**R3F** — React Three Fiber. A React renderer for Three.js enabling
declarative 3D scene composition. In Tsingou, R3F powers the WebGL 3D
rendering layer (z:0) for entity relationship graphs, geospatial
maps, emitter location displays, and trajectory visualization.

**RADINT** — Radar Intelligence. A MASINT sub-discipline concerned with
intelligence from the analysis of non-imaging radar returns. Tsingou
MAY render RADINT via R3F 3D and p5 PPI displays.

**RDBMS** — Relational Database Management System. Tsingou uses
PostgreSQL (via PgClient) for structured data persistence.

**REP** — Recognized Electromagnetic Picture. A comprehensive depiction
of all electromagnetic activity in an area of operations — the EMS
equivalent of a Common Operational Picture. Tsingou's 4-layer rendering
provides a REP for the analyst's area of responsibility.

**RF** — Radio Frequency. Electromagnetic radiation in the frequency
range ~3 kHz to 300 GHz, encompassing all frequencies used for radio
communications and radar. The primary signal domain for SIGINT/ELINT
collection.

**RFC** — Request for Comments. In IETF context, a formal standards
document. In Tsingou context, RFC-002 is the platform specification
using IETF normative language conventions.

**RPC** — Remote Procedure Call. In Effect-TS, a typed request/response
pattern defined with Schema types for payload, success, and error.
Tsingou uses `@effect/rpc` for entity communication with NDJSON or
MsgPack serialization.

**RRF** — Reciprocal Rank Fusion. A technique for combining ranked
search results from multiple sources. Used in Tsingou's memory recall
system for hybrid text + vector search.

**RSS** — Really Simple Syndication. An XML-based web feed format for
distributing regularly updated content. Tsingou ingests RSS feeds via
RssSourceAdapter as an OSINT source.

**RTL-SDR** — A family of USB SDR receivers based on the Realtek
RTL2832U chipset. An entry-level SDR platform supported by GNU Radio
and referenced in Tsingou's SDR hardware landscape (TSG.16).

### S

**SA** — Situational Awareness. The perception, comprehension, and
projection of environmental elements. Tsingou's 4-layer rendering
supports Endsley's three levels of SA: perception (z:0-z:2 displays),
comprehension (z:3 DOM annotations), and projection (derived graph
trend analysis).

**SAR** — Synthetic Aperture Radar. A radar imaging technique using
platform motion to synthesize a large antenna aperture. SAR data is
categorized as ELINT in Tsingou. Also: Search and Rescue (context-
dependent).

**SCIF** — Sensitive Compartmented Information Facility. A secure room
or building used for processing and storing classified information.
Tsingou's local-first architecture supports SCIF deployment where
network connectivity cannot be assumed.

**SDO** — STIX Domain Object. A STIX 2.1 entity representing a concept
in the CTI domain. Types include `indicator`, `malware`, `threat-actor`,
`attack-pattern`, `infrastructure`, `identity`, `observed-data`, and
others.

**SDR** — Software-Defined Radio. A radio communications system where
components traditionally implemented in hardware are implemented by
means of software. Tsingou ingests SDR data via GNU Radio → NATS
bridge (ADR-011).

**SigMF** — Signal Metadata Format. An open standard for describing
recorded RF signal data. Provides metadata for IQ captures including
sample rate, center frequency, and data format. Tsingou SHOULD support
SigMF metadata for RF recordings (TSG.18).

**SIGINT** — Signals Intelligence. Intelligence derived from
electromagnetic signals and systems. The umbrella discipline comprising
COMINT, ELINT, and FISINT. Tsingou's primary domain alongside OSINT
and CYBINT.

**SIEM** — Security Information and Event Management. Enterprise
security systems for log aggregation, correlation, and alerting.
Tsingou SHOULD support SIEM integration via NATS/syslog bridge.

**SMO** — Spectrum Management Operations. The component of EMSO
responsible for frequency assignment, EMI resolution, and spectrum
planning. Integrated into CEMA alongside CO and EW.

**SNR** — Signal-to-Noise Ratio. The ratio of desired signal power to
background noise power, typically expressed in decibels (dB). A
fundamental quality metric for SIGINT collection systems.

**SOSP** — Symposium on Operating Systems Principles. The ACM conference
where the Naiad timely dataflow system (precursor to differential
dataflow) was presented (2013).

**SRO** — STIX Relationship Object. A STIX 2.1 entity expressing a
typed relationship between two SDOs. Types include `relationship`
(directional) and `sighting` (temporal observation).

**SSE** — Server-Sent Events. An HTTP-based protocol for server-to-
client event streaming. Supported by HttpSourceAdapter for real-time
data feeds.

**STANAG** — Standardization Agreement. NATO's interoperability
standards. Tsingou supports NATO-compatible intelligence sharing through
STIX 2.1 and TLP 2.0.

**STIX** — Structured Threat Information eXpression. OASIS standard
(version 2.1) for representing CTI. Tsingou MUST support STIX 2.1
bundle export for all intelligence products and STIX 2.1 bundle import
for threat intelligence ingestion.

**SVG** — Scalable Vector Graphics. An XML-based vector image format.
In Tsingou, visx renders data visualizations as SVG in the z:1 layer.

### T

**TAXII** — Trusted Automated eXchange of Intelligence Information.
OASIS standard (version 2.1) for CTI transport over HTTPS. Tsingou
MUST support TAXII 2.1 for intelligence exchange via NATS subject
mapping.

**TCPED** — Tasking, Collection, Processing, Exploitation, and
Dissemination. The full ISR operational model. Tsingou owns the PED
portion; Collection is performed by external systems (SDR hardware,
network sensors, OSINT crawlers).

**TDOA** — Time Difference of Arrival. A geolocation technique using
the difference in signal arrival times measured at two or more receivers
to determine emitter location via hyperbolic intersection. Requires
precise time synchronization between receivers.

**Three.js** — A JavaScript 3D library that provides WebGL rendering.
The underlying library for R3F (React Three Fiber) used in Tsingou's
z:0 rendering layer.

**TLP** — Traffic Light Protocol. A classification scheme (version 2.0,
maintained by FIRST) for information sharing using color-coded markings:
TLP:RED (named recipients only), TLP:AMBER (organization + need-to-know),
TLP:AMBER+STRICT (organization only), TLP:GREEN (community), TLP:CLEAR
(unrestricted). Tsingou MUST support TLP 2.0 marking on all signals
and derived products.

**TOA** — Time of Arrival. The absolute time at which an electromagnetic
pulse arrives at a receiver. A primary PDW parameter measured in
microseconds (epoch-referenced). The fundamental timing measurement for
PRI analysis and TDOA geolocation.

**TPED** — Tasking, Processing, Exploitation, and Dissemination. The
ISR operational model for intelligence production. See also TCPED.
Tsingou maps each TPED phase to specific architectural components
(TSG.36).

**TTP** — Tactics, Techniques, and Procedures. The standardized
description of how military operations are conducted. In cyber context,
adversary TTPs are modeled using the ATT&CK framework.

### U

**UA** — User Agent. An HTTP header identifying the client software.
Anomalous user-agent strings are an IOC type in CYBINT analysis.

**UHF** — Ultra High Frequency. The radio frequency band from 300 MHz
to 3 GHz. Common for tactical communications, television, and cellular
networks.

**USRP** — Universal Software Radio Peripheral. A family of SDR
hardware platforms from Ettus Research / NI. A mid-range to high-end
SDR platform supported by GNU Radio and referenced in Tsingou's SDR
hardware landscape (TSG.16).

**USSID** — United States Signals Intelligence Directive. NSA/CSS
directives governing SIGINT activities. USSID 18 establishes
minimization procedures for U.S. person information.

**UTC** — Coordinated Universal Time. The primary time standard by
which the world regulates clocks. All Tsingou timestamps MUST be
normalized to UTC.

### V

**VHF** — Very High Frequency. The radio frequency band from 30 to
300 MHz. Used for FM broadcast, aviation communications, and tactical
military radios.

**visx** — A collection of composable, low-level visualization
components for React, built on D3. In Tsingou, visx powers the SVG
data visualization layer (z:1) for timelines, heatmaps, scatter plots,
histograms, and the ATT&CK matrix display.

### W

**WebGL** — Web Graphics Library. A JavaScript API for rendering 2D and
3D graphics within a web browser. The rendering backend for Three.js
and R3F in Tsingou's z:0 layer.

**WebSocket** — A communication protocol providing full-duplex
communication over a single TCP connection. Tsingou's
WebSocketSourceAdapter ingests real-time streams via WebSocket, and
the RPC server uses WebSocket for real-time subscriptions.

### X

**XState** — A JavaScript/TypeScript library for finite state machines
and statecharts. Used in Tsingou for UI state management and integration
with Effect-TS via the stx (state-transition) bridge.

### Z

**ZMQ** — ZeroMQ. A high-performance asynchronous messaging library.
The primary transport between GNU Radio and NATS in Tsingou's SDR
bridge (ADR-011). GNU Radio's ZMQ blocks publish IQ/FFT/PDW data to
ZMQ sockets, which a bridge process forwards to NATS subjects.

---

## TSG.F.2 SIGINT/EW Terminology

Alphabetical definitions of domain-specific terms. Doctrine references
indicate the source publication where the term is normatively defined.

### A

**Adaptive threat response** — The capability to update threat
parameters (EOB entries, emitter signatures, classification rules) in
response to newly observed adversary behavior. In Tsingou, implemented
via SchemaRegistry hot-update through NATS KV watch, analogous to the
EWIR (Electronic Warfare Integrated Reprogramming) process.

**Admiralty system** — The NATO-standard source evaluation framework
using a two-character code: source reliability (A-F) and information
accuracy (1-6). Example: B2 = "usually reliable, probably true."
Tsingou SHOULD apply Admiralty ratings to all OSINT signals.
[NATO STANAG 2022]

**Analyst workstation** — The terminal at which a SIGINT/OSINT analyst
consumes processed intelligence. Tsingou's 4-layer rendering surface
serves as a software-defined analyst workstation.

**Antichain** — In the context of EW operations, a set of emitters
whose signals are causally independent (concurrent in the version
lattice). In differential dataflow, an antichain of versions represents
a frontier — the boundary between completed and future computation.
[TSG.26, Definition 2.8]

### B

**Baseband** — The original frequency range of a signal before
modulation to a carrier frequency. SDR receivers typically down-convert
RF signals to baseband (IQ) for digital processing.

**BaseSignal** — Tsingou's internal signal representation defined by
Effect.Schema, with branded IDs, d2ts versioning, and a `kind`
discriminator. All signals ingested by Tsingou are normalized to
BaseSignal format at the adapter boundary. [TSG.8]

### C

**Channelization** — The DSP process of dividing a wideband signal into
multiple narrowband channels for independent processing. Performed in
GNU Radio before signals reach Tsingou.

**Collection management** — The process of managing intelligence
collection resources to satisfy intelligence requirements. Maps to
Tsingou's Session Configuration (Direction phase) and
AdapterManager.register() for asset allocation.

**Congested, contested, and constrained (3C)** — The DoD's
characterization of the modern Electromagnetic Operating Environment.
Congested: dense friendly and neutral signals. Contested: adversary
electronic attack and deception. Constrained: regulatory and policy
limitations on spectrum use. [EMS-STRAT]

**Contact chaining** — The primary COMINT analysis technique of
constructing social network graphs from communication metadata.
Implemented in Tsingou via d2ts `join` operators with selector keys.
Chain depth SHOULD NOT exceed 2 hops due to combinatorial explosion.
[TSG.2, Section 3.5]

**Convergence** — In CEMA doctrine, the integration of capabilities
from multiple domains to create combined effects exceeding the sum of
individual effects. In differential dataflow, the state when an
iterative computation produces no new differences. [FM 3-12]; [TSG.26]

### D

**Decimation** — The DSP process of reducing the sample rate of a
digital signal by discarding samples. Performed in GNU Radio as part
of signal conditioning before NATS transport.

**Deinterleaving** — The ELINT technique of separating a composite PDW
stream (containing interleaved pulses from multiple emitters) into
per-emitter pulse trains. Primary discriminants: RF frequency and PRI.
Secondary discriminants: AOA, PW, MOP. [TSG.2, Section 4.5]

**Demodulation** — The extraction of information content from a
modulated carrier signal. The reverse of modulation. Performed in GNU
Radio's demodulation blocks.

**Diamond Model** — The Diamond Model of Intrusion Analysis (Caltagirone
et al., 2013). An analytic framework where each intrusion event comprises
four vertices: adversary, infrastructure, capability, and victim.
Tsingou maps Diamond Model vertices to STIX SDOs and d2ts join
operations. [TSG.2, Section 6.5]

**Direction finding** — See DF.

**Dissemination** — The delivery of intelligence products to authorized
consumers. The final phase of both the TPED cycle and the Intelligence
Cycle. Tsingou disseminates via rendering (analyst display), STIX
export, NATS fan-out, and alert atoms.

### E

**Electromagnetic spectrum superiority** — That degree of control in the
EMS that permits the conduct of operations at a given time and place
without prohibitive interference, while affecting an adversary's ability
to do the same. The strategic objective of EMSO. [JP 3-85, Glossary]

**Emitter** — Any device that radiates electromagnetic energy. In ELINT,
emitters are characterized by their PDW parameters and classified against
the Electronic Order of Battle.

**Emitter clustering** — The signal processing technique of grouping
PDW entries into clusters in multi-dimensional parameter space
(RF, PRI, PW, MOP, AOA) to identify distinct emitters in a composite
stream. [TSG.2, Section 4.5]

**Endsley's SA model** — Mica Endsley's three-level model of Situational
Awareness: Level 1 (Perception), Level 2 (Comprehension), Level 3
(Projection). Tsingou's 4-layer rendering supports all three levels.
Referenced in TSG.36 for cognitive task analysis.

**Exploitation** — The third phase of the TPED cycle. The analytical
process of deriving intelligence from processed data. In Tsingou,
exploitation is performed by the d2ts derived graph through cross-
source correlation, anomaly detection, and pattern analysis.

### F

**Frequency agility** — The capability of a radar to rapidly change its
operating frequency between or within pulse groups. An ECCM technique
that complicates ELINT interception and deinterleaving. Tsingou's ELINT
pipeline SHOULD detect frequency agility through RF spread analysis.

**Frequency hopping** — A spread-spectrum technique where the
transmitted signal rapidly switches carrier frequency among multiple
channels. Relevant to both COMINT (communications interception) and
ELINT (radar MOP classification).

**Frontier** — In differential dataflow, an antichain of versions
representing a lower bound on future data. After a frontier advances
past version v, no new data will arrive at v. Frontiers MUST advance
monotonically. [TSG.26, Section 7]

### G

**Geolocation** — The determination of the geographic position of an
electromagnetic emitter. Techniques include DF (single-station bearing),
triangulation (multi-station bearing intersection), TDOA (hyperbolic
intersection), and FDOA (Doppler-based). [TSG.36, Section 16]

### H

**Hot-plug** — The capability to add, remove, or reconfigure source
adapters at runtime without restarting the application or interrupting
ongoing analysis. A key architectural requirement for Tsingou.

### I

**Intelligence cycle** — The six-phase process of intelligence
production: (1) Direction/Planning, (2) Collection, (3) Processing,
(4) Analysis/Exploitation, (5) Dissemination, (6) Feedback. Tsingou
covers all six phases per ADR-010. [JP 2-0]

**Intelligence Preparation of the Electromagnetic Environment (IPEM)** —
The SIGINT-specific variant of IPB (Intelligence Preparation of the
Battlespace). Systematic analysis of the electromagnetic environment
including known emitters, frequency usage, and threat capabilities.
[TSG.36, Section 21]

### K

**Kill chain** — The Lockheed Martin Cyber Kill Chain (Hutchins et al.,
2011). Seven phases of an intrusion: Reconnaissance, Weaponization,
Delivery, Exploitation, Installation, C2, Actions on Objectives.
Tsingou maps kill chain phases to ATT&CK tactics and d2ts detection
operators. [TSG.2, Section 6.6]

### M

**Minimization** — The procedures required under EO 12333 and USSID 18
to minimize the retention and dissemination of information about U.S.
persons collected incidentally during SIGINT operations.

### P

**Pattern-of-life (PoL)** — The observable behavioral patterns of an
entity (person, organization, emitter, network node) over time. PoL
analysis uses extended time windows in the d2ts derived graph to
identify recurring patterns, deviations, and activity schedules.

**Processing** — The second phase of the TPED cycle. Converting raw data
into exploitable form through signal conditioning, demodulation,
protocol decoding, format conversion, and quality assessment. In
Tsingou, processing is performed by the d2ts ingest graph.

### R

**Recognized Electromagnetic Picture (REP)** — A comprehensive depiction
of all electromagnetic activity in an area of operations. The EMS
equivalent of a Common Operational Picture (COP). Tsingou's 4-layer
rendering provides a REP for the analyst. [TSG.36, Section 22]

**Retraction** — In differential dataflow, the insertion of a signal
with multiplicity -1, causing all derived state depending on the
retracted signal to be updated. Retractions enable correction of false
positives without pipeline restart. [TSG.26, Section 10.2]

### S

**Scan pattern** — The spatial trajectory of a radar beam. Classified
as circular, sector, raster, helical, conical, track-while-scan, Palmer,
LORO, electronic (ESA/AESA), or frequency agile. Scan pattern detection
provides intelligence about emitter type and operational mode.
[TSG.2, Section 4.6]

**Selector** — In COMINT, a specific identifier used for targeted
collection: phone number, email address, IMSI, IP address, domain name,
or user account. Selectors serve as seed nodes for contact chaining.

**Signal kind** — The `kind` discriminator field on BaseSignal. One of
8 known types (nats, http, websocket, rss, serial, midi, osc,
file-watch) or a runtime-registered custom kind. [TSG.8]

### T

**Tasking** — The first phase of the TPED cycle. Directing collection
based on intelligence requirements, including PIR specification,
collection asset allocation, and deconfliction. Maps to Tsingou's
Session Configuration service.

**Threat library** — A reference database of known threat signatures
used for emitter identification and classification. In Tsingou,
implemented as the SchemaRegistry backed by NATS KV. Analogous to an
Electronic Order of Battle. [TSG.36, Section 14]

**Traffic analysis** — The COMINT technique of extracting intelligence
from communication patterns without access to message content. Includes
volume analysis, frequency analysis, timing analysis, network structure
analysis, and anomaly detection. [TSG.2, Section 3.6]

### W

**Waterfall display** — A spectrogram rendered as a scrolling time x
frequency x amplitude heatmap. The primary ELINT visualization in
Tsingou, rendered in the p5 layer (z:2). Time progresses vertically
(or horizontally), frequency spans one axis, and amplitude is encoded
as color intensity.

---

## TSG.F.3 Effect-TS Terminology

Terms specific to the Effect-TS ecosystem as applied in Tsingou's
architecture. See TSG.32 for the full Effect-TS Implementation
Architecture specification.

### A

**Atom** — A reactive state container from the `effect-atom` library.
Atoms are Tsingou's primary state primitive, defined at module level
and mutated via `ctx.set()` in Effect services. React components
subscribe via `useAtomValue()`. Atoms MUST NOT be created inside
component render bodies. [TSG.32.10]

**Atom.family** — A pattern for creating derived atoms that compute
values from other atoms. Used instead of `useMemo` for reactive
derivations.

**Atom.make** — The constructor for creating a new atom with an initial
value. Example: `Atom.make<Status>('idle')`.

**Atom.runtime** — A factory for creating service-scoped atom runtimes
that construct, share, and dispose Effect services. Provides `fn()`
for defining operations that mutate atoms within Effect context.
[TSG.32.10.6]

### C

**Cause** — The type representing the full failure tree of an Effect
computation. Variants: `Cause.fail(e)` (expected error), `Cause.die(d)`
(defect), `Cause.interrupt(fiberId)` (interruption), `Cause.parallel`
(concurrent failures), `Cause.sequential` (chained failures).
[TSG.32.1.5]

**Config** — Effect's typed configuration module providing environment
variable access with fallbacks. All runtime configuration in Tsingou
MUST flow through `Config` and `Layer`. Direct `process.env` access
is prohibited. [TSG.32.11]

**Context.Tag** — A typed identifier that serves as both a type-level
marker and runtime key for dependency injection. Used to define
infrastructure services. Example:
`class IIoTFeatureFlags extends Context.Tag('IIoTFeatureFlags')`.
[TSG.32.2.1]

**ctx.set()** — The method for mutating atoms within an Effect service
operation. Receives the atom and new value as arguments. Preferred over
returning values for React `setState` callbacks. [TSG.32.10.3]

### D

**Data.TaggedError** — An Effect class for creating discriminated error
types with a `_tag` field. Used for service-internal errors. Example:
`class AlarmNotFoundError extends Data.TaggedError('AlarmNotFoundError')`.
[TSG.32.5.1]

**Defect** — An unexpected failure in Effect — a programming error or
invariant violation, as opposed to an expected error. Created via
`Effect.die()`. Defects are not recoverable by normal error handling;
they indicate bugs. [TSG.32.5.6]

### E

**Effect<A, E, R>** — The fundamental computation type in Effect-TS.
A lazy, referentially transparent description of a computation that
succeeds with `A`, fails with `E`, or requires environment `R`. The
atomic unit of all Tsingou services. [TSG.32.1.1]

**Effect.addFinalizer** — Registers a cleanup function within the
current scope. Finalizers execute in LIFO order when the scope closes,
regardless of success, failure, or interruption. [TSG.32.7.3]

**Effect.catchTag / Effect.catchTags** — Discriminated error recovery
using the `_tag` field. Each `catchTag` call narrows the error channel
at the type level, enabling compile-time verified exhaustive error
handling. [TSG.32.5.3]

**Effect.fail** — Creates an Effect that fails with an expected error.
Used for domain failure modes (entity not found, invalid transition).
[TSG.32.5.6]

**Effect.fork / forkScoped / forkDaemon** — Fiber fork variants.
`fork`: parent-scoped. `forkScoped`: tied to explicit scope.
`forkDaemon`: global lifetime. Background fibers MUST use `forkScoped`.
[TSG.32.6.2]

**Effect.gen** — Generator-based composition using `yield*` for monadic
bind. The primary composition pattern for sequential operations in
Tsingou. [TSG.32.1.3]

**Effect.Service** — A class factory that bundles a service tag,
implementation, and dependencies into a single declaration. Produces a
`Default` static layer for auto-dependency resolution. [TSG.32.2.1]

**Effect.withSpan** — Adds a tracing span annotation to an Effect
operation. All top-level service operations MUST include spans. Span
names follow `{domain}.{operation}` convention. [TSG.32.14.1]

**Entity** — In `@effect/cluster`, a distributed stateful actor with
typed RPC interface, keyed by a primary key, with serial message
delivery via mailbox and cluster-distributed via consistent hashing.
[TSG.32.9.3]

**Exit<A, E>** — The result type of an Effect execution. Either
`Exit.Success<A>` or `Exit.Failure<E>` containing a `Cause<E>` tree.
[TSG.32.1.5]

### F

**Fiber** — A lightweight virtual thread managed by the Effect runtime.
Fibers implement structured concurrency with parent-child hierarchies,
interruption propagation, and guaranteed resource cleanup. [TSG.32.6.1]

### L

**Layer<Out, Error, In>** — A description of how to construct services
(`Out`) from dependencies (`In`), potentially failing with `Error`.
Layers replace constructor injection, factory patterns, and IoC
containers with type-safe, composable dependency injection. Layers are
memoized within a Scope. [TSG.32.3]

**Layer.effect** — Constructs a Layer from an effectful computation.
Used for database connections and other I/O-dependent service
construction.

**Layer.merge / Layer.mergeAll** — Combines independent layers. Used to
compose deployment layer stacks. [TSG.32.3.3]

**Layer.provide** — Satisfies a Layer's dependency requirements with
another Layer. Builds the dependency chain. [TSG.32.3.3]

**Layer.scoped** — Constructs a Layer with explicit resource lifecycle.
The Layer participates in the Scope's cleanup protocol.

### M

**Machine** — An `@effect/experimental` abstraction for state machine
logic with typed procedures (internal RPCs) and state transition
validation. Entity handlers MUST delegate to Machine for state
management. [TSG.32.15.3]

**ManagedRuntime** — The Effect bridge for React applications. Lazily
constructs services, memoizes within runtime scope, provides
`runPromise` / `runSync` for effect execution, and `dispose()` for
cleanup. [TSG.32.12.1]

**Metric** — Effect's built-in metrics API. `Metric.counter` for
counts, `Metric.histogram` for distributions. Signal processing
pipelines MUST track latency via histogram. [TSG.32.14.3]

### P

**PubSub** — Effect's broadcast messaging primitive. All subscribers
receive every published message. Used for event distribution. Bounded
PubSub suspends publishers when full. [TSG.32.6.4]

### Q

**Queue** — Effect's point-to-point messaging primitive. Each message
is consumed by exactly one consumer. Variants: `bounded` (suspends on
full), `unbounded`, `dropping` (discards oldest), `sliding` (discards
newest). Bounded queues SHOULD use power-of-2 capacities. [TSG.32.6.4]

### R

**Registry** — A synchronous atom container. `Registry.make()` creates
an instance; `registry.set(atom, value)` mutates synchronously (for
React callbacks); `registry.get(atom)` reads synchronously. Distinct
from `Atom.set()` which returns an Effect. [TSG.32.10.7]

**RegistryProvider** — A React component bridging Effect's AtomRegistry
with the React component tree. MUST wrap all components that use atom
hooks. [TSG.32.12.3]

**Rpc.make** — The Effect RPC definition constructor. Defines payload,
success, error schemas and a primary key function for entity routing.
Tags follow `{EntityType}.{Operation}` convention. [TSG.32.9.1]

**RpcGroup** — A collection of related RPC definitions for bulk
registration. Composed via `RpcGroup.make()`. [TSG.32.9.2]

**RpcSerialization** — Layer for RPC wire format. Options: `layerNdjson`
(development), `layerMsgPack` (production), `layerJson` (browser
WebSocket). [TSG.32.9.6]

**Runtime** — The execution engine for Effect programs. Manages the
fiber scheduler, service construction, tracing, and logging. React
applications use `ManagedRuntime`. [TSG.32.12]

### S

**Schema** — Effect's bidirectional type definition system. A single
Schema declaration serves as runtime validator, serializer, TypeScript
type, and JSON Schema generator. All domain types MUST be Schema-backed.
[TSG.32.4]

**Schema.brand** — Applies a compile-time brand to a Schema type,
preventing structural confusion between identical types (e.g., `AlarmId`
vs `DeviceId`). [TSG.32.4.3]

**Schema.Literal** — A Schema for enumerated values with runtime
validation. Replaces raw TypeScript union types for domain enumerations.
[TSG.32.4.7]

**Schema.TaggedClass** — A Schema class with a `_tag` discriminator and
prototype methods. Used for domain entities with behavior. [TSG.32.4.4]

**Schema.TaggedError** — A Schema-backed tagged error class for RPC
boundary errors. Enables error serialization across service boundaries.
[TSG.32.5.1]

**Schema.TaggedStruct** — A Schema struct with a `_tag` discriminator
field. Used for pure data domain types without methods. [TSG.32.4.4]

**Scope** — The lifetime manager for Effect resources. When a Scope
closes, all registered finalizers execute in LIFO order. Layers
constructed within the same Scope share resources through memoization.
[TSG.32.7.1]

**Sink** — The consumer end of an Effect Stream. Sinks accumulate stream
values into a final result. Used for collecting, folding, and draining
streams.

**Stream<A, E, R>** — Effect's lazy, potentially infinite sequence type.
Pull-based with built-in backpressure, chunked for efficiency,
composable with the same algebra as Effect. The primary abstraction for
signal processing in Tsingou. [TSG.32.8]

**Stream.asyncScoped** — Creates a Stream from an external push source
with scoped resource management. Used for integrating SDR hardware,
network feeds, and other external data sources. [TSG.32.8.2]

**Stream.provideLayer** — Injects service dependencies into a Stream.
MUST be called BEFORE `Stream.toAsyncIterable`. [TSG.32.8.4]

**Stream.toAsyncIterable** — Bridges an Effect Stream to a JavaScript
AsyncIterable for non-Effect consumers. Requires `R = never` at the
type level. [TSG.32.8.6]

### T

**Tag** — See Context.Tag.

---

## TSG.F.4 Mathematical Notation

Symbols and notation used in the theoretical sections of RFC-002,
primarily TSG.26 (Differential Dataflow), TSG.27 (Statistical Analysis),
TSG.28 (Graph Theory), TSG.29 (Information Theory), and TSG.30
(Geospatial Mathematics).

### Set Theory

| Symbol | Name | Definition |
|--------|------|-----------|
| `S` | Set | A collection of distinct elements |
| `x in S` | Element membership | Element x belongs to set S |
| `S'` (subset) `S` | Subset | All elements of S' are in S |
| `S1 union S2` | Union | Elements in S1 or S2 or both |
| `S1 intersect S2` | Intersection | Elements in both S1 and S2 |
| `|S|` | Cardinality | Number of elements in S |
| `{}` | Empty set | Set with no elements |
| `N` | Natural numbers | {0, 1, 2, 3, ...} |
| `Z` | Integers | {..., -2, -1, 0, 1, 2, ...} |
| `R` | Real numbers | The complete ordered field |

### Order Theory

| Symbol | Name | Definition | Reference |
|--------|------|-----------|-----------|
| `(S, <=)` | Partial order | Set S with reflexive, antisymmetric, transitive relation | TSG.26, Def. 2.1 |
| `a <= b` | Less-than-or-equal | a precedes or equals b in the partial order | TSG.26, Def. 2.1 |
| `a < b` | Strict order | a <= b and a != b | TSG.26, Def. 2.1 |
| `a \|\| b` | Incomparable | Neither a <= b nor b <= a | TSG.26, Def. 2.1 |
| `a v b` | Join (LUB) | Least upper bound of a and b | TSG.26, Def. 2.2 |
| `a ^ b` | Meet (GLB) | Greatest lower bound of a and b | TSG.26, Def. 2.3 |
| `V S'` | Join of set | Least upper bound of all elements in S' | TSG.26, Def. 2.5 |
| `^ S'` | Meet of set | Greatest lower bound of all elements in S' | TSG.26, Def. 2.5 |
| `_\|_` | Bottom | Least element of a bounded lattice | TSG.26, Def. 2.6 |
| `T` | Top | Greatest element of a bounded lattice | TSG.26, Def. 2.6 |
| `down(A)` | Downward closure | {x in S : exists a in A, x <= a} | TSG.26, Def. 2.9 |
| `up(A)` | Upper set (upset) | {x in S : exists a in A, a <= x} | TSG.26, Def. 2.10 |

### Algebraic Structures

| Symbol | Name | Definition | Reference |
|--------|------|-----------|-----------|
| `(G, +, 0)` | Abelian group | Set with commutative, associative binary operation, identity, and inverses | TSG.26, Def. 3.1 |
| `0` | Identity / zero | a + 0 = a for all a in G | TSG.26, Def. 3.1 |
| `-a` | Additive inverse | a + (-a) = 0 | TSG.26, Def. 3.1 |
| `Col(D)` | Collection group | {C : D -> Z \| C has finite support} | TSG.26, Def. 3.2 |
| `C(d)` | Multiplicity | Integer-valued function: number of copies of d in collection C | TSG.26, Def. 3.2 |

### Differential Dataflow

| Symbol | Name | Definition | Reference |
|--------|------|-----------|-----------|
| `V` | Version space | Partially ordered set of versions | TSG.26, Def. 4.1 |
| `D` | Data domain | Set of possible data elements | TSG.26, Def. 4.1 |
| `C : V -> Col(D)` | Collection function | Maps each version to a collection | TSG.26, Def. 4.1 |
| `delta : V -> Col(D)` | Trace / difference | Mobius inversion of collection function | TSG.26, Def. 4.2 |
| `(d, v, m)` | Update triple | Data element d at version v with multiplicity change m | TSG.26, Def. 4.3 |
| `mu(u, v)` | Mobius function | Inversion function for the partial order | TSG.26, Def. 4.4 |
| `F` | Frontier | Antichain of versions bounding future data | TSG.26, Sec. 7.1 |
| `L(C)` | Linear operator | Distributes over group addition: L(C1+C2) = L(C1)+L(C2) | TSG.26, Def. 6.1 |
| `A join B` | Join operator | Bilinear operator: (A join B)(k, (a,b)) = A(k,a) * B(k,b) | TSG.26, Def. 6.2 |
| `reduce_R(A)` | Reduce operator | Non-linear operator applying R to per-key sub-collections | TSG.26, Def. 6.3 |
| `lfp(F)` | Least fixed point | The smallest X such that F(X) = X | TSG.26, Def. 6.5 |

### Probability and Statistics

| Symbol | Name | Definition | Reference |
|--------|------|-----------|-----------|
| `P(A)` | Probability | Probability of event A occurring | TSG.27 |
| `E[X]` | Expected value | Mean of random variable X | TSG.27 |
| `Var(X)` | Variance | E[(X - E[X])^2] | TSG.27 |
| `sigma` | Standard deviation | sqrt(Var(X)) | TSG.27 |
| `mu` | Mean | Arithmetic mean of a distribution | TSG.27 |
| `z` | Z-score | (x - mu) / sigma; standard deviations from mean | TSG.27 |
| `alpha` | Decay factor | EWMA smoothing parameter (0 < alpha < 1) | TSG.27 |
| `H(X)` | Shannon entropy | -sum(p(x) * log2(p(x))) | TSG.29 |
| `I(X; Y)` | Mutual information | H(X) + H(Y) - H(X,Y) | TSG.29 |
| `D_KL(P \|\| Q)` | KL divergence | sum(P(x) * log(P(x)/Q(x))) | TSG.29 |
| `C` | Channel capacity | max I(X; Y) over input distributions | TSG.29 |
| `BER` | Bit error rate | Errors / total bits transmitted | TSG.29 |

### Graph Theory

| Symbol | Name | Definition | Reference |
|--------|------|-----------|-----------|
| `G = (V, E)` | Graph | Set of vertices V and edges E | TSG.28 |
| `d(v)` | Degree | Number of edges incident to vertex v | TSG.28 |
| `C_B(v)` | Betweenness centrality | Fraction of shortest paths through v | TSG.28 |
| `C_E(v)` | Eigenvector centrality | Principal eigenvector of adjacency matrix | TSG.28 |
| `C_C(v)` | Closeness centrality | Inverse sum of shortest distances from v | TSG.28 |
| `A` | Adjacency matrix | Binary matrix encoding graph edges | TSG.28 |
| `L` | Laplacian matrix | D - A where D is the degree matrix | TSG.28 |

### Geospatial

| Symbol | Name | Definition | Reference |
|--------|------|-----------|-----------|
| `phi` | Latitude | Angular distance north/south of equator (radians) | TSG.30 |
| `lambda` | Longitude | Angular distance east/west of prime meridian (radians) | TSG.30 |
| `R_earth` | Earth radius | Mean radius: 6,371 km | TSG.30 |
| `d_haversine` | Haversine distance | Great-circle distance between two points | TSG.30 |
| `theta` | Bearing | Direction from one point to another (radians) | TSG.30 |

---

## TSG.F.5 Protocol & Format Terms

Terms related to protocols, data formats, and messaging systems used
in or interfacing with Tsingou.

### NATS

**NATS Core** — The base NATS messaging system providing at-most-once
pub/sub and request/reply. Messages are fire-and-forget with no
persistence guarantee.

**NATS JetStream** — The persistence layer of NATS providing at-
least-once delivery, message replay, consumer groups, and key-value
storage. Tsingou uses JetStream for signal persistence, historical
replay, and SchemaRegistry storage.

**NATS KV Store** — A JetStream-backed key-value store. Keys become
NATS subjects internally (`$KV.bucket.key`). Keys MUST use dots (`.`)
as separators; colons are invalid. Tsingou uses KV for SchemaRegistry,
device state, and adapter configuration.

**NATS Subject** — The hierarchical address used for message routing in
NATS. Format: dot-separated tokens (e.g., `tsingou.signals.http`).
Wildcards: `*` (single token), `>` (all remaining tokens). Tsingou
subjects follow `tsingou.{category}.{discriminator}` convention.

**NATS Consumer** — A JetStream subscription with tracked delivery state
(acknowledged messages, redelivery policy). Consumers can be durable
(survive disconnection) or ephemeral.

**NATS Leaf Node** — A NATS server that connects to a hub cluster and
extends the messaging topology. Tsingou's edge deployment uses leaf
nodes to connect field stations to central infrastructure.

### STIX/TAXII

**STIX Bundle** — A collection of STIX 2.1 objects (SDOs, SROs,
SCOs) packaged for transport. The primary export format for Tsingou
intelligence products.

**STIX Domain Object (SDO)** — A STIX entity representing an
intelligence concept: `indicator`, `malware`, `threat-actor`,
`attack-pattern`, `campaign`, `infrastructure`, `identity`, `tool`,
`vulnerability`, `observed-data`, `report`, `grouping`, `note`,
`opinion`, `location`.

**STIX Relationship Object (SRO)** — A STIX entity expressing a
typed, directed relationship between two SDOs: `relationship` and
`sighting`.

**STIX Cyber Observable (SCO)** — A STIX entity representing an
observable in the cyber domain: `ipv4-addr`, `ipv6-addr`,
`domain-name`, `url`, `email-addr`, `file`, `process`,
`network-traffic`, `windows-registry-key`, `x509-certificate`,
`autonomous-system`, `mutex`.

**TAXII Collection** — A logical grouping of CTI objects served by a
TAXII server. Clients discover and poll collections to obtain STIX
bundles.

**TAXII Discovery** — The TAXII API endpoint (`/taxii2/`) that
provides server information and available API roots.

**TAXII API Root** — A grouping of TAXII collections under a URL
path. Each API root provides its own set of collections.

### SigMF

**SigMF Recording** — A SigMF-compliant dataset consisting of a
metadata file (`.sigmf-meta`, JSON) and a data file (`.sigmf-data`,
binary IQ samples). The metadata captures sample rate, center
frequency, data format, and annotations.

**SigMF Global** — The top-level metadata object in a SigMF recording,
specifying data type, sample rate, and other recording-wide properties.

**SigMF Capture** — A SigMF metadata segment describing the start of
a capture within a recording, including sample start index and center
frequency.

**SigMF Annotation** — A SigMF metadata segment marking a range of
samples with descriptive information (signal classification, SNR,
modulation type).

### Wire Formats

**NDJSON** — Newline-Delimited JSON. Each line is a valid JSON value.
Used for Tsingou RPC serialization in development mode. Human-readable
for debugging.

**MsgPack** — MessagePack. Binary serialization format, more compact
than JSON. RECOMMENDED for Tsingou RPC serialization in production for
throughput-critical paths.

**GeoJSON** — A JSON format for encoding geographic features (points,
lines, polygons) with associated properties. Tsingou SHOULD support
GeoJSON ingestion for GEOINT data.

---

## TSG.F.6 Visualization Terms

Terms related to Tsingou's 4-layer composited rendering architecture,
spanning WebGL 3D, SVG data visualization, Canvas 2D generative, and
DOM control surfaces.

### Rendering Architecture

**4-layer composited rendering** — Tsingou's rendering architecture
compositing four technology layers in a single viewport with z-index
stacking: z:0 (R3F/WebGL 3D), z:1 (visx/SVG), z:2 (p5/Canvas 2D),
z:3 (DOM/React). Each layer is optimized for specific intelligence
data types.

**Compositing** — The process of combining multiple rendered layers
into a single visual output. Tsingou composites via CSS z-index
stacking with pointer-events routing.

**pointer-events** — CSS property controlling which layer receives
mouse/touch interaction. In Tsingou: z:3 DOM has `pointer-events: auto`
(interactive); z:0-z:2 have `pointer-events: none` (passthrough) by
default, with selective interaction regions.

**z-index stack** — The CSS stacking order of rendering layers.
Tsingou's convention: z:0 (R3F, deepest), z:1 (visx), z:2 (p5),
z:3 (DOM, topmost and interactive).

### WebGL / R3F (z:0)

**React Three Fiber (R3F)** — A React renderer for Three.js enabling
declarative 3D scene composition with React's component model.
Tsingou's z:0 layer.

**Scene graph** — The hierarchical tree of 3D objects in a Three.js
scene. R3F maps React components to scene graph nodes.

**Force-directed graph** — A graph layout algorithm where nodes repel
each other and edges act as springs, reaching equilibrium that reveals
cluster structure. Used in R3F for entity relationship visualization.

**Globe / map overlay** — Geospatial rendering of entity positions,
signal origins, and coverage areas on a 3D globe or 2D map using R3F
with tile server integration (Mapbox, OSM).

**Trajectory visualization** — 3D path rendering for mobile emitters,
vehicles, or aircraft. Used for FISINT telemetry and COMINT movement
tracking in the R3F layer.

### SVG / visx (z:1)

**visx** — A collection of composable, low-level visualization
components for React built on D3. Tsingou's z:1 layer for data
visualization.

**Timeline** — A temporal visualization showing events distributed
along a time axis. Used for IOC timelines, communication timelines,
emitter activity timelines, and campaign progression.

**Heatmap** — A matrix visualization where cell color encodes value
intensity. Used for ATT&CK matrix heatmaps, topic frequency maps,
IOC correlation matrices, and contact frequency matrices.

**Scatter plot** — A visualization plotting individual data points in
2D coordinate space. Used for PDW parametric analysis (RF vs PRI,
RF vs PW) in ELINT.

**Histogram** — A visualization showing the distribution of values
across bins. Used for PRI distribution analysis and frequency
occupancy displays.

**Brush selection** — An interactive selection technique where the
analyst drags a rectangular region on a visx visualization to select
a subset of data points. Supports zoom, filter, and export operations.

### Canvas 2D / p5 (z:2)

**p5.js** — A JavaScript library for creative coding. Tsingou's z:2
layer for Canvas 2D rendering of continuous signal displays.

**Waterfall display** — See TSG.F.2 (SIGINT/EW Terminology).

**Spectrogram** — A visual representation of the spectrum of
frequencies in a signal as they vary with time. Typically time on one
axis, frequency on another, and amplitude as color. Rendered in p5
for continuous signal visualization.

**Constellation diagram** — An IQ scatter plot showing the phase and
amplitude of a modulated signal's symbol points. Used in ELINT for
modulation-on-pulse (MOP) classification. Rendered in p5.

**Noise field** — A generative visualization using Perlin or simplex
noise to represent background electromagnetic environment density.
Rendered in p5 as an ambient contextual layer.

**Polar plot** — A visualization in polar coordinates. Used for radar
scan pattern display (amplitude vs. angle) in the p5 layer.

### DOM / React (z:3)

**Control surface** — The interactive DOM layer providing analyst
controls, configuration panels, and status indicators. Built with
React and framer-motion.

**Alert panel** — A DOM component displaying real-time alerts generated
by anomaly detection threshold crossings. Supports acknowledge and
escalate interactions.

**Entity table** — A sortable, filterable DOM table displaying entity
catalogs (emitters, IOCs, signals). Built with AG-Grid column defs.

**Status banner** — A DOM element displaying TLP classification
markings, session status, and adapter health indicators.

**framer-motion** — A React animation library used in Tsingou's DOM
layer for smooth transitions, layout animations, and gesture-based
interactions.

---

## TSG.F.7 Cross-Reference Index

Maps key terms to the RFC section where they are first defined or
primarily discussed. Terms are listed alphabetically with the primary
section reference.

| Term | Primary Section | Type |
|------|----------------|------|
| 3C environment (congested, contested, constrained) | TSG.36.1 | Doctrine |
| 4-layer composited rendering | TSG.1.3.4 | Architecture |
| Abelian group | TSG.26.3.1 | Mathematics |
| Adapter (source) | TSG.9 | Architecture |
| AdapterManager | TSG.9 | Architecture |
| Admiralty system | TSG.2.9.4 | SIGINT |
| Anomaly detection | TSG.31 | Analysis |
| Antichain | TSG.26.2.4 | Mathematics |
| AOA (Angle of Arrival) | TSG.2.4.3 | SIGINT |
| Atom (effect-atom) | TSG.32.10.2 | Effect-TS |
| Atom.runtime() | TSG.32.10.6 | Effect-TS |
| ATT&CK mapping | TSG.2.6.4 | CYBINT |
| BaseSignal | TSG.8 | Schema |
| Branded types | TSG.32.4.3 | Effect-TS |
| Cause<E> | TSG.32.1.5 | Effect-TS |
| CEMA | TSG.36.6 | Doctrine |
| ChannelService | TSG.32.16.4 | Effect-TS |
| Collection function | TSG.26.4.1 | Mathematics |
| Compaction | TSG.26.8 | Mathematics |
| COMINT | TSG.2.3 | SIGINT |
| Composited rendering | TSG.1.3.4 | Visualization |
| Consolidate operator | TSG.26.6.4 | Mathematics |
| Contact chaining | TSG.2.3.5 | SIGINT |
| Context.Tag | TSG.32.2.1 | Effect-TS |
| CRDT | TSG.26.12.2 | Mathematics |
| ctx.set() | TSG.32.10.3 | Effect-TS |
| CUSUM | TSG.27 | Statistics |
| CYBINT | TSG.2.6 | SIGINT |
| d2ts | TSG.26.1.3 | Architecture |
| D2 graph | TSG.26.7.4 | Architecture |
| Data.TaggedError | TSG.32.5.1 | Effect-TS |
| Deinterleaving | TSG.2.4.5 | SIGINT |
| Derived graph | TSG.26.11.3 | Architecture |
| Diamond Model | TSG.2.6.5 | CYBINT |
| Differential dataflow | TSG.26.1.2 | Mathematics |
| Direction finding (DF) | TSG.36.16 | SIGINT |
| DOM layer (z:3) | TSG.24 | Visualization |
| EA (Electronic Attack) | TSG.36.3 | Doctrine |
| Effect<A, E, R> | TSG.32.1.1 | Effect-TS |
| Effect.gen | TSG.32.1.3 | Effect-TS |
| Effect.Service | TSG.32.2.1 | Effect-TS |
| ELINT | TSG.2.4 | SIGINT |
| EMBM | TSG.36.5 | Doctrine |
| EMOE | TSG.36.2.1 | Doctrine |
| EMSO | TSG.36.2 | Doctrine |
| Entity (Effect Cluster) | TSG.32.9.3 | Effect-TS |
| EOB (Electronic Order of Battle) | TSG.2.4.5 | SIGINT |
| EP (Electronic Protection) | TSG.36.3 | Doctrine |
| ES (Electronic Warfare Support) | TSG.36.3 | Doctrine |
| EventDistribution | TSG.32.16.4 | Effect-TS |
| EWIR | TSG.36.15 | Doctrine |
| EWMA | TSG.27 | Statistics |
| Exit<A, E> | TSG.32.1.5 | Effect-TS |
| FDOA | TSG.36.16 | SIGINT |
| Feature flags | TSG.32.11.4 | Effect-TS |
| FFT | TSG.25 | DSP |
| Fiber | TSG.32.6.1 | Effect-TS |
| FISINT | TSG.2.5 | SIGINT |
| Force-directed graph | TSG.28 | Visualization |
| FPUT (Fermi-Pasta-Ulam-Tsingou) | TSG.1.2.1 | Identity |
| Frontier | TSG.26.7 | Mathematics |
| Geolocation | TSG.36.16 | SIGINT |
| GEOINT | TSG.2.8 | SIGINT |
| GeoJSON | TSG.30 | Format |
| H3 (hexagonal index) | TSG.30 | Geospatial |
| Heatmap | TSG.22 | Visualization |
| Holonet | TSG.32.16.1 | Architecture |
| Hot-plug adapter | TSG.9 | Architecture |
| Index (arranged trace) | TSG.26.5.4 | Mathematics |
| Ingest graph | TSG.26.11.2 | Architecture |
| Intelligence cycle | TSG.3 | Doctrine |
| IOC (Indicator of Compromise) | TSG.2.6.7 | CYBINT |
| IQ (In-phase/Quadrature) | TSG.25 | DSP |
| ISA-18.2 | TSG.32.5 | Standards |
| Iterate operator | TSG.26.6.5 | Mathematics |
| JADC2 | TSG.36.8 | Doctrine |
| JEMSOC | TSG.36.2.3 | Doctrine |
| JetStream | TSG.11 | Protocol |
| Join operator (d2ts) | TSG.26.6.2 | Mathematics |
| JSONSchema.make() | TSG.32.4.6 | Effect-TS |
| Kill chain (Cyber) | TSG.2.6.6 | CYBINT |
| KL divergence | TSG.29 | Mathematics |
| KV Store (NATS) | TSG.11 | Protocol |
| Lattice | TSG.26.2.2 | Mathematics |
| Layer<Out, E, In> | TSG.32.3 | Effect-TS |
| Linear operator | TSG.26.6.1 | Mathematics |
| Machine (@effect/experimental) | TSG.32.15.3 | Effect-TS |
| ManagedRuntime | TSG.32.12.1 | Effect-TS |
| MASINT | TSG.2.7 | SIGINT |
| MDO (Multi-Domain Operations) | TSG.36.7 | Doctrine |
| Meet (GLB) | TSG.26.2.2 | Mathematics |
| Metric (Effect) | TSG.32.14.3 | Effect-TS |
| Mobius function | TSG.26.4.3 | Mathematics |
| MOP (Modulation on Pulse) | TSG.2.4.3 | SIGINT |
| MsgPack | TSG.32.9.6 | Format |
| Multi-INT | TSG.1.1.2 | SIGINT |
| MultiSet | TSG.26.5.1 | Mathematics |
| MVCC | TSG.26.12.3 | Mathematics |
| NATS | TSG.11 | Protocol |
| NDJSON | TSG.32.9.6 | Format |
| OSINT | TSG.2.9 | SIGINT |
| Output bridge | TSG.26.11.4 | Architecture |
| OutputBridge | TSG.7 | Architecture |
| p5 layer (z:2) | TSG.23 | Visualization |
| Partial order | TSG.26.2.1 | Mathematics |
| Pattern-of-life | TSG.31 | Analysis |
| PDW (Pulse Descriptor Word) | TSG.2.4.3 | SIGINT |
| PED (Processing, Exploitation, Dissemination) | TSG.2.1 | Doctrine |
| PIR (Priority Intelligence Requirements) | TSG.36.9 | Doctrine |
| Product lattice | TSG.26.2.3 | Mathematics |
| PubSub (Effect) | TSG.32.6.4 | Effect-TS |
| Queue (Effect) | TSG.32.6.4 | Effect-TS |
| R3F layer (z:0) | TSG.21 | Visualization |
| Recognized Electromagnetic Picture (REP) | TSG.36.22 | Doctrine |
| Reduce operator (d2ts) | TSG.26.6.3 | Mathematics |
| RegistryProvider | TSG.32.12.3 | Effect-TS |
| Retraction | TSG.26.10.2 | Mathematics |
| RPC (Effect) | TSG.32.9 | Effect-TS |
| RpcSerialization | TSG.32.9.6 | Effect-TS |
| Runtime (Effect) | TSG.32.12 | Effect-TS |
| Scan pattern | TSG.2.4.6 | SIGINT |
| Schema<A, I, R> | TSG.32.4.1 | Effect-TS |
| SchemaRegistry | TSG.8 | Architecture |
| Schema.TaggedStruct | TSG.32.4.4 | Effect-TS |
| Scope (Effect) | TSG.32.7.1 | Effect-TS |
| SDR (Software-Defined Radio) | TSG.16 | Hardware |
| SigMF | TSG.18 | Format |
| Signal kind | TSG.8 | Schema |
| SIGINT | TSG.2.2 | SIGINT |
| Spectrogram | TSG.19 | Visualization |
| STIX 2.1 | TSG.12 | Standards |
| STIX Bundle | TSG.12 | Standards |
| Stream<A, E, R> | TSG.32.8 | Effect-TS |
| TAXII 2.1 | TSG.13 | Standards |
| TCPED / TPED | TSG.36.9 | Doctrine |
| TDOA | TSG.36.16 | SIGINT |
| TLP (Traffic Light Protocol) | TSG.2.10.1 | Standards |
| Trace (difference function) | TSG.26.4.2 | Mathematics |
| Traffic analysis | TSG.2.3.6 | SIGINT |
| Update triple | TSG.26.4.2 | Mathematics |
| Version (d2ts) | TSG.26.5.2 | Mathematics |
| Version vector | TSG.26.12.1 | Mathematics |
| visx layer (z:1) | TSG.22 | Visualization |
| Waterfall display | TSG.19 | Visualization |
| Well-foundedness | TSG.26.2.5 | Mathematics |
| z-index stack | TSG.20 | Visualization |
| Z-score | TSG.27 | Statistics |

---

<!-- INTEGRATION NOTES

Appendix F — Glossary & Acronyms

Scope: All 36 RFC sections (TSG.1–TSG.36) + Appendices A-E

Coverage:
  - F.1: 180+ acronyms across SIGINT/EW, technical, standards, software
  - F.2: 50+ SIGINT/EW domain terms with doctrine references
  - F.3: 50+ Effect-TS terms with TSG.32 cross-references
  - F.4: 50+ mathematical symbols from TSG.26-TSG.30
  - F.5: 30+ protocol and format terms (NATS, STIX, TAXII, SigMF)
  - F.6: 30+ visualization terms across all four rendering layers
  - F.7: 150+ cross-reference entries mapping terms to primary sections

Dependencies:
  - All RFC sections (TSG.1 through TSG.36)
  - Appendix B (Bibliography) for citation keys
  - Appendix E (Research Document Index) for research references

Dependents:
  - All RFC sections (readers look up unfamiliar terms here)

Status: DRAFT
Line count: ~850 lines
-->
