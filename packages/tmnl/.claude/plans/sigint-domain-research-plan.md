# Plan: SIGINT_DOMAIN.md — Encyclopedic Domain Reference (15,000+ LINES)

## Scale Correction

**Target: 15,000+ LINES** (not words). This is a technical manual, not a summary.
At ~10 words/line average, that's ~150,000 words — an encyclopedic reference document.

## Deliverables

1. **`docs/tsingou/SIGINT_DOMAIN.md`** — 15k+ line encyclopedic SIGINT/OSINT domain reference
2. **Updates to `docs/tsingou/SPEC.md` Section 4** — refined intelligence scope with discipline mapping

---

## Document Architecture

The document is organized into 10 Parts with 40+ chapters. Each chapter is deeply structured with:
- Narrative exposition (multi-paragraph depth, not bullet summaries)
- ASCII architecture diagrams (multi-line, annotated)
- Extensive comparison tables (10-20+ row tables per topic)
- TypeScript/Effect.Schema code examples mapping domain concepts to Tsingou implementation
- Historical context and evolution of each discipline
- Worked examples and scenario walkthroughs
- Cross-references to ADRs, SPEC.md, source code paths

### Estimated Line Budget

| Part | Chapters | Est. Lines | Content Type |
|------|----------|-----------|--------------|
| I: Foundations | Ch 1-4 | 2,500 | Narrative + diagrams + tables |
| II: Intelligence Cycle | Ch 5-10 | 2,000 | 6 phases, deep Tsingou mapping per phase |
| III: SIGINT Disciplines | Ch 11-18 | 3,500 | 8 disciplines, each with history/methods/processing/Tsingou mapping |
| IV: Data Fusion | Ch 19-22 | 1,200 | JDL model, Dasarathy, multi-INT, d2ts mapping |
| V: Processing Chain | Ch 23-29 | 1,500 | 7-stage processing pipeline, detailed per-stage |
| VI: Analysis Techniques | Ch 30-37 | 2,000 | 8 techniques, each with SNA metrics/algorithms/Tsingou viz |
| VII: Structured Analytics | Ch 38-43 | 1,000 | SATs, ACH, confidence levels, ICD 203 |
| VIII: Platform Ecosystem | Ch 44-51 | 1,500 | 8 platforms, architecture comparison matrix |
| IX: Tsingou Mapping | Ch 52-57 | 1,500 | Adapter-discipline mapping, end-to-end workflows, code examples |
| X: Appendices | A-F | 1,500 | Glossary (150+ terms), references, legal frameworks, signal taxonomy |
| **TOTAL** | **57+ chapters** | **~18,200** | |

---

## Part I: Foundations of Intelligence (~2,500 lines)

### Chapter 1: Intelligence in the Digital Age (~600 lines)
- What intelligence analysis is — ODNI definition, purpose, consumer-producer relationship
- Historical arc: from human spies to signals interception to digital SIGINT
- The intelligence explosion: petabytes/day, AI-augmented analysis, automated collection
- Why visualization matters: cognitive load, pattern recognition, the analyst's decision loop
- Where Tsingou fits in the modern intelligence landscape
- This document's purpose and how to use it
- **Diagram**: Intelligence production pipeline (collection → processing → analysis → product)
- **Table**: Intelligence disciplines taxonomy (all 8 INT types with definitions)

### Chapter 2: The Intelligence Community Structure (~500 lines)
- US IC organization: 18 agencies, ODNI coordination
- NSA role in SIGINT, NGA role in GEOINT, CIA role in HUMINT/all-source
- Five Eyes alliance (UKUSA): history from WWII BRUSA to modern cooperation
  - Member nations: US (NSA), UK (GCHQ), Canada (CSE), Australia (ASD), New Zealand (GCSB)
  - ECHELON system: satellite intercept stations, keyword filtering, global coverage
  - Expanded alliances: Nine Eyes, Fourteen Eyes
- NATO intelligence sharing: BICES, Allied Command Transformation
- **Diagram**: IC organizational hierarchy (ASCII)
- **Table**: Five Eyes members with agencies, capabilities, and key facilities
- **Table**: SIGINT-relevant US IC agencies with SIGINT roles

### Chapter 3: Legal and Ethical Frameworks (~700 lines)
- US legal framework:
  - Foreign Intelligence Surveillance Act (FISA) — authorities, FISC, Section 702
  - Executive Order 12333 — US person protections, authorized collection methods
  - USA PATRIOT Act / USA FREEDOM Act — metadata collection, business records
  - PPD-28 — Signals Intelligence Activities (privacy protections for non-US persons)
- International frameworks:
  - European Convention on Human Rights (ECHR) Article 8
  - EU General Data Protection Regulation (GDPR) — implications for SIGINT
  - Wassenaar Arrangement — export controls on intrusion software
  - Budapest Convention on Cybercrime
- Ethical considerations:
  - Proportionality and necessity principles
  - Minimization procedures (US person information)
  - Oversight mechanisms: congressional oversight, IG investigations, PCLOB
  - Responsible disclosure for vulnerability intelligence
- Tsingou implications:
  - Platform is an analysis/visualization tool — legal responsibility lies with operators
  - Data handling: NATS KV retention policies, signal metadata vs content distinction
  - Export controls: STIX bundles may contain controlled information
- **Table**: US legal authorities matrix (authority, scope, oversight, relevance to Tsingou)
- **Table**: International legal frameworks comparison (12 jurisdictions)

### Chapter 4: Classification and Handling Markings (~700 lines)
- US classification system: UNCLASSIFIED, CONFIDENTIAL, SECRET, TOP SECRET
- Sensitive Compartmented Information (SCI):
  - SIGINT compartments: SI, TK, G, HCS
  - Codeword compartments and access controls
- Controlled Unclassified Information (CUI) framework
- NATO classification: COSMIC TOP SECRET through NATO UNCLASSIFIED
- Handling caveats: NOFORN, FVEY, REL TO, ORCON, PROPIN
- Traffic Light Protocol (TLP): RED, AMBER+STRICT, AMBER, GREEN, CLEAR
  - How TLP maps to STIX marking-definition objects
- STIX Data Marking:
  - marking-definition SDO and granular markings
  - TLP marking in STIX 2.1 bundles
  - Tsingou export: applying appropriate markings at dissemination
- **Table**: US classification levels with definitions and examples
- **Table**: SCI compartment types relevant to SIGINT
- **Table**: TLP colors with STIX marking-definition mapping
- **Code example**: Effect.Schema for TLP marking in Tsingou export

---

## Part II: The Intelligence Cycle — All 6 Phases (~2,000 lines)

### Chapter 5: Direction — Planning & Requirements (~400 lines)
- Purpose: Determine what intelligence is needed, by whom, and when
- Key concepts:
  - Priority Intelligence Requirements (PIRs) — commander/policymaker needs
  - Essential Elements of Information (EEIs) — specific questions to answer
  - Specific Intelligence Requirements (SIRs) — tasking for collection
  - Intelligence Collection Plan (ICP) — which sources, which methods, what priority
  - Standing vs. ad hoc requirements
- Requirements management:
  - Requirements registration and tracking
  - Collection strategies (single-INT vs multi-INT)
  - Coverage analysis: identifying intelligence gaps
- **Tsingou mapping — Session Configuration**:
  - Collection requirements → adapter selection and configuration
  - Focus areas → d2ts graph operator parameters (keywords, entity names, IP ranges)
  - ATT&CK techniques of interest → derived graph filter predicates
  - Priority sources → adapter ordering in AdapterManager
  - Time window → real-time vs JetStream replay
- **Diagram**: Requirements flow from PIR to collection tasking (ASCII)
- **Table**: Tsingou session configuration fields → intelligence requirement types
- **Code example**: Session configuration schema in Effect.Schema

### Chapter 6: Collection — Sources and Methods (~400 lines)
- Purpose: Gather raw data from all available sources
- Collection disciplines overview:
  - Active vs passive collection
  - Persistent vs episodic collection
  - Single-source vs multi-source
- Collection platforms:
  - Ground-based (fixed stations, mobile units)
  - Airborne (UAV, reconnaissance aircraft, AWACS)
  - Space-based (satellites, CubeSats)
  - Cyber (network taps, implants, APIs)
  - Open source (internet, media, public records)
- Collection management:
  - Tasking, collection, processing, exploitation, dissemination (TCPED)
  - Sensor-to-shooter timelines
  - Collection effectiveness metrics
- **Tsingou mapping — 10 Source Adapters**:
  - Complete adapter inventory table: adapter type, protocol, latency, bandwidth, disciplines served
  - In-process vs sidecar vs NATS leaf deployment models
  - Hot-plug lifecycle: register → connect → onSignal → disconnect
  - Health monitoring: AdapterHealth schema with status/latency/counts
- **Diagram**: Collection flow through Tsingou adapters (ASCII, full-page)
- **Table**: 10 adapters with collection discipline mapping (detailed)
- **Code example**: Adapter registration with AdapterManager

### Chapter 7: Processing — Raw Data to Usable Form (~350 lines)
- Purpose: Convert raw collected data into a form suitable for analysis
- Processing activities:
  - Decryption and decoding (converting encrypted/encoded signals)
  - Language translation (multilingual COMINT)
  - Signal normalization (diverse formats → common schema)
  - Deduplication (same signal from multiple collectors)
  - Metadata extraction and enrichment
  - Geolocation computation (TDOA, FDOA, DF)
  - Format conversion (proprietary → standard)
- Processing challenges:
  - Volume: petabytes per day at scale
  - Velocity: real-time requirements for tactical SIGINT
  - Variety: heterogeneous source formats
  - Veracity: noise, deception, spoofing
- **Tsingou mapping — d2ts Ingest Graph**:
  - schemaValidate operator → schema registry lookup → decode/validate
  - normalize operator → timestamp normalization, version assignment
  - tag operator → source metadata attachment
  - consolidate operator → deduplication
  - BaseSignal as the universal normalized format
- **Diagram**: Ingest graph operator chain (ASCII)
- **Table**: Processing activity → d2ts operator mapping
- **Code example**: Ingest graph factory with schema validation

### Chapter 8: Analysis & Production (~350 lines)
- Purpose: Integrate, evaluate, and interpret processed data to produce intelligence
- Analysis types:
  - Current intelligence — real-time situational awareness
  - Estimative intelligence — predictive assessments
  - Warning intelligence — imminent threats
  - Research intelligence — deep-dive studies
  - Scientific and technical intelligence (S&TI)
- Analytic methodology:
  - All-source analysis — integrating multiple INTs
  - Single-source analysis — deep expertise in one discipline
  - Target-centric analysis — entity-focused investigation
  - Activity-based intelligence (ABI) — pattern discovery from observable activities
- Confidence and probability:
  - ICD 203 analytic standards
  - Probability language: "almost no" (01-05%) to "almost certain" (95-99%)
  - Confidence levels: low, moderate, high (separate from probability)
  - Source reliability ratings (A-F) and information accuracy ratings (1-6)
