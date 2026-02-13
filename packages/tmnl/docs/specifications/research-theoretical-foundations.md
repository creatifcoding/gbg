# Theoretical Foundations for IIoT Entity-Realtime Integration

**Date**: 2026-02-09
**Author**: interface-visionary (Val)
**Status**: Complete
**Purpose**: Establish the cognitive science, human factors, and systems theory foundations that inform the architecture of TMNL-RFC-001 entity-realtime integration. Theory that informs architecture, not product comparison.

---

## 1. Situational Awareness Theory

### 1.1 Endsley's Three-Level Model

The foundational theory of operator awareness in complex dynamic systems comes from Endsley's 1995 model [ENDSLEY-1995], which defines three hierarchical levels:

| Level | Name | Definition | IIoT Mapping |
|-------|------|------------|--------------|
| **SA Level 1** | Perception | Detection and recognition of relevant environmental elements | Raw sensor readings, alarm states, equipment status indicators arriving in real-time streams |
| **SA Level 2** | Comprehension | Integration of Level 1 elements into meaningful patterns | Aggregated line/plant status, trend analysis, ISA-95 hierarchy roll-ups (Machine FAULTED -> Line DEGRADED) |
| **SA Level 3** | Projection | Prediction of future states based on current comprehension | Predictive maintenance forecasts, production schedule impact, failure cascade modeling |

**Key insight for architecture**: Each SA level maps directly to a different data delivery pattern and latency requirement:

- **Level 1 (Perception)** requires raw, low-latency streams (< 100ms for critical sensors). This is the **subscription** tier -- individual sensor readings, alarm state changes, equipment status transitions. The entity-realtime system MUST deliver these without comprehension overhead.

- **Level 2 (Comprehension)** requires computed aggregations delivered on a slower cadence (100ms-1s). This is where ISA-95 hierarchy propagation becomes critical -- the system computes "Line DEGRADED" from constituent machine states. Per Endsley, operators with strong Level 1 but weak Level 2 SA "were aware of low level data but had less comprehension of what the data meant in relation to operational goals" [ENDSLEY-1995, p. 36].

- **Level 3 (Projection)** tolerates higher latency (seconds to minutes) but demands temporal completeness -- the operator needs historical event sequences to project forward. This is where event sourcing and replay semantics directly serve cognitive needs.

### 1.2 The Out-of-the-Loop Problem

Endsley and Kiris [ENDSLEY-OOTL] identified the "out-of-the-loop performance problem": as automation increases, operator SA degrades, particularly at Level 2 (comprehension). Higher automation creates a passive monitoring role, leading to:

1. **Complacency** -- over-reliance on automation reduces monitoring vigilance
2. **Skill decay** -- operators lose the manual intervention capabilities they need during automation failure
3. **SA degradation** -- operators monitoring automated systems show significantly lower comprehension than those in manual or intermediate-automation conditions

**Architectural implication**: The entity-realtime system must NOT fully automate the operator's comprehension layer. Instead, it should provide **configural displays** (see Section 2) that make ISA-95 hierarchy state *perceptually evident* rather than hiding it behind automated summaries. The subscription model should deliver both raw entity events (Level 1) and hierarchy aggregations (Level 2) so the operator actively constructs understanding.

The Three Mile Island nuclear disaster exemplifies the danger: operators had Level 1 data (individual indicators) but lacked Level 2 comprehension of what the combined state meant [LEVESON-STAMP, Ch. 1].

### 1.3 SA and Alarm Flooding

In SCADA control rooms, alarm floods destroy SA at all three levels [ISA-18.2]. An operator managing sixteen displays with concurrent phone calls and video links faces sensory overload that collapses perception before comprehension can even begin.

Endsley's 50 design principles for SA-centered design [ENDSLEY-2012] include:

- **Principle 1**: Organize information around goals, not data sources
- **Principle 8**: Present Level 2 information directly (don't force the operator to compute it from Level 1 data)
- **Principle 12**: Support global SA -- provide overview displays that show the big picture

**Mapping to entity-realtime**: The subscription model must support **hierarchical subscription depth** -- subscribing at the Plant level should deliver Level 2 aggregations by default, with drill-down to Line/Machine/Sensor exposing Level 1 detail on demand. This mirrors SA-centered progressive disclosure: enterprise-level shows projection (Level 3), plant-level shows comprehension (Level 2), sensor-level shows perception (Level 1).

### 1.4 SAGAT/SART Measurement Framework

Endsley developed the Situation Awareness Global Assessment Technique (SAGAT) [ENDSLEY-1995] as an objective freeze-probe measure of SA, validated across 243 studies. SART (Situation Awareness Rating Technique) provides complementary subjective ratings. Crucially, SAGAT and SART are uncorrelated -- operators often believe they have good SA when they do not.

**Design implication**: The entity-realtime system should be testable against SA metrics. Hierarchical subscription patterns can be evaluated for whether they support Level 1/2/3 SA using SAGAT-style probes in simulator environments.

---

## 2. Ecological Interface Design (EID)

### 2.1 Origins and Core Principles

Ecological Interface Design was proposed by Vicente and Rasmussen in 1992 [EID-VICENTE] as a framework for interfaces in complex, real-time, dynamic sociotechnical systems. EID is built on two pillars:

**Pillar 1: Abstraction Hierarchy (AH)** -- a five-level means-ends decomposition of the work domain [RASMUSSEN-AH]:

| Level | Name | Description | IIoT/ISA-95 Equivalent |
|-------|------|-------------|------------------------|
| 1 (Top) | **Functional Purpose** | Overall system goals and values | Enterprise KPIs: OEE, throughput, safety targets |
| 2 | **Abstract Function** | Causal structure, conservation laws, flow balances | Energy balance, material flow, production rate equations |
| 3 | **Generalized Function** | Generic functional building blocks | Heating, mixing, conveying, sensing, actuating |
| 4 | **Physical Function** | How generalized functions are physically implemented | Specific motor, sensor model, PLC program |
| 5 (Bottom) | **Physical Form** | Appearance, layout, spatial configuration | Equipment location, panel layout, wiring topology |

Moving **down** the hierarchy answers "how?" -- how is a goal achieved? Moving **up** answers "why?" -- why does this component exist?

**Pillar 2: Skills, Rules, Knowledge (SRK) Framework** [RASMUSSEN-1983]:

| Behavior Level | Cognitive Demand | Error Type | Interface Support |
|----------------|-----------------|------------|-------------------|
| **Skill-based** | Lowest (automatic response) | Slips, lapses | Direct perception -- signals map to time-space coordinates |
| **Rule-based** | Moderate (if-then matching) | Rule selection errors | Signs -- consistent indicators that activate stored procedures |
| **Knowledge-based** | Highest (reasoning from principles) | Conceptual mistakes | Symbols -- abstract representations supporting problem-solving |

### 2.2 EID Design Principles for IIoT

EID's core goal: "make constraints and complex relationships in the work environment perceptually evident to the user" [EID-VICENTE]. This frees cognitive resources for higher-order problem solving.

**EID Principle 1**: In the form of *signals* -- support skill-based behavior by providing a direct, time-space mapping of physical parameters. For IIoT: real-time sensor streams displayed as analog indicators, trend lines, and spatial mimic diagrams.

**EID Principle 2**: Provide a consistent one-to-one mapping between work domain constraints and cues -- support rule-based behavior with reliable *signs*. For IIoT: consistent color coding, alarm states per ISA-18.2, and status indicators that always mean the same thing regardless of context.

**EID Principle 3**: Represent the work domain in the form of an abstraction hierarchy to support knowledge-based behavior -- support problem-solving with *symbols* that reveal causal structure. For IIoT: configural displays that show energy/material flow balances, enabling operators to reason about novel failures from first principles.

### 2.3 The Abstraction Hierarchy IS ISA-95

This is the critical theoretical bridge: **Rasmussen's Abstraction Hierarchy and the ISA-95 equipment hierarchy are structurally isomorphic.**

| AH Level | ISA-95 Level | Data Granularity | Subscription Tier |
|----------|-------------|------------------|-------------------|
| Functional Purpose | Enterprise | KPIs, strategic metrics | Minutes cadence |
| Abstract Function | Site / Plant | Aggregate flows, efficiency | 1-10s cadence |
| Generalized Function | Line / Area | Process step status | 100ms-1s cadence |
| Physical Function | Machine / Work Cell | Equipment state, control signals | 10-100ms cadence |
| Physical Form | Sensor / Device | Raw measurements, I/O states | 1-10ms cadence |

**This means ISA-95 hierarchy navigation IS ecological interface navigation.** When an operator drills from Enterprise to Plant to Line to Machine to Sensor, they are traversing the Abstraction Hierarchy from Functional Purpose to Physical Form. The entity-realtime subscription model should mirror this traversal -- subscribing at a higher level provides higher-abstraction data at lower frequency, while drilling down delivers lower-abstraction data at higher frequency.

### 2.4 EID Empirical Evidence

EID has been empirically validated in nuclear power plant control rooms, where ecological displays significantly improved operator SA compared to traditional mimic-based displays, specifically for unanticipated events without procedural support [EID-NPP]. The improvement was strongest for knowledge-based behavior -- exactly the scenario where operators face novel failures outside their training.

**Architectural requirement**: The entity-realtime system must support **configural displays** that reveal causal relationships across the hierarchy. When a sensor anomaly cascades to machine fault to line degradation, the causal chain must be visible as a connected pattern, not as three independent alarm notifications. The event model must preserve causality metadata (which entity caused which state change) to enable this.

---

## 3. Joint Cognitive Systems and Resilience Engineering

### 3.1 Hollnagel and Woods: The "Jointness" Principle

Hollnagel and Woods [HOLLNAGEL-JCS] reframe the human-machine relationship: the unit of analysis is not the human OR the machine, but the **joint cognitive system** (JCS). The system's cognitive work -- monitoring, diagnosing, planning, executing -- is distributed across human and automated components.

Key JCS principles relevant to entity-realtime design:

1. **Distributed cognition**: The IIoT platform and the operator together form the cognitive system. The platform handles data collection, pattern detection, and hierarchy aggregation (computational strengths). The operator handles contextual judgment, exception handling, and goal prioritization (human strengths). The interface must support this division.

2. **Common ground maintenance**: The platform and operator must maintain shared understanding of system state. When the platform detects an anomaly, the operator must be able to understand *why* the platform flagged it. Event sourcing provides the common ground -- both human and system can reconstruct the sequence of events that led to the current state.

3. **Graceful degradation**: When automation fails, the JCS must degrade gracefully rather than catastrophically. The entity-realtime system must allow operators to smoothly take over manual monitoring when automated aggregations or predictions become unreliable.

### 3.2 Hollnagel's ETTO Principle

The Efficiency-Thoroughness Trade-Off (ETTO) principle [HOLLNAGEL-ETTO] states that in practice, people and organizations systematically trade thoroughness for efficiency. Under time pressure, operators will skip verification steps, rely on shortcuts, and accept approximate information.

**Design implication**: The entity-realtime system must make the *efficient* path also the *thorough* path. If the subscription model requires operators to manually navigate to each entity to check status (effortful), they will stop checking. If the subscription model pushes relevant status changes to the operator's current context (efficient), thoroughness is built into the workflow.

### 3.3 Resilience Engineering: Four Cornerstones

Hollnagel's resilience engineering framework [WOODS-RESILIENCE] defines four capabilities that resilient systems (human + technical) must exhibit:

| Cornerstone | Definition | Entity-Realtime Mapping |
|-------------|-----------|-------------------------|
| **Respond** | Adjust functioning to handle current disruptions | Real-time entity state streaming, alarm routing, immediate operator notification |
| **Monitor** | Watch for threats in the near term | Continuous subscription streams, trend detection, threshold monitoring |
| **Anticipate** | Foresee future disruptions | Predictive analytics from event history, projection from Level 3 SA |
| **Learn** | Extract lessons from experience | Event sourcing replay, shift handoff journals, post-incident temporal queries |

**The entity-realtime system directly enables all four cornerstones.** Real-time streams support Respond and Monitor. Event sourcing supports Learn. Temporal queries and trend analysis support Anticipate. This is not a feature-level mapping -- it is a fundamental alignment between the architectural pattern (reactive event-driven entity state) and the cognitive requirements of resilient operation.

### 3.4 Woods' Law of Stretched Systems

David Woods [WOODS-STRETCHED] articulates a fundamental law of complex adaptive systems: **"Every system is stretched to operate at its capacity. As soon as there is some improvement, some new technology, we exploit it to achieve a new intensity and tempo of activity."**

This has a direct and uncomfortable implication for IIoT platforms: adding real-time entity streaming capability will NOT reduce operator workload. Instead, organizations will exploit the capability to expand the operator's monitoring scope -- more machines, more lines, more plants per operator. The safety margin that the new capability could have provided is consumed by productivity pressure.

**Architectural defense**: The entity-realtime system must build in structural resistance to overextension:

1. **Subscription capacity limits** -- maximum concurrent entity subscriptions per operator session, configurable by role. Not a soft recommendation; a hard system constraint.
2. **SA degradation detection** -- if an operator's subscription scope exceeds empirically-validated SA capacity (research suggests 7 +/- 2 active monitoring channels per Endsley's work), the system should emit warnings.
3. **Workload indicators** -- the system should surface meta-information about operator cognitive load (subscription count, event rate, alarm density) to supervisors.

