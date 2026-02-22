# Research: Intelligence Cycle, Analytic Standards, and Platform Ecosystem

```
Topic:          Intelligence Cycle, Structured Analytic Techniques, Platform Ecosystem
Platform:       Tsingou (SIGINT/OSINT analysis and visualization)
Author:         Val (sigint-researcher)
Date:           2026-02-18
Status:         COMPLETE
Lines:          ~1,500
Sections:       5
Frameworks:     TPED/TCPED, ICD 203, ACH, I&W, ATT&CK, Diamond Model, Kill Chain
Purpose:        Raw research feeding RFC section TSG.3 (Intelligence Cycle)
Cross-refs:     research-sigint-disciplines.md, research-data-fusion.md, ADR-010, ADR-013
```

---

## 1. Intelligence Cycle — Six Phases

### 1.1 Overview

The intelligence cycle is the fundamental process model for intelligence
operations. While various organizations describe it differently (4, 5, or
6 phases), the canonical six-phase model used by the US Intelligence
Community and adopted by NATO (ATP-2.1) comprises:

```
    ┌──────────────┐
    │  1. DIRECTION │◀──────────────────────────────────┐
    │  (Planning &  │                                    │
    │  Requirements)│                                    │
    └──────┬───────┘                                    │
           │                                             │
           ▼                                             │
    ┌──────────────┐                              ┌──────────────┐
    │ 2. COLLECTION │                              │  6. FEEDBACK  │
    │ (Gathering    │                              │  (Evaluation  │
    │  raw data)   │                              │   & Learning) │
    └──────┬───────┘                              └──────▲───────┘
           │                                             │
           ▼                                             │
    ┌──────────────┐                              ┌──────────────┐
    │ 3. PROCESSING │                              │5. DISSEMINA- │
    │ (Exploitation │─────────────────────────────▶│   TION       │
    │  & Reduction)│                              │ (Distribution)│
    └──────┬───────┘                              └──────────────┘
           │                                             ▲
           ▼                                             │
    ┌──────────────┐                                     │
    │  4. ANALYSIS  │─────────────────────────────────────┘
    │  (Production &│
    │   Integration)│
    └──────────────┘
```

Tsingou MUST support all six phases per ADR-010. Each phase maps to
specific platform capabilities.

### 1.2 Phase 1: Direction (Planning and Requirements)

Direction is the phase where intelligence requirements are identified,
prioritized, and translated into collection tasks.

**Requirements Hierarchy:**

| Requirement Level | Abbreviation | Originator | Description |
|------------------|-------------|------------|-------------|
| Priority Intelligence Requirement | PIR | Commander/decision maker | Highest priority questions needing answers |
| Essential Elements of Information | EEI | Intelligence staff | Specific info needed to answer PIRs |
| Specific Intelligence Requirement | SIR | Collection managers | Translated EEIs as collection tasks |
| Intelligence Collection Plan (ICP) | ICP | Collection managers | Master plan assigning sources to requirements |
| Request for Information | RFI | Any consumer | Ad-hoc intelligence request |

**Requirements Management Process:**

1. **Identify requirements**: Derive PIRs from mission/policy objectives
2. **Prioritize**: Rank by criticality, time sensitivity, and consumer need
3. **Validate**: Confirm the requirement cannot be met by existing holdings
4. **Task**: Assign to specific collection disciplines and platforms
5. **Monitor**: Track collection progress, adjust tasking as needed
6. **Evaluate**: Assess whether collection satisfies the requirement

**Intelligence Preparation of the Battlespace (IPB)** / **Intelligence
Preparation of the Operational Environment (IPOE):**

A systematic process used in direction phase:
- Step 1: Define the operational environment
- Step 2: Describe environmental effects
- Step 3: Evaluate the threat/adversary
- Step 4: Determine threat/adversary courses of action

**Tsingou Direction Phase Mapping:**

| Activity | Tsingou Component | Implementation |
|----------|------------------|----------------|
| Define requirements | Session configuration | User defines signal sources, analysis parameters |
| Select sources | Adapter configuration | Hot-plug adapter selection via AdapterManager |
| Set priorities | Signal weighting | d2ts operator priority/weight parameters |
| Define alert thresholds | Window/anomaly config | Sliding window and z-score threshold parameters |
| Monitor progress | Dashboard | DOM layer status panels, health indicators |

### 1.3 Phase 2: Collection

Collection is the gathering of raw data from authorized sources in
response to requirements.

**TCPED Framework (Tasking, Collection, Processing, Exploitation, Dissemination):**

The DoD uses TCPED (sometimes TPED without the Collection distinction) as
the operational framework for the collection-to-dissemination pipeline:

| Stage | Activity | Responsibility |
|-------|----------|---------------|
| Tasking | Translate requirements into sensor/source tasks | Collection managers |
| Collection | Operate sensors and sources to gather data | Collection platforms |
| Processing | Convert raw data into usable format | Processing centers |
| Exploitation | Extract intelligence from processed data | Analysts |
| Dissemination | Deliver finished intelligence to consumers | Dissemination systems |

**Collection Management:**

