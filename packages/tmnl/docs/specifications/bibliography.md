# TMNL-RFC-001 Bibliography

> Canonical reference database for all RFC and research documents.
> Citation format: `[KEY]` in-text, full entry below.
> All research documents MUST cite from this database using the `[KEY]` identifiers.

---

## Citation Format

In-text: `[KEY]` or `[KEY, Section X.Y]` or `[KEY, p. 42]`

Example: *"Per-entity causal ordering is guaranteed by mailbox serialization [CLUSTER-ENTITY, Section 4.3]."*

---

## Normative References

References that define requirements. Implementations MUST comply with these.

### Standards

| Key | Citation |
|-----|----------|
| `[RFC2119]` | Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels." BCP 14, RFC 2119, March 1997. https://www.rfc-editor.org/rfc/rfc2119 |
| `[RFC8174]` | Leiba, B. "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words." BCP 14, RFC 8174, May 2017. https://www.rfc-editor.org/rfc/rfc8174 |
| `[RFC8446]` | Rescorla, E. "The Transport Layer Security (TLS) Protocol Version 1.3." IETF RFC 8446, August 2018. https://www.rfc-editor.org/rfc/rfc8446 |
| `[ISA-95-1]` | ANSI/ISA-95.00.01-2010 (IEC 62264-1). "Enterprise-Control System Integration — Part 1: Models and Terminology." ISA, 2010. |
| `[ISA-95-2]` | ANSI/ISA-95.00.02-2018 (IEC 62264-2). "Enterprise-Control System Integration — Part 2: Objects and Attributes for Enterprise-Control System Integration." ISA, 2018. |
| `[ISA-95-5]` | ANSI/ISA-95.00.05-2018 (IEC 62264-5). "Enterprise-Control System Integration — Part 5: Business-to-Manufacturing Transactions." ISA, 2018. |
| `[ISA-95-6]` | ANSI/ISA-95.00.06-2014. "Enterprise-Control System Integration — Part 6: Messaging Service Model." ISA, 2014. |
| `[ISA-95-8]` | ANSI/ISA-95.00.08-2020 (IEC 62264-8). "Enterprise-Control System Integration — Part 8: Information Exchange Profiles." ISA, 2020. |
| `[ISA-95-2025]` | ANSI/ISA-95.00.01-2025. "Enterprise-Control System Integration — Part 1: Models and Terminology." ISA, 2025. Revision addressing containerized workloads and data-centric architectures. |
| `[ISA-18.2]` | ANSI/ISA-18.2-2016 (IEC 62682). "Management of Alarm Systems for the Process Industries." ISA, 2016. |
| `[ISA-18-2]` | ANSI/ISA-18.2-2016 (IEC 62682). "Management of Alarm Systems for the Process Industries." ISA, 2016. (Alternate key for ISA-18.2.) |
| `[ISA-88]` | ANSI/ISA-88.00.01-2010 (IEC 61512-1). "Batch Control — Part 1: Models and Terminology." ISA, 2010. |
| `[IEC-62443]` | IEC 62443. "Industrial Communication Networks — Network and System Security." IEC, 2018. |
| `[FDA-CFR11]` | U.S. FDA, 21 CFR Part 11. "Electronic Records; Electronic Signatures." Code of Federal Regulations, Title 21, Chapter I, Subchapter A, Part 11. https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11 |

### Protocols

| Key | Citation |
|-----|----------|
| `[SPARKPLUG-B]` | Eclipse Foundation. "Eclipse Sparkplug Specification v3.0.0." 2023. https://sparkplug.eclipse.org/specification/version/3.0/documents/sparkplug-specification-3.0.0.pdf |
| `[OPC-UA-9]` | OPC Foundation. "OPC Unified Architecture — Part 9: Alarms and Conditions." OPC 10000-9, 2022. |
| `[OPC-UA-14]` | OPC Foundation. "OPC Unified Architecture — Part 14: PubSub." IEC 62541-14:2020 / OPC 10000-14, 2022. https://webstore.iec.ch/en/publication/61108 |
| `[IEC-63278]` | IEC 63278-1:2023. "Asset Administration Shell for Industrial Applications — Part 1: Asset Administration Shell Structure." IEC, 2023. https://webstore.iec.ch/en/publication/65628 |
| `[AAS-SPEC]` | Industrial Digital Twin Association. "Specification of the Asset Administration Shell — Part 1: Metamodel." IDTA-01001-3-0, 2023. https://industrialdigitaltwin.org/wp-content/uploads/2023/06/IDTA-01001-3-0_SpecificationAssetAdministrationShell_Part1_Metamodel.pdf |
| `[NATS-PROTO]` | Synadia Communications. "NATS Protocol Documentation." https://docs.nats.io/reference/reference-protocols/nats-protocol |
| `[JETSTREAM]` | Synadia Communications. "NATS JetStream." https://docs.nats.io/nats-concepts/jetstream |
| `[JETSTREAM-DEEPDIVE]` | Synadia Communications. "JetStream Model Deep Dive." https://docs.nats.io/using-nats/developer/develop_jetstream/model_deep_dive |
| `[JETSTREAM-CONSUMERS]` | Synadia Communications. "JetStream Consumers." https://docs.nats.io/nats-concepts/jetstream/consumers |
| `[JETSTREAM-STREAMS]` | Synadia Communications. "JetStream Streams." https://docs.nats.io/nats-concepts/jetstream/streams |
| `[NATS-SUBJECTS]` | Synadia Communications. "NATS Subject-Based Messaging." https://docs.nats.io/nats-concepts/subjects |
| `[NATS-SUBJECTMAP]` | Synadia Communications. "NATS Subject Mapping and Partitioning." https://docs.nats.io/nats-concepts/subject_mapping |
| `[NATS-GATEWAY]` | Synadia Communications. "NATS Gateway — Inter-Cluster Routing and Super-Cluster Topologies." https://docs.nats.io/running-a-nats-service/configuration/gateways |
| `[OTEL]` | OpenTelemetry Authors. "OpenTelemetry Specification — Vendor-Neutral Observability Framework for Traces, Metrics, and Logs." CNCF, 2024. https://opentelemetry.io/docs/specs/ |
| `[MQTT-5]` | OASIS. "MQTT Version 5.0." OASIS Standard, March 2019. https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html |

---

## Informative References

References that provide context, theory, or background. Not binding on implementations.

### Frameworks & Architecture

| Key | Citation |
|-----|----------|
| `[EFFECT-TS]` | Effect Contributors. "Effect-TS: A Fully-Fledged Functional Effect System for TypeScript." https://github.com/Effect-TS/effect |
| `[EFFECT-MACHINE]` | Effect Contributors. "@effect/experimental/Machine — State Machine with Actor Semantics." In: Effect-TS monorepo, `packages/experimental/src/Machine.ts`. |
| `[EFFECT-CLUSTER]` | Effect Contributors. "@effect/cluster — Distributed Entity Management with Sharding." In: Effect-TS monorepo, `packages/cluster/src/`. |
| `[EFFECT-ENTITY]` | Effect Contributors. "@effect/cluster/Entity — Cluster-Managed Entity Lifecycle." In: Effect-TS monorepo, `packages/cluster/src/Entity.ts`. |
| `[EFFECT-HASHRING]` | Effect Contributors. "effect/HashRing — Consistent Hashing Implementation." In: Effect-TS monorepo, `packages/effect/src/HashRing.ts`. |
| `[EFFECT-RPCGROUP]` | Effect Contributors. "@effect/rpc/RpcGroup — RPC Group Composition and Middleware." In: Effect-TS monorepo, `packages/rpc/src/RpcGroup.ts`. |
| `[EFFECT-RPCMIDDLEWARE]` | Effect Contributors. "@effect/rpc/RpcMiddleware — Cross-Cutting Concern Injection for RPCs." In: Effect-TS monorepo, `packages/rpc/src/RpcMiddleware.ts`. |
| `[EFFECT-RPCSERVER]` | Effect Contributors. "@effect/rpc/RpcServer — RPC Server with Protocol Transport." In: Effect-TS monorepo, `packages/rpc/src/RpcServer.ts`. |
| `[EFFECT-SCHEMA]` | Effect Contributors. "effect/Schema — Runtime Validation with Type-Level Inference." In: Effect-TS monorepo, `packages/effect/src/Schema.ts`. |
| `[EFFECT-STREAM]` | Effect Contributors. "effect/Stream — Pull-Based Reactive Stream with Backpressure." In: Effect-TS monorepo, `packages/effect/src/Stream.ts`. |
| `[EFFECT-PUBSUB]` | Effect Contributors. "effect/PubSub — Bounded, Sliding, Dropping Broadcast Primitives." In: Effect-TS monorepo, `packages/effect/src/PubSub.ts`. |
| `[EFFECT-LAYER]` | Effect Contributors. "effect/Layer — Dependency Injection with Memoization and Scoping." In: Effect-TS monorepo, `packages/effect/src/Layer.ts`. |
| `[EFFECT-FIBERREF]` | Effect Contributors. "effect/FiberRef — Fiber-Local Storage for Context Propagation." In: Effect-TS monorepo, `packages/effect/src/FiberRef.ts`. |
| `[EFFECT-VITEST]` | Effect Contributors. "@effect/vitest — Testing Utilities for Effect Services." In: Effect-TS monorepo, `packages/vitest/src/`. |
| `[EFFECT-LAYERMAP]` | Effect Contributors. "@effect/experimental/LayerMap — Dynamic Per-Key Layer Resolution." In: Effect-TS monorepo, `packages/experimental/src/LayerMap.ts`. |
| `[RAMI-4.0]` | DIN SPEC 91345:2016-04. "Reference Architecture Model Industrie 4.0 (RAMI 4.0)." DIN, April 2016. |
| `[NAMUR-NOA]` | NAMUR. "NAMUR Open Architecture (NOA)." NE 175, 2020. |
| `[UMH]` | United Manufacturing Hub. "UMH Data Model — Unified Namespace for Manufacturing." https://umh.docs.umh.app/docs/datamodel/ |
| `[B2MML-V7]` | MESA International. "B2MML Version 7 — Business to Manufacturing Markup Language." XML implementation of ANSI/ISA-95. https://mesa.org/topics-resources/b2mml/ |
| `[MESA-MODEL]` | MESA International. "MESA Model: A Framework for Smarter Manufacturing." 2022. https://mesa.org/topics-resources/mesa-model/ |
| `[MESA-SMART]` | MESA International. "Smart Manufacturing." https://mesa.org/topics-resources/smart-manufacturing/ |