- **Tsingou mapping — d2ts Derived Graph**:
  - join operator → cross-source correlation (multi-INT fusion)
  - reduce operator → aggregation, rolling statistics, baseline computation
  - count / topK → frequency analysis, most-active entities
  - window operator → temporal bounding, sliding window analysis
  - iterate operator → convergence (anomaly threshold refinement)
  - Custom operators: ATT&CK mapping, entity extraction, sentiment scoring
- **Diagram**: Derived graph topology options (ASCII, multiple configurations)
- **Table**: Analysis type → d2ts operator configuration
- **Table**: ICD 203 probability language with percentage ranges
- **Code example**: Derived graph with join + window + anomaly detection

### Chapter 9: Dissemination — Delivering Intelligence Products (~300 lines)
- Purpose: Deliver finished intelligence to consumers in appropriate format and timeliness
- Intelligence product types:
  - Intelligence reports (serial publications, one-time reports)
  - Alerts and warnings (flash traffic, CRITIC messages)
  - Briefings (oral, written, multimedia)
  - Intelligence summaries (daily, weekly, situation reports)
  - Databases and feeds (machine-readable, continuous)
- Dissemination channels:
  - Pull: consumer queries databases, searches repositories
  - Push: producer sends to consumer based on standing requirements
  - Broadcast: mass dissemination to all authorized consumers
- Timeliness categories:
  - Immediate: CRITIC/FLASH (minutes)
  - Priority: within hours
  - Routine: within days
- **Tsingou mapping — Output Bridge + STIX Export**:
  - Real-time: NATS fan-out → atom state → rendering layers
  - Alert: anomaly threshold breach → alert atom → DOM panel + NATS publish
  - Structured export: STIX 2.1 bundles → TAXII collections
  - Integration: OpenCTI connector, MISP events, TheHive alerts
- **Diagram**: Dissemination channels from Tsingou (ASCII)
- **Table**: Intelligence product type → Tsingou output mechanism
- **Code example**: STIX bundle export from d2ts derived output

### Chapter 10: Feedback — Closing the Loop (~200 lines)
- Purpose: Assess intelligence effectiveness and adjust collection/analysis
- Feedback mechanisms:
  - Consumer satisfaction surveys
  - Collection effectiveness metrics (yield per source)
  - Analytic accuracy tracking (predictions vs. outcomes)
  - Requirements refinement based on intelligence gaps identified
- Automation opportunities:
  - Automatic collection priority adjustment based on yield
  - Anomaly threshold calibration from analyst feedback
  - Source quality scoring from validation rates
- **Tsingou mapping — Feedback Loop**:
  - Analyst marks false positive → adjust anomaly threshold atoms
  - Source quality scores per adapter → adapter priority reranking
  - Window duration auto-adjustment based on signal rate
  - Join condition refinement from analyst corrections
  - Session journal: record decisions for institutional learning
- **Table**: Feedback metric → Tsingou implementation path
- **Code example**: Feedback loop adjusting anomaly threshold via atom

---

## Part III: SIGINT Sub-Disciplines (Deep Dive) (~3,500 lines)

### Chapter 11: SIGINT Overview — The Signals Intelligence Discipline (~400 lines)
- Formal definition: "Intelligence derived from electronic signals and systems used by foreign targets" (NSA)
- Canonical sub-disciplines: COMINT, ELINT, FISINT
- Extended family: CYBINT/DNINT (emerging), TELINT (subset of FISINT)
- Historical evolution:
  - WWI: Room 40 (British Admiralty), MI1b (UK), US Army SIGINT
  - WWII: Bletchley Park (Enigma, Colossus), US Magic/Ultra
  - Cold War: ECHELON, satellite SIGINT, underwater cables (IVY BELLS)
  - Post-9/11: bulk collection, metadata analysis, NSA/GCHQ programs (PRISM, TEMPORA, XKeyscore)
  - Modern era: 5G intercept challenges, encrypted communications, AI-augmented analysis
- SIGINT collection postures:
  - Strategic SIGINT: national-level, persistent, broad
  - Tactical SIGINT: battlefield, immediate, specific
  - Operational SIGINT: theater/campaign level, medium-term
- SIGINT organization:
  - National: NSA (US), GCHQ (UK), BND (Germany), DGSE (France)
  - Military: service-specific SIGINT units (US Army INSCOM, US Navy NIOC)
  - Coalition: Five Eyes SIGINT sharing protocols
- **Diagram**: SIGINT discipline taxonomy tree (ASCII, comprehensive)
- **Diagram**: Historical timeline of SIGINT milestones (ASCII)
- **Table**: SIGINT posture comparison (strategic vs tactical vs operational)
- **Table**: National SIGINT agencies worldwide (20+ countries)

### Chapter 12: COMINT — Communications Intelligence (~500 lines)
- **Definition**: Intelligence from interception and analysis of communications
- **Scope**: Voice, data, text, video — any signal carrying human-intended information
- **History**:
  - Cable censorship (WWI)
  - HF radio intercept (WWII MAGIC/ULTRA)
  - Satellite intercept (ECHELON era)
  - Fiber-optic tapping (GCHQ TEMPORA, NSA PRISM)
  - Modern encrypted comms challenge
- **Collection methods** (detailed):
  - Radio Frequency intercept (HF/VHF/UHF/SHF)
    - Direction Finding (DF) and geolocation (TDOA, single-site, multi-site)
    - Frequency scanning and spectrum monitoring
  - Satellite intercept (SIGAD stations, GEO/LEO coverage)
  - Cable intercept (undersea cable tapping, ISP cooperation)
  - Packet capture (network taps, SPAN ports, lawful intercept)
  - IMSI catchers (cell-site simulators, Stingray)
  - Social media monitoring (API-based, scraping)
- **Processing**:
  - Decryption: known plaintext, side-channel, key recovery, quantum-vulnerable ciphers
  - Language translation: human linguists, machine translation, dialect identification
  - Content extraction: keyword matching, named entity recognition, topic modeling
  - Metadata analysis: contact chaining (hop analysis), call detail records (CDRs), network graph construction
  - Traffic analysis: communication patterns without content, timing analysis, volume analysis
  - Voice recognition: speaker identification, voiceprint databases, emotional analysis
- **Modern COMINT challenges**:
  - End-to-end encryption (Signal, WhatsApp, Wire)
  - Ephemeral messaging (Snapchat, Telegram timers)
  - Decentralized/P2P communications (Matrix, Briar)
  - 5G network slicing complicating intercept
  - VPN/Tor usage for anonymization
- **Tsingou adapter mapping** (detailed):
  - `WebSocketAdapter` → Real-time chat stream monitoring, IRC/XMPP bridges
  - `HttpAdapter` → Social media API polling, email gateway APIs, CDR APIs
  - `RssAdapter` → Blog/news monitoring, forum RSS feeds, public mailing lists
  - `NatsAdapter` → Internal message bus intercepts, IDS alert correlation
  - `FileWatchAdapter` → PCAP file tailing, CDR log ingestion, email archive scanning
  - `StixTaxiiAdapter` → COMINT-derived IOCs from CTI feeds
- **Signal schema** for COMINT:
  - BaseSignal fields relevant to COMINT
  - Metadata enrichment: language, encryption status, priority
  - Content vs metadata distinction in schema design
- **Analysis techniques for COMINT**:
  - Contact chaining → Link Analysis (R3F)
  - Communication timeline → Timeline Analysis (visx)
  - Geolocation of communicators → Geospatial Analysis (R3F)
  - Anomalous communication patterns → Anomaly Detection (DOM)
  - Behavioral baseline → Pattern-of-Life (visx)
- **Diagram**: COMINT collection-to-analysis flow in Tsingou (ASCII, full-page)
- **Table**: COMINT collection method → Tsingou adapter mapping (15+ rows)
- **Table**: COMINT processing step → d2ts operator mapping
- **Code example**: COMINT-specific derived graph (contact chaining via join)

### Chapter 13: ELINT — Electronic Intelligence (~500 lines)
- **Definition**: Intelligence from non-communication electromagnetic emissions
- **Scope**: Radar, navigation beacons, IFF, electronic warfare, jammers
- **History**:
  - WWII: Window/Chaff, cavity magnetron, H2S radar intercept
  - Cold War: FERRET flights, ELINT satellites (GRAB, POPPY, PARCAE)
  - Modern: cognitive/adaptive radar, LPI (Low Probability of Intercept) waveforms, DRFM
- **Signal characteristics** (detailed):
  - Pulse Descriptor Words (PDWs): RF, PA, PW, PRI, TOA, AOA
  - Modulation types: pulse, CW, chirp (LFM), phase-coded, frequency-hopped
  - Scan patterns: conical, sector, track-while-scan, phased array
  - Waveform agility: PRF stagger, frequency agility, pulse compression
- **Collection methods** (detailed):
  - Wide-band receivers (crystal video, channelized, digital)
  - Narrowband receivers (superheterodyne, compressive)
  - Direction finding: amplitude comparison, phase interferometry, time difference
  - Collection platforms: ground (fixed/mobile), airborne (RC-135 RIVET JOINT, EP-3E ARIES), space (ELINT satellites)
- **Processing**:
  - Pulse sorting: deinterleaving mixed emitter environments (primary/secondary sort)
  - Parametric measurement: frequency, PRI, PW, scan rate, beam pattern
  - Emitter identification: parametric matching against emitter databases (EOB)
  - Mode determination: search, track, acquisition, guidance
  - Electronic Order of Battle (EOB) maintenance
  - Signal environment mapping: frequency occupancy, spatial distribution
- **Modern ELINT challenges**:
  - LPI radar: spread-spectrum, noise-like waveforms
  - Cognitive/adaptive radar: dynamic parameter changes
  - MIMO radar: multiple transmit beams, complex signal space
  - DRFM jammers: perfect copies of intercepted signals
  - Dense signal environments: thousands of emitters in contested spectrum
- **Tsingou adapter mapping** (detailed):
  - `HolonetBridgeAdapter (SDR)` → GNU Radio flow graph for pulse detection, FFT, PDW extraction
  - `SerialAdapter` → Direct SDR device output (RTL-SDR, HackRF raw IQ)
  - `NatsAdapter` → ELINT processor output (sidecar architecture)
  - `FileWatchAdapter` → SigMF recording playback, ELINT log ingestion
- **Signal schema for ELINT**:
  - SdrSignal extension with frequency, bandwidth, modulation fields
  - PDW as a schema: RF, PA, PW, PRI, TOA, AOA
  - Emitter library entry schema for EOB
- **Analysis techniques for ELINT**:
  - Pulse parameter histograms → visx distribution plots
  - PRI analysis (constant, stagger, jitter, dwell-switch) → visx time-series
  - Frequency occupancy → p5 spectrum waterfall
  - Emitter geolocation (AOA triangulation) → R3F geospatial
  - EOB tracking → Link Analysis (R3F entity graph with emitter nodes)