| Principle | Description |
|----------|-------------|
| Redundancy | Multiple sources for critical requirements |
| Diversity | Different collection disciplines for cross-validation |
| Timeliness | Match collection tempo to consumer decision cycle |
| Economy | Allocate scarce collection assets efficiently |
| Synchronization | Coordinate multi-INT collection for fusion |

**Collection Platforms by Discipline:**

| Discipline | Platform Examples | Latency | Bandwidth |
|-----------|-----------------|---------|-----------|
| SIGINT (COMINT) | RC-135, ground stations, cable taps | Seconds-minutes | High (content) |
| SIGINT (ELINT) | RC-135, ES-3A, satellite | Seconds | Medium (PDW data) |
| CYBINT | Network sensors, honeypots, PCAP | Seconds | Very high |
| OSINT | Web crawlers, RSS, APIs, social media | Minutes-hours | Variable |
| GEOINT | Satellites, UAVs, aircraft | Minutes-days | Very high (imagery) |
| MASINT | Specialized sensors, monitoring stations | Seconds-hours | Variable |
| HUMINT | Human sources | Hours-days | Low (reports) |

**Tsingou Collection Phase Mapping:**

| Collection Activity | Tsingou Component | Implementation |
|--------------------|------------------|----------------|
| Sensor operation | Source adapters | 8 adapter types (RSS, HTTP, WS, NATS, serial, MIDI, OSC, file) |
| Hot-plug sources | AdapterManager | Runtime add/remove without restart |
| Health monitoring | Adapter status atoms | Heartbeat, error counts, throughput metrics |
| Collection scheduling | d2ts pipeline | Continuous ingestion (streaming) or scheduled polling |
| Multi-source sync | Signal versioning | BaseSignal.version [tick, source_seq] for ordering |

### 1.4 Phase 3: Processing (Exploitation and Reduction)

Processing converts raw collected data into a form suitable for analysis.

**Processing Activities:**

| Activity | Description | Tsingou Mapping |
|----------|-------------|-----------------|
| **Decryption** | Decrypt intercepted communications | External (not Tsingou scope) |
| **Translation** | Convert foreign language to analyst's language | External NLP service → NATS → adapter |
| **Normalization** | Convert to standard format | d2ts ingest graph: raw → BaseSignal |
| **Schema validation** | Verify data conforms to expected schema | Schema-validate operator in ingest graph |
| **Geolocation** | Determine geographic origin of signals | Geo-enrichment operator |
| **Deduplication** | Remove duplicate signals | d2ts deduplicate operator |
| **Metadata extraction** | Extract structured metadata from raw data | NLP/parsing operators in ingest graph |
| **Correlation tagging** | Tag signals with correlation identifiers | Cross-reference operator |
| **Quality assessment** | Evaluate data quality and confidence | QA scoring operator |

**Tsingou Processing Architecture:**

```
Raw Signal (from adapter)
    │
    ▼
┌───────────────────────────────┐
│  d2ts INGEST GRAPH            │
│                               │
│  normalize → validate →       │
│  dedup → geo-enrich →         │
│  tag → version → route        │
│                               │
│  Output: BaseSignal           │
│  (normalized, validated,      │
│   versioned, tagged)          │
└───────────────┬───────────────┘
                │
                ▼
        Signal Queue → Derived Graph
```

### 1.5 Phase 4: Analysis (Production and Integration)

Analysis is the transformation of processed data into finished intelligence
through evaluation, integration, interpretation, and synthesis.

**Analysis Types:**

| Type | Timeframe | Product | Consumer |
|------|----------|---------|----------|
| **Current Intelligence** | Hours-days | Daily briefs, alerts, summaries | Policymakers, commanders |
| **Estimative Intelligence** | Weeks-months | National Intelligence Estimates | Strategic leadership |
| **Warning Intelligence** | Real-time-days | Warnings, threat assessments | Decision makers, operators |
| **Research Intelligence** | Months-years | Studies, profiles, encyclopedic references | Analysts, planners |
| **Scientific & Technical (S&TI)** | Variable | Technical assessments, capability studies | Acquisition, R&D |

**All-Source vs. Single-Source Analysis:**

| Approach | Description | Strengths | Weaknesses |
|----------|-------------|-----------|------------|
| **All-source** | Integrates intelligence from all collection disciplines | Comprehensive, corroborated | Slow, classification barriers |
| **Single-source** | Analysis from one discipline (e.g., SIGINT-only) | Fast, specialized expertise | Narrow perspective, bias risk |
| **Multi-INT fusion** | Systematic fusion of 2+ disciplines | Best of both, structured | Complex, requires fusion methodology |

**Tsingou Analysis Phase Mapping (ADR-013):**