### 3.5 Woods' Four Concepts of Resilience

Woods [WOODS-FOUR] refines "resilience" into four distinct concepts, each with different architectural implications:

| Concept | Definition | IIoT System Property |
|---------|-----------|---------------------|
| **Rebound** | Recovery from disruption back to equilibrium | Event sourcing enables system state reconstruction after failure; replay semantics restore consistency |
| **Robustness** | Continue functioning across a range of disturbances | Per-entity isolation (cluster sharding) prevents fault propagation; one entity crash does not cascade |
| **Graceful Extensibility** | Stretch to handle surprises beyond design envelope | Formative subscription model (CWA principle) -- operators compose novel views for novel situations |
| **Sustained Adaptability** | Maintain adaptive capacity across lifecycle | Architecture must support schema evolution, new entity types, new hierarchy levels without redesign |

The critical concept is **graceful extensibility** -- the opposite of brittleness. A brittle system works perfectly within its design envelope and fails catastrophically outside it. A gracefully extensible system degrades proportionally as conditions exceed expectations.

For entity-realtime: when event rates exceed subscription capacity, the system should **shed load intelligently** (drop low-priority entity updates, reduce update frequency, aggregate more aggressively) rather than failing entirely or delivering stale data without warning. This maps directly to the backpressure strategies in the streaming architecture (sliding vs. dropping vs. bounded PubSub channels).

---

## 4. Information Foraging Theory

### 4.1 Pirolli and Card's Optimal Foraging Model

Information Foraging Theory (IFT) [PIROLLI-CARD] applies optimal foraging theory from behavioral ecology to how humans navigate information environments. The core analogy: just as animals seek food by following scent trails between patches, operators seek information by following cues between data sources.

Key IFT constructs:

| Concept | Ecological Analogy | IIoT Application |
|---------|-------------------|-------------------|
| **Information Patch** | Food source | An entity view (machine dashboard, plant overview, alarm panel) |
| **Information Scent** | Olfactory cues | Visual cues indicating relevant data (status colors, trend arrows, count badges) |
| **Information Diet** | Prey selection | Decision about which entities to investigate vs. ignore |
| **Between-Patch Navigation** | Travel between food sources | Navigation between ISA-95 hierarchy levels |
| **Within-Patch Exploitation** | Foraging within a source | Examining details of a specific entity's state and history |

### 4.2 Information Scent in ISA-95 Navigation

The critical design question: **how does an operator decide which branch of the ISA-95 hierarchy to investigate?**

IFT predicts that operators follow information scent -- perceptual cues that indicate the likely value of pursuing a path. In the entity-realtime context, information scent is generated by:

1. **Status propagation indicators**: When a Machine enters FAULTED state, the parent Line's status changes to DEGRADED. This propagated status change IS the information scent -- it tells the operator "there is something worth investigating down this branch."

2. **Event count badges**: "3 new alarms in Line-007" provides quantitative scent about patch richness.

3. **Trend indicators**: Rising temperature trend icons on a machine tile signal that the patch contains time-sensitive information.

4. **Recency cues**: "Last event 2 seconds ago" vs "Last event 3 hours ago" signals active vs. quiescent patches.

**Architectural requirement**: The subscription model must deliver not just entity state, but **scent metadata** -- information that helps operators decide where to navigate next without having to open each entity. This means hierarchy-level subscriptions must include summary statistics (alarm count, worst-child-status, trend direction) that serve as navigation cues.

### 4.3 Patch Switching and the Cost of Navigation

IFT's marginal value theorem predicts that foragers leave a patch when the rate of information gain drops below the average rate achievable by switching to another patch. In IIoT terms: operators stop investigating a machine when the diminishing returns of further detail fall below the expected value of checking another machine.

**Design implication**: Navigation between ISA-95 levels must be low-cost. The subscription system should support **pre-fetching** -- when an operator is viewing a Plant, the system should already be streaming summary data for all child Lines so that drilling down is instantaneous. High navigation cost (loading spinners, query delays) increases the effective "travel time" between patches and degrades foraging efficiency.

### 4.4 ACT-IF: Computational Model of Information Foraging

Pirolli's ACT-IF model [PIROLLI-2007] formalizes scent-following as production rules: if a navigation cue (link text, status indicator, badge) contains "trigger words" relevant to the operator's current task, the operator follows that path. The more trigger cues present, the stronger the scent.

**Mapping to subscriptions**: Each entity in the hierarchy should expose a computed "relevance summary" that serves as information scent for its parent level. The entity-realtime system computes these summaries as derived state from the event stream -- not as separate queries, but as part of the subscription's natural data flow.

---

## 5. Cognitive Work Analysis (CWA)

### 5.1 Five Dimensions of CWA

Cognitive Work Analysis [CWA-VICENTE] provides a systematic framework for analyzing, designing, and evaluating work in complex sociotechnical systems. CWA comprises five analytical dimensions:

| Dimension | Analysis Focus | IIoT Design Concern |
|-----------|---------------|---------------------|
| **Work Domain Analysis** | What constraints exist in the work domain? | ISA-95 hierarchy structure, physical process constraints, safety limits |
| **Control Task Analysis** | What must be done? | Monitoring tasks, alarm response procedures, maintenance workflows |
| **Strategies Analysis** | How can tasks be accomplished? | Manual vs. automated monitoring, exception-based vs. polling-based observation |
| **Social Organization** | Who does what? | Operator roles, shift handoff, multi-operator coordination at COP |
| **Worker Competencies** | What skills/knowledge are needed? | SRK levels for different operator experience levels |

### 5.2 CWA's Formative vs. Normative Approach

Traditional interface design is **normative** -- it prescribes specific workflows and penalizes deviation. CWA's **formative** approach instead identifies constraints and lets operators adapt within those constraints.

This distinction is critical for IIoT:

- **Normative approach**: "When alarm X fires, operator MUST navigate to Machine Y, check readings A, B, C, then execute procedure P." This breaks when the situation doesn't match the pre-defined procedure.

- **Formative approach**: "Alarm X indicates a constraint violation in the heat exchange subsystem. Here is the current state of all related entities. The operator decides the investigation path based on their understanding." This supports adaptation to novel situations.

**Architectural implication**: The entity-realtime subscription model must not enforce a single navigation path. It must support **unconstrained exploration** -- operators should be able to subscribe to any entity or combination of entities at any hierarchy level, composing their own view of the situation. The system provides the data streams; the operator structures their own understanding.

### 5.3 CWA and the Abstraction-Decomposition Space

CWA extends Rasmussen's Abstraction Hierarchy into the **Abstraction-Decomposition Space (ADS)** by adding a decomposition dimension (whole system -> subsystem -> component) orthogonal to the abstraction dimension.