- **Diagram**: ELINT processing chain from antenna to analysis (ASCII, full-page)
- **Diagram**: PDW extraction pipeline (ASCII)
- **Table**: Radar types with parametric characteristics (20+ types)
- **Table**: ELINT platform inventory (10+ platforms with frequency range, sensitivity)
- **Code example**: Effect.Schema for Pulse Descriptor Word
- **Code example**: ELINT-specific derived graph (emitter clustering via reduce)

### Chapter 14: FISINT — Foreign Instrumentation Signals Intelligence (~300 lines)
- **Definition**: Intelligence from foreign weapons system testing signals
- **Scope**: Telemetry, beaconry, video data links, command destruct, tracking
- **History**:
  - Cold War: monitoring Soviet ICBM tests from Turkey, Iran, Pakistan ground stations
  - Treaties: SALT/START — telemetry encryption ban (later lifted)
  - Modern: space launch monitoring, hypersonic weapon testing, drone telemetry
- **Signal types** (detailed):
  - Telemetry (TLM): missile flight data, engine parameters, guidance corrections
  - Beaconry: tracking beacons for range safety and trajectory measurement
  - Video data links: UAV/missile sensor feeds
  - Command systems: uplink commands to missiles/satellites
  - Tracking: radar tracking data from test ranges
- **Collection methods**:
  - Ground stations near test ranges (Shemya AK, Pine Gap AU, Menwith Hill UK)
  - Airborne collection (COBRA BALL RC-135S)
  - Ship-based collection (USNS Howard O. Lorenzen)
  - Space-based (early warning satellites, SBIRS)
- **Processing**:
  - Telemetry format identification (PCM, PAM, FM/FM)
  - Frame synchronization and decommutation
  - Parameter extraction: velocity, acceleration, attitude, engine thrust
  - Trajectory reconstruction from telemetry data
  - Capability assessment: range, payload, accuracy (CEP)
- **Tsingou mapping**:
  - `SerialAdapter` → Telemetry receiver output
  - `NatsAdapter` → Processed telemetry streams from sidecar decoders
  - Custom schema registry entries for telemetry frame formats
  - d2ts derive graph: trajectory reconstruction via reduce, anomaly detection on parameters
- **Table**: FISINT signal types with characteristics
- **Table**: Collection platforms and coverage areas
- **Code example**: Telemetry frame schema in Effect.Schema

### Chapter 15: CYBINT/DNINT — Cyber/Digital Network Intelligence (~500 lines)
- **Definition**: Intelligence from cyber operations, network traffic, digital artifacts
- **Scope**: Network traffic analysis, malware analysis, dark web intelligence, vulnerability intelligence
- **Emergence as a discipline**:
  - NSA's SIGINT vs cyber operations convergence
  - US Cyber Command (USCYBERCOM) — dual-hat with NSA
  - Defensive vs offensive cyber operations
  - Cyber Threat Intelligence (CTI) as commercial industry
- **Collection methods** (detailed):
  - Passive network monitoring:
    - Full packet capture (PCAP)
    - Flow records (NetFlow, sFlow, IPFIX)
    - DNS logging (passive DNS databases)
    - TLS certificate monitoring (Certificate Transparency logs)
  - Active collection:
    - Vulnerability scanning (Nmap, Nessus, OpenVAS)
    - Honeypots and honeynets
    - Dark web crawling and marketplace monitoring
    - Malware sandboxing (Cuckoo, Joe Sandbox, ANY.RUN)
  - Threat intelligence feeds:
    - Commercial: Recorded Future, Mandiant, CrowdStrike Falcon Intelligence
    - Open: AlienVault OTX, Abuse.ch, VirusTotal
    - ISAC/ISAO sector-specific sharing
    - Government: CISA AIS (Automated Indicator Sharing)
- **Processing**:
  - IOC extraction: IP addresses, domains, URLs, file hashes, email addresses
  - Malware analysis: static (PE header, string extraction), dynamic (sandbox execution)
  - Network traffic analysis: protocol identification, anomaly detection, exfiltration detection
  - Attribution analysis: TTPs, infrastructure overlap, code similarity
  - Vulnerability assessment: CVE matching, CVSS scoring, exploit availability
- **STIX alignment** (detailed):
  - SCOs: network-traffic, ipv4-addr, ipv6-addr, domain-name, url, email-addr, file, process, software, user-account, windows-registry-key, x509-certificate
  - SDOs: indicator, malware, threat-actor, intrusion-set, campaign, vulnerability, tool, attack-pattern, infrastructure
  - SROs: relationship, sighting
  - This is the MOST STIX-native discipline — every concept has a direct STIX mapping
- **Tsingou adapter mapping**:
  - `FileWatchAdapter` → PCAP tailing, IDS log ingestion, DNS query logs
  - `HttpAdapter` → Threat intel API polling (OTX, VT, Shodan, GreyNoise)
  - `StixTaxiiAdapter` → TAXII feed subscription (commercial and open)
  - `WebSocketAdapter` → Real-time threat feed websockets
  - `NatsAdapter` → IDS/IPS alert streams, SIEM event forwarding
- **Analysis techniques for CYBINT**:
  - IOC correlation → Link Analysis (R3F): IP ↔ domain ↔ hash ↔ campaign
  - Attack timeline → Timeline Analysis (visx): CVE disclosure → exploit → campaign
  - Threat actor infrastructure → Geospatial Analysis (R3F): IP geolocation
  - Anomalous network behavior → Anomaly Detection (DOM)
  - APT behavioral baseline → Pattern-of-Life (visx): normal vs compromised traffic
  - TTP classification → Kill Chain / ATT&CK Mapping (visx)
- **Diagram**: CYBINT collection-to-analysis flow in Tsingou (ASCII, full-page)
- **Table**: IOC types with STIX SCO mapping (20+ types)
- **Table**: Threat intelligence feed sources with adapter type (15+ sources)
- **Table**: MITRE ATT&CK tactic → Tsingou detection operator mapping
- **Code example**: CYBINT IOC correlation in d2ts derived graph
- **Code example**: Threat intel API adapter configuration

### Chapter 16: MASINT — Measurement and Signature Intelligence (~500 lines)
- **Definition**: Intelligence from technical sensors measuring physical phenomena
- **Scope**: Distinct from SIGINT — measures physical/chemical/biological signatures, not communications or electronics
- **Sub-disciplines** (each with detailed coverage):
  - **RADINT** (Radar Intelligence): Active/passive radar signatures, RCS measurement, SAR imagery
  - **NUCINT** (Nuclear Intelligence): Radiation detection, nuclear test monitoring (CTBTO IMS), fallout analysis
  - **ACINT** (Acoustic Intelligence): Underwater acoustics (SOSUS), submarine detection, torpedo signatures
  - **ACOUSTINT** (Atmospheric Acoustics): Infrasound monitoring, explosion detection, aircraft noise signatures
  - **IRINT** (Infrared Intelligence): Thermal signatures, missile plume detection (SBIRS), industrial activity
  - **LASINT** (Laser Intelligence): Laser designator detection, LIDAR analysis, directed energy weapons
  - **CBRINT** (Chemical/Biological/Radiological Intelligence): Chemical agent detection, biological warfare indicators
  - **ELECTRO-OPTINT**: Multispectral/hyperspectral imagery, spectral signatures
  - **RF/EMPINT**: Unintentional RF emissions (TEMPEST), EMP signatures
  - **Materials Intelligence**: Physical samples, debris analysis, materials composition
- **Collection platforms**:
  - Space-based: DSP/SBIRS (IR), NOSS/White Cloud (ELINT/MASINT), weather satellites
  - Ground-based: seismic arrays (IMS), hydroacoustic stations, radionuclide stations
  - Airborne: WC-135 Constant Phoenix (nuclear), U-2/Global Hawk (multi-sensor)
  - Maritime: SOSUS arrays, towed sonar arrays, submarines
- **Processing**:
  - Spectral analysis: FFT, wavelet transforms, spectral matching
  - Pattern matching: signature libraries, template matching, machine learning classifiers
  - Anomaly detection: baseline deviation, change detection
  - Multi-sensor fusion: combining MASINT with imagery and SIGINT
- **Tsingou mapping**:
  - `SerialAdapter` → Sensor array outputs (seismic, acoustic, radiological detectors)
  - `OscAdapter` → IoT sensor networks (distributed environmental sensors)
  - `NatsAdapter` → Processed sensor data from sidecar analysis nodes
  - `HolonetBridgeAdapter` → GNU Radio for RF MASINT
  - Custom d2ts operators for spectral analysis and signature matching
- **Table**: MASINT sub-disciplines with sensors, signatures, and platforms (comprehensive)
- **Table**: CTBTO IMS station types with detection capabilities
- **Diagram**: MASINT sensor taxonomy tree (ASCII)
- **Code example**: Spectral signature schema in Effect.Schema

### Chapter 17: GEOINT — Geospatial Intelligence (~400 lines)
- **Definition**: "Intelligence derived from the exploitation and analysis of imagery and geospatial information" (NGA)
- **Components**:
  - IMINT (Imagery Intelligence): satellite/aerial imagery, electro-optical, SAR, MSI
  - Geospatial Information: maps, charts, geodetic data, terrain models, cultural features
  - Geospatial Analysis: spatial reasoning, change detection, movement analysis
- **Collection methods**:
  - Satellite imagery:
    - Electro-optical (EO): visible/near-IR, sub-meter resolution (commercial: Maxar, Planet, Airbus)
    - Synthetic Aperture Radar (SAR): all-weather, day/night (Capella, ICEYE, Umbra)
    - Multispectral/Hyperspectral Imagery (MSI/HSI): spectral band analysis
    - Thermal Infrared: heat signatures, industrial activity detection
  - Airborne imagery: UAV (Predator, Global Hawk, commercial), manned aircraft, aerostats
  - Ground-based: CCTV, ground-based radar, surveying
  - Commercial geospatial data: OpenStreetMap, Google Earth, Maxar SecureWatch
- **Analysis types**:
  - First Phase Exploitation (FPE): initial screening, time-critical reporting
  - Detailed Exploitation: comprehensive image analysis, mensuration
  - Pattern-of-Life (POL): longitudinal observation over time
  - Change Detection: comparing images over time for new construction, movement, etc.
  - Activity-Based Intelligence (ABI): correlating imagery with other INTs
  - 3D terrain analysis: line-of-sight, viewshed, mobility corridors
- **NGA GEOINT Doctrine (Pub 1.0)**:
  - GEOINT operations process: planning, collection, production, dissemination
  - Integration with other INTs
  - Foundation GEOINT vs activity GEOINT
- **Tsingou mapping**:
  - `HttpAdapter` → Map tile APIs (Mapbox, OpenStreetMap), satellite imagery APIs (Planet, Maxar)
  - R3F layer → 3D globe visualization, terrain rendering, signal marker placement
  - visx layer → 2D map overlays, heatmaps, movement traces
  - d2ts derived graph → signal × location joins for geolocated analysis
  - STIX `location` SDO for geolocated intelligence products
- **Diagram**: GEOINT collection-to-rendering flow in Tsingou (ASCII)
- **Table**: Satellite imagery providers with resolution, revisit, cost
- **Table**: GEOINT analysis type → Tsingou rendering layer mapping
- **Code example**: Location-enriched signal schema