| Analysis Technique | d2ts Operator | Rendering Layer | STIX Output |
|-------------------|--------------|-----------------|-------------|
| Link Analysis | `join`, `count` | R3F (3D graph) | `relationship` SROs |
| Timeline Analysis | `window`, aggregate | visx (timeline) | `observed-data` SDOs |
| Geospatial Analysis | `join` (geo-key) | R3F (map) | `location` SDOs |
| Anomaly Detection | `iterate`, statistical | visx (chart) | `indicator` SDOs |
| Pattern-of-Life | `window`, `join`, aggregate | visx + DOM | `observed-data` bundles |
| Kill Chain / ATT&CK | `map` (ATT&CK tag) | DOM (matrix) | `attack-pattern` SDOs |
| Spectrum Analysis | FFT, waterfall | p5 (canvas) | Custom extensions |
| Signal Flow | `topK`, routing | R3F (topology) | `infrastructure` SDOs |

### 1.6 Phase 5: Dissemination

Dissemination is the delivery of finished intelligence to authorized
consumers in a timely and appropriate manner.

**Product Types:**

| Product | Frequency | Classification | Description |
|---------|----------|---------------|-------------|
| Intelligence report (INTREP) | Event-driven | Varies | Single-event reporting |
| Intelligence summary (INTSUM) | Periodic | Varies | Summary of activity period |
| Intelligence estimate | As needed | Usually TS/SCI | Estimative assessment |
| Warning report | Immediate | Often TS/SCI | Time-sensitive threat |
| Target intelligence package | As needed | Varies | Targeting support |
| Counterintelligence report | Event-driven | TS/SCI | CI findings |

**Dissemination Channels:**

| Channel | Push/Pull | Latency | Description |
|---------|----------|---------|-------------|
| **JWICS** | Both | Seconds | TS/SCI network |
| **SIPRNet** | Both | Seconds | SECRET network |
| **NIPRNet** | Both | Seconds | UNCLASSIFIED network |
| **Intelink** | Pull | Minutes | IC web-based portal |
| **TAXII** | Push | Seconds-minutes | CTI sharing protocol |
| **Email** | Push | Minutes | Standard reports |
| **Broadcast** | Push | Real-time | Multi-consumer simultaneous |

**Tsingou Dissemination Mapping:**

| Dissemination Activity | Tsingou Component | Implementation |
|-----------------------|------------------|----------------|
| STIX bundle export | Output bridge + STIX codec | `toStixBundle()` per ADR-009 |
| TAXII transport | NATS → TAXII bridge | TAXII 2.1 collection/channel mapping |
| CTI platform integration | API adapters | Push to Palantir/OpenCTI/MISP |
| Real-time display | 4-layer rendering | Live visualization for analysts |
| Alert notification | DOM layer + external | Anomaly-triggered alerts |
| Report generation | Export service | Structured report from analysis state |

### 1.7 Phase 6: Feedback (Evaluation and Learning)

Feedback closes the intelligence cycle loop by evaluating the quality,
relevance, and timeliness of intelligence products and adjusting the
process accordingly.

**Feedback Dimensions:**

| Dimension | Metric | How Measured |
|----------|--------|-------------|
| **Consumer satisfaction** | Product usefulness rating | Consumer surveys, RFI follow-ups |
| **Collection effectiveness** | Requirement satisfaction rate | % of requirements answered per collection period |
| **Timeliness** | Time from requirement to product | Clock measurement across phases |
| **Accuracy** | Product accuracy over time | Post-event validation, ground truth comparison |
| **Source quality** | Source reliability trends | Admiralty rating updates |
| **False positive rate** | Alert-to-true-positive ratio | Analyst validation of automated alerts |

**Tsingou Feedback Mapping:**

| Feedback Activity | Tsingou Component | Implementation |
|------------------|------------------|----------------|
| False positive feedback | Analyst annotation | DOM layer annotation → feedback to derived graph |
| Source quality scoring | Adapter health metrics | Throughput, error rate, latency, freshness |
| Alert tuning | Threshold adjustment | Modify window/anomaly parameters based on FP rate |
| Graph refinement | d2ts topology update | Add/remove operators, adjust join keys |
| Collection gap identification | Coverage dashboard | Visual representation of requirement vs. collection coverage |

---

## 2. ICD 203 Analytic Standards

### 2.1 Overview

Intelligence Community Directive 203 (ICD 203), "Analytic Standards,"
establishes the nine standards that all IC analytic products must meet.
Published by the ODNI, these standards apply to all member agencies.

### 2.2 The Nine Analytic Tradecraft Standards

| # | Standard | Description | Tsingou Relevance |
|---|---------|-------------|-------------------|
| 1 | **Objectivity** | Analysis must be based on all available sources, unbiased | Multi-source ingestion, no source preference bias |
| 2 | **Political Independence** | Analysis must not be influenced by political considerations | N/A (tool-level, not policy-level) |
| 3 | **Timeliness** | Products must be delivered within consumer decision timelines | Real-time pipeline, sub-second visualization |
| 4 | **Sourcing** | All assertions must cite sources; source reliability assessed | Citation tracking in signal metadata |
| 5 | **Uncertainty** | Express uncertainty using standardized probability language | Confidence scoring in derived signals |
| 6 | **Distinguishing** | Clearly distinguish between evidence and assumption | Annotation layer in DOM rendering |
| 7 | **Analysis of Alternatives (AoA)** | Consider alternative hypotheses explicitly | ACH integration (see Section 3) |
| 8 | **Customer Relevance** | Products must address stated intelligence requirements | Session configuration ties to PIR/EEI |
| 9 | **Logical Argumentation** | Reasoning must be explicit, logically sound | Audit trail in signal lineage |