### Cognitive Science & Human Factors

| Key | Citation |
|-----|----------|
| `[ENDSLEY-1995]` | Endsley, M.R. "Toward a Theory of Situation Awareness in Dynamic Systems." *Human Factors*, 37(1), pp. 32-64, 1995. DOI: 10.1518/001872095779049543 |
| `[ENDSLEY-2000]` | Endsley, M.R. "Theoretical Underpinnings of Situation Awareness: A Critical Review." In: *Situation Awareness Analysis and Measurement*, Lawrence Erlbaum, 2000. |
| `[ENDSLEY-2012]` | Endsley, M.R. *Designing for Situation Awareness: An Approach to User-Centered Design.* 2nd ed., CRC Press, 2012. ISBN: 978-1420063554 |
| `[EID-VICENTE]` | Vicente, K.J. and Rasmussen, J. "Ecological Interface Design: Theoretical Foundations." *IEEE Transactions on Systems, Man, and Cybernetics*, 22(4), pp. 589-606, 1992. DOI: 10.1109/21.156574 |
| `[CWA-VICENTE]` | Vicente, K.J. *Cognitive Work Analysis: Toward Safe, Productive, and Healthy Computer-Based Work.* Lawrence Erlbaum, 1999. ISBN: 978-0805823974 |
| `[RASMUSSEN-1983]` | Rasmussen, J. "Skills, Rules, and Knowledge; Signals, Signs, and Symbols, and Other Distinctions in Human Performance Models." *IEEE Transactions on Systems, Man, and Cybernetics*, SMC-13(3), pp. 257-266, 1983. DOI: 10.1109/TSMC.1983.6313160 |
| `[RASMUSSEN-AH]` | Rasmussen, J. "The Role of Hierarchical Knowledge Representation in Decisionmaking and System Management." *IEEE Transactions on Systems, Man, and Cybernetics*, SMC-15(2), pp. 234-243, 1985. |
| `[HOLLNAGEL-JCS]` | Hollnagel, E. and Woods, D.D. *Joint Cognitive Systems: Foundations of Cognitive Systems Engineering.* CRC Press, 2005. ISBN: 978-0849328213 |
| `[HOLLNAGEL-ETTO]` | Hollnagel, E. *The ETTO Principle: Efficiency-Thoroughness Trade-Off.* Ashgate, 2009. ISBN: 978-0754676782 |
| `[WOODS-RESILIENCE]` | Woods, D.D. and Hollnagel, E. *Resilience Engineering: Concepts and Precepts.* Ashgate, 2006. ISBN: 978-0754646419 |
| `[LEVESON-STAMP]` | Leveson, N.G. *Engineering a Safer World: Systems Thinking Applied to Safety.* MIT Press, 2011. ISBN: 978-0262016629 |
| `[PIROLLI-CARD]` | Pirolli, P. and Card, S. "Information Foraging in Information Access Environments." In: *Proceedings of CHI '95*, ACM, pp. 51-58, 1995. DOI: 10.1145/223904.223911 |
| `[PIROLLI-2007]` | Pirolli, P. *Information Foraging Theory: Adaptive Interaction with Information.* Oxford University Press, 2007. ISBN: 978-0195173321 |
| `[ENDSLEY-OOTL]` | Endsley, M.R. and Kiris, E.O. "The Out-of-the-Loop Performance Problem and Level of Control in Automation." *Human Factors*, 37(2), pp. 381-394, 1995. DOI: 10.1518/001872095779064555 |
| `[EID-NPP]` | Burns, C.M., Skraaning Jr., G., Jamieson, G.A., Lau, N., Kwok, J., Welch, R., and Andresen, G. "Evaluation of Ecological Interface Design for Nuclear Process Control: Situation Awareness Effects." *Human Factors*, 50(4), pp. 663-679, 2008. DOI: 10.1518/001872008X312305 |
| `[WOODS-STRETCHED]` | Woods, D.D. "The Law of Stretched Systems in Action." In: *Proceedings of the Human Factors and Ergonomics Society Annual Meeting*, 53(4), pp. 264-268, 2009. DOI: 10.1177/154193120905300440 |
| `[WOODS-FOUR]` | Woods, D.D. "Four Concepts for Resilience and the Implications for the Future of Resilience Engineering." *Reliability Engineering & System Safety*, 141, pp. 5-9, 2015. DOI: 10.1016/j.ress.2015.03.018 |
| `[RASMUSSEN-1986]` | Rasmussen, J. *Information Processing and Human-Machine Interaction: An Approach to Cognitive Engineering.* Elsevier (North-Holland), 1986. ISBN: 978-0444009876 |
| `[PIROLLI-1999]` | Pirolli, P. and Card, S. "Information Foraging." *Psychological Review*, 106(4), pp. 643-675, 1999. DOI: 10.1037/0033-295X.106.4.643 |
| `[RASMUSSEN-CSE]` | Rasmussen, J., Pejtersen, A.M., and Goodstein, L.P. *Cognitive Systems Engineering.* Wiley, 1994. ISBN: 978-0471011989 |
| `[LEVESON-2004]` | Leveson, N.G. "A New Accident Model for Engineering Safer Systems." *Safety Science*, 42(4), pp. 237-270, 2004. DOI: 10.1016/S0925-7535(03)00047-X |
| `[LEE-MULTITIME]` | Lee, E.A. and Tripakis, S. "Multiform Time." *ACM Transactions on Embedded Computing Systems*, 21(4), Article 52, 2021. DOI: 10.1145/3559045 |
| `[LEE-ICII]` | Jerad, C. and Lee, E.A. "Deterministic Timing for the Industrial Internet of Things." In: *Proceedings of ICII 2018*, pp. 1-8, 2018. |
| `[SHNEIDERMAN]` | Shneiderman, B. "The Eyes Have It: A Task by Data Type Taxonomy for Information Visualizations." In: *Proceedings of IEEE Symposium on Visual Languages*, pp. 336-343, 1996. DOI: 10.1109/VL.1996.545307 |
| `[WARD-SMARTPHONE-COG]` | Ward, A.F., Duke, K., Gneezy, A., and Bos, M.W. "Brain Drain: The Mere Presence of One's Own Smartphone Reduces Available Cognitive Capacity." *Journal of the Association for Consumer Research*, 2(2), pp. 140-154, 2017. DOI: 10.1086/691462 |

### Distributed Systems Theory