### Chapter 18: OSINT — Open Source Intelligence (~400 lines)
- **Definition**: "Publicly available information that anyone can lawfully obtain by request, purchase, or observation" (ODNI)
- **Distinction**: Open source information (OSINF) vs. OSINT — raw data vs. processed intelligence
- **History**:
  - FBIS (Foreign Broadcast Information Service, 1941-2005)
  - Open Source Center (OSC, 2005-2015)
  - Open Source Enterprise (OSE, 2015-present)
  - ODNI IC OSINT Strategy 2024-2026 — elevating OSINT as a first-class discipline
- **Source categories**:
  - Media: newspapers, television, radio, online news, podcasts
  - Internet: websites, blogs, forums, social media, wikis
  - Government data: public records, budgets, legislation, court filings, patent databases
  - Academic: research papers, conference proceedings, dissertations, preprints
  - Commercial: financial reports, industry analysis, market data, corporate filings
  - Gray literature: think tank reports, NGO publications, technical manuals
  - Geospatial open source: commercial satellite imagery, OpenStreetMap, Google Earth
  - Dark web: .onion sites, anonymous marketplaces, paste sites
- **Collection techniques**:
  - Social media monitoring: API-based (X/Twitter, Reddit, Telegram), scraping, social listening
  - Search engine dorking: Google hacking database, specialized search operators
  - Domain/infrastructure reconnaissance: WHOIS, DNS, certificate transparency, Shodan
  - Document and metadata analysis: FOCA, ExifTool, PDF metadata
  - Deep/dark web monitoring: Tor crawling, marketplace monitoring, paste site scanning
  - Automated collection: RSS aggregation, web scraping frameworks, API orchestration
- **Tradecraft**:
  - Operational security (OPSEC) for OSINT collectors
  - Managed attribution / non-attributable systems
  - VPN/Tor for collection anonymization
  - Source evaluation: reliability, accuracy, currency, relevance
  - Legal considerations: GDPR, CCPA, Computer Fraud and Abuse Act
- **ODNI IC OSINT Strategy 2024-2026 key themes**:
  - Elevate OSINT to parity with classified collection disciplines
  - Embrace AI/ML for automated OSINT processing
  - Develop OSINT-specific analytic tradecraft
  - Build OSINT workforce and training pipeline
  - Data volume challenge: 64→147 zettabytes (2020-2024)
- **Tsingou adapter mapping**:
  - `RssAdapter` → News/blog/forum monitoring, threat intel RSS feeds, government RSS
  - `HttpAdapter` → API polling (Twitter/X, Reddit, Shodan, GreyNoise, VirusTotal)
  - `WebSocketAdapter` → Real-time social media streams, chat platform bridges
  - `FileWatchAdapter` → Downloaded document analysis, scraped data ingestion
  - `NatsAdapter` → OSINT tool output (SpiderFoot, Maltego transform results)
- **Analysis techniques for OSINT**:
  - Entity extraction → Link Analysis (R3F): person ↔ organization ↔ location graph
  - Publication timeline → Timeline Analysis (visx): article/post chronology
  - Source geolocation → Geospatial Analysis (R3F): geotagged social media
  - Trend detection → Anomaly Detection (DOM): unusual mention spikes
  - Author behavior → Pattern-of-Life (visx): posting frequency baseline
  - Narrative analysis → Kill Chain (visx): disinformation campaign mapping
- **Diagram**: OSINT collection-to-analysis flow in Tsingou (ASCII, full-page)
- **Table**: OSINT source category → Tsingou adapter mapping (detailed)
- **Table**: OSINT tools comparison (SpiderFoot, Maltego, Recon-ng, theHarvester, Shodan, etc.)
- **Code example**: RSS feed adapter configuration for news monitoring

---

## Part IV: Data Fusion Models (~1,200 lines)

### Chapter 19: JDL Data Fusion Model (~400 lines)
- History: Joint Directors of Laboratories (JDL) Data Fusion Group, 1986
- Revised model: Data Fusion Information Group (DFIG), 2004
- **Level 0: Source Preprocessing / Data Assessment**
  - Raw signal conditioning, noise reduction, format normalization
  - Tsingou mapping: adapter signal conditioning, schemaValidate operator
- **Level 1: Object Assessment / Entity Estimation**
  - Entity detection, tracking, identification, characterization
  - State estimation: position, velocity, attributes
  - Association: correlating observations to entities
  - Tsingou mapping: d2ts ingest graph entity extraction, schema enrichment
- **Level 2: Situation Assessment**
  - Aggregating entities into relational structures
  - Force structure, network analysis, order of battle
  - Event detection: recognizing significant events from entity states
  - Tsingou mapping: d2ts derived graph join operator, Link Analysis (R3F)
- **Level 3: Impact Assessment / Threat Refinement**
  - Predicting future states and impacts
  - Risk assessment, threat estimation, vulnerability analysis
  - Course of action (COA) analysis
  - Tsingou mapping: d2ts iterate operator for predictive convergence, Anomaly Detection
- **Level 4: Process Refinement**
  - Sensor management, collection planning optimization
  - Resource allocation for intelligence collection
  - Tsingou mapping: Feedback loop — adapter priority adjustment, window tuning
- **Level 5: User Refinement** (DFIG addition)
  - Human cognitive processing, visualization optimization
  - Analyst-system interaction, display management
  - Tsingou mapping: 4-layer rendering system, analyst interaction via DOM layer
- **Diagram**: JDL levels mapped to Tsingou subsystems (ASCII, full-page, annotated)
- **Table**: JDL level × Tsingou component × d2ts operator mapping (comprehensive)
- **Code example**: d2ts graph organized by JDL levels

### Chapter 20: Dasarathy Input-Output Functional Model (~300 lines)
- Overview: fusion classified by input/output abstraction levels
- **DAI-DAO** (Data In - Data Out): raw sensor fusion, signal combining
  - Example: combining IQ samples from multiple SDR receivers
  - Tsingou: adapter-level signal aggregation
- **DAI-FEO** (Data In - Feature Out): feature extraction from raw data
  - Example: extracting PDWs from raw RF signal
  - Tsingou: d2ts ingest graph operators (schemaValidate, normalize)
- **FEI-FEO** (Feature In - Feature Out): feature-level fusion
  - Example: correlating radar parameters with communication metadata
  - Tsingou: d2ts derived graph join operator
- **FEI-DEO** (Feature In - Decision Out): decision making from features
  - Example: threat classification from fused feature set
  - Tsingou: d2ts derived graph with threshold operators, anomaly detection
- **DEI-DEO** (Decision In - Decision Out): decision fusion
  - Example: combining analyst assessments with automated alerts
  - Tsingou: DOM layer analyst-in-the-loop, feedback atoms
- **Diagram**: Dasarathy model layers mapped to Tsingou pipeline (ASCII)
- **Table**: Dasarathy category × example × Tsingou stage mapping

### Chapter 21: Multi-INT Fusion (~300 lines)
- Definition: integrating intelligence from multiple collection disciplines
- Why multi-INT: no single discipline provides complete picture
- Fusion approaches:
  - All-source analysis: human analyst integrates multiple INT products
  - Activity-Based Intelligence (ABI): automated correlation across INTs
  - Target-centric fusion: entity-focused integration
- Challenges:
  - Different timescales (SIGINT: real-time, HUMINT: days/weeks, IMINT: hours)
  - Different data formats (signals, text, imagery, measurements)
  - Different confidence levels and source reliability
  - Classification barriers (SIGINT compartments vs HUMINT restrictions)
- **Tsingou as multi-INT fusion platform**:
  - Adapter model enables simultaneous multi-INT collection
  - BaseSignal as universal normalized format bridges disciplines
  - d2ts join operator: cross-discipline correlation
  - Rendering layers: each INT type can have dedicated visualization
  - Example: COMINT metadata (HTTP adapter) + GEOINT location (HTTP adapter) + OSINT context (RSS adapter) → fused intelligence product
- **Diagram**: Multi-INT fusion through Tsingou adapter/pipeline/render (ASCII, full-page)
- **Table**: INT discipline pairs with fusion value and Tsingou join configuration

### Chapter 22: Emerging Fusion Paradigms (~200 lines)
- Machine learning fusion: deep learning for multi-sensor integration
- Bayesian fusion: probabilistic combination of uncertain evidence
- Dempster-Shafer theory: belief functions for uncertain reasoning
- Graph neural networks: entity/relationship prediction from heterogeneous data
- Federated fusion: privacy-preserving multi-party intelligence sharing
- **Tsingou relevance**: d2ts iterate operator enables iterative refinement; future ML operators could implement Bayesian/neural fusion within the pipeline
- **Table**: Fusion paradigm × maturity × applicability to Tsingou

---

## Part V: The SIGINT Processing Chain (~1,500 lines)

### Chapter 23: Signal Intercept and Collection (~250 lines)
- Antenna systems: omnidirectional, directional, phased array, aperture synthesis
- Receiver architectures: crystal video, superheterodyne, channelized, digital
- Frequency coverage: HF (3-30 MHz), VHF (30-300 MHz), UHF (300-3000 MHz), SHF (3-30 GHz), EHF (30-300 GHz)
- Digital conversion: ADC sampling, Nyquist theorem, dynamic range, SFDR
- Collection management: frequency assignment, time allocation, priority queuing
- **Tsingou mapping**: SDR hardware → GNU Radio source block → NATS → Tsingou adapter
- **Diagram**: Receiver architecture comparison (ASCII)
- **Table**: Frequency bands with applications and collection methods

### Chapter 24: Signal Conditioning and Preprocessing (~200 lines)
- Filtering: bandpass, notch, adaptive, digital filter banks
- Amplification: LNA (Low Noise Amplifier), AGC (Automatic Gain Control)
- Digitization: sampling rate selection, quantization depth, oversampling
- Channelization: polyphase filter banks, DDC (Digital Down Conversion)
- Time stamping: GPS disciplined clocks, NTP synchronization, TOA precision
- **Tsingou mapping**: d2ts ingest graph Level 0 operators
- **Code example**: Signal conditioning schema in Effect.Schema

### Chapter 25: Signal Detection and Classification (~250 lines)
- Detection theory:
  - Energy detection: threshold comparison, CFAR (Constant False Alarm Rate)
  - Matched filtering: optimal detection for known waveforms
  - Cyclostationary detection: exploiting signal periodicity
  - Eigenvalue-based detection: random matrix theory methods
- Classification methods:
  - Modulation recognition: feature-based (higher-order statistics, cumulants) and ML-based (CNN, RNN)
  - Protocol identification: header matching, traffic fingerprinting, deep packet inspection
  - Emitter fingerprinting: hardware-specific signal characteristics (RF fingerprinting)
- Performance metrics:
  - Probability of detection (Pd), probability of false alarm (Pfa)
  - Receiver Operating Characteristic (ROC) curves
  - Confusion matrices for classification