### 2.3 Probability Language (ICD 203 Standard 5)

ICD 203 mandates a seven-level probability language for expressing
analytic confidence:

| Term | Probability Range | Numeric Encoding |
|------|------------------|-----------------|
| Almost no chance | 01-05% | 0.01-0.05 |
| Very unlikely | 05-20% | 0.05-0.20 |
| Unlikely | 20-45% | 0.20-0.45 |
| Roughly even chance | 45-55% | 0.45-0.55 |
| Likely | 55-80% | 0.55-0.80 |
| Very likely | 80-95% | 0.80-0.95 |
| Almost certain(ly) | 95-99% | 0.95-0.99 |

**Confidence Levels:**

| Level | Meaning | Factors |
|-------|---------|---------|
| **Low** | Based on questionable or thin information | Few sources, low reliability, significant gaps |
| **Moderate** | Based on credible information, some gaps | Multiple sources of moderate reliability, some gaps |
| **High** | Based on strong information, minimal gaps | Multiple reliable, corroborating sources |

**Tsingou Implementation:**

Derived signals SHOULD carry a confidence annotation:

```typescript
// Conceptual confidence annotation schema
const ConfidenceAnnotation = Schema.Struct({
  probability: Schema.Number.pipe(Schema.between(0.01, 0.99)),
  confidence_level: Schema.Literal('low', 'moderate', 'high'),
  source_count: Schema.Number.pipe(Schema.positive()),
  assessment_basis: Schema.String,  // "3 corroborating RSS + 1 API source"
})
```

### 2.4 Source Reliability and Information Accuracy

The Admiralty/NATO system (6x6 matrix) provides source evaluation:

| | A: Completely Reliable | B: Usually Reliable | C: Fairly Reliable | D: Not Usually Reliable | E: Unreliable | F: Cannot Judge |
|---|---|---|---|---|---|---|
| **1: Confirmed** | A1 | B1 | C1 | D1 | E1 | F1 |
| **2: Probably True** | A2 | B2 | C2 | D2 | E2 | F2 |
| **3: Possibly True** | A3 | B3 | C3 | D3 | E3 | F3 |
| **4: Doubtfully True** | A4 | B4 | C4 | D4 | E4 | F4 |
| **5: Improbable** | A5 | B5 | C5 | D5 | E5 | F5 |
| **6: Cannot Judge** | A6 | B6 | C6 | D6 | E6 | F6 |

Each source adapter in Tsingou SHOULD assign a default reliability rating
(e.g., established RSS feeds might default to B2; unknown WebSocket
sources to F3).

---

## 3. Structured Analytic Techniques (SATs)

### 3.1 Analysis of Competing Hypotheses (ACH)

ACH is the most widely taught and practiced SAT. Developed by Richards
Heuer (CIA, 1999), it provides a systematic process for evaluating
multiple competing hypotheses against available evidence.

**The 8-Step ACH Process:**

| Step | Action | Description |
|------|--------|-------------|
| 1 | Identify hypotheses | List all plausible explanations |
| 2 | List evidence/arguments | Gather all relevant evidence and arguments |
| 3 | Build diagnostic matrix | Rate evidence against each hypothesis (C/I/NA) |
| 4 | Refine the matrix | Add evidence, refine ratings |
| 5 | Draw tentative conclusions | Identify most consistent hypothesis |
| 6 | Analyze sensitivity | How much does conclusion depend on key evidence? |
| 7 | Report conclusions | Document findings with confidence level |
| 8 | Identify milestones | What future evidence would change the conclusion? |

**Diagnosticity Matrix:**

The core ACH tool is a matrix rating each piece of evidence as:
- **C** (Consistent): Evidence supports this hypothesis
- **I** (Inconsistent): Evidence contradicts this hypothesis
- **NA** (Not Applicable): Evidence is irrelevant to this hypothesis

```
                    H1       H2       H3       H4
Evidence 1          C        I        NA       C
Evidence 2          I        C        C        I
Evidence 3          C        C        I        C
Evidence 4          NA       I        C        NA
Evidence 5          C        I        I        C
─────────────────────────────────────────────────
Inconsistencies     1        3        2        1
```

The hypothesis with the fewest inconsistencies is the most supported.
Crucially, ACH focuses on **disconfirmation** (counting inconsistencies)
rather than confirmation (counting consistencies) to combat confirmation
bias.

**Tsingou ACH Integration:**

- DOM layer: Interactive matrix visualization
- d2ts operators: Automated evidence-hypothesis consistency scoring
- Cross-source correlation as evidence generation
- Confidence scoring per ICD 203 probability language

### 3.2 Key Assumptions Check (KAC)

KAC explicitly identifies and evaluates the assumptions underlying an
analytic judgment:

| Step | Action |
|------|--------|
| 1 | List all assumptions in the current assessment |
| 2 | Challenge each: Is this supported by evidence or assumed? |
| 3 | Categorize: Key (would change conclusion if wrong) vs. supporting |
| 4 | Evaluate: How confident are you in each key assumption? |
| 5 | Identify: What would signal that an assumption is wrong? |

### 3.3 Devil's Advocacy

A team or individual deliberately argues against the prevailing hypothesis
to test its robustness:

- Assign a "devil's advocate" role to challenge consensus
- Must construct strongest possible case against the leading hypothesis
- Tests logical rigor and evidence completeness
- Particularly valuable when high-confidence assessments face groupthink risk

### 3.4 Red Team Analysis

Red teaming adopts the adversary's perspective:

- Reconstruct adversary decision-making process
- Identify adversary perception of our actions
- Predict adversary response to our courses of action
- Commonly used in cyber threat analysis (Red Team / Blue Team exercises)

### 3.5 Indicators and Warnings (I&W)

I&W is the structured monitoring of predefined indicators that signal
an impending event or change in threat level.

**Indicator Development:**

| Step | Action | Example |
|------|--------|---------|
| 1 | Define the threat scenario | "State-sponsored cyber attack on critical infrastructure" |
| 2 | Identify observable precursors | Reconnaissance activity, vulnerability scanning, spear-phishing |
| 3 | Assign indicators | Specific, measurable observables tied to precursors |
| 4 | Set thresholds | At what level does an indicator become actionable? |
| 5 | Define warning levels | WATCHCON system: Normal → Increased → Elevated → Imminent |

**Warning Conditions (WATCHCON):**

| Level | Condition | Action |
|-------|----------|--------|
| WATCHCON 5 | Normal | Routine monitoring |
| WATCHCON 4 | Increased interest | Enhanced collection on specific indicators |
| WATCHCON 3 | Heightened concern | Increased analysis, consumer notification |
| WATCHCON 2 | Possible imminent threat | Warning message, force protection measures |
| WATCHCON 1 | Imminent or ongoing | Full alert, crisis response |

**Tsingou I&W Integration:**

- d2ts window operators monitor indicator streams over time
- Anomaly detection operators flag threshold crossings
- DOM layer displays WATCHCON dashboard
- Alert generation triggers dissemination workflows
- Historical baseline comparison via NATS JetStream replay

---

## 4. Analysis Techniques

### 4.1 Link Analysis / Social Network Analysis (SNA)

Link analysis maps relationships between entities (people, organizations,
devices, accounts) to reveal network structure, key actors, and
communication patterns.

**Centrality Metrics:**

| Metric | Formula (simplified) | What It Measures | Intelligence Use |
|--------|---------------------|-----------------|------------------|
| **Degree centrality** | C_D(v) = deg(v) / (n-1) | Number of direct connections | Who communicates most broadly |
| **Betweenness centrality** | C_B(v) = Σ(σ_st(v) / σ_st) | How often node is on shortest paths | Who controls information flow (broker) |
| **Closeness centrality** | C_C(v) = (n-1) / Σ d(v,u) | Average distance to all other nodes | Who can reach everyone fastest |
| **Eigenvector centrality** | C_E(v) = (1/λ) Σ A_vu · C_E(u) | Connection to well-connected nodes | Who is connected to important people |
| **PageRank** | PR(v) = (1-d)/n + d · Σ PR(u)/deg(u) | Influence accounting for link quality | Overall influence/authority |
| **k-core** | Maximal subgraph with min degree k | Dense subgroup membership | Identifying tightly-knit cells |

**Community Detection Algorithms:**

| Algorithm | Method | Complexity | Best For |
|-----------|--------|-----------|----------|
| **Louvain** | Modularity optimization (greedy) | O(n log n) | Large networks, hierarchical communities |
| **Girvan-Newman** | Edge betweenness removal | O(m²n) | Small-medium networks, dendrogram |
| **Label Propagation** | Iterative label spreading | O(m) | Very large networks, fast detection |
| **Infomap** | Random walk compression | O(m) | Directed networks, information flow |
| **Spectral** | Eigenvectors of Laplacian | O(n³) | Balanced communities |

**Tsingou Link Analysis Mapping:**

- R3F layer: 3D force-directed graph with centrality-based sizing
- d2ts `join` operator: Build edges from co-occurrence in signals
- d2ts `count`/aggregate: Compute degree centrality
- STIX export: `relationship` SROs encode discovered links

### 4.2 Timeline / Temporal Analysis

Temporal analysis arranges events chronologically to identify patterns,
sequences, and causal relationships:

| Technique | Description | Use Case |
|-----------|-------------|----------|
| Chronological timeline | Events ordered by time | Activity reconstruction |
| Event matrix | Time × entity activity grid | Multi-actor coordination detection |
| Temporal clustering | Group events by time proximity | Attack campaign delineation |
| Periodicity detection | Identify recurring patterns | Scheduled activity (C2 beacons, etc.) |
| Gap analysis | Identify temporal gaps | Missing intelligence, EMCON periods |
| Duration analysis | Measure event durations | Session profiling, dwell time analysis |

**Tsingou temporal analysis:**
- visx layer: D3-based timeline visualization
- d2ts `window` operator: Sliding/tumbling time windows
- Anomaly operators: Temporal deviation detection