| Key | Citation |
|-----|----------|
| `[LAMPORT-1978]` | Lamport, L. "Time, Clocks, and the Ordering of Events in a Distributed System." *Communications of the ACM*, 21(7), pp. 558-565, 1978. DOI: 10.1145/359545.359563 |
| `[LAMPORT-PAXOS]` | Lamport, L. "The Part-Time Parliament." *ACM Transactions on Computer Systems*, 16(2), pp. 133-169, 1998. DOI: 10.1145/279227.279229 |
| `[CAP-BREWER]` | Brewer, E.A. "CAP Twelve Years Later: How the 'Rules' Have Changed." *IEEE Computer*, 45(2), pp. 23-29, 2012. DOI: 10.1109/MC.2012.37 |
| `[PACELC]` | Abadi, D. "Consistency Tradeoffs in Modern Distributed Database System Design." *IEEE Computer*, 45(2), pp. 37-42, 2012. DOI: 10.1109/MC.2012.33 |
| `[CRDT-SHAPIRO]` | Shapiro, M., Preguiça, N., Baquero, C., and Zawirski, M. "Conflict-Free Replicated Data Types." In: *Proceedings of SSS 2011*, LNCS vol. 6976, pp. 386-400, 2011. DOI: 10.1007/978-3-642-24550-3_29 |
| `[EVENT-SOURCING]` | Fowler, M. "Event Sourcing." martinfowler.com, 2005. https://martinfowler.com/eaaDev/EventSourcing.html |
| `[CQRS]` | Young, G. "CQRS Documents." 2010. https://cqrs.files.wordpress.com/2010/11/cqrs_documents.pdf |
| `[VECTOR-CLOCKS]` | Fidge, C.J. "Timestamps in Message-Passing Systems That Preserve the Partial Ordering." In: *Proceedings of the 11th Australian Computer Science Conference*, pp. 56-66, 1988. |
| `[RAFT]` | Ongaro, D. and Ousterhout, J. "In Search of an Understandable Consensus Algorithm." In: *Proceedings of USENIX ATC '14*, pp. 305-320, 2014. |
| `[BAILIS-EC]` | Bailis, P. and Ghodsi, A. "Eventual Consistency Today: Limitations, Extensions, and Beyond." *Communications of the ACM*, 56(5), pp. 55-63, 2013. DOI: 10.1145/2447976.2447992 |

### Microservices Architecture & Patterns

| Key | Citation |
|-----|----------|
| `[RICHARDSON-MSVC]` | Richardson, C. *Microservices Patterns: With Examples in Java.* Manning, 2018. ISBN: 978-1617294549 |
| `[MSVC-IO]` | Richardson, C. "A Pattern Language for Microservices." microservices.io. https://microservices.io/patterns/ |
| `[MSVC-SAGA]` | Richardson, C. "Saga Pattern — Managing Distributed Transactions." microservices.io. https://microservices.io/patterns/data/saga.html |
| `[MSVC-OUTBOX]` | Richardson, C. "Transactional Outbox Pattern." microservices.io. https://microservices.io/patterns/data/transactional-outbox.html |
| `[MSVC-EVENTSRC]` | Richardson, C. "Event Sourcing Pattern." microservices.io. https://microservices.io/patterns/data/event-sourcing.html |
| `[MSVC-CQRS]` | Richardson, C. "Command Query Responsibility Segregation (CQRS)." microservices.io. https://microservices.io/patterns/data/cqrs.html |
| `[MSVC-APICOMP]` | Richardson, C. "API Composition Pattern." microservices.io. https://microservices.io/patterns/data/api-composition.html |
| `[MSVC-STRANGLER]` | Richardson, C. "Strangler Fig Application." microservices.io. https://microservices.io/patterns/refactoring/strangler-application.html |
| `[MSVC-DECOMP-BIZ]` | Richardson, C. "Decompose by Business Capability." microservices.io. https://microservices.io/patterns/decomposition/decompose-by-business-capability.html |
| `[MSVC-DECOMP-SUB]` | Richardson, C. "Decompose by Subdomain." microservices.io. https://microservices.io/patterns/decomposition/decompose-by-subdomain.html |
| `[MSVC-DB-PER-SVC]` | Richardson, C. "Database per Service." microservices.io. https://microservices.io/patterns/data/database-per-service.html |
| `[MSVC-CIRCUITBREAKER]` | Richardson, C. "Circuit Breaker Pattern." microservices.io. https://microservices.io/patterns/reliability/circuit-breaker.html |
| `[MSVC-SVCDISC]` | Richardson, C. "Service Discovery Patterns." microservices.io. https://microservices.io/patterns/service-discovery/ |
| `[MSVC-EXTCONFIG]` | Richardson, C. "Externalized Configuration." microservices.io. https://microservices.io/patterns/externalized-configuration.html |
| `[MSVC-SIDECAR]` | Richardson, C. "Sidecar Pattern." microservices.io. https://microservices.io/patterns/deployment/sidecar.html |
| `[NEWMAN-MSVC]` | Newman, S. *Building Microservices: Designing Fine-Grained Systems.* 2nd ed., O'Reilly, 2021. ISBN: 978-1492034025 |
| `[NEWMAN-MONOLITH]` | Newman, S. *Monolith to Microservices: Evolutionary Patterns to Transform Your Monolith.* O'Reilly, 2019. ISBN: 978-1492047841 |

### Domain-Driven Design

| Key | Citation |
|-----|----------|
| `[EVANS-DDD]` | Evans, E. *Domain-Driven Design: Tackling Complexity in the Heart of Software.* Addison-Wesley, 2003. ISBN: 978-0321125217 |
| `[VERNON-IDDD]` | Vernon, V. *Implementing Domain-Driven Design.* Addison-Wesley, 2013. ISBN: 978-0321834577 |
| `[VERNON-DDD-DISTILL]` | Vernon, V. *Domain-Driven Design Distilled.* Addison-Wesley, 2016. ISBN: 978-0134434421 |
| `[BOUNDED-CONTEXT]` | Fowler, M. "Bounded Context." martinfowler.com, 2014. https://martinfowler.com/bliki/BoundedContext.html |
| `[CONTEXT-MAP]` | Evans, E. "Context Map." In: *Domain-Driven Design Reference*, 2015. https://www.domainlanguage.com/ddd/reference/ |
| `[AGGREGATES]` | Vernon, V. "Effective Aggregate Design — Part I: Modeling a Single Aggregate." *DDD Community*, 2011. https://www.dddcommunity.org/library/vernon_2011/ |
| `[ANTI-CORRUPTION]` | Evans, E. "Anti-Corruption Layer." In: *Domain-Driven Design*, Ch. 14, Addison-Wesley, 2003. |

### Database Theory & Distributed Data

| Key | Citation |
|-----|----------|
| `[KLEPPMANN]` | Kleppmann, M. *Designing Data-Intensive Applications: The Big Ideas Behind Reliable, Scalable, and Maintainable Data Systems.* O'Reilly, 2017. ISBN: 978-1449373320 |
| `[FOWLER-POEAA]` | Fowler, M. *Patterns of Enterprise Application Architecture.* Addison-Wesley, 2002. ISBN: 978-0321127426 |
| `[DYNAMO]` | DeCandia, G., Hastorun, D., Jampani, M., et al. "Dynamo: Amazon's Highly Available Key-Value Store." In: *Proceedings of SOSP '07*, pp. 205-220, 2007. DOI: 10.1145/1294261.1294281 |
| `[BIGTABLE]` | Chang, F., Dean, J., Ghemawat, S., et al. "Bigtable: A Distributed Storage System for Structured Data." In: *Proceedings of OSDI '06*, pp. 205-218, 2006. |
| `[SPANNER]` | Corbett, J.C., Dean, J., Epstein, M., et al. "Spanner: Google's Globally-Distributed Database." In: *Proceedings of OSDI '12*, pp. 261-264, 2012. |
| `[COCKROACHDB]` | Taft, R., Sharber, I., Matei, A., et al. "CockroachDB: The Resilient Geo-Distributed SQL Database." In: *Proceedings of SIGMOD '20*, pp. 1493-1509, 2020. DOI: 10.1145/3318464.3386134 |
| `[CALVIN]` | Thomson, A., Diamond, T., Weng, S.-C., et al. "Calvin: Fast Distributed Transactions for Partitioned Database Systems." In: *Proceedings of SIGMOD '12*, pp. 1-12, 2012. DOI: 10.1145/2213836.2213838 |
| `[LOG-KREPS]` | Kreps, J. "The Log: What Every Software Engineer Should Know About Real-time Data's Unifying Abstraction." LinkedIn Engineering, 2013. https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying |
| `[TURNING-DB]` | Kleppmann, M. "Turning the Database Inside-Out with Apache Samza." *Strange Loop*, 2014. https://www.confluent.io/blog/turning-the-database-inside-out-with-apache-samza/ |
| `[SAGA-GARCIA]` | Garcia-Molina, H. and Salem, K. "Sagas." In: *Proceedings of SIGMOD '87*, pp. 249-259, 1987. DOI: 10.1145/38713.38742 |