- **Tsingou mapping**: Custom d2ts operators for detection/classification within derived graph
- **Diagram**: Detection theory decision flow (ASCII)
- **Table**: Detection method × signal type × performance characteristics

### Chapter 26: Demodulation, Decoding, and Decryption (~200 lines)
- Demodulation: AM, FM, PM, QAM, OFDM, spread spectrum
- Error correction: convolutional codes, turbo codes, LDPC, Reed-Solomon
- Protocol decoding: layer-by-layer protocol stack extraction
- Decryption:
  - Known-plaintext and crib-based approaches
  - Side-channel attacks: timing, power analysis, electromagnetic emanations
  - Quantum-vulnerable algorithms: RSA, ECC (future PQC considerations)
  - Metadata analysis when content is encrypted
- **Tsingou mapping**: GNU Radio DSP blocks → NATS → adapter → ingest
- **Table**: Modulation types with characteristics and applications

### Chapter 27: Content and Metadata Analysis (~200 lines)
- Content analysis:
  - Natural Language Processing (NLP): tokenization, NER, sentiment, topic modeling
  - Keyword and phrase extraction
  - Machine translation: neural MT (Google/DeepL quality), dialect/slang challenges
  - Voice analysis: speaker recognition, emotion detection, language identification
  - Image/video analysis: object detection, OCR, facial recognition
- Metadata analysis:
  - Contact chaining: n-hop graph expansion from seed selector
  - Traffic analysis: who talks to whom, when, how often, how long
  - Network graph construction from communication metadata
  - Geolocation from metadata: cell tower records, IP geolocation, GPS coordinates
  - Temporal analysis: activity patterns, scheduling, coordination timing
- **Tsingou mapping**: d2ts derived graph operators for NLP/metadata analysis
- **Diagram**: Content vs metadata analysis branches (ASCII)
- **Table**: Analysis type → d2ts operator → rendering layer

### Chapter 28: Geolocation Techniques (~200 lines)
- Direction Finding (DF): Watson-Watt, Adcock, phase interferometry
- Time Difference of Arrival (TDOA): multilateration from arrival time differences
- Frequency Difference of Arrival (FDOA): exploiting Doppler shifts
- Combined TDOA/FDOA: improved accuracy from time+frequency
- IP geolocation: MaxMind, IP2Location, BGP-based, RTT-based
- Cell tower triangulation: serving cell, timing advance, signal strength
- Satellite geolocation: uplinking from GEO, cross-satellite TDOA
- Accuracy budgets: atmospheric effects, multipath, calibration errors
- **Tsingou mapping**: Geolocation as metadata enrichment → R3F/visx rendering
- **Table**: Geolocation technique × accuracy × platform × Tsingou rendering

### Chapter 29: Reporting and Production (~200 lines)
- Report types:
  - SIGINT report (NSA product line)
  - Technical ELINT (TECHELINT) report
  - SIGINT summaries
  - Serialized intelligence reports (SIR)
  - Alerts and warnings (CRITIC, SPOT)
- Product standards:
  - Source description and reliability assessment
  - Confidence language (ICD 203 compliance)
  - Handling caveats and classification markings
  - Tearline: separating source-sensitive from shareable information
- **Tsingou mapping**: STIX bundle as the structured report format, DOM layer for human-readable display
- **Table**: Intelligence report type → Tsingou output mechanism

---

## Part VI: Analysis Techniques (Deep Dive) (~2,000 lines)

### Chapter 30: Link Analysis — Entity-Relationship Mapping (~300 lines)
- **Definition**: Visualization and analysis of relationships between entities
- **Historical context**: i2 Analyst's Notebook (1990), FBI link charts, intelligence analyst training
- **Core concepts**:
  - Nodes: entities (persons, organizations, locations, devices, accounts)
  - Edges: relationships (communicates-with, works-for, located-at, owns, traveled-to)
  - Properties: attributes attached to nodes and edges (timestamps, confidence, type)
- **Graph metrics** (detailed):
  - Degree centrality: number of connections (in-degree, out-degree, total)
  - Betweenness centrality: bridge/gatekeeper nodes controlling information flow
  - Closeness centrality: speed of information spread, proximity to all nodes
  - Eigenvector centrality: influence based on well-connected neighbors
  - PageRank: Google's variant of eigenvector centrality, directed graphs
  - Clustering coefficient: how interconnected a node's neighbors are
  - Community detection: Louvain, Girvan-Newman, label propagation algorithms
- **Intelligence applications**:
  - Identifying command structure (hierarchy from centrality analysis)
  - Finding key communicators (betweenness in communication graph)
  - Detecting hidden relationships (2-hop connections through intermediaries)
  - Network disruption: removing high-betweenness nodes to fragment network
  - Temporal link analysis: how relationships evolve over time
- **Tools comparison**: Maltego, i2 Analyst's Notebook, Palantir Graph, Gephi, Neo4j
- **STIX mapping**: SDOs as nodes, SROs (relationship, sighting) as edges
- **Tsingou implementation**:
  - R3F force-directed graph: `@react-three/fiber` + `three-forcegraph` or custom
  - visx adjacency matrix: `@visx/group` for dense relationship view
  - d2ts join operator: real-time entity correlation across signal sources
  - Atom-driven: `entityGraphAtom`, `centralityScoresAtom` updated by derived graph
- **Diagram**: Force-directed graph layout with centrality highlighting (ASCII)
- **Table**: Centrality metric × formula × interpretation × intelligence application
- **Table**: Graph algorithm × complexity × use case
- **Code example**: Entity-relationship d2ts graph with join + distinct
- **Code example**: Centrality computation in d2ts reduce operator

### Chapter 31: Timeline / Temporal Analysis (~250 lines)
- Definition: Chronological ordering and visualization of events
- Time representations: absolute (UTC timestamps), relative (durations), cyclic (time-of-day, day-of-week)
- Analysis methods:
  - Event sequencing: establishing chronological order
  - Gap analysis: identifying time periods with missing data
  - Concurrency analysis: overlapping events across entities
  - Tempo analysis: acceleration/deceleration of activity
  - Periodicity detection: recurring patterns in time series
- Temporal correlation:
  - Coincidence: events occurring at the same time
  - Precedence: event A consistently precedes event B
  - Causality: establishing causal relationships from temporal patterns
- Visualization approaches:
  - Linear timeline: horizontal time axis, events as markers
  - Gantt-style: activity bars showing duration
  - Swimlane: parallel tracks per entity/source
  - Calendar heatmap: activity density across time
  - Sparklines: compact trend lines
- **Tsingou implementation**:
  - visx timeline: `@visx/axis` + `@visx/scale` + custom event markers
  - d2ts window operator: sliding time windows for temporal bounding
  - d2ts count operator: event frequency in temporal windows
  - STIX `observed-data.first_observed` and `last_observed` for temporal ordering
- **Diagram**: Swimlane timeline with multi-source events (ASCII)
- **Table**: Temporal analysis method × d2ts operator × visx component
- **Code example**: Temporal correlation d2ts graph with window + join

### Chapter 32: Geospatial Analysis — Location Intelligence (~250 lines)
- Definition: Analysis of spatial relationships and geographic context
- Coordinate systems: WGS-84 (GPS standard), MGRS (military grid), UTM
- Analysis methods:
  - Proximity analysis: entities within distance threshold
  - Hotspot analysis: spatial clustering (Getis-Ord Gi*, kernel density)
  - Movement analysis: trajectory, speed, heading, route prediction
  - Line-of-sight: viewshed analysis, intervisibility
  - Buffer/corridor analysis: areas of influence around features
  - Spatial-temporal correlation: co-location in space AND time
- Visualization:
  - Marker maps: point features with symbol encoding
  - Heatmaps: density/intensity overlay
  - Choropleth: area-based color encoding
  - Flow maps: movement/connection visualization
  - 3D terrain: elevation-aware rendering
- **Tsingou implementation**:
  - R3F globe: WebGL 3D earth with signal markers, orbit paths
  - R3F terrain: 3D elevation rendering with line-of-sight
  - visx map overlay: 2D marker/heatmap on projected basemap
  - d2ts join: signal × location enrichment
  - STIX `location` SDO with latitude, longitude, precision
- **Table**: Geospatial analysis method → rendering layer → d2ts operator
- **Code example**: Location-based signal join in d2ts

### Chapter 33: Anomaly Detection — Statistical Deviation (~250 lines)
- Definition: Identifying observations that deviate significantly from expected behavior
- Statistical methods:
  - Z-score: standard deviations from mean (parametric, assumes normal distribution)
  - Modified Z-score (MAD): median absolute deviation (robust to outliers)
  - IQR method: interquartile range, box-plot outliers
  - Grubbs test: single outlier in normally distributed data
  - DBSCAN: density-based spatial clustering for anomaly detection
  - Isolation Forest: tree-based anomaly scoring
  - Autoencoder: neural network reconstruction error
- Time-series anomaly detection:
  - Moving average deviation
  - Exponential smoothing (Holt-Winters) forecast residuals
  - Seasonal decomposition (STL) anomalies
  - Change point detection: CUSUM, PELT algorithm
- Alert management:
  - Threshold configuration: static vs adaptive
  - Alert fatigue mitigation: severity levels, aggregation, suppression
  - Escalation: automated routing based on severity
  - False positive feedback: analyst markings for threshold refinement
- **Tsingou implementation**:
  - d2ts `reduce` operator: rolling statistics (mean, variance, z-score)
  - d2ts `window` operator: temporal bounding for baseline computation
  - DOM alert panel: framer-motion animated alerts with severity ranking
  - visx distribution plots: histogram, box plot for anomaly context
  - Feedback loop: analyst marks false positive → atom adjustment → threshold update
- **Diagram**: Anomaly detection pipeline in Tsingou (ASCII)
- **Table**: Statistical method × assumptions × complexity × Tsingou operator
- **Code example**: Rolling z-score anomaly detector in d2ts

### Chapter 34: Pattern-of-Life (POL) Analysis (~250 lines)
- Definition: Study of routine behaviors to establish baselines for anomaly detection
- Core concept: "What does normal look like for this entity?"
- Data dimensions:
  - Temporal: time-of-day, day-of-week, seasonal patterns
  - Spatial: habitual locations, routes, areas of activity
  - Social: regular contacts, communication frequency, group affiliations
  - Behavioral: activity types, transaction patterns, online habits
  - Cyber: login patterns, network usage, application behavior
- Methodology:
  - Data collection: prolonged observation across dimensions
  - Baseline construction: statistical modeling of normal behavior
  - Deviation scoring: measuring current behavior against baseline
  - Contextual filtering: accounting for known variations (holidays, events)
  - Alert generation: significant deviation triggers investigation
- POL in different domains:
  - Physical surveillance: movement patterns, schedule adherence
  - Communications: calling patterns, email habits, social media posting cadence
  - Cyber: login times, bandwidth usage, application patterns
  - Financial: transaction patterns, spending behaviors