### 4.3 Anomaly Detection

Statistical anomaly detection identifies signals that deviate from
established baselines:

| Method | Category | Description | Tsingou Operator |
|--------|----------|-------------|-----------------|
| **Z-score** | Statistical | Standard deviations from mean | `iterate` + rolling stats |
| **Modified Z-score (MAD)** | Robust statistical | Median absolute deviation based | `iterate` + robust stats |
| **EWMA** | Time-series | Exponentially weighted moving average | `iterate` + decay |
| **Grubbs' test** | Statistical | Identifies single outlier in dataset | Batch operator |
| **DBSCAN** | Clustering | Density-based spatial clustering | Multi-dim operator |
| **Isolation Forest** | Tree-based | Random forest anomaly scoring | ML operator (external) |
| **CUSUM** | Sequential | Cumulative sum of deviations from target | `iterate` + accumulator |
| **Bayesian change-point** | Bayesian | Detect distribution changes | `iterate` + posterior update |

### 4.4 Pattern-of-Life (POL) Analysis

POL analysis establishes baseline behavioral patterns for entities and
detects deviations:

| Dimension | Observable | Baseline Metric | Deviation Indicator |
|-----------|-----------|----------------|-------------------|
| **Temporal** | Activity times, frequency | Hourly/daily/weekly distributions | Activity outside normal hours |
| **Spatial** | Locations, routes, areas | Frequent locations, travel patterns | New locations, route changes |
| **Social** | Contacts, communication partners | Regular contact network | New contacts, dropped contacts |
| **Behavioral** | Actions, methods, tools | Typical behavior repertoire | New behaviors, escalation patterns |
| **Cyber** | Login times, IP addresses, user agents | Normal network behavior | Anomalous access patterns |

**POL in Tsingou:**
- d2ts `window` + `join`: Build temporal/spatial baselines
- Anomaly operators: Detect deviations from established POL
- visx layer: POL visualization (heatmaps, timelines)
- NATS JetStream: Historical data for baseline construction

### 4.5 Kill Chain / ATT&CK Frameworks

**Lockheed Martin Cyber Kill Chain (7 phases):**

| Phase | Activity | Detection Point |
|-------|----------|-----------------|
| 1. Reconnaissance | Target research, scanning | OSINT monitoring, network telemetry |
| 2. Weaponization | Payload creation, exploit preparation | (Rarely observable externally) |
| 3. Delivery | Phishing, watering hole, USB | Email security, web proxy, endpoint |
| 4. Exploitation | Vulnerability exploitation | Endpoint detection, IDS/IPS |
| 5. Installation | Persistence establishment | Endpoint monitoring, file integrity |
| 6. Command & Control | C2 channel establishment | Network monitoring, DNS analysis |
| 7. Actions on Objective | Data exfiltration, disruption | DLP, SIEM, behavioral analytics |

**Unified Kill Chain (18 phases):**

Extends the Lockheed Martin model with pre-attack (Initial Foothold),
lateral movement (Network Propagation), and objective (Action on
Objectives) phases — 18 total phases with more granular mapping to
ATT&CK techniques.

**Diamond Model of Intrusion Analysis:**

| Vertex | Description | Intelligence Focus |
|--------|-------------|-------------------|
| **Adversary** | Threat actor or group | Attribution, capability assessment |
| **Capability** | Tools, techniques, malware | TTP cataloging, detection signatures |
| **Infrastructure** | Domains, IPs, C2 servers | IOC development, takedown targeting |
| **Victim** | Target organization or individual | Vulnerability assessment, defense planning |

The four vertices form a diamond, with relationships between them:
- Adversary uses Capability against Victim via Infrastructure
- Each event (intrusion attempt) is a "diamond event"
- Meta-features: timestamp, phase, result, direction, methodology

**Tsingou Kill Chain/ATT&CK Mapping:**

- DOM layer: ATT&CK matrix visualization with heat-mapping
- d2ts `map` operator: Tag signals with ATT&CK technique IDs
- STIX export: `attack-pattern` SDOs linked via `uses` relationships
- Cross-source correlation: Match indicators across kill chain phases

---

## 5. Platform Ecosystem

### 5.1 Intelligence Analysis Platforms

**Palantir Gotham / Foundry**

| Attribute | Gotham | Foundry |
|----------|--------|---------|
| Focus | Intelligence analysis, counterterrorism | Enterprise data integration |
| Users | IC agencies, DoD, law enforcement | Commercial, government civilian |
| Core capability | Link analysis, temporal analysis, geospatial | Data pipeline, ontology management |
| Data model | Object-centric, typed relationships | Ontology-defined, configurable |
| Visualization | Graph, map, timeline, table | Dashboard, pipeline, graph |
| Integration | JWICS, SIPRNet, NIPRNet | Cloud, on-premise, hybrid |
| Pricing | Government contract, per-seat licensing | Platform licensing |
| Strengths | Deep IC integration, workflow support | Flexible data model, self-service |
| Weaknesses | Expensive, vendor lock-in | Steep learning curve, cost |