For IIoT, this produces a two-dimensional navigation space:

```
                    Whole System    Subsystem      Component
                    (Enterprise)    (Plant/Line)   (Machine/Sensor)
                    ============    ============   ================
Functional Purpose  | OEE target   | Line yield   | Machine uptime
Abstract Function   | Total flow   | Process rate  | Heat balance
Generalized Funct.  | Production   | Assembly     | Welding
Physical Function   | Fleet status | Motor states  | Servo position
Physical Form       | Floor plan   | Cell layout   | Wiring diagram
```

**The entity-realtime subscription model naturally maps to ADS navigation**: the ISA-95 hierarchy provides the decomposition axis, while the data granularity (KPIs -> process metrics -> raw readings) provides the abstraction axis. A single subscription can be parameterized along both dimensions -- "give me Physical Function data for the Line subsystem level" = machine-level equipment states for all machines on a specific line.

### 5.4 Rasmussen's Decision Ladder

The Decision Ladder [RASMUSSEN-1986] is CWA's primary tool for modeling operator decision-making activity. It maps the cognitive states (knowledge) and cognitive processes (information processing) required for decision-making in complex systems.

**Structure**: The full ladder traces a canonical path from detection to execution:

```
ACTIVATION (detect need for action)
  |
  v
OBSERVATION (perceive system state)        <-- Left side: situation assessment
  |
  v
IDENTIFICATION (recognize system state)
  |
  v
INTERPRETATION (evaluate consequences)
  |
  v
EVALUATION (determine priorities)          <-- Top: goal-level reasoning
  |
  v
GOAL SELECTION (define target state)
  |
  v
TASK DEFINITION (plan response)            <-- Right side: planning/execution
  |
  v
PROCEDURE SELECTION (choose method)
  |
  v
EXECUTION (carry out action)
```

**The critical feature: shortcuts.** Experienced operators do NOT follow the full ladder. They take two types of shortcuts:

- **Shunts**: Skip cognitive processes (e.g., jump from OBSERVATION directly to TASK DEFINITION -- "I see the temperature rising, I know to reduce feed rate" without explicitly identifying the state or evaluating alternatives).
- **Leaps**: Skip between knowledge states (e.g., jump from IDENTIFICATION directly to PROCEDURE SELECTION -- "That pattern means motor bearing failure -- execute bearing replacement procedure").

These shortcuts correspond directly to Rasmussen's SRK levels:
- **Knowledge-based**: Full ladder traversal (novice or novel situation)
- **Rule-based**: Shunts across the ladder (experienced operator, recognized situation)
- **Skill-based**: Leaps from bottom-left to bottom-right (expert, automatic response)

**IIoT implications for event presentation**:

1. **Support shortcuts, don't prevent them.** When an experienced operator sees a familiar alarm pattern, the system should enable direct jump to the relevant procedure -- not force them through a sequential diagnostic workflow.

2. **But preserve the full ladder for novel situations.** When the operator encounters an unfamiliar alarm combination, the system must provide sufficient context (system state, consequence assessment, available procedures) to support full knowledge-based reasoning.

3. **Event sequencing supports OBSERVATION -> IDENTIFICATION.** The entity-realtime system's event stream provides the raw observation data; the hierarchy aggregation provides the identification context. Both must be available simultaneously.

4. **Temporal queries support INTERPRETATION.** "Has this happened before? What was the outcome?" -- event sourcing replay directly supports the interpretation step of the decision ladder.

5. **The formative principle means the system provides all ladder nodes, not just the prescribed path.** Different operators at different experience levels will enter and exit the ladder at different points. The subscription model must make all relevant data accessible regardless of which cognitive path the operator follows.

---

## 6. Cyber-Physical Systems Theory

### 6.1 Lee's Temporal Semantics Problem

Edward Lee's work on CPS [LEE-CPS] identifies the fundamental challenge: **programs lack temporal semantics.** The behavior of a physical process is strongly affected by the timing of its inputs, but software provides at best weak control over timing.

For IIoT entity-realtime integration, this manifests as:

1. **Network-induced timing uncertainty**: Sensor readings arrive with variable latency. The entity state at time T may not match the physical state at time T.
2. **Event ordering ambiguity**: Events from multiple sensors may arrive out of physical-time order.
3. **Simultaneity loss**: Two sensors that fire simultaneously in the physical world arrive as sequential events in the digital world.

Lee and colleagues developed two approaches to address this:

- **PRET (Precision Timed)**: Making timing precision of synchronous digital logic available at the software level -- deterministic execution.
- **Ptides**: Programming temporally-integrated distributed embedded systems -- a model for deterministic distributed CPS.

**Architectural mapping**: The entity-realtime system must acknowledge timing uncertainty explicitly. Event timestamps should use physical-time (when it happened) vs. system-time (when it was received). The consistency model should define which guarantees hold under which timing conditions. The Ptides approach suggests using timestamp-based ordering with configurable "safe time" windows to buffer for late-arriving events.

### 6.2 Rajkumar's CPS Architecture Requirements

Rajkumar et al. [RAJKUMAR-CPS] define CPS as systems where "physical and engineering systems whose operations are monitored, coordinated, controlled, and integrated by a computing and communication core." They identify key architectural requirements:

1. **Real-time resource allocation**: Networks must provide QoS guarantees -- not best-effort delivery.
2. **Data aggregation**: In-network processing reduces bandwidth while maintaining information quality.
3. **Global snapshots**: The ability to capture consistent system state across distributed components.
4. **In-network decision making**: Pushing computation toward data sources to reduce latency.

**Mapping to entity-realtime**: These requirements directly inform the subscription architecture:
- QoS per subscription tier (critical alarms get guaranteed delivery; historical queries tolerate delay)
- Hierarchy aggregation as data reduction (plant-level subscription aggregates from thousands of sensor streams)
- Event sourcing provides global snapshot capability via temporal queries
- Edge processing (Sparkplug protocol) performs in-network data aggregation before entity state updates

### 6.3 CPS and Non-Determinism in Event-Driven Systems

The fundamental tension: event-driven architecture (EDA) is inherently non-deterministic -- event arrival order depends on network conditions, processing load, and race conditions. Yet safety-critical CPS requires deterministic behavior.

Resolution strategies from CPS theory:

| Strategy | Mechanism | Trade-off |
|----------|-----------|-----------|
| **Synchronous execution** | Lock-step processing | Latency floor = slowest component |
| **Bounded non-determinism** | Time-triggered architecture with bounded arrival windows | Requires worst-case timing analysis |
| **Causal ordering** | Logical clocks (Lamport) + causal delivery guarantees | Latency for ordering overhead |
| **Eventual convergence** | CRDTs + conflict-free merge | Temporary inconsistency acceptable |