- **Tsingou implementation**:
  - visx heatmap: `@visx/heatmap` for time-of-day × day-of-week activity density
  - visx stats: `@visx/stats` for distribution comparison (current vs baseline)
  - d2ts window operator: long-term baseline windows (24h, 7d, 30d)
  - d2ts iterate operator: baseline convergence through iterative refinement
  - d2ts reduce operator: statistical feature extraction per entity per time period
  - Atom-driven comparison: `baselineAtom` vs `currentAtom` with deviation scoring
- **Diagram**: POL analysis lifecycle (collect → model → compare → alert) (ASCII)
- **Table**: POL dimension × data source × Tsingou adapter × analysis operator
- **Code example**: Time-of-day baseline construction in d2ts

### Chapter 35: Kill Chain and MITRE ATT&CK Mapping (~250 lines)
- Kill Chain models:
  - Lockheed Martin Cyber Kill Chain (7 phases): Reconnaissance, Weaponization, Delivery, Exploitation, Installation, C2, Actions on Objectives
  - Unified Kill Chain: 18 phases across initial access, network propagation, action on objectives
  - Diamond Model: adversary, capability, infrastructure, victim (meta-features)
- MITRE ATT&CK Framework (detailed):
  - Enterprise matrix: 14 tactics, 200+ techniques, 400+ sub-techniques
  - Tactics: Reconnaissance, Resource Development, Initial Access, Execution, Persistence, Privilege Escalation, Defense Evasion, Credential Access, Discovery, Lateral Movement, Collection, C2, Exfiltration, Impact
  - Technique structure: ID (Txxxx), name, description, procedures, mitigations, detections
  - Data sources: process monitoring, file monitoring, network traffic, API monitoring
  - ATT&CK Navigator: interactive matrix visualization tool
- Mapping signals to ATT&CK:
  - Network traffic → T1071 (Application Layer Protocol), T1572 (Protocol Tunneling)
  - File modifications → T1543 (Create/Modify System Process)
  - DNS queries → T1071.004 (DNS), T1568 (Dynamic Resolution)
  - Process creation → T1059 (Command and Scripting Interpreter)
  - Authentication events → T1078 (Valid Accounts), T1110 (Brute Force)
- **Tsingou implementation**:
  - visx ATT&CK matrix: `@visx/group` + `@visx/text` grid layout with coverage heatmap
  - d2ts join: signal × ATT&CK technique mapping (signal attributes → technique indicators)
  - STIX `attack-pattern` SDO with ATT&CK external references
  - DOM layer: technique detail panel with linked signals
  - Color encoding: technique coverage (observed, detected, blocked, not covered)
- **Diagram**: ATT&CK matrix layout with technique coverage overlay (ASCII)
- **Table**: ATT&CK tactics with Tsingou detection capability per technique category
- **Table**: Kill chain phase → ATT&CK tactic → Tsingou signal source mapping
- **Code example**: ATT&CK technique matching in d2ts derived graph

### Chapter 36: Spectrum Analysis — RF Signal Visualization (~250 lines)
- Frequency domain analysis:
  - FFT (Fast Fourier Transform): time domain → frequency domain
  - STFT (Short-Time Fourier Transform): time-frequency representation
  - Wavelet analysis: multi-resolution time-frequency decomposition
  - Welch method: power spectral density estimation
  - Spectrogram: scrolling time-frequency display (waterfall)
- Visualization types:
  - FFT magnitude plot: real-time frequency spectrum (amplitude vs frequency)
  - Waterfall display: time × frequency × amplitude (scrolling spectrogram)
  - Constellation diagram: IQ scatter plot for modulation analysis
  - Eye diagram: signal quality assessment for digital modulations
  - Phase plot: signal phase relationships
- SDR-specific analysis:
  - Band scanning: systematic frequency coverage
  - Signal identification: matching observed signals to known protocols
  - Bandwidth measurement: occupied bandwidth, out-of-band emissions
  - Signal-to-noise ratio (SNR) measurement
  - Interference detection and characterization
- SigMF integration:
  - Recording metadata: datatype, sample rate, hardware, captures, annotations
  - Annotation-driven analysis: marking signals of interest in recordings
  - Recording playback: historical spectrum analysis
- **Tsingou implementation**:
  - p5 layer (z:2): real-time waterfall display, FFT magnitude plot
  - p5 `updateWithProps`: FFT data streamed via atom from d2ts output
  - visx overlay: statistical spectrum analysis (peak detection, bandwidth measurement)
  - d2ts custom FFT operators for in-pipeline frequency analysis
  - SigMF metadata schema in Effect.Schema
- **Diagram**: Spectrum analysis rendering pipeline (SDR → GNU Radio → NATS → Tsingou → p5) (ASCII)
- **Table**: Visualization type × data requirement × rendering layer
- **Code example**: FFT data atom for p5 waterfall rendering

### Chapter 37: Signal Flow Visualization — Pipeline Monitoring (~200 lines)
- Purpose: Real-time animated view of the d2ts processing pipeline
- Topology representation:
  - Nodes: adapters, ingest operators, derived operators, output bridge
  - Edges: data flow connections between operators
  - Node properties: throughput, latency, error count, queue depth
  - Edge properties: signal count, data volume, latency
- Visual encoding:
  - Node size: proportional to throughput
  - Node color: health status (green/yellow/red)
  - Edge thickness: proportional to data volume
  - Animated particles: signals flowing through the pipeline
  - Pulse animation: per-signal burst on ingestion
- Interaction:
  - Hover node: show operator statistics (signals/sec, avg latency)
  - Click node: expand operator detail panel
  - Click edge: show signal samples flowing on that path
  - Layout: hierarchical left-to-right (adapters → ingest → derived → output)
- **Tsingou implementation**:
  - R3F (z:0): 3D pipeline visualization with animated particle flow
  - visx (z:1): 2D graph overlay for precise statistics readout
  - d2ts metadata: pipeline topology extracted from graph definition
  - Atoms: `pipelineTopologyAtom`, `operatorStatsAtom`, `edgeFlowAtom`
- **Diagram**: Pipeline visualization layout (ASCII)
- **Code example**: Pipeline topology atom structure

---

## Part VII: Structured Analytic Techniques (~1,000 lines)

### Chapter 38: Introduction to SATs (~150 lines)
- What are Structured Analytic Techniques (SATs)?
- CIA Tradecraft Primer (2009) — three categories:
  - Diagnostic techniques: transparency of assumptions and logic
  - Contrarian techniques: challenging consensus thinking
  - Imaginative thinking: generating new ideas and perspectives
- Why SATs matter: reducing cognitive bias, improving rigor
- **Table**: SAT categories with technique names and purposes

### Chapter 39: Analysis of Competing Hypotheses (ACH) (~200 lines)
- Origin: Richard Heuer, CIA, 1970s
- 8-step process (detailed):
  1. Identify potential hypotheses
  2. List evidence and arguments for each
  3. Prepare diagnosticity matrix
  4. Refine matrix — identify significant evidence
  5. Draw tentative conclusions
  6. Analyze sensitivity — which evidence is most critical?
  7. Report conclusions with identified assumptions
  8. Identify milestones for future observation
- Diagnosticity: evidence that differentiates between hypotheses
- Matrix construction: hypotheses as columns, evidence as rows, consistency ratings
- Strengths: systematic, auditable, bias-resistant
- Weaknesses: hypothesis generation bias, evidence selection bias, time-intensive
- **Tsingou integration concept**: DOM layer ACH panel with:
  - Hypothesis management (add/edit/delete/rank)
  - Evidence linking to signals (BaseSignal references)
  - Diagnosticity matrix visualization (visx heatmap)
  - Sensitivity analysis (highlighting pivotal evidence)
- **Diagram**: ACH matrix example (ASCII table format)
- **Table**: ACH step → analyst action → Tsingou UI component

### Chapter 40: Key Assumptions Check (~150 lines)
- Purpose: Surface and evaluate unstated assumptions
- Process:
  - List all assumptions underlying the analysis
  - Evaluate each assumption: supported, unsupported, partially supported
  - Assess impact if assumption is wrong
  - Identify alternative assumptions
- **Tsingou integration**: Assumption registry in session metadata, linked to d2ts graph configuration (e.g., "assuming signals from source X are authentic" — challenge: what if spoofed?)

### Chapter 41: Devil's Advocacy and Red Team Analysis (~150 lines)
- Devil's Advocacy: deliberately arguing against prevailing assessment
- Red Team Analysis: adopting adversary's perspective
  - What would the adversary see?
  - How would the adversary respond?
  - What deception might the adversary employ?
- Team A/Team B: competitive analysis
- Tabletop exercises: scenario-based red team sessions
- **Tsingou integration**: Alternate analysis views — same data, different d2ts graph configurations representing different hypotheses

### Chapter 42: Indicators and Warnings (I&W) (~200 lines)
- Definition: Framework for detecting impending events
- Indicator development:
  - Specific observable indicators tied to potential events
  - Indicator list: positive (supporting) and negative (contradicting)
  - Indicator scoring: observed/not observed, confidence, diagnostic weight
- Warning thresholds:
  - Green: normal activity, no indicators observed
  - Yellow: some indicators present, heightened monitoring
  - Orange: significant indicators, elevated concern
  - Red: imminent threat indicators, active warning
- **Tsingou implementation**:
  - d2ts derived graph: indicator matching operators
  - Atom-driven warning level: `warningLevelAtom` with color coding
  - DOM layer: I&W dashboard with indicator status grid
  - Alert escalation: threshold breach → NATS publish → external notification
- **Table**: I&W level → indicators observed → automated action
- **Code example**: I&W indicator matching in d2ts

### Chapter 43: ICD 203 Analytic Standards and Confidence Language (~150 lines)
- Nine Analytic Tradecraft Standards:
  1. Properly describes quality and credibility of underlying sources
  2. Properly caveats and expresses uncertainties
  3. Properly distinguishes between underlying intelligence and assumptions/judgments
  4. Incorporates alternative analysis
  5. Demonstrates relevance to customers
  6. Uses clear and logical argumentation
  7. Provides effective visual information
  8. Is accurate, balanced, and impartial
  9. Incorporates effective collaboration
- Probability language matrix:
  - Almost no chance: 01-05%
  - Very unlikely: 05-20%
  - Unlikely: 20-45%
  - Roughly even chance: 45-55%
  - Likely: 55-80%
  - Very likely: 80-95%
  - Almost certain: 95-99%
- Confidence levels (separate from probability):
  - Low confidence: fragmented sources, tenuous logic
  - Moderate confidence: reasonable sources, plausible logic
  - High confidence: strong sources, sound logic, corroborated
- **Table**: Probability language with percentage ranges and example usage
- **Table**: Confidence level criteria matrix

---

## Part VIII: Platform Ecosystem and Comparisons (~1,500 lines)

### Chapter 44: Palantir Gotham / Foundry (~250 lines)
- **Architecture**: Dynamic ontology, knowledge graph, object-relationship model
- **Key capabilities**:
  - Entity resolution: fuzzy matching, deduplication, cross-source linking
  - Investigation workspace: drag-and-drop analysis, collaborative
  - Timeline and geospatial views built-in
  - Object types: fully customizable domain model
  - Access control: granular, attribute-based