**i2 Analyst's Notebook (IBM)**

| Attribute | Details |
|----------|---------|
| Focus | Law enforcement, military intelligence link analysis |
| Core capability | Visual link analysis charts, timeline analysis |
| Data model | Entity-relationship with typed links |
| Integration | i2 iBase database, external data sources |
| Strengths | De facto law enforcement standard, powerful chart visualization |
| Weaknesses | Legacy architecture, expensive, limited real-time |

### 5.2 Cyber Threat Intelligence (CTI) Platforms

**OpenCTI**

| Attribute | Details |
|----------|---------|
| Type | Open source CTI platform |
| Data model | STIX 2.1 native |
| Backend | ElasticSearch + Redis + MinIO + RabbitMQ |
| Connectors | 80+ for feeds, enrichment, export |
| Visualization | Knowledge graph, timeline, indicators, reports |
| API | GraphQL |
| License | Apache 2.0 (Community) / EE license |
| Strengths | STIX-native, extensible, strong community |
| Weaknesses | Resource-intensive deployment, learning curve |

**MISP (Malware Information Sharing Platform)**

| Attribute | Details |
|----------|---------|
| Type | Open source threat intel sharing |
| Data model | MISP format (partially STIX-compatible) |
| Backend | MariaDB/MySQL + Python/PHP |
| Sharing | MISP sync, STIX/TAXII, CSV, OpenIOC, YARA |
| Galaxies | 60+ clustering frameworks (ATT&CK, threat actors, etc.) |
| License | AGPL 3.0 |
| Strengths | Large community, excellent sharing model, lightweight |
| Weaknesses | UI dated, limited analysis capabilities |

**TheHive + Cortex**

| Attribute | TheHive | Cortex |
|----------|---------|--------|
| Type | Security incident response platform | Observable analysis engine |
| Focus | Case management, alert triage | Automated enrichment, analysis |
| Integration | MISP, Cortex, webhooks | 100+ analyzers, responders |
| License | AGPL 3.0 | AGPL 3.0 |
| Strengths | Collaborative investigation, case workflow | Automated enrichment pipeline |
| Weaknesses | Limited analysis beyond case management | Dependency management complex |

### 5.3 OSINT Collection Tools

**Maltego**

| Attribute | Details |
|----------|---------|
| Type | OSINT link analysis and visualization |
| Core capability | Entity transforms (automated enrichment), graph visualization |
| Transforms | 100+ built-in, marketplace, custom |
| Editions | Community (free, limited), Pro, Enterprise |
| Strengths | Powerful automated OSINT, visual graph output |
| Weaknesses | Rate limits (community), expensive (pro), Java-based |

**SpiderFoot**

| Attribute | Details |
|----------|---------|
| Type | Open source OSINT automation |
| Core capability | 200+ modules for automated reconnaissance |
| Deployment | Local, SpiderFoot HX (cloud) |
| License | MIT (open source) |
| Strengths | Comprehensive automation, open source |
| Weaknesses | Results quality varies by module, limited analysis |

**IntelOwl**

| Attribute | Details |
|----------|---------|
| Type | Open source threat intelligence aggregation |
| Core capability | 100+ analyzers, IOC enrichment |
| API | REST API, connectors for MISP, TheHive |
| License | AGPL 3.0 |
| Strengths | Modern architecture (Django/Celery), extensive analyzers |
| Weaknesses | Focused on IOC enrichment, limited visualization |

### 5.4 SDR and RF Analysis Tools

**GNU Radio**

| Attribute | Details |
|----------|---------|
| Type | Open source SDR framework |
| Architecture | Flowgraph-based signal processing (C++/Python) |
| Blocks | 300+ signal processing blocks |
| Hardware | Universal: RTL-SDR, HackRF, USRP, LimeSDR, Ettus |
| Integration | gr-osmosdr, SoapySDR hardware abstraction |
| Tsingou path | GNU Radio → ZMQ/NATS → NatsSourceAdapter |

**Gqrx / SDR++ / SDRangel**

| Tool | Type | Strengths |
|------|------|-----------|
| Gqrx | Desktop SDR receiver | Simple, GNU Radio-based |
| SDR++ | Modern SDR receiver | Fast, cross-platform, plugin architecture |
| SDRangel | SDR platform | TX/RX, channel analyzers, remote operation |

### 5.5 Platform Comparison Matrix

| Capability | Palantir | OpenCTI | MISP | TheHive | Maltego | Tsingou |
|-----------|---------|---------|------|---------|---------|---------|
| **Link analysis** | Excellent | Good | Basic | Basic | Excellent | Good (R3F) |
| **Timeline** | Excellent | Good | Basic | Good | None | Good (visx) |
| **Geospatial** | Excellent | Basic | Basic | None | Basic | Good (R3F) |
| **STIX native** | Partial | Full | Partial | Partial | None | Export (ADR-009) |
| **Real-time** | Good | Good | Limited | Good | Limited | Excellent (d2ts) |
| **SDR/RF** | None | None | None | None | None | Yes (GNU Radio bridge) |
| **Customizable viz** | Good | Limited | Limited | Limited | Good | Excellent (4-layer) |
| **Open source** | No | Yes | Yes | Yes | Partial | Yes |
| **Multi-source ingest** | Excellent | Good | Good | Limited | Good | Excellent (8 adapters) |
| **Streaming** | Good | Limited | None | Webhook | None | Excellent (d2ts) |
| **Anomaly detection** | Good | None | None | None | None | Good (d2ts operators) |
| **Data fusion** | Excellent | Good | Limited | None | Limited | Good (d2ts join) |
| **Cost** | Very High | Free/EE | Free | Free | Med-High | Free |
| **Deployment** | Gov/Cloud | Docker | Docker | Docker | Desktop | Tauri desktop |