**Architectural decision**: For IIoT entity-realtime, **bounded non-determinism with causal ordering** is the appropriate model. Per-entity causal ordering (guaranteed by mailbox serialization in @effect/cluster [TMNL-CLUSTER]) combined with bounded time windows for cross-entity ordering provides deterministic-enough behavior for manufacturing without the latency penalty of full synchronous execution.

---

## 7. Safety-Critical Event-Driven Architecture

### 7.1 Leveson's STAMP Framework

Nancy Leveson's Systems-Theoretic Accident Model and Processes (STAMP) [LEVESON-STAMP] reframes safety as a control problem rather than a failure/reliability problem. The core concept is **constraints** rather than events -- accidents result from inadequate enforcement of safety constraints on system behavior.

STAMP's three components:
1. **Safety constraints** -- what must be maintained
2. **Hierarchical control structure** -- who/what enforces constraints
3. **Process models** -- the mental/computational model of system state used for control

**Critical insight for entity-realtime**: The entity hierarchy (ISA-95) IS a hierarchical control structure in STAMP terms. Each level enforces constraints on the level below:
- Enterprise enforces production targets on Sites
- Plant enforces safety limits on Lines
- Line enforces sequence constraints on Machines
- Machine enforces physical limits on Sensors/Actuators

The entity-realtime system must make these constraint relationships explicit and observable. When a constraint is violated (machine exceeds temperature limit), the violation must propagate UP the hierarchy as an observable event -- this is the safety-critical version of status cascade propagation.

### 7.2 STPA: Hazard Analysis for Event-Driven Systems

STAMP's analytical technique, Systems-Theoretic Process Analysis (STPA), identifies hazardous control actions:

1. **Control action not provided** -- entity state change event not delivered (message loss)
2. **Unsafe control action provided** -- incorrect entity state delivered (data corruption)
3. **Control action at wrong time** -- entity event arrives too late for operator response (latency violation)
4. **Control action stopped too soon / applied too long** -- subscription drops silently / stale data persists

Each of these maps to a failure mode in the entity-realtime system:

| STPA Hazard | Entity-Realtime Failure | Mitigation |
|-------------|------------------------|------------|
| Not provided | JetStream message loss | At-least-once delivery + consumer acknowledgment |
| Unsafe action | Corrupted entity state | Schema validation at serialization boundary |
| Wrong time | Event arrives after SLA | Per-stream latency monitoring + timeout escalation |
| Stopped/persisted | Silent subscription drop / stale display | Heartbeat protocol + freshness indicators |

### 7.3 Event Sourcing in Safety-Critical Systems

Event sourcing has been adopted in safety-critical domains (aviation, medical devices) because it provides:

1. **Complete audit trail** -- every state change is recorded as an immutable event
2. **Temporal query capability** -- "what was the state at time T?" for incident investigation
3. **Deterministic replay** -- given the same event sequence, produce the same state (essential for forensic analysis)
4. **Regulatory compliance** -- satisfies FDA 21 CFR Part 11 [FDA-CFR11] electronic records requirements

However, event sourcing in safety-critical systems faces a tension with eventual consistency: if event projections are eventually consistent, the operator may see stale state during the convergence window. For IIoT:

- **Write path (event capture)**: Must be strongly consistent per-entity -- events must be ordered and durable before acknowledgment.
- **Read path (projections)**: Can be eventually consistent for non-critical displays, but MUST be strongly consistent for alarm/safety-critical displays.
- **Consistency boundary**: The per-entity mailbox serialization in @effect/cluster provides the write-path strong consistency. The read-path consistency depends on the subscription delivery model.

---

## 8. Synthesis: Theoretical Requirements for Entity-Realtime Architecture

### 8.1 Cross-Theory Convergence

These seven theoretical frameworks converge on remarkably consistent architectural requirements:

| Requirement | SA Theory | EID | JCS/RE | IFT | CWA | CPS | STAMP |
|-------------|-----------|-----|--------|-----|-----|-----|-------|
| Hierarchical subscription model | Level 1/2/3 mapping | AH levels | -- | Patch navigation | ADS traversal | Data aggregation | Control hierarchy |
| Causal chain visibility | Level 2 comprehension | Configural display | Common ground | -- | Decision ladder support | Causal ordering | Constraint propagation |
| Status cascade propagation | Level 2 -> Level 3 bridge | Means-ends links | Graceful extensibility | Information scent | -- | Global snapshot | Safety constraint flow |
| Event sourcing / temporal queries | Level 3 projection | -- | Learn cornerstone | -- | Strategies analysis | Deterministic replay | Audit trail |
| Low-cost hierarchy navigation | -- | -- | ETTO principle | Marginal value theorem | Unconstrained exploration | In-network processing | -- |
| Freshness / timing guarantees | Level 1 perception fidelity | Signal mapping | Monitor cornerstone | Recency cues | -- | Temporal semantics | Wrong-time hazard |
| Overload resistance | SA degradation detection | -- | Law of Stretched Systems | Patch saturation | -- | QoS budgets | -- |
| Shortcut support for experts | -- | SRK skill/rule mapping | -- | -- | Decision ladder shunts/leaps | -- | -- |
| Graceful load shedding | -- | -- | Graceful extensibility | -- | Formative adaptation | Bounded non-determinism | -- |
| Formative (not normative) navigation | -- | SRK support | Distributed cognition | Foraging flexibility | Formative approach | -- | -- |

### 8.2 Derived Architectural Principles

From the theoretical convergence, seven non-negotiable architectural principles:

**P1: Hierarchy-Aware Subscriptions (SA + EID + CWA)**
Subscribe at any ISA-95 level with configurable depth and abstraction. Higher levels deliver comprehension-ready (Level 2) aggregations; lower levels deliver perception-ready (Level 1) raw data.

**P2: Causal Chain Preservation (EID + STAMP + CPS)**
Events must carry causality metadata. When Machine-001 FAULTS causing Line-007 to DEGRADE, the Line-007 event must reference Machine-001 as the causal antecedent. This enables configural displays and incident investigation.

**P3: Information Scent Propagation (IFT + SA)**
Each entity must expose computed summary metadata (alarm count, worst-status, trend direction) that serves as navigation scent for parent entities. This metadata is part of the subscription payload, not a separate query.

**P4: Temporal Completeness for Projection (SA + Event Sourcing + STAMP)**
The event store must support temporal queries ("state at time T") and deterministic replay. Operators use these for Level 3 SA (projection), shift handoff (Learn cornerstone), and incident forensics (STAMP audit trail).

