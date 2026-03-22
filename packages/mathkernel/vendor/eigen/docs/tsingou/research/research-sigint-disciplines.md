# Research: SIGINT/OSINT Intelligence Disciplines

```
Topic:          Signal Intelligence and Open Source Intelligence Disciplines
Platform:       Tsingou (SIGINT/OSINT analysis and visualization)
Author:         Val (sigint-researcher)
Date:           2026-02-18
Status:         COMPLETE
Lines:          ~2,000
Sections:       10
Disciplines:    SIGINT (COMINT, ELINT, FISINT), CYBINT/DNINT, MASINT, GEOINT, OSINT
Purpose:        Raw research feeding RFC section TSG.2 (SIGINT/OSINT Domain Reference)
Cross-refs:     research-intelligence-cycle.md, research-ew-doctrine.md (TSG.36)
```

---

## 1. SIGINT Overview

### 1.1 Definition and Scope

Signals Intelligence (SIGINT) is intelligence derived from the interception,
processing, and analysis of electromagnetic emissions, whether from
communications systems, electronic devices, or foreign instrumentation.

The United States SIGINT System (USSS) defines SIGINT as:

> Intelligence derived from communications, electronic, and foreign
> instrumentation signals. [USSID-18]

The Office of the Director of National Intelligence (ODNI) places SIGINT
among the principal intelligence collection disciplines in the Intelligence
Community (IC), alongside HUMINT, IMINT, MASINT, and OSINT. The National
Security Agency (NSA) serves as the functional manager for SIGINT under
Executive Order 12333 (as amended).

SIGINT encompasses three canonical sub-disciplines:

| Sub-Discipline | Abbreviation | Definition |
|----------------|-------------|------------|
| Communications Intelligence | COMINT | Intelligence from intercepted communications |
| Electronic Intelligence | ELINT | Intelligence from non-communications electromagnetic emissions |
| Foreign Instrumentation Signals Intelligence | FISINT | Intelligence from foreign instrumentation signals (telemetry, beaconry, command) |

### 1.2 Extended Discipline Taxonomy

Beyond the three canonical sub-disciplines, modern SIGINT practice encompasses
extended disciplines that have emerged with the digital age:

| Discipline | Abbreviation | Emergence | Description |
|-----------|-------------|-----------|-------------|
| Cyber Intelligence | CYBINT/DNINT | ~2000s | Intelligence from computer network operations, digital infrastructure |
| Telemetry Intelligence | TELINT | Cold War | Subset of FISINT — specifically telemetry from weapons systems |
| Technical ELINT | TECHELINT | 1960s | Detailed technical analysis of radar parameters for EOB development |
| Operational ELINT | OPELINT | 1960s | Real-time ELINT supporting military operations |
| Network Intelligence | NETINT | 2010s | Intelligence derived from network metadata and traffic analysis |

### 1.3 Historical Evolution

The history of SIGINT traces a continuous arc from wire-tapping in the
telegraph age to machine-learning-assisted analysis of petabyte-scale
digital intercepts:

**Pre-World War I (1840-1914)**

- Telegraph interception during the American Civil War (1861-1865).
  Both Union and Confederate forces tapped telegraph lines.
- British Cable & Wireless intercepts during the Boer War (1899-1902).
- Room 40 established by the Royal Navy (1914) — Britain's first dedicated
  SIGINT organization.

**World War I (1914-1918)**

- Zimmermann Telegram (1917) — intercepted and decrypted by Room 40,
  instrumental in bringing the US into the war.
- Radio direction finding (RDF) used to locate German naval units.
- French Bureau du Chiffre pioneered systematic radio intercept and
  cryptanalysis.

**Interwar Period (1918-1939)**