- **Gotham vs Foundry**: Gotham = defense/intelligence, Foundry = commercial
- **Ontology**: semantic (types + properties), kinetic (actions + operations), dynamic (live data)
- **API**: REST v2.0, GraphQL, SDK
- **Tsingou integration**: STIX SDOs → Gotham objects via API connector
- **Tsingou differentiators vs Palantir**:
  - Real-time signal processing (d2ts incremental) vs batch analytics
  - 4-layer composited rendering vs single web view
  - Effect-TS typed pipeline vs Java/Spark backend
  - Open source vs proprietary
  - Signal-level analysis vs entity-level analysis
- **Table**: Palantir capability × Tsingou equivalent/complement

### Chapter 45: OpenCTI (~200 lines)
- Architecture: React frontend, GraphQL API, ElasticSearch, Redis, MinIO, RabbitMQ, Python workers
- STIX 2.1 native data model (key advantage)
- Knowledge graph with entity/relationship visualization
- Connector ecosystem: MISP, TheHive, Cortex, VirusTotal, AlienVault
- Playbooks and automated workflows
- **Tsingou integration**: Bidirectional STIX connector via NATS → OpenCTI GraphQL API
- **Table**: OpenCTI features × Tsingou complementary features

### Chapter 46: MISP (~200 lines)
- Architecture: PHP (CakePHP), MySQL, Redis
- MISP data model: events, attributes, objects, galaxies, taxonomies
- Sharing: organizations, sharing groups, distribution levels
- Galaxy clusters: ATT&CK, threat actors, tools, sectors
- STIX/TAXII support: MISP ↔ STIX conversion
- **Tsingou integration**: MISP event import/export via REST API adapter
- **Table**: MISP concepts → Tsingou signal/STIX mapping

### Chapter 47: TheHive + Cortex (~200 lines)
- TheHive: incident response platform
  - Cases, tasks, observables, alerts
  - Case templates for repeatable processes
  - Alert intake from external sources
- Cortex: observable analysis engine
  - Analyzers: 100+ connectors (VirusTotal, Shodan, PassiveTotal, etc.)
  - Responders: automated actions (block IP, disable account)
- **Tsingou integration**: anomaly alerts → TheHive case creation, observables → Cortex enrichment
- **Table**: TheHive/Cortex capability × Tsingou integration point

### Chapter 48: Maltego (~200 lines)
- Architecture: Java desktop client + Transform Hub
- Transforms: data retrieval plugins (400+ transforms from 80+ providers)
- Entity types: person, phone, email, domain, IP, organization, etc.
- Machines: automated transform chains
- Investigation workflow: seed entity → transform → expand graph → analyze
- **Tsingou comparison**: Maltego = manual investigation, Tsingou = real-time stream analysis
  - Maltego: pull-based (analyst triggers transforms)
  - Tsingou: push-based (signals arrive continuously)
  - Complementary: Maltego findings → Tsingou monitoring requirements
- **Table**: Maltego capability × Tsingou equivalent/difference

### Chapter 49: Commercial Threat Intelligence Platforms (~150 lines)
- Recorded Future: AI-powered threat intelligence, massive open source collection
- Mandiant (Google Cloud): incident response heritage, APT tracking
- CrowdStrike Falcon Intelligence: endpoint-derived threat intelligence
- Anomali ThreatStream: threat intelligence management
- Flashpoint: deep/dark web intelligence
- Intel 471: underground economy and adversary tracking
- **Tsingou integration**: Commercial TI feeds → HTTP adapter (API polling) or STIX/TAXII adapter
- **Table**: Commercial TI platform × data types × integration method × Tsingou adapter

### Chapter 50: GNU Radio and SDR Ecosystem (~150 lines)
- GNU Radio: flow graph DSP toolkit, Python/C++, 1000+ signal processing blocks
- Key blocks: sources (RTL-SDR, HackRF, USRP), filters, demodulators, decoders, sinks
- Popular SDR applications:
  - GQRX: spectrum analyzer
  - SDR++: multi-platform waterfall
  - CubicSDR: cross-platform SDR application
  - dump1090: ADS-B decoder
  - multimon-ng: multi-protocol decoder (POCSAG, FLEX, EAS)
- **Tsingou integration**: GNU Radio → NATS sink block → Tsingou HolonetBridgeAdapter
- **Table**: SDR hardware comparison (RTL-SDR, HackRF, LimeSDR, USRP, Pluto)

### Chapter 51: Platform Comparison Matrix (~150 lines)
- Comprehensive comparison across 15+ dimensions:
  - Real-time processing, batch analytics, knowledge graph, STIX support, OSINT collection, RF/SDR, visualization layers, multi-INT, deployment (SaaS/on-prem/desktop), open source, cost, scalability, API, extensibility, learning curve
- 8 platforms compared: Tsingou, Palantir, OpenCTI, MISP, TheHive, Maltego, Recorded Future, GNU Radio
- **Table**: 15-dimension comparison matrix (extensive, multiline)
- Summary: where Tsingou fits in the ecosystem (visualization + real-time signal processing layer)

---

## Part IX: Tsingou Signal-to-Intelligence Mapping (~1,500 lines)

### Chapter 52: Complete Adapter-to-Discipline Matrix (~300 lines)
- Master table: 10 adapters × 8 intelligence disciplines
  - Each cell: primary/secondary/n/a, example scenario, signal kind produced