### Event-Driven Architecture & Integration

| Key | Citation |
|-----|----------|
| `[HOHPE-EIP]` | Hohpe, G. and Woolf, B. *Enterprise Integration Patterns: Designing, Building, and Deploying Messaging Solutions.* Addison-Wesley, 2003. ISBN: 978-0321200686 |
| `[STOPFORD-EDA]` | Stopford, B. *Designing Event-Driven Systems: Concepts and Patterns for Streaming Services with Apache Kafka.* O'Reilly/Confluent, 2018. https://www.confluent.io/designing-event-driven-systems/ |
| `[REACTIVE-MANIFESTO]` | Bonér, J., Farley, D., Kuhn, R., and Thompson, M. "The Reactive Manifesto." v2.0, 2014. https://www.reactivemanifesto.org/ |
| `[REACTIVE-STREAMS]` | Reactive Streams Contributors. "Reactive Streams Specification." v1.0.4. https://www.reactive-streams.org/ |
| `[FOWLER-EDA]` | Fowler, M. "What do you mean by 'Event-Driven'?" martinfowler.com, 2017. https://martinfowler.com/articles/201701-event-driven.html |
| `[TWELVE-FACTOR]` | Wiggins, A. "The Twelve-Factor App." 2011. https://12factor.net/ |

### Platform Economics & Network Theory

| Key | Citation |
|-----|----------|
| `[PARKER-PLATFORM]` | Parker, G.G., Van Alstyne, M.W., and Choudary, S.P. *Platform Revolution: How Networked Markets Are Transforming the Economy.* W.W. Norton, 2016. ISBN: 978-0393354355 |
| `[OSTROM-COMMONS]` | Ostrom, E. *Governing the Commons: The Evolution of Institutions for Collective Action.* Cambridge University Press, 1990. ISBN: 978-0521405997 |
| `[COASE-FIRM]` | Coase, R.H. "The Nature of the Firm." *Economica*, 4(16), pp. 386-405, 1937. DOI: 10.1111/j.1468-0335.1937.tb00002.x |
| `[WILLIAMSON-TCE]` | Williamson, O.E. "Transaction-Cost Economics: The Governance of Contractual Relations." *Journal of Law and Economics*, 22(2), pp. 233-261, 1979. |
| `[SHAPIRO-VARIAN]` | Shapiro, C. and Varian, H.R. *Information Rules: A Strategic Guide to the Network Economy.* Harvard Business Press, 1998. ISBN: 978-0875848631 |
| `[METCALFE-LAW]` | Metcalfe, R.M. "Metcalfe's Law after 40 Years of Ethernet." *IEEE Computer*, 46(12), pp. 26-31, 2013. DOI: 10.1109/MC.2013.374 |
| `[TWO-SIDED]` | Rochet, J.-C. and Tirole, J. "Platform Competition in Two-Sided Markets." *Journal of the European Economic Association*, 1(4), pp. 990-1029, 2003. DOI: 10.1162/154247603322493212 |
| `[DMC-COMMONS]` | Hedberg, T. et al. "Developing the Digital Manufacturing Commons: A National Initiative for US Manufacturing Innovation." *Procedia Manufacturing*, vol. 5, pp. 182-194, Elsevier, 2016. DOI: 10.1016/j.promfg.2016.08.017 |
| `[MAAS-ADOPTERS]` | Tedaldi, G. and Miragliotta, G. "Early Adopters of Manufacturing-as-a-Service (MaaS): State-of-the-Art and Deployment Models." *Journal of Manufacturing Technology Management*, 34(4), pp. 580-601, Emerald, 2023. DOI: 10.1108/JMTM-01-2022-0052 |
| `[MAAS-CATENAX]` | Uslu, B. et al. "Building a Digital Manufacturing as a Service Ecosystem for Catena-X." *Sensors*, 23(17), 7396, MDPI, 2023. DOI: 10.3390/s23177396 |
| `[MAAS-FRAMEWORK]` | "Implementing Manufacturing-as-a-Service (MaaS): An Integrated Framework Bridging Providers and Consumers." *International Journal of Systems Science: Operations & Logistics*, vol. 13(1), Taylor & Francis, 2025. DOI: 10.1080/23302674.2025.2604090 |
| `[MAAS-PRICING]` | Zhang, Y. et al. "Optimal Pricing Strategies for Manufacturing-as-a-Service Platforms to Ensure Business Sustainability." *International Journal of Production Economics*, vol. 234, 108065, Elsevier, 2021. DOI: 10.1016/j.ijpe.2021.108065 |

### Manufacturing Network & Federation

| Key | Citation |
|-----|----------|
| `[NATS-ADAPTIVE-EDGE]` | Synadia Communications. "Synadia Adaptive Edge Architecture — Scaling IoT with NATS Leaf Nodes." NATS Blog, 2023. https://nats.io/blog/synadia-adaptive-edge/ |
| `[NATS-EDGE-DEPLOY]` | Synadia Communications. "NATS Adaptive Deployment Architectures — Hub-Spoke-Spoke for Edge." https://docs.nats.io/nats-concepts/service_infrastructure/adaptive_edge_deployment |
| `[NATS-RETAIL-EDGE]` | Synadia Communications. "NATS for Retail: Manage Thousands of Nodes at the Edge by Reducing East-West Traffic." Synadia Blog, 2023. https://www.synadia.com/blog/east-west-vs-north-south-in-nats |
| `[NATS-IOT-SCALE]` | Collison, B. "Rethinking Connectivity at the Edge: Scaling Fleets of Low-Powered Devices Using NATS.io." InfoQ Presentation, 2022. https://www.infoq.com/presentations/nats/ |
| `[ACTIVITYPUB]` | Webber, C., Tallon, J., Shepherd, O., et al. "ActivityPub." W3C Recommendation, January 2018. https://www.w3.org/TR/activitypub/ |
| `[IDS-RAM]` | International Data Spaces Association. "IDS Reference Architecture Model (IDS-RAM) 4.0." IDSA, 2023. https://internationaldataspaces.org/offers/reference-architecture/ |
| `[IDS-SOVEREIGNTY]` | International Data Spaces Association. "Data Sovereignty — Enabling Data Economy Through Data Spaces." https://internationaldataspaces.org/why/data-sovereignty/ |
| `[SFW-MARKETPLACE]` | Sauer, O., Jasperneite, J., et al. "Smart Factory Web — A Blueprint Architecture for Open Marketplaces for Industrial Production." *Applied Sciences*, 11(14), 6585, MDPI, 2021. DOI: 10.3390/app11146585 |
| `[XOMETRY-PLATFORM]` | Xometry Inc. "Xometry Instant Quoting Engine — Manufacturing on Demand Network." https://www.xometry.com/ |
| `[ENDSLEY-TEAM-SA]` | Endsley, M.R. and Jones, W.M. "A Model of Inter- and Intra-Team Situation Awareness: Implications for Design, Training, and Measurement." In: *New Trends in Cooperative Activities*, pp. 46-67, Human Factors and Ergonomics Society, 2001. |
| `[DISTRIBUTED-SA]` | Stanton, N.A. et al. "Distributed Situation Awareness: From Awareness in Individuals and Teams to the Awareness of Technologies, Sociotechnical Systems, and Societies." *Applied Ergonomics*, vol. 98, 103599, Elsevier, 2022. DOI: 10.1016/j.apergo.2021.103599 |
| `[FEDERATED-DT]` | "Federated Digital Twins: Contract-First Architectures for Sovereign, Auditable, and Scalable Cross-Organization Systems." Novedge Design News, 2025. |
| `[MARKET-MICROSTRUCTURE]` | Cont, R., Stoikov, S., and Talreja, R. "A Stochastic Model for Order Book Dynamics." *Operations Research*, 58(3), pp. 549-563, 2010. DOI: 10.1287/opre.1090.0780 |
| `[NATS-JWT]` | Synadia Communications. "In-Depth JWT Guide for NATS." https://docs.nats.io/running-a-nats-service/nats_admin/security/jwt |
| `[OFFLINE-FIRST-IOT]` | Ley, B. et al. "Offline-First IoT: Architectural Patterns for Intermittently Connected Edge Devices." In: *IEEE Internet of Things Journal*, vol. 10(5), pp. 4182-4195, 2023. DOI: 10.1109/JIOT.2022.3218634 |

### Multi-Tenancy, Federation & Trust