- US "Black Chamber" (MI-8) under Herbert Yardley operated 1919-1929.
  Closed by Secretary of State Stimson ("Gentlemen do not read each
  other's mail").
- Signal Intelligence Service (SIS) established 1930 under William Friedman.
  Friedman's team broke Japanese PURPLE cipher (1940).
- Government Code and Cypher School (GC&CS) at Bletchley Park (UK)
  established 1919.

**World War II (1939-1945)**

- ULTRA: British decryption of German Enigma and Lorenz ciphers at
  Bletchley Park. Estimated to have shortened the war by 2 years.
- MAGIC: US decryption of Japanese diplomatic and military ciphers.
  JN-25 naval code break enabled Midway victory.
- Y-stations: Allied SIGINT collection network spanning global listening
  posts, feeding raw intercepts to processing centers.
- Traffic analysis: Even without decryption, analysis of message patterns,
  call signs, and volumes provided operational intelligence.
- ELINT origins: British 192 Squadron equipped with receivers to map
  German Freya and Würzburg radar emissions. R.V. Jones pioneered
  scientific intelligence.

**Cold War (1945-1991)**

- UKUSA Agreement (1946): Formalized SIGINT cooperation between US (NSA,
  est. 1952) and UK (GCHQ). Later expanded to include Canada (CSE),
  Australia (ASD/DSD), and New Zealand (GCSB) — the Five Eyes alliance.
- ECHELON: Global SIGINT collection network operated by Five Eyes.
  Satellite intercept stations (Bad Aibling, Menwith Hill, Pine Gap,
  Waihopai, Yakima) intercepted INTELSAT and other satellite
  communications.
- SIGINT satellites: US launched GRAB (1960), POPPY (1962-1977), RHYOLITE
  (1970s), ORION/MENTOR (1990s-present) for SIGINT collection from
  geosynchronous orbit.
- Undersea cable tapping: USS Halibut (1971) tapped Soviet military
  communications cable in Sea of Okhotsk (Operation Ivy Bells).
- FISINT prominence: Monitoring of Soviet missile telemetry became critical
  for arms control verification (SALT I, SALT II, START treaties).

**Digital Age (1991-2010)**

- Internet explosion created new SIGINT targets and challenges.
- NSA Transition 2001: Hayden-era reform to adapt NSA for digital age.
- STELLARWIND/PRISM (post-9/11): Bulk collection programs revealed by
  Snowden (2013). PRISM collected data from major tech companies. Upstream
  collection tapped fiber-optic cables.
- XKEYSCORE: NSA's "Google for SIGINT" — near-real-time search of
  intercepted internet traffic.
- Shift from content to metadata: Recognition that "metadata is
  surveillance" — who/when/where/how long often more valuable than content.

**AI Era (2020-present)**

- Machine learning for automated signal classification, speaker
  identification, anomaly detection.
- Natural language processing for real-time translation and content
  extraction from intercepted communications.
- Deep learning for ELINT: Automatic modulation recognition, emitter
  classification from PDW sequences.
- Adversarial ML: Concern that adversaries may poison training data or
  craft signals specifically to evade ML classifiers.
- Quantum threat: Harvest-now-decrypt-later strategies assume quantum
  computers will break current public-key cryptography. NSA's CNSA 2.0
  timeline targets quantum-resistant algorithms by 2035.

### 1.4 SIGINT Postures

SIGINT operations are classified by their relationship to military
operations and decision timelines:

| Posture | Timeline | Consumer | Description |
|---------|----------|----------|-------------|
| **Strategic SIGINT** | Days to months | National leadership, policymakers | Long-term intelligence on foreign capabilities, intentions, plans |
| **Operational SIGINT** | Hours to days | Theater/campaign commanders | Intelligence supporting operational planning and execution |
| **Tactical SIGINT** | Minutes to hours | Unit commanders, warfighters | Real-time intelligence for immediate tactical decisions |

Tsingou's d2ts pipeline architecture maps naturally to these postures:

- **Strategic**: Retrospective analysis via NATS JetStream replay,
  historical pattern detection, trend analysis
- **Operational**: Real-time cross-source correlation, sliding window
  analysis, anomaly detection
- **Tactical**: Sub-second signal visualization, immediate alert generation,
  live feed composition

### 1.5 The Five Eyes Alliance and ECHELON

The Five Eyes (FVEY) alliance is the world's most significant SIGINT
partnership, formalized through the UKUSA Agreement (1946, declassified 2010):

| Nation | Agency | Primary Role | Key Facilities |
|--------|--------|-------------|----------------|
| United States | NSA (National Security Agency) | Global SIGINT lead, technology development | Fort Meade (MD), Georgia (NSA/CSS), Hawaii, Texas |
| United Kingdom | GCHQ (Government Communications Headquarters) | European focus, cable intercept expertise | Cheltenham, Bude (cable), Menwith Hill (satellite) |
| Canada | CSE (Communications Security Establishment) | Northern approaches, Arctic monitoring | Ottawa |
| Australia | ASD (Australian Signals Directorate) | Asia-Pacific, Southern Hemisphere | Pine Gap (joint US/AU), Shoal Bay |
| New Zealand | GCSB (Government Communications Security Bureau) | South Pacific, satellite intercept | Waihopai, Tangimoana |

**ECHELON** was the signals intercept and analysis network operated by Five
Eyes from the 1960s through at least the 2000s. Key characteristics:

- Satellite intercept stations positioned to cover all major INTELSAT
  ocean regions
- Dictionary systems: Automated keyword/topic filtering of intercepted
  communications
- Each nation responsible for designated geographic/signals targets
- Existence publicly confirmed by European Parliament report (2001)
  and NSA declassifications (2015)

### 1.6 Tsingou Platform Relevance

Tsingou positions itself as a visualization and analysis platform for
SIGINT/OSINT data — it does NOT perform signals collection. The platform's
value proposition maps to intelligence disciplines as follows:

| Activity | Tsingou Responsibility | External Dependency |
|----------|----------------------|---------------------|
| Signal collection | NO — adapters ingest from existing sources | Collection platforms (SDR, network taps, feeds) |
| Signal processing | YES — d2ts pipeline, normalization, dedup | GNU Radio sidecar for RF processing |
| Signal analysis | YES — 8 analysis techniques, cross-source correlation | Analyst expertise, SAT methodology |
| Visualization | YES — 4-layer rendering, real-time display | None (core capability) |
| Dissemination | YES — STIX export, TAXII transport, CTI integration | Downstream consumers (Palantir, OpenCTI) |

---

## 2. COMINT — Communications Intelligence

### 2.1 Definition and Scope

COMINT is intelligence derived from intercepted communications — the content
of messages, the metadata surrounding them, and the patterns of communication
behavior. COMINT is the largest sub-discipline of SIGINT by volume, budget,
and organizational focus.

Intercepted communications include:

| Medium | Examples | Collection Method |
|--------|----------|-------------------|
| Voice | Telephone (PSTN, VoIP, cellular), radio (HF, VHF, UHF), satellite phone | RF intercept, network tap, SS7 exploitation |
| Data | Email, instant messaging, file transfer, web browsing, cloud sync | Cable intercept, upstream collection, warranted access |
| Text | SMS, MMS, pager, telex (legacy) | SS7 intercept, cell-site simulation |
| Video | Video conferencing (Zoom, Teams, etc.), surveillance camera feeds | Network tap, endpoint collection |
| Fax | Facsimile transmission (legacy but persistent in some domains) | PSTN intercept |

### 2.2 Collection Methods

**Radio Frequency (RF) Intercept**

Traditional COMINT collection intercepts radio communications across
the electromagnetic spectrum:

- **HF (3-30 MHz)**: Long-range military and diplomatic communications.
  Skywave propagation enables global intercept from fixed stations.
  Thinning with satellite displacement but still used by military,
  maritime, and diplomatic services.
- **VHF/UHF (30 MHz - 3 GHz)**: Tactical military radio, aviation,
  public safety. Line-of-sight propagation limits intercept range.
  Requires airborne or ground-based proximity collection.
- **Microwave (1-40 GHz)**: Point-to-point relay links, satellite
  uplinks/downlinks. Intercept requires positioned receivers in the
  beam path or at relay points.

Collection platforms include:

| Platform | Range | Duration | Examples |
|----------|-------|----------|---------|
| Ground-based fixed | HF global, VHF/UHF local | Continuous | Sugar Grove (WV), Teufelsberg (Berlin, historical) |
| Ground-based mobile | VHF/UHF local | Temporary | SIGINT vehicles, man-portable systems |
| Airborne | 200-500km radius | Hours | RC-135 RIVET JOINT, EP-3 ARIES II, MC-12W LIBERTY |
| Shipborne | 200-400km radius | Extended | DDG SIGINT suites, USNS Impeccable |
| Satellite | Footprint-dependent | Continuous | ORION/MENTOR (GEO), INTRUDER (LEO) |
| Submarine | Local | Covert | Special operations, cable tapping |

**Satellite Communication Intercept**

SATCOM intercept targets communications relayed via satellite:

- **INTELSAT/commercial satellite**: Large footprint dishes at designated
  intercept stations capture downlink signals
- **VSAT networks**: Small-aperture terminals used by military,
  humanitarian, and commercial users — vulnerable to intercept
- **Iridium/Thuraya/Inmarsat**: Satellite phone networks — COMINT
  gold mine due to user assumption of security
- **DVB-S**: Satellite TV used as covert communications channel —
  data embedded in broadcast stream

**Cable Intercept**

Fiber-optic cable intercept is the dominant modern COMINT collection method:

- **Undersea cables**: Carry 97% of intercontinental internet traffic.
  Tapping points at cable landing stations (e.g., GCHQ Bude).
  TEMPORA (GCHQ program) buffered full-take cable data for 3 days
  (content) and 30 days (metadata).
- **Terrestrial fiber**: Domestic backbone tapping requires legal
  authority (FISA, Section 702 for US). AT&T Room 641A (San Francisco)
  was an NSA upstream collection point.
- **Optical splitters**: Non-intrusive tapping via beam splitters —
  copies light without interrupting transmission.

**Network-Level Collection**

Modern COMINT extends beyond RF to network-layer collection:

- **Deep packet inspection (DPI)**: Application-layer protocol analysis.
  Identifies applications, extracts content even on non-standard ports.
- **SS7 exploitation**: Signaling System 7 vulnerabilities enable
  location tracking, call/SMS intercept, and IMSI harvesting on
  cellular networks.
- **IMSI catchers (cell-site simulators)**: Devices that impersonate
  cell towers to force target phones to connect. StingRay (Harris Corp.)
  is the most widely known. Collect IMSI, IMEI, location, and can
  intercept calls/SMS.
- **Wi-Fi collection**: Passive monitoring of 802.11 traffic. Even
  encrypted Wi-Fi leaks metadata (probe requests reveal SSIDs,
  MAC addresses enable tracking).

**Social Media and Internet Monitoring**

- **API collection**: Platform APIs (where available) provide structured
  access to public posts, profiles, and metadata
- **Web scraping**: Automated collection of forum posts, blog comments,
  image boards, paste sites
- **Dark web monitoring**: Tor hidden services, I2P, Freenet — requires
  specialized collection infrastructure

### 2.3 Processing Chain

Raw COMINT intercepts undergo a multi-stage processing chain before
yielding actionable intelligence:

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Intercept   │────▶│  Decryption │────▶│  Translation │────▶│   Content    │
│  (raw signal)│     │  (if needed) │     │  (if needed) │     │  Extraction  │
└──────────────┘     └─────────────┘     └──────────────┘     └──────┬───────┘
                                                                     │
                     ┌─────────────┐     ┌──────────────┐            │
                     │   Voice     │◀────│   Metadata   │◀───────────┘
                     │  Analysis   │     │   Analysis   │
                     └─────────────┘     └──────────────┘
```

**Stage 1: Decryption**

- Cryptanalysis of encrypted communications
- Key recovery through HUMINT, side-channel attacks, or brute force
- Protocol exploitation (weak implementations, known vulnerabilities)
- Note: End-to-end encryption (Signal, WhatsApp) has significantly
  increased the difficulty of content access — driving emphasis toward
  metadata analysis

**Stage 2: Translation**

- Human translators remain essential for nuanced interpretation
- Machine translation (MT) provides initial triage and prioritization
- Language identification precedes translation for multi-language intercepts
- Critical languages: Arabic, Mandarin, Farsi, Russian, Korean, Pashto, Urdu

**Stage 3: Content Extraction**

- Named Entity Recognition (NER): Extract persons, organizations,
  locations, dates, monetary amounts
- Topic classification: Categorize intercepts by subject matter
- Sentiment analysis: Assess emotional tone, urgency, intent
- Key phrase extraction: Identify significant terms and concepts

**Stage 4: Metadata Analysis**

Metadata analysis has become equal to or more valuable than content
analysis in the digital age:

| Metadata Type | What It Reveals | Analysis Technique |
|---------------|----------------|-------------------|
| **Call Detail Records (CDR)** | Who called whom, when, duration, cell tower | Contact chaining, social network analysis |
| **Email headers** | Sender, recipients, timestamps, routing, subject | Communication pattern analysis |
| **IP addresses** | Source/destination, geolocation, ISP attribution | Network topology mapping |
| **Selector data** | Phone numbers, email addresses, IMSIs, MAC addresses | Identity resolution, device tracking |
| **Timing data** | Message timestamps, session durations, inter-message intervals | Pattern-of-life analysis |
| **Location data** | Cell tower IDs, GPS coordinates, IP geolocation | Movement pattern analysis, co-location |

**Contact Chaining**

Contact chaining (also called "link analysis" in COMINT context) maps
communication relationships:

- First hop: Direct contacts of target
- Second hop: Contacts of contacts (N² expansion)
- Third hop: Contacts of contacts of contacts (N³ — millions of records)

The USA FREEDOM Act (2015) limited NSA's bulk collection and restricted
contact chaining to 2 hops from a specific selector.

**Traffic Analysis**

Traffic analysis extracts intelligence from communication patterns
WITHOUT accessing content:

- **Volume analysis**: Spike in communications may indicate impending
  operations
- **Timing analysis**: Regular patterns reveal organizational structure
  and routine
- **Network analysis**: Communication topology reveals hierarchies,
  cells, and command chains
- **Correlation analysis**: Simultaneous activity across multiple
  selectors indicates coordination
- **Absence analysis**: Sudden communication silence (EMCON) may
  indicate operational security or imminent action

### 2.4 Voice Analysis

Modern COMINT includes sophisticated voice analysis capabilities:

| Capability | Description | Technology |
|-----------|-------------|------------|
| Speaker identification | Match voice to known individual | Voiceprint database, GMM-UBM, i-vector, x-vector |
| Speaker verification | Confirm claimed identity | Same as identification, threshold-based |
| Language identification | Determine spoken language | Acoustic models, phonotactic analysis |
| Emotion detection | Assess speaker emotional state | Prosody analysis, spectral features |
| Keyword spotting | Detect specific words/phrases | HMM, DNN-based speech recognition |
| Speech-to-text | Full transcription of voice content | ASR (automatic speech recognition) engines |

### 2.5 Modern COMINT Challenges

| Challenge | Impact | Mitigation |
|-----------|--------|------------|
| End-to-end encryption (E2EE) | Content inaccessible without endpoint access | Metadata analysis, endpoint exploitation |
| Ephemeral messaging | Messages auto-delete, reducing forensic value | Real-time collection, platform cooperation |
| 5G network slicing | Encrypted, segmented traffic harder to intercept | New collection architectures |
| VPN/Tor usage | Source attribution complicated | Traffic correlation, timing analysis |
| Volume | Petabytes/day of intercept data | ML-based triage, automated prioritization |
| Encrypted DNS (DoH/DoT) | DNS metadata no longer visible | Alternative metadata sources |
| Certificate pinning | MITM intercept increasingly difficult | Endpoint-based collection |

### 2.6 Tsingou COMINT Mapping

Tsingou ingests COMINT-derived data through several adapter paths:

| COMINT Data Type | Tsingou Adapter | Signal Kind | Processing |
|-----------------|-----------------|-------------|------------|
| CDR/metadata feeds | `HttpSourceAdapter` (API poll) | `http` | d2ts join for contact chaining |
| RSS threat intel | `RssSourceAdapter` | `rss` | NLP entity extraction |
| Real-time alerts | `WebSocketSourceAdapter` | `websocket` | Anomaly detection, windowing |
| NATS event streams | `NatsSourceAdapter` | `nats` | Cross-source correlation |
| PCAP file analysis | `HolonetBridgeAdapter` (file watch) | `file-watch` | Protocol decode, metadata extraction |

---

## 3. ELINT — Electronic Intelligence

### 3.1 Definition and Scope

ELINT is intelligence derived from non-communications electromagnetic
emissions — primarily radar systems, but also navigation aids, IFF
(Identification Friend or Foe) transponders, data links, and other
electronic emitters.

ELINT is fundamentally concerned with characterizing emitters:

- **What** type of radar or electronic system is emitting
- **Where** is it located (geolocation)
- **What** are its operating parameters (frequency, power, timing)
- **What** does it reveal about the military order of battle

### 3.2 Signal Characteristics — Pulse Descriptor Words (PDWs)

The fundamental unit of ELINT data is the Pulse Descriptor Word (PDW),
which captures the measured parameters of a single radar pulse:

| Parameter | Abbreviation | Unit | Description |
|-----------|-------------|------|-------------|
| Radio Frequency | RF | MHz/GHz | Center frequency of the pulse |
| Pulse Amplitude | PA | dBm | Received power level |
| Pulse Width | PW | μs/ns | Duration of the pulse |
| Pulse Repetition Interval | PRI | μs/ms | Time between consecutive pulses |
| Time of Arrival | TOA | μs (epoch-referenced) | Absolute time the pulse was received |
| Angle of Arrival | AOA | degrees | Direction from which the pulse arrived |
| Modulation on Pulse | MOP | various | Intra-pulse modulation type and parameters |
| Frequency on Pulse | FOP | MHz | Intra-pulse frequency variation |

**PDW in Tsingou Schema Context:**

The PDW maps naturally to an Effect.Schema definition for Tsingou's
BaseSignal extension:

```typescript
// Conceptual — PDW as Effect.Schema
const PulseDescriptorWord = Schema.Struct({
  rf_mhz: Schema.Number.pipe(Schema.between(0.1, 100000)),     // RF in MHz
  pa_dbm: Schema.Number.pipe(Schema.between(-120, 30)),         // Amplitude in dBm
  pw_us: Schema.Number.pipe(Schema.positive()),                  // Pulse width in μs
  pri_us: Schema.Number.pipe(Schema.positive()),                 // PRI in μs
  toa_us: Schema.Number.pipe(Schema.positive()),                 // Time of arrival
  aoa_deg: Schema.Number.pipe(Schema.between(0, 360)),          // Angle of arrival
  mop_type: Schema.Literal('none', 'linear_fm', 'barker', 'polyphase', 'frequency_hop'),
  fop_mhz: Schema.optional(Schema.Number),                      // Frequency on pulse
})
```

### 3.3 Radar Signal Types and Scan Patterns

ELINT systems must identify and categorize diverse radar types:

| Radar Type | Function | Typical RF | Typical PRI | Scan Pattern |
|-----------|----------|-----------|-------------|--------------|
| Early Warning (EW) | Long-range air surveillance | L/S band (1-4 GHz) | 1-4 ms | Mechanical 360° rotation |
| Height Finder | Altitude determination | S/C band (2-8 GHz) | 0.5-2 ms | Nodding/V-beam |
| Target Acquisition | Medium-range tracking | S/C band (2-8 GHz) | 0.3-1 ms | Sector scan |
| Fire Control | Weapon guidance | X/Ku band (8-18 GHz) | 0.1-0.5 ms | Conical scan, monopulse |
| Missile Seeker | Terminal guidance | X/Ka band (8-40 GHz) | 10-100 μs | Conical scan, active |
| SAR (Synthetic Aperture) | Ground imaging | X/C/L band (1-12 GHz) | Variable | Spotlight/stripmap |
| Weather | Meteorological | S/C band (2-8 GHz) | 0.5-3 ms | 360° rotation |
| Navigation | Maritime/airborne nav | X band (9.3-9.5 GHz) | 0.5-2 ms | 360° rotation |

**Scan patterns** reveal emitter type and operational mode:

| Scan Pattern | Description | What It Indicates |
|-------------|-------------|-------------------|
| Circular | Continuous 360° rotation | Surveillance radar |
| Sector | Limited angular coverage | Target acquisition, fire control search |
| Raster | Line-by-line coverage | 3D surveillance, height finding |
| Helical | Combined circular + elevation | 3D search radar |
| Conical | Circular nutating beam | Older fire control tracking |
| Track-while-scan | Interleaved search + track | Modern multi-function radar |
| Electronically steered | Agile beam positioning | AESA/PESA phased array |

### 3.4 Collection Methods

**Receiver Architectures**

ELINT receivers must cover wide bandwidths with high sensitivity:

| Receiver Type | Bandwidth | Sensitivity | Advantages | Limitations |
|--------------|-----------|-------------|------------|-------------|
| Crystal video | Wide (GHz) | Low (-40 dBm) | Simple, instant coverage | No frequency measurement |
| Superheterodyne | Narrow (MHz) | High (-80 dBm) | Excellent sensitivity, frequency accuracy | Slow scanning, narrow instantaneous BW |
| Channelized | Wide (GHz) | Medium (-60 dBm) | Simultaneous wideband coverage | Complex, expensive |
| Compressive (microscan) | Wide (GHz) | Medium (-55 dBm) | Fast frequency measurement | Limited dynamic range |
| Digital (wideband ADC) | Moderate (100s MHz) | Medium (-65 dBm) | Flexible, software-defined | ADC technology limited |
| Bragg cell | Wide (GHz) | Medium (-50 dBm) | Real-time spectrum analysis | Optical complexity |

**Direction Finding (DF) Techniques**

| Technique | Accuracy | Bandwidth | Description |
|-----------|----------|-----------|-------------|
| Amplitude comparison | 5-10° | Wide | Compare signal levels across directional antennas |
| Phase interferometry | 0.1-1° | Moderate | Measure phase difference across antenna baseline |
| Watson-Watt | 2-5° | Wide | Rotating loop or crossed loops |
| Doppler DF | 1-3° | Wide | Measure Doppler shift from rotating antenna |
| Time Difference of Arrival (TDOA) | 0.1-1° | Wide | Multiple receivers, measure arrival time differences |
| Frequency Difference of Arrival (FDOA) | 0.5-2° | Wide | Multiple moving receivers, measure frequency shift |

**Collection Platforms**

| Platform | Role | Examples |
|----------|------|---------|
| Ground-based fixed | Strategic ELINT | AN/FLR-9 (Wullenweber array), various allied stations |
| Ground-based mobile | Tactical ELINT | PROPHET (AN/MLQ-44), Ground SIGINT systems |
| Airborne | Strategic/operational | RC-135 RIVET JOINT, U-2 SENIOR GLASS, RQ-4 Global Hawk |
| Shipborne | Maritime ELINT | AN/SLQ-32, CLASSIC OUTBOARD/COBLU |
| Space-based | Strategic/global | INTRUDER (LEO), Naval Ocean Surveillance System (NOSS) |
| UAV | Tactical ELINT | MQ-9 Reaper SIGINT pod, RQ-170 Sentinel |

### 3.5 Processing Chain

ELINT processing transforms raw PDW streams into identified emitters:

```
┌───────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  RF Front  │────▶│   Pulse     │────▶│    Pulse     │────▶│   Emitter    │
│    End     │     │  Detection  │     │   Sorting    │     │   ID (EID)   │
└───────────┘     └─────────────┘     └──────────────┘     └──────┬───────┘
                                                                   │
                  ┌─────────────┐     ┌──────────────┐            │
                  │    EOB      │◀────│   Parameter  │◀───────────┘
                  │   Update    │     │  Measurement │
                  └─────────────┘     └──────────────┘
```

**Stage 1: Pulse Detection**

Detect radar pulses in the received RF environment:
- Threshold detection against noise floor
- Leading/trailing edge detection for PW measurement
- TOA stamping with sub-microsecond resolution
- PA measurement via calibrated power detection

**Stage 2: Pulse Sorting (Deinterleaving)**

In a real RF environment, pulses from multiple emitters arrive
interleaved. Deinterleaving separates them into per-emitter pulse trains:

| Algorithm | Method | Strengths | Weaknesses |
|-----------|--------|-----------|------------|
| PRI-based | Group pulses by consistent PRI | Works for fixed-PRI radars | Fails for PRI-agile emitters |
| Histogram | Cluster PRI/RF/PW in parameter space | Good for dense environments | Resolution limited |
| Sequential | Process pulses in TOA order, predict next | Handles stagger, jitter | Sensitive to missed pulses |
| CDIF (Cumulative Difference) | Histogram of all TOA differences | Robust PRI extraction | Computationally intensive |
| Clustering (DBSCAN/k-means) | Multi-dimensional parameter clustering | Handles complex environments | Requires parameter tuning |

**Stage 3: Parametric Measurement**

Once pulses are sorted into emitter-specific trains:
- Statistical PRI analysis: mean, mode, jitter, stagger patterns
- RF agility characterization: hopping pattern, bandwidth, dwell time
- PW measurement: pulse compression ratio, modulation bandwidth
- Scan analysis: determine scan type, rate, sector

**Stage 4: Emitter Identification (EID)**

Match measured parameters against known emitter databases:
- Electronic Order of Battle (EOB) databases
- EWIR (Electronic Warfare Integrated Reprogramming) data files
- Pattern matching against parametric templates
- Mode identification: determine operational state (search, track, engage)

**Stage 5: EOB Update**

Update the electronic order of battle with new observations:
- New emitter: Add to EOB with parameters and location
- Known emitter: Update position, operating modes, activity status
- Emitter removal: Mark emitters not observed after threshold period

### 3.6 Modern ELINT Challenges

| Challenge | Description | Impact |
|-----------|-------------|--------|
| **LPI Radar** | Low Probability of Intercept — spread spectrum, low power, wideband | Hard to detect with conventional receivers |
| **Cognitive Radar** | Adapts waveform based on environment and target response | Unpredictable parameters defeat template matching |
| **AESA Phased Arrays** | Agile beams, multiple simultaneous beams, low sidelobes | Reduced intercept probability, complex deinterleaving |
| **MIMO Radar** | Multiple simultaneous waveforms from distributed apertures | Conventional receivers cannot separate signals |
| **DRFM Jammers** | Digital Radio Frequency Memory — captures and retransmits | Creates false targets, complicates ELINT collection |
| **Frequency Agility** | Pulse-to-pulse frequency changes across wide bandwidth | Defeats narrowband receivers, complicates sorting |

### 3.7 Tsingou ELINT Mapping

ELINT data enters Tsingou through the SDR bridge path:

| ELINT Data Type | Tsingou Path | Signal Kind | Rendering Layer |
|----------------|-------------|-------------|-----------------|
| PDW streams | GNU Radio → NATS → `NatsSourceAdapter` | `nats` | visx (scatter plots), p5 (waterfall) |
| Spectrum data (FFT) | GNU Radio → NATS FFT topic | `nats` | p5 (spectrum display), visx (frequency histogram) |
| Emitter locations | Processing → NATS | `nats` | R3F (3D geospatial), DOM (table) |
| EOB database | File/API → `HttpSourceAdapter` | `http` | DOM (table), R3F (map overlay) |

Cross-reference: SDR hardware landscape and GNU Radio bridge in TSG.16-17.
Cross-reference: EW doctrine alignment in TSG.36.

---

## 4. FISINT — Foreign Instrumentation Signals Intelligence

### 4.1 Definition and Scope

FISINT is intelligence derived from foreign instrumentation signals —
electromagnetic emissions associated with the testing and operational
deployment of foreign aerospace, surface, and subsurface systems.

FISINT encompasses:

| Signal Type | Source | Intelligence Value |
|------------|--------|-------------------|
| Telemetry | Missile/rocket flight data, vehicle performance | System capabilities, performance envelope |
| Beaconry | Tracking transponders on test vehicles | Trajectory reconstruction, accuracy assessment |
| Video data links | Onboard cameras, sensor feeds | System configuration, guidance behavior |
| Command signals | Ground-to-vehicle commands | Control architecture, operational procedures |
| Performance monitoring | Engine sensors, structural monitors | Design margins, failure modes |

### 4.2 Historical Context

FISINT's prominence grew during the Cold War when monitoring Soviet missile
tests was critical for strategic balance assessment:

- **SALT I/II and START treaties**: Required "national technical means"
  for verification — primarily FISINT collection of telemetry from
  Soviet/Russian missile tests
- **Article V, SALT I**: Both parties agreed not to interfere with
  NTM of verification (implicitly acknowledging SIGINT collection)
- **Encryption controversy**: Soviet Union began encrypting missile
  telemetry in the 1970s; US argued this violated the spirit of
  verification agreements

Collection platforms historically included:

- Ground stations in Turkey, Iran (pre-1979), Pakistan, China (Qitai)
- COBRA DANE phased-array radar (Shemya, Alaska)
- Ships positioned along missile test trajectories
- SIGINT satellites (RHYOLITE/AQUACADE) in geosynchronous orbit

### 4.3 Modern FISINT

Modern FISINT extends beyond missile monitoring to include:

- Hypersonic vehicle testing (China, Russia)
- Space launch vehicle telemetry
- UAV command and data links
- Anti-satellite (ASAT) weapon testing
- Directed energy weapon testing signatures

### 4.4 Tsingou FISINT Mapping

FISINT is a MAY-support discipline in Tsingou — the platform does not
provide dedicated FISINT processing but could ingest FISINT-derived data:

- Telemetry time-series via `HttpSourceAdapter` or `NatsSourceAdapter`
- Trajectory data for 3D visualization in R3F layer
- Schema extensibility allows custom FISINT signal kinds via runtime
  registration in the SchemaRegistry (NATS KV)

---

## 5. CYBINT/DNINT — Cyber/Digital Network Intelligence

### 5.1 Definition and Scope

Cyber Intelligence (CYBINT) and Digital Network Intelligence (DNINT) refer
to intelligence derived from computer networks, digital infrastructure, and
cyber operations. This is the fastest-growing intelligence discipline and
the most native to STIX 2.1 data modeling.

### 5.2 Collection Methods

**Passive Collection**

| Method | Data Captured | Use Case |
|--------|--------------|----------|
| PCAP (packet capture) | Full packet content and headers | Network forensics, protocol analysis |
| NetFlow/IPFIX | Flow metadata (src/dst IP, ports, bytes, duration) | Network behavior analysis, anomaly detection |
| DNS logging | Query/response records | Domain intelligence, C2 detection |
| Passive DNS | Historical DNS resolution data | Infrastructure tracking, domain attribution |
| BGP monitoring | Route announcements and withdrawals | Route hijacking detection, infrastructure mapping |
| Certificate transparency | TLS certificate issuance logs | Phishing detection, infrastructure discovery |
| Darknet/honeypot | Unsolicited traffic to unused IP space | Scanning activity, botnet detection |

**Active Collection**

| Method | Data Captured | Use Case |
|--------|--------------|----------|
| Vulnerability scanning | Open ports, services, versions | Attack surface assessment |
| Honeypots | Attacker TTPs, malware samples | Threat intelligence, early warning |
| Dark web crawling | Forum posts, marketplace listings | Threat actor intelligence |
| Malware sandboxing | Behavioral analysis, C2 beacons | IOC extraction, capability assessment |
| Active DNS probing | Zone transfers, subdomain enumeration | Infrastructure mapping |
| Banner grabbing | Service identification | Technology stack profiling |

**Threat Intelligence Feeds**

| Source Type | Examples | Data Format |
|-----------|---------|-------------|
| Commercial | Recorded Future, Mandiant, CrowdStrike, Intel 471 | STIX/TAXII, proprietary API |
| Open source | AlienVault OTX, Abuse.ch, PhishTank, URLhaus | STIX, CSV, JSON |
| Government | US-CERT, CISA KEV, UK NCSC | STIX, advisories |
| ISAC/ISAO | FS-ISAC, IT-ISAC, NH-ISAC | STIX/TAXII, member portals |
| Community | MISP communities, OpenCTI instances | MISP format, STIX |

### 5.3 Processing and Analysis

**IOC (Indicator of Compromise) Extraction**

IOCs are the atomic evidence of malicious activity:

| IOC Type | STIX SDO | Example |
|----------|---------|---------|
| IP address | `ipv4-addr`, `ipv6-addr` | `192.168.1.100` |
| Domain | `domain-name` | `evil-c2.example.com` |
| URL | `url` | `https://evil.com/payload.exe` |
| File hash | `file` (with `hashes`) | SHA-256: `a1b2c3...` |
| Email address | `email-addr` | `phisher@evil.com` |
| Registry key | `windows-registry-key` | `HKLM\SOFTWARE\Malware` |
| Mutex | `mutex` | `Global\EvilMutex` |
| User agent | `network-traffic` (extension) | `Mozilla/5.0 (evil)` |

**ATT&CK Mapping**

MITRE ATT&CK provides a structured framework for classifying adversary
tactics, techniques, and procedures (TTPs):

| Tactic | ID | Description | CYBINT Relevance |
|--------|-----|-------------|-----------------|
| Reconnaissance | TA0043 | Gathering information | Passive/active scanning detection |
| Resource Development | TA0042 | Establishing infrastructure | Domain/IP acquisition tracking |
| Initial Access | TA0001 | Gaining entry | Phishing, exploitation detection |
| Execution | TA0002 | Running malicious code | Malware analysis, sandbox results |
| Persistence | TA0003 | Maintaining access | Registry, scheduled tasks, implants |
| Privilege Escalation | TA0004 | Gaining higher privileges | Exploit detection, UAC bypass |
| Defense Evasion | TA0005 | Avoiding detection | Obfuscation, process injection |
| Credential Access | TA0006 | Stealing credentials | Credential dumping, keylogging |
| Discovery | TA0007 | Exploring environment | Network scanning, enumeration |
| Lateral Movement | TA0008 | Moving within network | RDP, SMB, WMI exploitation |
| Collection | TA0009 | Gathering data of interest | Data staging, clipboard capture |
| Command and Control | TA0011 | Communicating with implants | C2 beacon detection, protocol analysis |
| Exfiltration | TA0010 | Stealing data | DNS tunneling, encrypted channels |
| Impact | TA0040 | Manipulation/disruption | Ransomware, wiper, DDoS |

### 5.4 STIX Alignment

CYBINT is the most STIX-native intelligence discipline. Nearly all CYBINT
artifacts map directly to STIX 2.1 SDOs and SCOs:

| CYBINT Artifact | STIX Object Type | Relationship |
|----------------|-----------------|--------------|
| Threat actor profile | `threat-actor` SDO | `attributed-to`, `targets` |
| Malware family | `malware` SDO | `uses`, `drops` |
| Attack campaign | `campaign` SDO | `attributed-to`, `uses` |
| Vulnerability | `vulnerability` SDO | `exploits`, `targets` |
| Attack pattern (TTP) | `attack-pattern` SDO | `uses` (mapped to ATT&CK) |
| IOC (indicator) | `indicator` SDO | `indicates`, `based-on` |
| Network observable | `observed-data` SDO + SCOs | Various SCO types |
| Course of action | `course-of-action` SDO | `mitigates` |
| Tool used | `tool` SDO | `uses` |
| Infrastructure | `infrastructure` SDO | `hosts`, `communicates-with` |

Cross-reference: Full STIX 2.1 data model in TSG.12. Codec in TSG.13.

### 5.5 Tsingou CYBINT Mapping

CYBINT is a primary (MUST support) discipline in Tsingou:

| CYBINT Data Type | Tsingou Adapter | Signal Kind | Analysis Technique |
|-----------------|-----------------|-------------|-------------------|
| Threat intel feeds | `HttpSourceAdapter` (API poll) | `http` | IOC correlation, ATT&CK mapping |
| STIX bundles | `HttpSourceAdapter` (TAXII) | `http` | Entity graph construction |
| DNS data | `NatsSourceAdapter` | `nats` | Domain pattern analysis |
| PCAP metadata | `HolonetBridgeAdapter` (file watch) | `file-watch` | Network behavior analysis |
| Real-time alerts | `WebSocketSourceAdapter` | `websocket` | Anomaly detection, windowing |
| RSS advisories | `RssSourceAdapter` | `rss` | NLP entity extraction |

---

## 6. MASINT — Measurement and Signature Intelligence

### 6.1 Definition and Scope

Measurement and Signature Intelligence (MASINT) is intelligence derived
from the detection, tracking, identification, and characterization of
phenomena associated with the signatures (acoustic, seismic, chemical,
nuclear, electromagnetic) of targets and sources.

MASINT differs from SIGINT in that it focuses on the physical properties
and signatures of targets rather than on communications or electronic
emissions per se.

### 6.2 Sub-Disciplines

| Sub-Discipline | Abbreviation | Focus | Sensors |
|---------------|-------------|-------|---------|
| Radar Intelligence | RADINT | Target RCS, velocity, trajectory | Radar systems (monostatic, bistatic) |
| Nuclear Intelligence | NUCINT | Nuclear events, materials, radiation | Gamma spectrometers, seismographs, radionuclide detectors |
| Acoustic Intelligence | ACINT/ACOUSTINT | Underwater/surface sound signatures | Sonar (active/passive), hydrophones, SOSUS |
| Infrared Intelligence | IRINT | Thermal signatures, heat sources | IR sensors (MWIR, LWIR, SWIR) |
| Laser Intelligence | LASINT | Laser emissions and designators | Laser warning receivers |
| Chemical/Biological/Radiological Intelligence | CBRINT | CBR agents, effluents | Mass spectrometers, particle samplers |
| Electro-Optical Intelligence | ELECTRO-OPTINT | Visual and near-visual signatures | Multispectral/hyperspectral imagers |
| RF/Electromagnetic Pulse Intelligence | RF/EMPINT | RF emissions, EMP characteristics | Specialized RF sensors |
| Seismic Intelligence | (subset of NUCINT) | Ground vibrations from nuclear tests, tunneling | Seismometer arrays |
| Debris Intelligence | (subset of FISINT/MASINT) | Physical debris from weapons tests | Collection platforms |

### 6.3 CTBTO International Monitoring System

The Comprehensive Nuclear-Test-Ban Treaty Organization (CTBTO) operates
a global monitoring system that demonstrates MASINT collection at scale:

| Technology | Stations | Detection Capability |
|-----------|----------|---------------------|
| Seismic | 170 (50 primary, 120 auxiliary) | Underground nuclear tests > 1 kT |
| Hydroacoustic | 11 | Underwater nuclear tests |
| Infrasound | 60 | Atmospheric nuclear tests |
| Radionuclide | 80 (+ 16 labs) | Radioactive debris from any nuclear test |

### 6.4 Tsingou MASINT Mapping

MASINT is a MAY-support discipline. Tsingou could ingest MASINT-derived
data through sensor adapters:

- Seismic/acoustic time-series via `NatsSourceAdapter` or
  `WebSocketSourceAdapter`
- Spectral data (IR, multispectral) via `HttpSourceAdapter`
- Custom MASINT signal kinds via runtime SchemaRegistry extension
- Visualization: visx for time-series, p5 for spectrograms, R3F for
  3D sensor placement

---

## 7. GEOINT — Geospatial Intelligence

### 7.1 Definition and NGA Doctrine

Geospatial Intelligence (GEOINT) is intelligence derived from the
exploitation and analysis of imagery and geospatial information to describe,
assess, and visually depict physical features and geographically referenced
activities on Earth.

The National Geospatial-Intelligence Agency (NGA) defines GEOINT as
comprising three components:

| Component | Description |
|----------|-------------|
| **Imagery Intelligence (IMINT)** | Intelligence from visual representations (satellite, aerial, ground) |
| **Geospatial Information** | Data about the physical Earth (terrain, features, infrastructure) |
| **Geospatial Analysis** | Exploitation of imagery and geospatial information for intelligence |

### 7.2 Collection Platforms

| Platform | Resolution | Revisit | Examples |
|----------|-----------|---------|---------|
| Government satellite (optical) | 10-30 cm | 1-3 days | KH-11 (CRYSTAL), GeoEye-2 |
| Commercial satellite (optical) | 25-50 cm | Daily | Maxar WorldView, Planet SkySat, Airbus Pleiades |
| Government satellite (SAR) | 0.5-3 m | Variable | Lacrosse/Onyx, Capella Space |
| Commercial satellite (SAR) | 0.5-1 m | Hours | ICEYE, Capella Space, Synspective |
| Airborne (manned) | 5-20 cm | On demand | U-2, MC-12W, P-8A Poseidon |
| Airborne (UAV) | 5-30 cm | Persistent | MQ-9 Reaper, RQ-4 Global Hawk, RQ-170 |
| Ground-based | Sub-cm | Continuous | Ground surveillance radar, border cameras |
| Open source | 30 cm - 15 m | Varies | Google Earth, Sentinel-2, Landsat, Planet |

### 7.3 Analysis Types

| Analysis Type | Description | Use Case |
|--------------|-------------|----------|
| First Phase Exploitation (FPE) | Rapid initial assessment | Time-sensitive targeting |
| Detailed Exploitation | In-depth analysis with measurements | Order of battle, capability assessment |
| Pattern-of-Life (POL) | Temporal activity patterns at locations | Facility monitoring, behavioral profiling |
| Change Detection | Compare multi-temporal imagery | Construction monitoring, military buildup |
| Activity-Based Intelligence (ABI) | Correlate geospatial data with other INT | Multi-source intelligence fusion |
| Terrain Analysis | Slope, elevation, hydrology, vegetation | Military planning, infrastructure assessment |
| 3D Modeling | Point cloud generation, building extraction | Urban planning, battle space prep |

### 7.4 Tsingou GEOINT Mapping

GEOINT is a SHOULD-support discipline in Tsingou:

| GEOINT Data Type | Tsingou Adapter | Rendering Layer | Analysis |
|-----------------|-----------------|-----------------|----------|
| Geospatial coordinates | All adapters (geo-enriched) | R3F (3D map), DOM (map widget) | Geospatial correlation |
| Imagery tiles | `HttpSourceAdapter` (tile server) | R3F (texture overlay) | Change detection |
| GeoJSON features | `HttpSourceAdapter` (API) | R3F (3D features), visx (2D map) | Spatial analysis |
| Satellite feeds | `WebSocketSourceAdapter` | p5 (imagery display) | Temporal monitoring |

Cross-reference: Geospatial mathematics in TSG.30.

---

## 8. OSINT — Open Source Intelligence

### 8.1 Definition and Scope

Open Source Intelligence (OSINT) is intelligence produced from publicly
available information that is collected, exploited, and disseminated in
a timely manner to an appropriate audience for the purpose of addressing
a specific intelligence requirement.

OSINT is a primary (MUST support) discipline in Tsingou alongside CYBINT.

### 8.2 Source Categories

| Category | Sources | Collection Method |
|----------|---------|-------------------|
| **Media** | News agencies, newspapers, television, radio | RSS feeds, API monitoring, web scraping |
| **Internet** | Websites, blogs, forums, social media, dark web | API collection, scraping, specialized tools |
| **Public Government** | Government reports, hearings, budgets, legal filings | Document retrieval, FOIA, RSS |
| **Professional/Academic** | Journals, conferences, patents, dissertations | Database search, citation tracking |
| **Commercial** | Business databases, financial reports, imagery | API access, subscription services |
| **Geospatial** | Maps, satellite imagery, GIS data | Tile servers, WMS/WFS, Google Earth |
| **Social Media** | Twitter/X, Facebook, Telegram, Reddit, TikTok | Platform APIs, specialized tools |
| **Technical** | Code repositories, network data, DNS records | GitHub API, Shodan, Censys |

### 8.3 ODNI IC OSINT Strategy (2024-2026)

The ODNI's IC OSINT Strategy emphasizes several key themes relevant
to Tsingou's design:

1. **Parity with classified sources**: OSINT should be treated with
   the same rigor as classified collection
2. **Automation**: ML/AI for collection prioritization, translation,
   entity extraction, and triage
3. **Tradecraft standardization**: Common analytic standards for
   OSINT evaluation and sourcing
4. **Integration**: OSINT must be integrated with other INTs in
   all-source analysis
5. **Commercial partnerships**: Leverage commercial data providers
   (social media analytics, satellite imagery, dark web monitoring)

### 8.4 OSINT Tradecraft

**Source Evaluation**

OSINT requires rigorous source evaluation using the Admiralty System
(also called NATO system):

| Reliability Code | Meaning | Criteria |
|-----------------|---------|----------|
| A | Completely reliable | Source has provided reliable info consistently |
| B | Usually reliable | Source has provided reliable info in most cases |
| C | Fairly reliable | Source has provided reliable info in some cases |
| D | Not usually reliable | Source has provided unreliable info in most cases |
| E | Unreliable | Source has provided unreliable info consistently |
| F | Cannot be judged | Insufficient basis for evaluation |

| Accuracy Code | Meaning | Criteria |
|--------------|---------|----------|
| 1 | Confirmed | Confirmed by independent sources |
| 2 | Probably true | Likely based on logical assessment |
| 3 | Possibly true | Possible but not confirmed |
| 4 | Doubtfully true | Questionable, significant doubt |
| 5 | Improbable | Unlikely, contradicted by other info |
| 6 | Cannot be judged | No basis for determination |

**OPSEC Considerations**

OSINT collection must maintain operational security:

- **Managed attribution**: Use infrastructure that cannot be attributed
  back to the collecting organization
- **Persona management**: Maintain separate identities for different
  collection activities
- **Browser/network isolation**: Dedicated collection infrastructure
  separated from operational networks
- **Legal compliance**: Respect platform terms of service, privacy
  regulations (GDPR, CCPA), and collection authorities

### 8.5 Tsingou OSINT Mapping

OSINT is a primary (MUST support) discipline in Tsingou:

| OSINT Source | Tsingou Adapter | Signal Kind | Processing |
|-------------|-----------------|-------------|------------|
| RSS/Atom feeds | `RssSourceAdapter` | `rss` | NLP entity extraction, topic classification |
| REST APIs | `HttpSourceAdapter` (poll) | `http` | JSON parsing, schema validation |
| WebSocket streams | `WebSocketSourceAdapter` | `websocket` | Real-time event processing |
| SSE streams | `HttpSourceAdapter` (SSE) | `http` | Continuous event ingestion |
| File imports | `HolonetBridgeAdapter` (file watch) | `file-watch` | Batch document processing |
| NATS republish | `NatsSourceAdapter` | `nats` | Cross-system integration |

---

## 9. Legal and Ethical Frameworks

### 9.1 United States Legal Framework

| Authority | Scope | Key Provisions |
|----------|-------|----------------|
| **Executive Order 12333** (1981, amended 2008) | IC-wide | Authorizes foreign intelligence collection; restricts collection on US persons |
| **Foreign Intelligence Surveillance Act (FISA)** (1978, amended) | Domestic SIGINT | Requires FISC warrant for electronic surveillance of US persons in US |
| **FISA Section 702** (2008 FISA Amendments Act) | Upstream/PRISM | Authorizes targeting of non-US persons abroad; programmatic collection |
| **USA FREEDOM Act** (2015) | Bulk metadata | Ended NSA bulk phone metadata program; limits contact chaining to 2 hops |
| **Presidential Policy Directive 28 (PPD-28)** (2014) | Signals intelligence | Extends privacy protections to non-US persons in SIGINT collection |
| **USSID 18** | NSA operations | NSA procedures for collection, retention, and dissemination |
| **Attorney General Guidelines** | FBI SIGINT | Procedures for FBI foreign intelligence and counterintelligence |

**Key Principles:**

- **Minimization**: Procedures to minimize collection, retention, and
  dissemination of US person information incidentally collected
- **Targeting**: Collection must be directed at specific foreign
  intelligence targets or selectors
- **Necessity**: Collection must be necessary for foreign intelligence
  purposes
- **Proportionality**: Collection methods must be proportionate to the
  intelligence requirement

### 9.2 International Legal Framework

| Framework | Jurisdiction | Key Provisions |
|----------|-------------|----------------|
| **European Convention on Human Rights, Article 8** | Council of Europe | Right to respect for private life and correspondence |
| **General Data Protection Regulation (GDPR)** (2018) | European Union | Data protection, consent, purpose limitation, right to erasure |
| **Investigatory Powers Act 2016** (UK) | United Kingdom | Legal framework for GCHQ bulk interception warrants |
| **Wassenaar Arrangement** | 42 participating states | Export controls on dual-use surveillance technology |
| **Budapest Convention on Cybercrime** (2001) | Council of Europe + others | International cooperation on cybercrime investigation |
| **Tallinn Manual 2.0** (2017) | Advisory (NATO CCD COE) | Application of international law to cyber operations |
| **UN GGE Reports** (2013, 2015, 2021) | United Nations | Norms of responsible state behavior in cyberspace |

### 9.3 Classification Systems

**US Classification System**

| Level | Criteria | Handling |
|-------|----------|---------|
| TOP SECRET (TS) | Exceptionally grave damage to national security | Strict access controls, need-to-know |
| SECRET (S) | Serious damage to national security | Controlled access, security clearance required |
| CONFIDENTIAL (C) | Damage to national security | Standard security clearance |
| UNCLASSIFIED | No damage to national security | No special handling |

**Sensitive Compartmented Information (SCI)**

SCI controls add compartmented access beyond classification level:

| Compartment | Controls |
|------------|----------|
| SI (Special Intelligence) | SIGINT material |
| TK (TALENT KEYHOLE) | Satellite imagery and SIGINT |
| HCS (HUMINT Control System) | HUMINT sources and methods |
| GAMMA | Sensitive SIGINT sub-compartment |
| ORCON | Originator controlled dissemination |

**Traffic Light Protocol (TLP)**

TLP provides a standardized sharing framework widely used in the
cybersecurity/CTI community:

| TLP Level | Color | Sharing Scope | STIX Mapping |
|-----------|-------|---------------|-------------|
| TLP:RED | Red | Named recipients only | `marking-definition--5e57c739-391a-4eb3-b6be-7d15ca92d5ed` |
| TLP:AMBER | Amber | Organization + need-to-know | `marking-definition--f88d31f6-486f-44da-b317-01333bde0b82` |
| TLP:AMBER+STRICT | Amber | Organization only | `marking-definition--826578e1-40a3-4b26-bf4c-9ea95e106e15` |
| TLP:GREEN | Green | Community sharing | `marking-definition--34098fce-860f-48ae-8e50-ebd3cc5e41da` |
| TLP:CLEAR | White | Unrestricted | `marking-definition--613f2e26-407d-48c7-9eca-b8e91df99dc9` |

### 9.4 Tsingou Legal Compliance

Tsingou as a visualization and analysis platform must:

- MUST support TLP marking on all signals and derived products
- MUST map TLP markings to STIX `marking-definition` objects for export
- SHOULD support classification marking display in DOM layer
- SHOULD support data handling instructions per marking level
- MAY implement access control based on markings (future capability)

---

## 10. National SIGINT Organizations

### 10.1 Five Eyes Agencies

| Nation | Agency | Est. | Personnel (est.) | Focus Areas |
|--------|--------|------|-----------------|-------------|
| **USA** | NSA (National Security Agency) | 1952 | 30,000-40,000 | Global SIGINT, cryptology, cybersecurity (CNSA) |
| **USA** | CIA (Central Intelligence Agency) — SCS | — | Classified | HUMINT-enabled SIGINT (close access) |
| **USA** | NRO (National Reconnaissance Office) | 1961 | ~3,000 | SIGINT satellite systems |
| **USA** | DIA (Defense Intelligence Agency) | 1961 | ~16,500 | Military SIGINT analysis |
| **USA** | Service cryptologic elements | Various | Various | NSA/CSS components: Army INSCOM, Navy FCC, AF 16th AW, USMC |
| **UK** | GCHQ (Government Communications Headquarters) | 1919 | ~7,000 | European SIGINT, cable intercept, cybersecurity (NCSC) |
| **Canada** | CSE (Communications Security Establishment) | 1946 | ~2,500 | Northern approaches, Arctic, domestic assistance |
| **Australia** | ASD (Australian Signals Directorate) | 1947 | ~2,000 | Asia-Pacific, South Pacific, cyber ops (ACSC) |
| **New Zealand** | GCSB (Government Communications Security Bureau) | 1977 | ~400 | South Pacific, satellite intercept |

### 10.2 Major Non-Five Eyes SIGINT Agencies

| Nation | Agency | Notable Capabilities |
|--------|--------|---------------------|
| **France** | DGSE (Direction Générale de la Sécurité Extérieure) | Submarine cable intercept, SIGINT satellites (CERES) |
| **Germany** | BND (Bundesnachrichtendienst) | European SIGINT, cooperation with NSA (Bad Aibling) |
| **Israel** | Unit 8200 (IDF Intelligence) | Cyber/SIGINT operations, technology development |
| **Russia** | GRU (Main Intelligence Directorate) | Military SIGINT, cyber operations, HUMINT-enabled SIGINT |
| **Russia** | FSB (Federal Security Service) — TSSS | Domestic SIGINT (SORM lawful intercept system) |
| **Russia** | SVR (Foreign Intelligence Service) | Foreign SIGINT |
| **China** | PLA SSF (Strategic Support Force) | Cyber/SIGINT, space, EW — reorganized 2015 |
| **China** | MSS (Ministry of State Security) | Domestic/foreign cyber intelligence |
| **Japan** | DFS (Defense Intelligence Headquarters — SIGINT) | Regional SIGINT, cooperation with Five Eyes |
| **South Korea** | ADD (Agency for Defense Development) / NIS | North Korea-focused SIGINT |
| **India** | NTRO (National Technical Research Organisation) | SIGINT, cyber, MASINT — est. 2004 |
| **Netherlands** | AIVD/MIVD (Joint Sigint Cyber Unit — JSCU) | European SIGINT, advanced cyber capabilities |
| **Sweden** | FRA (Försvarets radioanstalt) | Cable intercept (pioneering legislation), Baltic SIGINT |
| **Norway** | E-tjenesten (Norwegian Intelligence Service) | Arctic/Russian monitoring, undersea cable proximity |
| **Denmark** | FE (Forsvarets Efterretningstjeneste) | Cable intercept (cooperation with NSA per 2021 revelations) |
| **Italy** | AISE (Agenzia Informazioni e Sicurezza Esterna) | Mediterranean SIGINT |
| **Turkey** | MİT (Millî İstihbarat Teşkilâtı) | Regional SIGINT, Kurdish monitoring |
| **Saudi Arabia** | GIP (General Intelligence Presidency) | Regional SIGINT (acquired Pegasus/similar tools) |
| **UAE** | NESA (National Electronic Security Authority) / Signals Intelligence Agency | Cyber/SIGINT, Project Raven |
| **Taiwan** | NSB (National Security Bureau) — SIGINT Division | Cross-strait monitoring, China-focused SIGINT |
| **Pakistan** | ISI (Inter-Services Intelligence) — SIGINT Wing | Regional SIGINT, India/Afghanistan focus |
| **Egypt** | NSSA (National Security Sector Agency) | Regional SIGINT, Mediterranean monitoring |
| **Iran** | IRGC Intelligence / MOIS | Cyber operations, regional SIGINT |
| **North Korea** | RGB (Reconnaissance General Bureau) — Bureau 121 | Cyber operations, limited SIGINT |

### 10.3 Multinational SIGINT Arrangements

Beyond Five Eyes, several multilateral SIGINT-sharing arrangements exist:

| Arrangement | Members | Focus |
|------------|---------|-------|
| **Nine Eyes** | Five Eyes + Denmark, France, Netherlands, Norway | Extended SIGINT sharing |
| **Fourteen Eyes** (SIGINT Seniors Europe — SSEUR) | Nine Eyes + Belgium, Germany, Italy, Spain, Sweden | European SIGINT coordination |
| **SIGINT Seniors Pacific (SSPAC)** | Five Eyes + France, India, Japan, Singapore, South Korea, Thailand | Indo-Pacific intelligence sharing |
| **NATO SIGINT** | NATO members | Military SIGINT for alliance operations |
| **Bilateral agreements** | Various pairs | US-Israel, US-Japan, US-Germany (specific programs) |

---

## Bibliography

| Key | Reference |
|-----|-----------|
| [USSID-18] | United States Signals Intelligence Directive 18 — Legal Compliance and U.S. Person Minimization Procedures |
| [EO-12333] | Executive Order 12333, United States Intelligence Activities, as amended (2008) |
| [FISA] | Foreign Intelligence Surveillance Act of 1978, as amended |
| [USA-FREEDOM] | Uniting and Strengthening America by Fulfilling Rights and Ensuring Effective Discipline Over Monitoring Act of 2015 |
| [PPD-28] | Presidential Policy Directive 28 — Signals Intelligence Activities (2014) |
| [ICD-203] | Intelligence Community Directive 203 — Analytic Standards (2015) |
| [JP-2-01] | Joint Publication 2-01, Joint and National Intelligence Support to Military Operations |
| [JP-2-0] | Joint Publication 2-0, Joint Intelligence |
| [JP-3-13.1] | Joint Publication 3-13.1, Electronic Warfare (cross-ref: TSG.36) |
| [ATP-2.1] | NATO Standardization Agreement — Intelligence Procedures |
| [NIDC-2022] | National Intelligence Discipline Categories, ODNI (2022 revision) |
| [ECHELON-EP] | European Parliament Report on ECHELON, Temporary Committee (2001) |
| [UKUSA-DECLASSIFIED] | UKUSA Agreement, declassified 2010, National Archives (UK/US) |
| [NSA-TRANSITION] | NSA Transition 2001, Director's Program Overview |
| [SNOWDEN-ARCHIVE] | Published documents from the Snowden archive (various outlets, 2013-2017) |
| [STIX-2.1] | STIX Version 2.1, OASIS Standard (2021) |
| [ATT&CK] | MITRE ATT&CK Framework, Enterprise Matrix v14 (2024) |
| [TLP-2.0] | Traffic Light Protocol 2.0, FIRST (Forum of Incident Response and Security Teams) |
| [NGA-GEOINT] | NGA Geospatial Intelligence Basic Doctrine (2018) |
| [CTBTO-IMS] | CTBTO International Monitoring System overview, ctbto.org |
| [GDPR] | Regulation (EU) 2016/679 — General Data Protection Regulation |
| [WASSENAAR] | Wassenaar Arrangement on Export Controls for Conventional Arms and Dual-Use Goods |
| [IPA-2016] | UK Investigatory Powers Act 2016 |
| [TALLINN-2.0] | Tallinn Manual 2.0 on International Law Applicable to Cyber Operations (2017) |
| [BUDAPEST] | Convention on Cybercrime, Council of Europe Treaty Series No. 185 (2001) |
| [RV-JONES] | R.V. Jones, "Most Secret War" — account of British scientific intelligence, WWII |
| [BAMFORD-NSA] | James Bamford, "Body of Secrets" (2001), "The Shadow Factory" (2008) — NSA histories |
| [AID-2019] | Andrew, Christopher, "The Secret World: A History of Intelligence" (2019) |

---

*This research document feeds RFC section TSG.2 (SIGINT/OSINT Domain Reference).*
*Cross-references: research-intelligence-cycle.md, research-ew-doctrine.md (TSG.36).*
*Cross-references: SPEC.md Section 4, ADR-009 (STIX interop), ADR-011 (SDR bridge).*