### 5.6 Tsingou Platform Positioning

Based on the ecosystem analysis, Tsingou's differentiated capabilities:

1. **SDR/RF integration**: No other CTI platform offers native SDR support.
   Tsingou bridges GNU Radio output to intelligence visualization.

2. **Real-time streaming**: d2ts differential dataflow enables sub-second
   incremental computation. Most CTI platforms are batch-oriented.

3. **4-layer rendering**: Composited visualization (WebGL + SVG + Canvas +
   DOM) provides richer visual analysis than any single-layer platform.

4. **Multi-source hot-plug**: Runtime adapter management without restart.
   Most platforms require configuration changes and service restart.

5. **Desktop-first**: Tauri provides native performance without cloud
   dependency. Critical for classified/air-gapped environments.

6. **Effect-TS foundation**: Typed errors, structured concurrency, and
   service composition provide architectural rigor absent in most OSINT/CTI
   tools.

**What Tsingou defers to other platforms:**

| Capability | Deferred To | Reason |
|-----------|------------|--------|
| Knowledge graph (large-scale) | Palantir Gotham/Foundry | Scale, maturity, IC integration |
| Indicator sharing/distribution | MISP, OpenCTI | Community, established sharing networks |
| Incident response workflow | TheHive, Cortex | Case management not in scope |
| Automated enrichment | Cortex, IntelOwl | Analyzer ecosystem too large to replicate |
| Enterprise search | Elastic/OpenSearch | Full-text search at scale |

Cross-reference: Platform interoperability in TSG.15.
Cross-reference: ADR-012 (visualization-focused platform).

---

## Bibliography

| Key | Reference |
|-----|-----------|
| [JP-2-0] | Joint Publication 2-0, Joint Intelligence (2013, revised 2022) |
| [JP-2-01] | Joint Publication 2-01, Joint and National Intelligence Support to Military Operations |
| [ATP-2.1] | NATO Allied Tactical Publication 2.1 — Intelligence Procedures |
| [ICD-203] | Intelligence Community Directive 203 — Analytic Standards (2015) |
| [HEUER-1999] | Heuer, Richards J. "Psychology of Intelligence Analysis" (CIA, 1999) |
| [HEUER-PHERSON-2010] | Heuer & Pherson, "Structured Analytic Techniques for Intelligence Analysis" (2010, 3rd ed. 2020) |
| [TPED] | DoD TCPED Framework — JP 2-01.3 (Signals Intelligence Support) |
| [KILL-CHAIN] | Hutchins, Cloppert, Amin. "Intelligence-Driven Computer Network Defense" (Lockheed Martin, 2011) |
| [DIAMOND] | Caltagirone, Pendergast, Betz. "The Diamond Model of Intrusion Analysis" (2013) |
| [UKC] | Pols, Paul. "The Unified Kill Chain" (2017) |
| [ATT&CK] | MITRE ATT&CK Framework, Enterprise Matrix v14 (2024) |
| [ODNI-OSINT] | ODNI IC OSINT Strategy 2024-2026 |
| [ADR-010] | Tsingou ADR-010: Full Intelligence Cycle Coverage |
| [ADR-012] | Tsingou ADR-012: Visualization-Focused Platform |
| [ADR-013] | Tsingou ADR-013: Analysis Techniques Catalog |
| [ADR-009] | Tsingou ADR-009: STIX Interop Layer |
| [PALANTIR-GOTHAM] | Palantir Technologies — Gotham Platform Overview (public documentation) |
| [OPENCTI] | OpenCTI Platform Documentation, Filigran (2024) |
| [MISP-PROJECT] | MISP Project Documentation, CIRCL (2024) |
| [THEHIVE] | TheHive Project Documentation (2024) |
| [MALTEGO] | Maltego Technologies — Product Documentation |
| [GNU-RADIO] | GNU Radio Project Documentation, gnuradio.org |
| [ADMIRALTY] | NATO Standardization Agreement — Source/Information Evaluation System |
| [WATCHCON] | DoD Joint Warning Conditions system (JP 3-0 Appendix) |

---

*This research document feeds RFC section TSG.3 (Intelligence Cycle).*
*Cross-references: research-sigint-disciplines.md, research-data-fusion.md.*
*Cross-references: ADR-010 (intelligence cycle), ADR-013 (analysis techniques).*
*Cross-references: ADR-009 (STIX interop), ADR-012 (visualization platform).*