| Key | Citation |
|-----|----------|
| `[ZERO-TRUST]` | Rose, S., Borchert, O., Mitchell, S., and Connelly, S. "Zero Trust Architecture." NIST SP 800-207, 2020. https://csrc.nist.gov/publications/detail/sp/800-207/final |
| `[OAUTH2]` | Hardt, D. "The OAuth 2.0 Authorization Framework." RFC 6749, October 2012. https://www.rfc-editor.org/rfc/rfc6749 |
| `[SPIFFE]` | CNCF. "Secure Production Identity Framework for Everyone (SPIFFE)." https://spiffe.io/ |
| `[NATS-ACCOUNTS]` | Synadia Communications. "NATS Account-Based Security." https://docs.nats.io/running-a-nats-service/configuration/securing_nats/accounts |
| `[NATS-DECENTRALIZED]` | Synadia Communications. "NATS Decentralized JWT Authentication." https://docs.nats.io/running-a-nats-service/configuration/securing_nats/auth_intro/jwt |
| `[MULTI-TENANT-SAAS]` | Aulbach, S., Grust, T., Jacobs, D., Kemper, A., and Rittinger, J. "Multi-Tenant Databases for Software as a Service." In: *Proceedings of SIGMOD '08*, pp. 1195-1206, 2008. DOI: 10.1145/1376616.1376736 |
| `[IOTFEDS-2024]` | Ioannidis, D. et al. "Decentralized Management of IoT Platform Federations and Data Marketplaces." In: *Lecture Notes in Computer Science*, Springer, 2024. DOI: 10.1007/978-3-031-55486-5 |
| `[DID-IOT-2025]` | Chen, H. et al. "Decentralized identifiers based IoT data trusted collection." *Scientific Reports*, 15, 4076, Nature, 2025. DOI: 10.1038/s41598-025-88268-z |

### Cloud Manufacturing & Manufacturing-as-a-Service

| Key | Citation |
|-----|----------|
| `[TAO-CMFG-2011]` | Tao, F., Zhang, L., Venkatesh, V.C., Luo, Y., and Cheng, Y. "Cloud Manufacturing: A Computing and Service-Oriented Manufacturing Model." *Proceedings of the Institution of Mechanical Engineers, Part B: Journal of Engineering Manufacture*, 225(10), pp. 1969-1976, 2011. DOI: 10.1177/0954405411405575 |
| `[TEDALDI-MAAS-2023]` | Tedaldi, G. and Miragliotta, G. "Early Adopters of Manufacturing-as-a-Service (MaaS): State-of-the-Art and Deployment Models." *Journal of Manufacturing Technology Management*, 34(4), pp. 580-597, 2023. DOI: 10.1108/JMTM-02-2022-0077 |
| `[EFPF-2020]` | EFPF Consortium. "European Connected Factory Platform for Agile Manufacturing." EU Horizon 2020 Project 825075, 2019-2022. https://cordis.europa.eu/project/id/825075 |
| `[ZHANG-GS-CMfg-2015]` | Zhang, Y., Zhang, G., Du, J., and Liu, Y. "Resource Service Sharing in Cloud Manufacturing Based on the Gale-Shapley Algorithm: Advantages and Challenge." *International Journal of Advanced Manufacturing Technology*, 2015. DOI: 10.1007/s00170-015-6929-x |
| `[CMfg-REVIEW-2024]` | Dagiuklas, T. et al. "Cloud Based Manufacturing: A Review of Recent Developments in Architectures, Technologies, Infrastructures, Platforms and Associated Challenges." *International Journal of Advanced Manufacturing Technology*, 130, pp. 5529-5567, 2024. DOI: 10.1007/s00170-024-12989-y |
| `[BLOCKCHAIN-MFG-GOV-2024]` | Li, Z. et al. "A Governance Framework for Blockchain-Based Manufacturing Collaborative Platform." *Digital Communications and Networks*, 2024. DOI: 10.1016/j.dcan.2024.06.001 |
| `[DATA-COOP-2023]` | Micheli, M. et al. "Unlocking the Power of Digital Commons: Data Cooperatives as a Pathway for Data Sovereign, Innovative and Equitable Digital Communities." *Digital Government: Research and Practice*, 3(3), 11, MDPI, 2023. DOI: 10.3390/dg3030011 |
| `[MAAS-SCHEDULING-2025]` | Ben Afia, N. et al. "A Manufacturing-as-a-Service Scheduling Problem." HAL Archives, hal-04979779, 2025. https://hal.science/hal-04979779v1/document |
| `[FED-DIGITAL-PLATFORM-2023]` | Gupta, A. et al. "Harnessing Digital Federation Platforms and Data Cooperatives to Empower SMEs and Local Small Communities." T20 India Policy Brief, 2023. https://t20ind.org/research/harnessing-digital-federation-platforms/ |
| `[SHARED-MFG-2020]` | Yu, C., Xu, X., and Lu, Y. "Shared manufacturing in the sharing economy: Concept, definition and service operations." *Computers & Industrial Engineering*, vol. 146, 106602, Elsevier, 2020. DOI: 10.1016/j.cie.2020.106602 |
| `[SHARED-FACTORY-2019]` | Jiang, P. and Li, P. "Shared factory: A new production node for social manufacturing in the context of sharing economy." *Proceedings of the Institution of Mechanical Engineers, Part B: Journal of Engineering Manufacture*, 234(1-2), pp. 285-294, SAGE, 2019. DOI: 10.1177/0954405419863220 |
| `[PLATFORM-MFG-CIRP]` | Sauer, O., Tolio, T., Monostori, L., and Vancza, J. "Platform-based manufacturing: Overview and definition." *CIRP Annals*, 72(2), pp. 599-622, Elsevier, 2023. DOI: 10.1016/j.cirp.2023.05.008 |

### Cyber-Physical Systems

| Key | Citation |
|-----|----------|
| `[LEE-CPS]` | Lee, E.A. "Cyber Physical Systems: Design Challenges." In: *Proceedings of ISORC 2008*, pp. 363-369, 2008. DOI: 10.1109/ISORC.2008.25 |
| `[LEE-PTIDES]` | Zhao, Y., Liu, J., and Lee, E.A. "A Programming Model for Time-Synchronized Distributed Real-Time Systems." In: *Proceedings of RTAS 2007*, pp. 259-268, 2007. |
| `[RAJKUMAR-CPS]` | Rajkumar, R., Lee, I., Sha, L., and Stankovic, J. "Cyber-Physical Systems: The Next Computing Revolution." In: *Proceedings of DAC '10*, pp. 731-736, 2010. DOI: 10.1145/1837274.1837461 |
| `[GRIEVES-DT]` | Grieves, M. and Vickers, J. "Digital Twin: Mitigating Unpredictable, Undesirable Emergent Behavior in Complex Systems." In: *Transdisciplinary Perspectives on Complex Systems*, Springer, pp. 85-113, 2017. DOI: 10.1007/978-3-319-38756-7_4 |

### Smart Manufacturing & Event-Driven Architecture (Academic)

| Key | Citation |
|-----|----------|
| `[GRIEVES-EDA-2012]` | Grieves, M. et al. "Event-Driven Manufacturing Process Management." In: *Advances in Production Management Systems*, Springer LNCS, pp. 120-128, 2012. DOI: 10.1007/978-3-642-32885-5_9 |
| `[BADER-2022]` | Bader, S. et al. "Development of an Event-Driven System Architecture for Smart Manufacturing." In: *IFIP Advances in Information and Communication Technology*, vol. 663, Springer, 2022. DOI: 10.1007/978-3-031-08757-8_38 |
| `[LU-NIST-2016]` | Lu, Y., Morris, K.C., and Frechette, S. "Current Standards Landscape for Smart Manufacturing Systems." NIST IR 8107, 2016. https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=920863 |
| `[LEITAO-2017]` | Leitao, P. et al. "Auto-configurable Event-Driven Architecture for Smart Manufacturing." In: *Proceedings of IECON 2017*, IEEE, 2017. https://www.researchgate.net/publication/319385894 |
| `[PEREZ-2025]` | Perez, L. et al. "Smart Manufacturing: MLOps-Enabled Event-Driven Architecture for Enhanced Control in Steel Production." arXiv:2511.17632, 2025. https://arxiv.org/html/2511.17632 |
| `[NIST-PARADIGM]` | Lu, Y., Morris, K.C., and Frechette, S. "The Paradigm Shift in Smart Manufacturing System Architecture." In: *IFIP Advances in Information and Communication Technology*, vol. 492, Springer, pp. 767-776, 2016. DOI: 10.1007/978-3-319-51133-7_90 |
| `[EDA-ENERGY-2021]` | Gonzalez-Gil, P. et al. "Event-Driven Interoperable Manufacturing Ecosystem for Energy Consumption Monitoring." *Energies*, 14(12), 3620, MDPI, 2021. DOI: 10.3390/en14123620 |
| `[IIOT-REVIEW-2023]` | Liu, S. et al. "Industrial Internet of Things Intelligence Empowering Smart Manufacturing: A Literature Review." arXiv:2312.16174, 2023. https://arxiv.org/html/2312.16174v1 |
| `[NOA-OPCUA-2023]` | Schulz, D. et al. "A Cloud-Native Software Architecture of NAMUR Open Architecture Verification of Request using OPC UA PubSub Actions over MQTT." In: *Proceedings of ETFA 2023*, IEEE, 2023. DOI: 10.1109/ETFA54631.2023.10275714 |
| `[OPCUA-TSN-2018]` | Pfrommer, J. et al. "Open Source OPC UA PubSub over TSN for Realtime Industrial Communication." In: *Proceedings of ETFA 2018*, IEEE, 2018. DOI: 10.1109/ETFA.2018.8502479 |
| `[AAS-DT-2024]` | Becker, F. et al. "Digital Twin and the Asset Administration Shell." *Software and Systems Modeling*, Springer, 2024. DOI: 10.1007/s10270-024-01255-0 |
| `[FAULT-PROP-2025]` | Chen, J. et al. "Fault Propagation in Complex Industrial Equipment." *Journal of Engineering Design*, 2025. DOI: 10.1080/09544828.2025.2608659 |

