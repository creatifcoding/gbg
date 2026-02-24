# Appendix D — Bibliography

```
Section:       Appendix D — Bibliography
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          Appendices (Informative)
```

> This appendix consolidates all academic references, standards, and technical
> specifications cited across the AVA-RFC-001 sections. Entries are grouped by
> category and numbered for cross-reference.

---

## Table of Contents

1. [Standards and RFCs](#d1-standards-and-rfcs)
2. [Academic Papers — Data Fusion & Differential Dataflow](#d2-academic-papers--data-fusion--differential-dataflow)
3. [Academic Papers — Evidence Theory & Confidence](#d3-academic-papers--evidence-theory--confidence)
4. [Academic Papers — Track Management & Detection](#d4-academic-papers--track-management--detection)
5. [Academic Papers — Multi-Level Fusion](#d5-academic-papers--multi-level-fusion)
6. [Software Libraries & Repositories](#d6-software-libraries--repositories)
7. [Data Standards & Specifications](#d7-data-standards--specifications)
8. [NATS Documentation](#d8-nats-documentation)

---

## D.1 Standards and RFCs

| # | Citation | Reference |
|---|----------|-----------|
| [1] | Bradner, S. (1997). "Key words for use in RFCs to Indicate Requirement Levels." BCP 14, RFC 2119, March 1997. | Normative language specification used throughout AVA-RFC-001. |
| [2] | Leiba, B. (2017). "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words." BCP 14, RFC 8174, May 2017. | Clarification of RFC 2119 key word interpretation. |
| [3] | ISA/IEC 62682. "Management of Alarm Systems for the Process Industries." | Referenced in alarm management architecture ([AVA.12](rfc-section-alarm-management.md)). |

Source: Referenced in [AVA.3.11](rfc-section-nats-subject-taxonomy.md#ava311-references).

---

## D.2 Academic Papers — Data Fusion & Differential Dataflow

| # | Citation | Relevance |
|---|----------|-----------|
| [4] | McSherry, F. (2013). "Differential Dataflow." *CIDR*. | Foundational paper for the `(data, time, diff)` tuple representation and incremental computation model. The ava-fusion dataflow engine is built on this model. All relational operators (join, reduce, iterate) are automatically incremental via differentiation/integration. Source: `docs/research/differential-dataflow-fusion-integration.md` Section 2.1. |
| [5] | Ngo, H.Q., Porat, E., Re, C., & Rudra, A. (2014). "Worst-Case Optimal Join Algorithms." *Proceedings of the 33rd ACM SIGMOD-SIGACT-SIGART Symposium on Principles of Database Systems (PODS)*. | Proved that traditional binary joins are suboptimal for cyclic queries. The LeapFrog TrieJoin achieves O~(\|D\| + \|Q(D)\|) complexity. Applied in Tier 2/3 multi-source fusion via `Plan::multiway_join` with delta queries per relation. Source: `docs/research/differential-dataflow-fusion-integration.md` Section 2.2. |
| [6] | Ngo, H.Q. (2018). "Worst-Case Optimal Join Algorithms: Techniques, Results, and Open Problems." *SIGMOD Record* 47(3). | Survey of WCOJ landscape post-2014. Confirms leapfrog trie join as the practical champion. Covers extensions to inequality joins. Source: `docs/research/differential-dataflow-fusion-integration.md` Section 2.2. |

---

## D.3 Academic Papers — Evidence Theory & Confidence

| # | Citation | Relevance |
|---|----------|-----------|
| [7] | Khan, N. & Anwar, S. (2019). "Modified Dempster-Shafer with entropy-based paradox elimination." *Sensors*. | Addresses Zadeh's paradox in standard Dempster-Shafer combination. Proposes entropy-based weighting: `w_i = 1 / (1 + H(m_i))` to discount conflicting evidence. Maps to a `map` operator before the `reduce` in the dataflow graph. Referenced in confidence scoring for the `DempsterShafer` model variant (`ava-fusion/src/confidence.rs`). Source: `docs/research/differential-dataflow-fusion-integration.md` Section 2.3. |
| [8] | Xiao, F. & Qin, Z. (2018). "Weighted Dempster-Shafer combination using cosine similarity of BPAs." *Sensors*. | Uses cosine similarity between Basic Probability Assignments (BPAs) to assign source weights. Sources with BPAs similar to the majority receive higher weights. Enables incremental re-weighting when source credibility changes. Source: `docs/research/differential-dataflow-fusion-integration.md` Section 2.3. |
| [9] | Smets, P. (1990). "The Transferable Belief Model." *Artificial Intelligence* 66(2), 191-234. | Introduced the un-normalized Dempster-Shafer variant (TBM) and the pignistic probability transform `BetP`. The `BasicProbabilityAssignment::pignistic_transform()` implementation (`ava-fusion/src/confidence.rs:299-328`) follows Smets' formulation: `BetP(H_i) = SUM_{A: H_i in A} m(A)/|A| * 1/(1-m(empty))`. |
| [10] | Smarandache, F. & Dezert, J. (2006). "Proportional Conflict Redistribution Rules (PCR)." *Advances and Applications of DSmT for Information Fusion*, Vol. 2. | Introduced PCR5: redistributes conflict mass proportionally to each source's commitment. Implemented as `DsCombinationRule::Pcr5` (`ava-fusion/src/confidence.rs:166-168`). Not associative for n>2 sources; requires Murphy's average BPA first. O(F^2) per pair where F = number of focal elements. |

---

## D.4 Academic Papers — Track Management & Detection

| # | Citation | Relevance |
|---|----------|-----------|
| [11] | Wald, A. (1947). *Sequential Analysis*. John Wiley & Sons, New York. | Foundation for the Sequential Probability Ratio Test (SPRT) used in track confirmation. The `SprtConfig` (`ava-fusion/src/track.rs:257-281`) implements Wald's thresholds: `A = ln((1-beta)/alpha)` (confirm), `B = ln(beta/(1-alpha))` (reject). Domain-specific alpha/beta values per entity class. |

---

## D.5 Academic Papers — Multi-Level Fusion

| # | Citation | Relevance |
|---|----------|-----------|
| [12] | Jiang, B., et al. (2009). "A Multi-Level Fusion Approach for Remote Sensing." *Sensors*. | Three fusion levels: pixel-level, feature-level, decision-level. The ava-fusion architecture operates at decision-level fusion: each sensor produces semantic outputs (entity identifiers, tracks, states), and the fusion engine correlates these decisions. Validates the tiered approach: Tier 1 (identity decisions), Tier 2 (correlation decisions), Tier 3 (pattern decisions). Source: `docs/research/differential-dataflow-fusion-integration.md` Section 2.4. |

---

## D.6 Software Libraries & Repositories

| # | Citation | Version | Relevance |
|---|----------|---------|-----------|
| [13] | `TimelyDataflow/differential-dataflow` | v0.18.0 | Rust library implementing differential dataflow. Core computational engine for the ava-fusion pipeline. Provides `Collection`, `InputSession`, `join`, `reduce`, `iterate`, `arrange_by_key`, `consolidate`, and `ProbeHandle`. Source: `docs/research/differential-dataflow-fusion-integration.md` Section 1.1. |
| [14] | `TimelyDataflow/timely-dataflow` | v0.25 | Underlying dataflow execution framework. Provides `Worker`, `Scope`, progress tracking, and the `step()`/`step_or_park()` execution model. |
| [15] | `Dicklesworthstone/asupersync` | v0.2.5 | Async supervision framework providing GenServer lifecycle, `spawn_blocking`, and `RuntimeBuilder`. Bridge between async GenServer and synchronous dataflow worker thread. Source: `docs/research/differential-dataflow-fusion-integration.md` Section 1.3. |

---

## D.7 Data Standards & Specifications

| # | Citation | Relevance |
|---|----------|-----------|
| [16] | OASIS. "STIX 2.1 — Structured Threat Information eXpression." | Standard for cyber threat intelligence exchange. Used for `Cyber` SignalKind data format (format token `stix`). Campaign entities use STIX IDs as primary identifiers. |
| [17] | IEEE/SigMF. "Signal Metadata Format (SigMF)." | Metadata standard for RF signal recordings. Used for `Sdr` SignalKind format (`sensor.sdr.{source}.sigmf`). |
| [18] | NMEA. "NMEA 0183 Standard for Interfacing Marine Electronic Devices." | Serial protocol for AIS data. Used for raw AIS ingestion (`sensor.ais.{source}.nmea`). |
| [19] | Uber H3. "H3: A Hexagonal Hierarchical Geospatial Indexing System." | Hierarchical hexagonal spatial index. Used for Tier 2 spatial blocking (`SpatialBlockConfig`) to reduce candidate join pairs. Resolution 8 cells (~4.6 km^2) provide ~1000-7000x reduction factor. |
| [20] | TSGC-001 / TSGC-001-v2. "Tsingou Fusion Ontology Specification." | Internal specification document. Defines SignalKind (Section 2), EntityClass (Section 2), JoinPath (Section 6), ReferenceSource (Section 5.4), Risk (Section 10), Track Lifecycle (Section 8), and R1-R9 requirements. |

---

## D.8 NATS Documentation

| # | Citation | Relevance |
|---|----------|-----------|
| [21] | NATS. "Subjects." https://docs.nats.io/nats-concepts/subjects | Subject syntax, wildcards (`*`, `>`), and dot-delimited hierarchy. All ava-fusion subjects conform to this specification. |
| [22] | NATS. "JetStream." https://docs.nats.io/nats-concepts/jetstream | Persistent message streaming. Seven JetStream streams capture all ava-fusion subjects with non-overlapping filters. |
| [23] | NATS. "Key-Value Store." https://docs.nats.io/nats-concepts/jetstream/key-value-store | KV buckets (`ava-config`, `ava-state`, `ava-metrics`, `ava-schemas`) store runtime configuration and entity state. Keys use dots as separators (colons are invalid in NATS KV). |

---

*Sources: `ava-fusion/src/confidence.rs` (652 lines), `ava-fusion/src/track.rs`
(683 lines), `ava-fusion/src/signal.rs` (337 lines),
`docs/research/differential-dataflow-fusion-integration.md` (457 lines).
All citations extracted from source code comments and research documents.*

*End of Appendix D*