**P5: Bounded-Latency Delivery (CPS + SA + STAMP)**
Each subscription tier has a defined latency SLA. Critical alarms: < 100ms. Entity state changes: < 500ms. Hierarchy aggregations: < 2s. Violation of these SLAs is a monitorable failure condition, not a silent degradation.

**P6: Graceful Extensibility Under Load (JCS + SA out-of-loop + Woods)**
When automated aggregations or predictions fail, the system must fall back to raw entity streams that the operator can interpret manually. When event rates exceed capacity, the system must shed load intelligently (reduce update frequency, aggregate more aggressively) rather than failing entirely. Full automation blackout must never leave the operator without data. This is Woods' graceful extensibility -- the opposite of brittleness.

**P7: Unconstrained Navigation (CWA + IFT)**
The subscription model must not enforce navigation paths. Operators must be able to compose arbitrary entity combinations into custom views, subscribe to cross-hierarchy entity groups, and restructure their information space in real-time. The Decision Ladder must be traversable at any entry point -- experts skip to procedures, novices reason from first principles.

**P8: Overload Resistance (Law of Stretched Systems + SA)**
The system must structurally resist the organizational tendency to exploit new capability as increased operator scope. Configurable subscription capacity limits per operator session, SA degradation warnings when monitoring channels exceed cognitive capacity, and workload indicators visible to supervisors.

### 8.3 Theory-to-Implementation Mapping

| Principle | Implementation Mechanism | @effect/cluster Feature |
|-----------|------------------------|------------------------|
| P1 | `Realtime.SubscribeHierarchy({ level, depth, abstraction })` RPC | Entity sharding by ISA-95 level |
| P2 | `causedBy: EntityAddress[]` field on all state-change events | Per-entity mailbox preserves local causality |
| P3 | `EntitySummary` computed state in parent entity handlers | Entity handlers aggregate child state |
| P4 | JetStream event storage + temporal query RPCs | `MessageStorage` with `Persisted` annotation |
| P5 | Per-stream latency monitoring + timeout-based escalation | `EntityReaper` + custom health checks |
| P6 | Backpressure-aware channels (sliding/dropping/bounded) + raw fallback | Multiple subscription channels (raw + computed) |
| P7 | Client-defined subscription sets, not server-defined views | `RpcGroup` supports arbitrary subscription composition |
| P8 | `maxSubscriptions` per session + event rate monitoring + supervisor dashboard | Cluster-level operator session tracking |

---

## 9. Manufacturing Commons Extension: From Enterprise IIoT to 200K-Org Network

### 9.1 The Persona Spectrum Problem

Sections 1-8 of this document assume an **enterprise IIoT** context: a single organization with dedicated control rooms, professional operators, and deep ISA-95 hierarchies. The actual system serves a **metropolitan manufacturing commons** — approximately 200,000 organizations in the Atlanta, Georgia region, spanning the full spectrum:

| Persona | Organization | ISA-95 Depth | Interface | Cognitive Context |
|---------|-------------|-------------|-----------|-------------------|
| **Earl** | 2-person machine shop, 2 CNC machines | 1 level (machine = shop) | Phone in pocket, tablet on wall | Machinist-first, monitoring secondary |
| **Maria** | 15-person contract manufacturer, 3 lines | 3-4 levels | Desktop + 2 monitors | Dedicated production manager, part-time operator |
| **Boeing Atlanta** | 500+ employees, complex assembly | 7 levels | Control room, 16+ screens | Dedicated operators, shift teams, ISA-18.2 alarm management |

**This is not a minor variation — it is a fundamentally different cognitive task environment.** The theories in Sections 1-8 must be reinterpreted through this lens.

### 9.2 SA Theory Reinterpreted: Three Realtime Regimes

Endsley's SA model [ENDSLEY-1995] assumes an individual operator monitoring a single domain. In the manufacturing commons, SA operates at three distinct scales, each with different latency requirements and cognitive demands:

| Regime | Latency | SA Level | Who Cares | Cognitive Task |
|--------|---------|----------|-----------|----------------|
| **Equipment realtime** | 1-100ms | Individual SA Level 1 | Machine operator | Physical safety, process control |
| **Shop realtime** | 1-60s | Individual SA Level 2 | Shop owner (Earl) | Job status, machine health, daily planning |
| **Network realtime** | 1-300s | Distributed SA | Network participants | Capacity matching, supply chain resilience |

For Earl, equipment realtime is irrelevant most of the time — his CNC runs a 4-hour job. Shop realtime is his primary concern: "Is my machine running? When does this job finish? Am I available for the next order?" Network realtime is where his shop becomes valuable to others: "Earl's shop just became AVAILABLE for 5-axis aluminum."

**Critical insight**: The SA levels do not just map to different data rates — they map to different **social structures**. Equipment SA is individual. Shop SA is organizational. Network SA is collective.

### 9.3 Distributed Situation Awareness: The Network as Cognitive System

Stanton et al. [DISTRIBUTED-SA] extend SA from individual cognition to **distributed situation awareness (DSA)**: awareness that is emergent property of a sociotechnical system, not the sum of individual awarenesses. In DSA:

- Each agent (person, organization, automated system) holds a **partial, overlapping** view of the situation
- No single agent has complete SA — completeness is a property of the **system**
- Awareness is distributed across agents AND artifacts (including the platform itself)

**Mapping to manufacturing commons**:

| DSA Concept | Manufacturing Commons Equivalent |
|-------------|----------------------------------|
| Agent | Individual organization (Earl's shop, Boeing) |
| Artifact | The TMNL platform — aggregates, routes, displays collective state |
| Compatible SA | Two shops with matching capabilities see compatible views of the order book |
| Transactive Memory | The network "knows" who can make what — no individual knows all capabilities |
| SA Transactions | One shop's AVAILABLE event changes another shop's competitive landscape |

**Architectural requirement**: The platform IS a cognitive artifact in the DSA framework. It does not just display information — it actively participates in the distributed cognition of the manufacturing commons. The subscription model must therefore serve both individual SA (Earl watching his machines) and collective SA (the network monitoring aggregate capacity).

### 9.4 The Abstraction Hierarchy Extends Above Enterprise

The structural isomorphism between Rasmussen's Abstraction Hierarchy and ISA-95 (Section 2.3) remains valid within an organization. But the manufacturing commons adds hierarchy levels ABOVE Enterprise:

```
Manufacturing Commons     (collective KPIs: regional capacity, utilization, resilience)
  Regional Network         (Atlanta: aggregate capabilities, availability by capability type)
    Organization           (Earl's Shop: reputation, capacity, availability, capability set)
      [ISA-95 levels]      (flexible depth: 1 level for Earl, 7 for Boeing)
        Equipment           (machines, sensors — the traditional IIoT domain)
```

This produces two distinct navigation zones with different cognitive requirements:

**Intra-org zone** (ISA-95 levels and below):
- Traditional EID navigation — Abstraction Hierarchy traversal
- Information scent = equipment status propagation
- Causal chains are internal, fully visible
- The operator IS the cognitive agent

**Inter-org zone** (Organization level and above):
- Network topology navigation — capability and availability discovery
- Information scent = capacity signals, reputation, availability status
- Causal chains cross sovereignty boundaries — must be redacted (see Section 9.6)
- The platform IS the cognitive artifact mediating between agents

### 9.5 Variable-Depth Hierarchy and the Formative Principle

CWA's formative approach [CWA-VICENTE] becomes essential for variable-depth hierarchies. A normative approach would require Earl to configure his ISA-95 hierarchy (Enterprise > Site > Area > Line > Machine). A formative approach lets the system adapt:

**For Earl (1 level)**: Machine state = Shop state. No aggregation needed. The "subscription model" is a push notification.

**For Maria (3-4 levels)**: Plant has lines, lines have machines. Status propagation computes "Line DEGRADED" from machine states. Standard EID navigation applies.

**For Boeing (7 levels)**: Full ISA-95 hierarchy. SA Level 1/2/3 mapping per Section 1. Control room operators navigate the full Abstraction-Decomposition Space.

The formative principle demands that the system **does not force hierarchy configuration on small shops**. Earl should be able to connect a CNC and start participating in the network. The hierarchy should emerge from equipment relationships, not from administrative configuration.

**Rasmussen's Decision Ladder [RASMUSSEN-1986] applies differently across the persona spectrum**:
- **Earl**: Almost entirely skill-based (leaps). He hears the machine stop, walks over, checks the display. The system's value is in network presence, not in decision support.
- **Maria**: Mix of rule-based (shunts) and skill-based. She recognizes alarm patterns across her three lines.
- **Boeing operator**: Full ladder traversal for novel situations, shunts for recognized patterns. The system provides the full decision support infrastructure.

### 9.6 Redacted Causality Across Organizational Boundaries

Principle P2 (Causal Chain Preservation) must be reinterpreted for cross-org events. Within an organization, full causality is visible: Machine FAULT -> Line DEGRADED -> alarm. Across organizations, causality crosses sovereignty boundaries.

**Scenario**: Boeing subcontracts a titanium component to Earl. Earl's CNC faults mid-job.

| Observer | What They See | SA Level |
|----------|--------------|----------|
| **Earl** | CNC-001 FAULTED (spindle motor overcurrent). Job #47 halted. Network status: UNAVAILABLE. Order rerouted by network. | Full causality, Level 1+2 |
| **Boeing supply chain** | "Supplier experienced capacity disruption. Order rerouted to Shop B. ETA updated." | Abstract signal, Level 2 |
| **Shop B** | "New order received. Compatible with your 5-axis capability. Deadline: Thursday." | Market signal, Level 1 |

**This is not eventual consistency — it is intentional information redaction.** Each org sees a projection of the causal chain filtered through authorization boundaries. The cognitive science term is **information asymmetry** — and it is both a privacy requirement and a cognitive optimization (Earl doesn't need to know Boeing's full production schedule).

The EID configural display principle (Section 2) applies within boundaries. Across boundaries, the display must show **abstract relational signals** rather than raw causal chains.

### 9.7 Ostrom's Commons Governance Principles

Elinor Ostrom's eight design principles for governing the commons [OSTROM-COMMONS] provide theoretical grounding for the manufacturing network's governance structure. These were developed for natural resource commons but have been applied to digital commons and platform cooperatives:

| Ostrom Principle | Manufacturing Commons Application |
|-----------------|-----------------------------------|
| **1. Clearly defined boundaries** | Each org's data sovereignty boundary. What is shared vs. private. |
| **2. Proportional equivalence between benefits and costs** | Participants who share more availability data get better network matching. |
| **3. Collective-choice arrangements** | Network governance — who sets capability taxonomies, quality standards. |
| **4. Monitoring** | Platform monitors availability claims against actual performance. Reputation system. |
| **5. Graduated sanctions** | Shops that consistently misrepresent availability lose network priority. |
| **6. Conflict resolution mechanisms** | Dispute resolution for order rerouting, quality disputes. |
| **7. Minimal recognition of rights to organize** | Small shops have equal governance voice. Not pay-to-play. |
| **8. Nested enterprises** | Regional networks within the national commons. Atlanta network as a governance unit. |

**Architectural implication**: The entity-realtime system is not just a data pipeline — it is **governance infrastructure**. Availability events are commitments. Machine state changes affect reputation. The subscription model mediates commons governance by making behavior observable.

### 9.8 Information Foraging in a Two-Zone Model

The IFT patch/scent model (Section 4) applies differently in each zone:

**Intra-org foraging** (Earl navigating his own equipment):
- **Patch** = machine view, sensor detail
- **Scent** = status colors, trend arrows, alarm counts
- **Navigation cost** = tap to drill down (low on phone, lower on desktop)
- **Cognitive budget** = limited (phone + shop noise + manual work)

**Inter-org foraging** (network participant discovering capacity):
- **Patch** = organization profile, capability listing, availability calendar
- **Scent** = availability status, capability match score, reputation indicator, proximity
- **Navigation cost** = search/filter on capability + geography (must be very low)
- **Cognitive budget** = varies (Earl checking phone vs. Boeing procurement analyst)

**The critical design insight from IFT**: For small-shop owners using phones, the cost of between-patch navigation must approach zero. If Earl has to navigate three screens to see if he has new orders, he will stop checking. The system must PUSH relevant information — the phone notification IS the information patch.

Research on smartphone cognitive effects [WARD-SMARTPHONE-COG] confirms this: mobile users process information less deeply and are less vigilant than desktop users. The platform must compensate by delivering pre-digested, actionable information to phone users — not raw event streams.

### 9.9 Updated Architectural Principles for Manufacturing Commons

The eight principles from Section 8.2 remain valid for intra-org concerns. The manufacturing commons adds four new principles:

**P9: Variable-Depth Hierarchy (CWA Formative + EID)**
The system must support ISA-95 hierarchies from 1 level (Earl) to 7+ levels (Boeing) without requiring administrative configuration for simple cases. Equipment registration should infer hierarchy from relationships. The subscription model must degenerate gracefully: for a flat hierarchy, "subscribe to shop" = "subscribe to machine."

**P10: Distributed SA Mediation (DSA + JCS)**
The platform mediates between individual SA (each org's view of their equipment) and collective SA (the network's view of aggregate capacity). Events cross org boundaries as abstract signals, not raw data. The platform computes collective awareness that no single participant possesses.

**P11: Sovereignty-Preserving Causality (STAMP + Ostrom)**
Causal chains must be fully preserved within org boundaries but redacted to authorized abstractions when crossing boundaries. "Supplier experienced disruption" is a valid causal signal. "Supplier's spindle motor drew 47A" is not. The redaction boundary is configurable per trust relationship.

**P12: Commons Governance Observability (Ostrom + Resilience Engineering)**
The platform must make participant behavior observable for commons governance. Availability commitments, fulfillment rates, quality metrics, and response times are governance data — not just operational data. The subscription model serves double duty: operational awareness for participants AND governance monitoring for the commons.

---

## 10. Implications for RFC-001

### 10.1 What the Theory Tells Us We MUST Build

1. **ISA-95 hierarchy IS the user's cognitive navigation structure** (EID + CWA). The subscription model must mirror the hierarchy exactly -- not approximate it, not flatten it, not add extra levels.

2. **Status cascade propagation is not a feature -- it is the mechanism of SA Level 2** (Endsley). Without automatic, reactive, sub-second propagation of worst-child-status up the hierarchy, operators cannot achieve comprehension.

3. **Event sourcing is not a technical choice -- it is a cognitive requirement** (SA Level 3 + Resilience Engineering Learn cornerstone + STAMP audit trail). The ability to query "what happened and why" is fundamental to projection, learning, and safety.

4. **The subscription model must deliver information scent** (IFT). Bare entity state changes are insufficient -- operators need navigational metadata to make foraging decisions efficiently.

5. **Latency SLAs must be formally defined and monitored** (CPS + STAMP). "Best effort" delivery is not acceptable for safety-critical systems. Each subscription tier has a latency budget derived from cognitive response requirements.

6. **The system must resist organizational overextension** (Law of Stretched Systems). New capability will be consumed as expanded operator scope unless the system structurally limits subscription density and surfaces cognitive load indicators.

7. **Expert shortcuts must be first-class** (Decision Ladder + SRK). The subscription model and event presentation must support both the novice's full decision ladder traversal AND the expert's shunts and leaps. Forcing sequential workflows on experienced operators destroys efficiency; providing only shortcuts leaves novices lost.

### 10.2 What the Theory Tells Us We Must NOT Build

1. **Do not build fully automated comprehension layers** (SA out-of-loop problem). The system should compute and present aggregated state, but the operator must remain in the loop for interpretation. Automated "everything is fine" summaries create complacency.

2. **Do not enforce navigation workflows** (CWA formative principle). The subscription model must be composable and operator-driven, not prescriptive wizard-style flows.

3. **Do not hide causality behind aggregate status** (EID configural display principle). "Line DEGRADED" without visible connection to "Machine-003 FAULTED due to Sensor TMP-007 exceeding 95C" destroys the operator's ability to reason about the situation.

4. **Do not treat all subscriptions equally** (CPS QoS, STAMP hazard classification). Safety-critical alarm streams have different reliability and latency requirements than historical trend queries.

---

## 11. Bibliography

All citations use keys from the canonical bibliography [bibliography.md].

### Primary Theoretical Sources

| Key | Relevance to RFC |
|-----|-----------------|
| `[ENDSLEY-1995]` | SA Level 1/2/3 model -- foundation for subscription tier design |
| `[ENDSLEY-2012]` | 50 SA design principles -- validation criteria for interface patterns |
| `[EID-VICENTE]` | Abstraction Hierarchy + SRK -- theoretical basis for ISA-95 navigation |
| `[RASMUSSEN-1983]` | SRK framework -- operator behavior classification |
| `[RASMUSSEN-AH]` | Abstraction Hierarchy -- structural isomorphism with ISA-95 |
| `[CWA-VICENTE]` | Five-dimension CWA framework -- formative design approach |
| `[HOLLNAGEL-JCS]` | Joint Cognitive Systems -- human-machine collaboration model |
| `[HOLLNAGEL-ETTO]` | ETTO principle -- efficiency-thoroughness trade-off in design |
| `[WOODS-RESILIENCE]` | Four cornerstones of resilience -- respond, monitor, anticipate, learn |
| `[PIROLLI-CARD]` | Information Foraging Theory -- navigation and scent model |
| `[PIROLLI-2007]` | ACT-IF computational model -- formalized scent following |
| `[LEE-CPS]` | CPS temporal semantics -- timing uncertainty in distributed systems |
| `[RAJKUMAR-CPS]` | CPS architecture requirements -- QoS, aggregation, snapshots |
| `[LEVESON-STAMP]` | STAMP accident model -- safety as control problem |
| `[SHNEIDERMAN]` | Visual Information Seeking Mantra -- overview, zoom, filter, details-on-demand |

### Supporting Sources

| Key | Relevance |
|-----|-----------|
| `[ISA-18.2]` | Alarm management standard -- alarm state model for entity events |
| `[ISA-95-1]` | Equipment hierarchy standard -- structural basis for AH mapping |
| `[FDA-CFR11]` | Regulatory requirement for event sourcing audit trail |
| `[ENDSLEY-2000]` | SA measurement validation -- SAGAT methodology |
| `[TMNL-CLUSTER]` | Internal: @effect/cluster entity lifecycle patterns |
| `[EVENT-SOURCING]` | Fowler's event sourcing definition |
| `[REACTIVE-MANIFESTO]` | Responsive, resilient, elastic, message-driven |

### Works Consulted (Now Cited via Bibliography Keys)

| Key | Relevance |
|-----|-----------|
| `[ENDSLEY-OOTL]` | Out-of-the-loop performance problem -- SA degradation under automation |
| `[EID-NPP]` | Empirical validation of EID in nuclear process control |
| `[WOODS-STRETCHED]` | Law of Stretched Systems -- capability consumed as expanded scope |
| `[WOODS-FOUR]` | Four concepts for resilience -- rebound, robustness, graceful extensibility, sustained adaptability |
| `[RASMUSSEN-1986]` | Decision Ladder original formulation -- cognitive process model for operator decision-making |
| `[PIROLLI-1999]` | Extended information foraging model -- patch model and scent formalization |
| `[RASMUSSEN-CSE]` | Cognitive Systems Engineering -- Abstraction-Decomposition Space methodology |
| `[LEVESON-2004]` | STAMP precursor paper -- systems-theoretic accident model |
| `[LEE-MULTITIME]` | Multiform time -- temporal semantics for distributed CPS |
| `[LEE-ICII]` | Deterministic timing for Industrial IoT |

---

*This document provides the cognitive science and systems theory foundation for TMNL-RFC-001. Architectural decisions in the RFC should be traceable to the principles derived here. When in doubt, the theoretical frameworks provide the decision criteria: does this design choice support SA? Does it preserve EID's configural display capability? Does it satisfy STAMP's constraint propagation requirements? If yes, proceed. If no, reconsider.*