### Industrial IoT & Alarm Management

| Key | Citation |
|-----|----------|
| `[EEMUA-191]` | Engineering Equipment and Materials Users' Association. "Alarm Systems: A Guide to Design, Management and Procurement." Publication No. 191, 3rd ed., 2013. |
| `[BRANSBY-ALARM]` | Bransby, M.L. and Jenkinson, J. "The Management of Alarm Systems." HSE Contract Research Report 166, UK Health and Safety Executive, 1998. |
| `[HOLLIFIELD]` | Hollifield, B.R. and Habibi, E. *The Alarm Management Handbook.* 2nd ed., PAS (now Hexagon), 2010. ISBN: 978-0977896929 |
| `[ISA-TR18.2]` | ISA-TR18.2.6. "Alarm Systems for Batch and Discrete Processes." ISA Technical Report, 2012. |
| `[UNS-HIVEMQ]` | HiveMQ. "Designing Your Unified Namespace (UNS) Semantic Information Hierarchy." 2024. https://www.hivemq.com/solutions/manufacturing/unified-namespace/ |
| `[UNS-WALKER]` | Walker Reynolds. "The Unified Namespace: Why It's the Foundation of Industrial IoT." 2023. |
| `[UNS-CEDALO]` | Cedalo. "What Is Unified Namespace (UNS) and Its Role in Industry 4.0." 2024. https://cedalo.com/blog/unified-namespace-uns/ |
| `[UNS-CIRRUSLINK]` | Cirrus Link. "Understanding the Unified Namespace (UNS) in Industrial IoT." 2024. https://cirrus-link.com/understanding-the-unified-namespace-uns-in-industrial-iot/ |
| `[UNS-FLOWFUSE]` | FlowFuse. "Why the Automation Pyramid Blocks Digital Transformation — The Role of Unified Namespace." 2023. https://flowfuse.com/blog/2023/08/isa-95-automation-pyramid-to-unified-namespace/ |
| `[UNS-PROSYS]` | Prosys OPC. "OPC UA PubSub Explained." 2024. https://prosysopc.com/blog/opc-ua-pubsub-explained/ |
| `[NOA-BELDEN]` | Belden. "What You Need to Know About NAMUR Open Architecture." 2023. https://www.belden.com/blog/what-you-need-to-know-about-namur-open-architecture |
| `[NOA-VS-UNS]` | United Manufacturing Hub. "NAMUR Open Architecture versus Unified Namespace: Two Sides of the Same Coin?" 2024. https://learn.umh.app/course/unified-namespace-versus-namur-differences-and-similarities/ |
| `[ISA95-BEYOND-PYRAMID]` | ISA InTech. "Beyond the Pyramid: Using ISA-95 for Industry 4.0 and Smart Manufacturing." October 2021. https://www.isa.org/intech-home/2021/october-2021/features/beyond-the-pyramid-using-isa95-for-industry-4-0-an |
| `[ISA95-SMART-MFG]` | ISA InTech. "ISA-95 Evolves to Support Smart Manufacturing and IIoT." November 2017. https://www.isa.org/intech-home/2017/november-december/features/isa-95-to-support-smart-manufacturing-iiot |
| `[ISA95-AGE-I40]` | Nauni, M. "ISA-95 in the Age of Industry 4.0: Relevance and the Path Forward." 2024. https://mayanknauni.com/?p=4808 |
| `[ISA95-2025-UPDATE]` | Industrial Cyber. "New ISA-95 Standard Enhances IT/OT Convergence for Industrial Automation." 2025. https://industrialcyber.co/regulation-standards-and-compliance/new-isa-95-standard-enhances-it-ot-convergence-for-industrial-automation/ |
| `[RHIZE-ISA95]` | Rhize. "Is ISA-95 Relevant? Reframing Perspective on ISA-95." 2024. https://rhize.com/blog/reframing-perspective-on-isa95/ |
| `[SOLACE-ISA95]` | Solace. "Modeling Events in Accordance with ISA-95." 2023. https://solace.com/blog/modeling-events-isa-95/ |
| `[RAMI40-EC]` | Schweichhart, K. "Reference Architectural Model Industrie 4.0 (RAMI 4.0) — An Introduction." European Commission Futurium, 2016. https://ec.europa.eu/futurium/en/system/files/ged/a2-schweichhart-reference_architectural_model_industrie_4.0_rami_4.0.pdf |

### Platform & Implementation References

| Key | Citation |
|-----|----------|
| `[KAFKA]` | Apache Software Foundation. "Apache Kafka Documentation." https://kafka.apache.org/documentation/ |
| `[NATS-KV]` | Synadia Communications. "NATS Key-Value Store." https://docs.nats.io/nats-concepts/jetstream/key-value-store |
| `[NATS-LEAFNODE]` | Synadia Communications. "NATS Leaf Nodes." https://docs.nats.io/running-a-nats-service/configuration/leafnodes |
| `[NATS-COMPARE]` | Synadia Communications. "Compare NATS." https://docs.nats.io/nats-concepts/overview/compare-nats |
| `[NATS-DEDUP-INF]` | Synadia Communications. "Infinite Message Deduplication in JetStream." NATS Blog, 2022. https://nats.io/blog/new-per-subject-discard-policy/ |
| `[NATS-DISCUSS-3908]` | nats-io/nats-server GitHub. "Discussion #3908: Ordering Guarantees Per Entity." https://github.com/nats-io/nats-server/discussions/3908 |
| `[NATS-VS-KAFKA]` | Synadia Communications. "NATS and Kafka Compared." https://www.synadia.com/blog/nats-and-kafka-compared |
| `[NATS-VS-KAFKA-UNS]` | i-flow GmbH. "NATS vs. Kafka: Comparison for the Unified Namespace (UNS)." https://i-flow.io/en/ressources/nats-vs-kafka-comparison-for-the-uns/ |
| `[AZURE-DT]` | Microsoft. "Azure Digital Twins Documentation." https://learn.microsoft.com/en-us/azure/digital-twins/ |
| `[AWS-TWINMAKER]` | Amazon Web Services. "AWS IoT TwinMaker." https://docs.aws.amazon.com/iot-twinmaker/ |
| `[AWS-IOT-EVENTS]` | Amazon Web Services. "AWS IoT Events Developer Guide." https://docs.aws.amazon.com/iotevents/ |
| `[RABBITMQ-STREAMS]` | VMware/Broadcom. "RabbitMQ Streams." https://www.rabbitmq.com/docs/streams |
| `[IEC-61508]` | IEC 61508. "Functional Safety of Electrical/Electronic/Programmable Electronic Safety-related Systems." IEC, 2010. |

### Vendor Documentation — IIoT Platforms