- Detailed per-adapter sections:
  - Adapter purpose, configuration options, deployment model
  - Disciplines served (primary and secondary)
  - Example NATS subject patterns
  - BaseSignal kind and payload structure
  - STIX export mapping (SCO types produced)
  - Rendering layer affinity (which layers best display this adapter's data)
- **Table**: 10×8 adapter-discipline matrix with scenario descriptions
- **Table**: Per-adapter configuration reference

### Chapter 53: d2ts Operator-to-Analysis Mapping (~200 lines)
- Master table: d2ts operators × analysis techniques
  - join → link analysis, multi-INT fusion, cross-source correlation
  - reduce → aggregation, baseline computation, rolling statistics
  - count → frequency analysis, rate monitoring
  - topK → most-active entities, highest-priority signals
  - window → temporal bounding, sliding windows, POL baselines
  - throttle → rate limiting, alert fatigue prevention
  - iterate → convergence, anomaly threshold refinement, predictive models
  - filter → schema validation, entity filtering, discipline scoping
  - map → normalization, enrichment, transformation
  - consolidate → deduplication, multiset compaction
  - schemaValidate → runtime type validation against registry
- Custom operators: ATT&CK matcher, entity extractor, geolocation enricher, sentiment scorer
- **Table**: Operator × analysis technique × JDL level × Dasarathy category

### Chapter 54: Rendering Layer-to-Technique Mapping (~200 lines)
- Layer capabilities and affinity:
  - R3F (z:0): 3D graph, geospatial globe, pipeline flow, particle effects
  - visx (z:1): timeline, heatmap, distribution, matrix, sparkline
  - p5 (z:2): waterfall, FFT, generative noise, constellation diagram
  - DOM (z:3): tables, alerts, text panels, forms, configuration
- Technique-layer affinity matrix:
  - Link Analysis: R3F (primary), visx (secondary — adjacency matrix)
  - Timeline: visx (primary), DOM (secondary — event list)
  - Geospatial: R3F (primary — globe), visx (secondary — 2D map)
  - Anomaly Detection: DOM (primary — alerts), visx (secondary — distributions)
  - Pattern-of-Life: visx (primary — heatmaps), R3F (secondary — 3D POL)
  - Kill Chain/ATT&CK: visx (primary — matrix), DOM (secondary — details)
  - Spectrum: p5 (primary — waterfall), visx (secondary — statistics)
  - Signal Flow: R3F (primary — 3D flow), visx (secondary — 2D stats)
- **Table**: 8 techniques × 4 layers with primary/secondary/n/a designations

### Chapter 55: End-to-End Workflow: CYBINT Investigation (~300 lines)
- **Scenario**: Investigating suspicious network activity targeting a corporate network
- **Step 1 — Direction**:
  - Requirements: identify compromised hosts, C2 infrastructure, data exfiltration
  - Session configuration: network-focused adapters, CYBINT analysis rules
  - ATT&CK techniques of interest: T1071, T1568, T1059, T1078, T1041
- **Step 2 — Collection**:
  - FileWatch adapter: tailing IDS alert log (Suricata)
  - HTTP adapter: polling VirusTotal and Shodan APIs for infrastructure enrichment
  - STIX/TAXII adapter: subscribing to AlienVault OTX feed
  - NATS adapter: receiving DNS query logs from resolver sidecar
- **Step 3 — Processing**:
  - d2ts ingest: schema validation, timestamp normalization, source tagging
  - IP extraction: parsing IDS alerts for source/destination IPs
  - DNS enrichment: joining DNS queries with threat intel domains
- **Step 4 — Analysis**:
  - d2ts derived graph: join IDS alerts × threat intel IOCs
  - Anomaly detection: unusual outbound connections (baseline deviation)
  - ATT&CK mapping: matching observed behavior to techniques
  - Link analysis: building IP ↔ domain ↔ hash ↔ campaign graph
- **Step 5 — Dissemination**:
  - STIX bundle: export indicators, sightings, relationships
  - OpenCTI: publish to organizational knowledge base
  - TheHive: create incident case with observables
  - DOM alerts: highlight compromised hosts in real-time
- **Step 6 — Feedback**:
  - Analyst confirms IOC matches, marks false positive DNS alerts
  - Threshold refinement: adjust anomaly sensitivity for DNS queries
  - Source quality: VirusTotal rated higher than OTX for this investigation
- **Diagram**: Complete investigation flow through Tsingou (ASCII, full-page, multi-section)

### Chapter 56: End-to-End Workflow: RF SIGINT Collection (~250 lines)
- **Scenario**: Monitoring ISM band (433 MHz) for unauthorized transmitters
- Full workflow through SDR → GNU Radio → NATS → Tsingou → p5 waterfall
- Emitter identification, geolocation, pattern-of-life analysis for transmitter activity
- **Diagram**: SDR-to-visualization flow (ASCII)

### Chapter 57: End-to-End Workflow: OSINT Investigation (~250 lines)
- **Scenario**: Monitoring social media for disinformation campaign indicators
- RSS + HTTP + WebSocket adapters for multi-platform collection
- Entity extraction, sentiment analysis, network mapping, narrative tracking
- **Diagram**: OSINT investigation flow through Tsingou (ASCII)

---

## Part X: Appendices (~1,500 lines)

### Appendix A: Comprehensive Glossary (~500 lines)
- 150+ intelligence and technical terms with full definitions
- Organized alphabetically
- Each entry: term, abbreviation (if any), definition (2-5 sentences), context/usage, Tsingou relevance (where applicable)
- Terms include: ACH, ACINT, ADC, ADS-B, ABI, AOA, APT, ATT&CK, BICES, CDR, CFAR, COMINT, CRITIC, CTI, CUI, CYBINT, DAI-DAO, DBSCAN, DDC, DF, DFIG, DNINT, DRFM, EEI, ELINT, EMI, EO, EOB, ESM, EW, FDOA, FFT, FISA, FISINT, FLASH, FVEY, GEOINT, HUMINT, ICD, ICP, IFF, IMINT, IMSI, IOC, IQR, ISAC, JDL, KG, LNA, LPI, MAD, MASINT, MGRS, MIMO, MISP, MITRE, NER, NOFORN, NUCINT, ODNI, OODA, OPSEC, ORCON, OSINT, PAM, PCM, PCAP, PDW, PIR, PQC, PRF, PRI, PRISM, PW, QAM, RADINT, RCS, ROC, SAR, SAT, SCI, SCO, SDO, SDR, SFDR, SigMF, SIGINT, SIR, SNR, SRO, STFT, STIX, TAXII, TDOA, TELINT, TEMPEST, TLP, TOA, TTP, UAV, UKUSA, UTM, VPN, WGS-84

### Appendix B: STIX 2.1 Object Quick Reference (~200 lines)
- All 18 SDOs with key fields and SIGINT relevance
- All 2 SROs with relationship types
- Key SCOs (top 15) with field definitions
- Marking definitions and TLP mapping
- **Table**: SDO/SRO/SCO inventory with Tsingou signal mapping

### Appendix C: MITRE ATT&CK Quick Reference (~200 lines)
- 14 Enterprise tactics with technique counts
- Top 20 most common techniques with detection approaches
- ATT&CK data sources relevant to Tsingou signal types
- **Table**: ATT&CK tactic → technique count → Tsingou detection capability

### Appendix D: Legal Authority Quick Reference (~150 lines)
- US authorities: FISA Section 702, EO 12333, USA FREEDOM Act
- International: ECHR Article 8, GDPR, Budapest Convention
- Classification: US levels + NATO equivalents
- **Table**: Legal authority × scope × Tsingou implications

### Appendix E: Tsingou ADR Cross-Reference Index (~150 lines)
- Complete ADR inventory with SIGINT domain relevance
- ADR-001 through ADR-013 with summary and cross-reference to document chapters
- **Table**: ADR × relevant chapters × key decisions

### Appendix F: Signal Taxonomy and Schema Registry (~300 lines)
- Complete signal kind taxonomy:
  - Known kinds: midi, osc, nats, http, serial, rss, websocket, file-watch
  - Extended kinds: sdr, stix, misp, telemetry, sensor, social-media
  - Custom kind registration: schema registry entry format
- Schema registry NATS KV structure
- BaseSignal field reference with all extensions
- **Table**: Signal kind × payload fields × STIX SCO mapping × discipline affinity

---

## SPEC.md Section 4 Updates

### Additions to Section 4 ("Mission: SIGINT/OSINT Analysis"):

1. **New subsection: "Supported Intelligence Disciplines"** (~50 lines)
   - Table mapping each discipline (SIGINT, COMINT, ELINT, FISINT, CYBINT, MASINT, GEOINT, OSINT) to Tsingou capabilities
   - Cross-reference to SIGINT_DOMAIN.md for full coverage

2. **Intelligence cycle phase annotations** (~30 lines)
   - Each of the 6 use cases annotated with which intelligence cycle phase(s) it covers

3. **New subsection: "Multi-INT Fusion"** (~20 lines)
   - Paragraph explaining how Tsingou's adapter model enables discipline convergence
   - d2ts join operator as the fusion mechanism

4. **Reference to SIGINT_DOMAIN.md** (~5 lines)
   - Link to encyclopedic domain reference

---

## Research Sources Consulted

### Intelligence Community Official Sources
- [ODNI — What is Intelligence](https://www.dni.gov/index.php/what-we-do/what-is-intelligence)
- [ODNI — ICD 203 Analytic Standards](https://www.dni.gov/files/documents/ICD/ICD-203.pdf)
- [ODNI — IC OSINT Strategy 2024-2026](https://www.dni.gov/files/ODNI/documents/IC_OSINT_Strategy.pdf)
- [ODNI — MASINT Primer 2022](https://www.dni.gov/files/ODNI/documents/21-113_MASINT_Primer__2022.pdf)
- [NSA — SIGINT FAQ](https://www.nsa.gov/about/faqs/sigint-faqs/)
- [NSA — ELINT at NSA (declassified)](https://www.nsa.gov/portals/75/documents/about/cryptologic-heritage/historical-figures-publications/publications/misc/elint.pdf)
- [NGA — GEOINT Basic Doctrine Pub 1.0](https://www.nga.mil/assets/files/170901-038_GEOINT_Basic_Doctrine_Pub_1.pdf)
- [CIA — Tradecraft Primer: Structured Analytic Techniques](https://www.cia.gov/resources/csi/static/Tradecraft-Primer-apr09.pdf)
- [FBI — Intelligence Cycle Graphic](https://www.fbi.gov/image-repository/intelligence-cycle-graphic.jpg/view)

### Military Doctrine
- [Army FM 2-0 Ch 8: SIGINT](https://www.globalsecurity.org/intell/library/policy/army/fm/2-0/chap8.htm)
- [Army FM 2-0 Ch 9: MASINT](https://www.globalsecurity.org/intell/library/policy/army/fm/2-0/chap9.htm)
- [USMC MCRP 2-10A.1: Signals Intelligence](https://www.marines.mil/Portals/1/Publications/MCRP%202-10A.1%20(SECURED).pdf)
- [GovInfo — IC21 Ch V: SIGINT](https://www.govinfo.gov/content/pkg/GPO-IC21/html/GPO-IC21-5.html)
- [GovInfo — IC21 Ch VII: MASINT](https://www.govinfo.gov/content/pkg/GPO-IC21/html/GPO-IC21-7.html)

### Academic and Technical
- [JDL Data Fusion Model (DTIC)](https://apps.dtic.mil/sti/tr/pdf/ADA391479.pdf)
- [PMC — Review of Data Fusion Techniques](https://pmc.ncbi.nlm.nih.gov/articles/PMC3826336/)
- [Pherson — How Does ACH Improve Analysis](https://pherson.org/wp-content/uploads/2013/06/06.-How-Does-ACH-Improve-Analysis_FINAL.pdf)
- [RAND — Assessing Value of SATs](https://www.rand.org/content/dam/rand/pubs/research_reports/RR1400/RR1408/RAND_RR1408.pdf)
- [IEEE — Palantir Gotham Analysis](https://ieeexplore.ieee.org/document/10808897)

### Platform Documentation
- [OpenCTI GitHub](https://github.com/OpenCTI-Platform/opencti)
- [MISP Project](https://www.misp-project.org/)
- [MISP vs OpenCTI 2025 Guide](https://www.cosive.com/misp-vs-opencti)
- [Maltego Platform](https://www.maltego.com/)
- [MITRE ATT&CK](https://attack.mitre.org/)
- [Palantir Platform Architecture](https://www.palantir.com/docs/foundry/platform-overview/architecture)
- [Palantir Ontology Overview](https://www.palantir.com/docs/foundry/ontology/overview)

### Intelligence Analysis Resources
- [Cambridge Intelligence — Social Network Analysis](https://cambridge-intelligence.com/keylines-faqs-social-network-analysis/)
- [Cambridge Intelligence — Pattern-of-Life](https://cambridge-intelligence.com/pattern-of-life-analysis/)
- [Naval War College — Intelligence Studies LibGuide](https://usnwc.libguides.com/c.php?g=494120&p=3381426)
- [Grey Dynamics — SATs Guide](https://greydynamics.com/a-guide-to-structured-analytic-techniques-sats-for-intelligence/)
- [Grey Dynamics — MASINT Guide](https://greydynamics.com/a-guide-to-measurement-and-signature-intelligence-masint/)
- [EMSOPEDIA — COMINT](https://www.emsopedia.org/entries/communication-intelligence/)
- [EMSOPEDIA — ELINT](https://www.emsopedia.org/entries/electronic-intelligence-elint/)
- [Rohde & Schwarz — ELINT Analysis](https://www.rohde-schwarz.com/us/solutions/aerospace-and-defense/multi-domain/sigint-ew/strategic-sigint/radar-interception-and-analysis-elint/radar-interception-and-analysis-elint_233134.html)
- [Novator Solutions — COMINT Guide](https://novatorsolutions.com/sda/knowledge/comint/)
- [Novator Solutions — ELINT Guide](https://novatorsolutions.com/sda/knowledge/elint/)

### Historical References
- [Wikipedia — Five Eyes](https://en.wikipedia.org/wiki/Five_Eyes)
- [Wikipedia — ECHELON](https://en.wikipedia.org/wiki/ECHELON)
- [Wikipedia — UKUSA Agreement](https://en.wikipedia.org/wiki/UKUSA_Agreement)
- [Wikipedia — Signals Intelligence](https://en.wikipedia.org/wiki/Signals_intelligence)
- [Wikipedia — Traffic Analysis](https://en.wikipedia.org/wiki/Traffic_analysis)
- [Wikipedia — FISINT](https://en.wikipedia.org/wiki/Foreign_instrumentation_signals_intelligence)
- [Wikipedia — GEOINT](https://en.wikipedia.org/wiki/Geospatial_intelligence)
- [Recorded Future — Threat Intelligence Lifecycle](https://www.recordedfuture.com/blog/threat-intelligence-lifecycle-phases)

### Codebase Sources (read during research)
- `docs/tsingou/SPEC.md` — System specification
- `docs/tsingou/FLOW_ARCHITECTURE.md` — Signal pipeline architecture
- `src/lib/tsingou-flow/schemas/base-signal.ts` — Internal signal model
- `src/lib/tsingou-flow/schemas/signal-union.ts` — Signal discriminated union
- `docs/tsingou/adr/ADR-009-stix-interop-layer.md` — STIX interop decision
- `docs/tsingou/adr/ADR-010-full-intelligence-cycle.md` — Intelligence cycle coverage
- `docs/tsingou/adr/ADR-011-sdr-gnu-radio-bridge.md` — SDR integration
- `docs/tsingou/adr/ADR-012-visualization-focused-platform.md` — Visualization focus
- `docs/tsingou/adr/ADR-013-analysis-techniques.md` — 8 analysis techniques

---

## Implementation Strategy

### Phase 1: Write Parts I-III (Foundations + Cycle + Disciplines)
- Heaviest content, ~8,000 lines
- Foundation for everything else

### Phase 2: Write Parts IV-VI (Fusion + Processing + Analysis)
- Technical depth, ~4,700 lines
- Builds on discipline knowledge from Phase 1

### Phase 3: Write Parts VII-VIII (SATs + Platforms)
- Analytical context, ~2,500 lines
- Ecosystem positioning

### Phase 4: Write Parts IX-X (Mapping + Appendices)
- Tsingou-specific integration, ~3,000 lines
- Ties everything together

### Phase 5: Update SPEC.md Section 4
- Apply refined intelligence scope from research
- ~100 lines of additions