| Key | Citation |
|-----|----------|
| `[SIEMENS-INSIGHTS]` | Siemens AG. "Insights Hub (formerly MindSphere) — Industrial IoT as a Service." https://www.siemens.com/global/en/products/software/insights-hub.html |
| `[SIEMENS-EDGE]` | Siemens AG. "Industrial Edge — Edge Computing for Industrial Automation." https://www.siemens.com/global/en/products/automation/topic-areas/industrial-edge.html |
| `[SIEMENS-MQTT]` | Siemens AG. "Industrial Edge MQTT Connector and Data Integration." In: Siemens Industrial Edge Documentation, 2024. |
| `[SIEMENS-OPCUA-PUBSUB]` | Siemens AG. "OPC UA PubSub Support in SIMATIC and Industrial Edge." In: Siemens Industrial Automation Documentation, 2024. |
| `[SIEMENS-KAFKA]` | Siemens AG. "Apache Kafka Integration for Industrial Edge and Insights Hub." In: Siemens Industrial Edge App Development Documentation, 2024. |
| `[TWX-EVENTS]` | PTC Inc. "ThingWorx Events and Subscriptions." In: ThingWorx Platform Documentation, 2024. https://support.ptc.com/help/thingworx/platform/ |
| `[TWX-SUBSCRIPTIONS]` | PTC Inc. "ThingWorx Subscription Model — Property Change Events." In: ThingWorx Developer Documentation, 2024. |
| `[TWX-ALWAYSON]` | PTC Inc. "ThingWorx AlwaysOn Protocol — Persistent WebSocket Communication." In: ThingWorx Edge Documentation, 2024. |
| `[TWX-ALWAYSON-IP]` | PTC Inc. "AlwaysOn Protocol — Intellectual Property and Binary WebSocket Transport." In: ThingWorx SDK Documentation, 2024. |
| `[TWX-KEPWARE]` | PTC Inc. "Kepware KEPServerEX — Industrial Connectivity Platform." https://www.ptc.com/en/products/kepware |
| `[TWX-VALUESTREAM]` | PTC Inc. "ThingWorx Value Stream — Time-Series Data Storage." In: ThingWorx Data Storage Documentation, 2024. |
| `[TWX-THROUGHPUT]` | PTC Inc. "ThingWorx Platform Sizing and Performance — 100K+ Properties Per Second." In: ThingWorx Sizing Guide, 2024. |
| `[TWX-SPARK-2025]` | PTC Inc. "ThingWorx + Apache Spark Integration for Real-Time Analytics." In: ThingWorx Analytics Documentation, 2025. |
| `[AVEVA-SP]` | AVEVA Group plc. "AVEVA System Platform — Supervisory HMI and SCADA." https://www.aveva.com/en/products/system-platform/ |
| `[AVEVA-PI]` | AVEVA Group plc (formerly OSIsoft). "AVEVA PI System — Real-Time Data Infrastructure for Industrial Operations." https://www.aveva.com/en/products/aveva-pi-system/ |
| `[AVEVA-OMI]` | AVEVA Group plc. "AVEVA Operations Management Interface (OMI) — Unified Operations View." https://www.aveva.com/en/products/operations-management-interface/ |
| `[AVEVA-SP-2023R2]` | AVEVA Group plc. "AVEVA System Platform 2023 R2 Release Notes — Enhanced Cloud Integration and Containerization." AVEVA, 2023. |
| `[RA-OPTIX]` | Rockwell Automation. "FactoryTalk Optix — Next-Generation HMI and Visualization." https://www.rockwellautomation.com/en-us/products/software/factorytalk/operationsuite/optix.html |
| `[RA-PLEX]` | Rockwell Automation. "Plex Smart Manufacturing Platform — Cloud-Native MES/ERP." https://www.rockwellautomation.com/en-us/products/software/plex.html |
| `[RA-HUB]` | Rockwell Automation. "FactoryTalk Hub — Cloud-Based Industrial Software." https://www.rockwellautomation.com/en-us/products/software/factorytalk/factorytalk-hub.html |
| `[GEV-CIMPLICITY]` | GE Vernova. "CIMPLICITY HMI/SCADA — Industrial Monitoring and Control." https://www.gevernova.com/software/products/cimplicity |
| `[GEV-HISTORIAN]` | GE Vernova. "Proficy Historian — High-Performance Time-Series Database for Industrial Data." https://www.gevernova.com/software/products/proficy-historian |
| `[GEV-APM]` | GE Vernova. "Asset Performance Management (APM) — Predictive Analytics for Industrial Assets." https://www.gevernova.com/software/products/apm |
| `[GEV-PROFICY-2025]` | GE Vernova. "Proficy Smart Factory 2025 — Unified Manufacturing Intelligence." GE Vernova Software Documentation, 2025. |
| `[GEV-ALARM-CAST]` | GE Vernova. "CIMPLICITY Alarm Viewer and Alarm Management." In: CIMPLICITY Documentation, 2024. |
| `[IGN-PLATFORM]` | Inductive Automation. "Ignition Platform — Industrial Application Platform." https://inductiveautomation.com/ignition/ |
| `[IGN-TAGS]` | Inductive Automation. "Ignition Tag System — Real-Time Tag Model and Tag Change Events." In: Ignition User Manual, 2024. https://docs.inductiveautomation.com/docs/8.1/platform/tags |
| `[IGN-PERSPECTIVE]` | Inductive Automation. "Ignition Perspective Module — Web-Based Visualization with Session Bindings." In: Ignition User Manual, 2024. https://docs.inductiveautomation.com/docs/8.1/getting-started/modules/perspective |
| `[IGN-SPARKPLUG]` | Inductive Automation. "Ignition MQTT Engine and Sparkplug-B Integration." In: Ignition Cirrus Link Module Documentation, 2024. https://docs.chariot.io/display/CLD/MQTT+Engine |
| `[IGN-GATEWAY-PERF]` | Inductive Automation. "Ignition Gateway Performance and Scaling — 10M+ Tags." In: Ignition Architecture Documentation, 2024. |
| `[IGN-ARCHITECTURE]` | Inductive Automation. "Ignition Architecture: Gateway Network, Redundancy, and Scale-Out." In: Ignition User Manual, 2024. https://docs.inductiveautomation.com/docs/8.1/platform/gateway-network |
| `[AWS-SITEWISE]` | Amazon Web Services. "AWS IoT SiteWise — Industrial Data Collection and Monitoring." https://docs.aws.amazon.com/iot-sitewise/ |
| `[AWS-SITEWISE-NOTIFY]` | Amazon Web Services. "AWS IoT SiteWise Property Notifications via MQTT Topics." In: AWS IoT SiteWise Developer Guide, 2024. |
| `[AZURE-DT-ROUTING]` | Microsoft. "Azure Digital Twins Event Routes — Routing Events to Downstream Services." In: Azure Digital Twins Documentation, 2024. https://learn.microsoft.com/en-us/azure/digital-twins/concepts-route-events |
| `[AZURE-DT-NOTIFY]` | Microsoft. "Azure Digital Twins Event Notifications — Twin Change and Lifecycle Events." In: Azure Digital Twins Documentation, 2024. https://learn.microsoft.com/en-us/azure/digital-twins/concepts-event-notifications |
| `[AZURE-DT-TWIN2TWIN]` | Microsoft. "Azure Digital Twins Twin-to-Twin Event Processing via Azure Functions." In: Azure Digital Twins Tutorials, 2024. https://learn.microsoft.com/en-us/azure/digital-twins/tutorial-end-to-end |
| `[AZURE-DT-PERF]` | Microsoft. "Azure Digital Twins Service Limits and Performance — Query Latency and Throughput." In: Azure Digital Twins Documentation, 2024. https://learn.microsoft.com/en-us/azure/digital-twins/reference-service-limits |
| `[AZURE-DT-SCALEOUT]` | Microsoft. "Azure Digital Twins Scale-Out Patterns for Large Twin Graphs." In: Azure Architecture Center, 2024. |
| `[GCP-IOT-ARCH]` | Google Cloud. "Cloud IoT Architecture — Device Management, Pub/Sub, and Analytics." In: Google Cloud Architecture Center. https://cloud.google.com/architecture/connected-devices |
| `[GCP-IOT-RETIRED]` | Google Cloud. "Cloud IoT Core Retirement Notice — Service Discontinued August 2023." Google Cloud Blog, 2023. https://cloud.google.com/iot-core |

---

## Internal Research Documents

| Key | Citation |
|-----|----------|
| `[TMNL-CLUSTER]` | Val et al. "Research: @effect/cluster Distributed Entity Patterns." `docs/specifications/research-cluster-patterns.md`, 2026-02-09. |
| `[TMNL-ARCH-OPT]` | Val et al. "Research: Architecture Options Analysis — 5 Approaches for Entity-Realtime Integration." `docs/specifications/research-architecture-options.md`, 2026-02-09. |
| `[TMNL-UNS]` | Val et al. "Research: UNS Metropolitan Patterns for IIoT Event Distribution." `docs/specifications/research-uns-metropolitan.md`, 2026-02-09. |
| `[TMNL-ADR-001]` | "ADR-001: NATS-Only Broker Architecture." `docs/decisions/adr-001-nats-only-broker.md`. |
| `[TMNL-ADR-004]` | "ADR-004: Entity System Architecture (Machine + Cluster)." `docs/decisions/adr-004-entity-system-architecture.md`. |
| `[TMNL-MFG-COMMONS]` | Val (realtime-philosopher). "Research: Manufacturing Commons — Platform Economics for Metropolitan-Scale IIoT." `docs/specifications/research-manufacturing-commons.md`, 2026-02-09. |
| `[TMNL-EFFECT-ARCH]` | Val et al. "Research: Effect-TS Architecture Patterns for 200K-Org Manufacturing Network." `docs/specifications/research-effect-architecture.md`, 2026-02-09. |
| `[TMNL-EDGE]` | TMNL RFC-001 — Section E: Edge-First Architecture. `docs/specifications/rfc-section-edge-architecture.md`. This document. |
| `[TMNL-MULTITENANT]` | TMNL RFC-001 — Section Y: Multi-Tenant Manufacturing Network Architecture. `docs/specifications/rfc-section-multi-tenant-network.md`. This document. |
| `[TMNL-SECURITY]` | TMNL RFC-001 — Section Z: Security, Trust & Tenant Isolation. `docs/specifications/rfc-section-security-trust.md`. This document. |

### Pending Research (will be added as agents complete)

| Key | Citation | Status |
|-----|----------|--------|
| `[TMNL-REACTIVE-ISA95]` | "Research: Reactive ISA-95 Design." `docs/specifications/research-reactive-isa95.md` | **Complete** |
| `[TMNL-THEORY]` | "Research: Theoretical Foundations — Cognitive Science for IIoT Interfaces." `docs/specifications/research-theoretical-foundations.md` | **Complete** |
| `[TMNL-CONSISTENCY]` | "Research: Consistency Models for Metropolitan-Scale IIoT." `docs/specifications/research-consistency-models.md` | **Complete** |
| `[TMNL-INDUSTRY]` | "Research: Industry Leaders — Competitive Analysis of IIoT Realtime Platforms." `docs/specifications/research-industry-leaders.md` | **Complete** |
| `[TMNL-EFFECT-ARCH]` | "Research: Effect-TS Architecture Patterns for 200K-Org Manufacturing Network." `docs/specifications/research-effect-architecture.md` | **Complete** |

---

## How to Cite

### In RFC sections

```markdown
The observer pattern leverages `Machine.changes` [EFFECT-MACHINE] to capture
all state transitions without handler modification. Per-entity causal ordering
is guaranteed by the cluster's mailbox serialization [EFFECT-CLUSTER, Section 4.3],
consistent with Lamport's foundational work on event ordering [LAMPORT-1978].
```

### In research documents

```markdown
Endsley's three-level model of situational awareness [ENDSLEY-1995] provides
the theoretical foundation for understanding how operators process real-time
industrial data. Level 1 (perception) maps directly to raw sensor telemetry;
Level 2 (comprehension) requires entity state context; Level 3 (projection)
demands trend analysis and predictive capabilities [ENDSLEY-2012, Chapter 3].
```

### Cross-referencing research

```markdown
The UNS subject hierarchy [TMNL-UNS] follows patterns established by HiveMQ
[UNS-HIVEMQ] and the United Manufacturing Hub [UMH], adapted for our ISA-95
entity types per [ISA-95-1] and [ISA-95-2].
```

---

## Revision Log

| Date | Change |
|------|--------|
| 2026-02-09 | Initial bibliography — 60+ entries across 8 categories |
| 2026-02-09 | Added NATS-specific refs: JETSTREAM-DEEPDIVE, JETSTREAM-CONSUMERS, JETSTREAM-STREAMS, NATS-COMPARE, NATS-DEDUP-INF, NATS-DISCUSS-3908, NATS-VS-KAFKA, NATS-VS-KAFKA-UNS. Added AWS-IOT-EVENTS, RABBITMQ-STREAMS, IEC-61508, BAILIS-EC. Marked TMNL-CONSISTENCY complete. |
| 2026-02-09 | Added 6 new categories: Microservices Architecture (17 entries, microservices.io + Newman), Domain-Driven Design (7 entries, Evans/Vernon), Database Theory (10 entries, Kleppmann/Dynamo/Spanner/Calvin), Event-Driven Architecture (6 entries, Hohpe/Stopford/Reactive), Platform Economics (7 entries, Ostrom/Parker/Coase), Multi-Tenancy & Trust (6 entries, NIST/SPIFFE/NATS). Marked TMNL-REACTIVE-ISA95 complete. Total: 120+ entries across 14 categories. |
| 2026-02-09 | effect-specialist: Added 12 Effect-TS framework refs: EFFECT-HASHRING, EFFECT-RPCGROUP, EFFECT-RPCMIDDLEWARE, EFFECT-RPCSERVER, EFFECT-SCHEMA, EFFECT-STREAM, EFFECT-PUBSUB, EFFECT-LAYER, EFFECT-FIBERREF, EFFECT-VITEST, EFFECT-LAYERMAP. Added TMNL-EFFECT-ARCH internal research. Marked TMNL-EFFECT-ARCH complete. Total: 165+ entries. |
| 2026-02-09 | isa95-architect: Added 30+ entries for Reactive ISA-95 research. New: ISA-95-8, ISA-95-2025, IEC-63278, AAS-SPEC, NATS-SUBJECTS, NATS-SUBJECTMAP, B2MML-V7, MESA-MODEL, MESA-SMART. New category: Smart Manufacturing & EDA (12 academic papers: GRIEVES-EDA-2012, BADER-2022, LU-NIST-2016, LEITAO-2017, PEREZ-2025, NIST-PARADIGM, EDA-ENERGY-2021, IIOT-REVIEW-2023, NOA-OPCUA-2023, OPCUA-TSN-2018, AAS-DT-2024, FAULT-PROP-2025). Added 14 industry analysis refs: UNS-CEDALO, UNS-CIRRUSLINK, UNS-FLOWFUSE, UNS-PROSYS, NOA-BELDEN, NOA-VS-UNS, ISA95-BEYOND-PYRAMID, ISA95-SMART-MFG, ISA95-AGE-I40, ISA95-2025-UPDATE, RHIZE-ISA95, SOLACE-ISA95, RAMI40-EC. Total: 150+ entries. |
| 2026-02-09 | industry-analyst: Added new "Vendor Documentation — IIoT Platforms" category with 40 entries covering Siemens (5), PTC ThingWorx (8), AVEVA (4), Rockwell (3), GE Vernova (5), Ignition (6), AWS (2), Azure (5), Google Cloud (2). Marked TMNL-INDUSTRY complete. Total: 190+ entries across 15 categories. |
| 2026-02-09 | industry-analyst: Added 11 entries for 200K-org manufacturing network reframe. New in Platform Economics: DMC-COMMONS, MAAS-ADOPTERS, MAAS-CATENAX, MAAS-FRAMEWORK, MAAS-PRICING. New category "Manufacturing Network & Federation": NATS-ADAPTIVE-EDGE, NATS-EDGE-DEPLOY, NATS-RETAIL-EDGE, NATS-IOT-SCALE, ACTIVITYPUB. Total: 200+ entries across 16 categories. |
| 2026-02-09 | consistency-theorist: Added 10 entries for cross-org consistency research: IDS-RAM, IDS-SOVEREIGNTY, SFW-MARKETPLACE, XOMETRY-PLATFORM, ENDSLEY-TEAM-SA, DISTRIBUTED-SA, FEDERATED-DT, MARKET-MICROSTRUCTURE, NATS-JWT. Total: 210+ entries. |
| 2026-02-09 | interface-visionary: Added 10 entries to Cognitive Science & Human Factors: ENDSLEY-OOTL, EID-NPP, WOODS-STRETCHED, WOODS-FOUR, RASMUSSEN-1986, PIROLLI-1999, RASMUSSEN-CSE, LEVESON-2004, LEE-MULTITIME, LEE-ICII. Converted research-theoretical-foundations.md to canonical [KEY] citations. Total: 220+ entries. |
| 2026-02-09 | interface-visionary: Added Section 9 "Manufacturing Commons Extension" to research-theoretical-foundations.md (4 new architectural principles P9-P12, persona spectrum, three realtime regimes, distributed SA, redacted causality, Ostrom's governance, two-zone IFT model). Added WARD-SMARTPHONE-COG to bibliography. Fixed section renumbering (10/11). Total: 225+ entries. |
| 2026-02-09 | industry-analyst: Bibliography completeness audit. Fixed 7 citation key typos across rfc-section-reactive-isa95.md and rfc-section-network-entities.md. Added 7 new entries: ISA-18-2, NATS-GATEWAY, OTEL, RFC8446, TMNL-EDGE, TMNL-MULTITENANT, TMNL-SECURITY. Total: 232+ entries. |
