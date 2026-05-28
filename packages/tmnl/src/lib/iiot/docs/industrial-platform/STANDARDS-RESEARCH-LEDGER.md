# Standards Research Ledger — Industrial Agentic Platform

Status: living research ledger

## 1. Why this ledger exists

The platform RFCs must be grounded in actual industrial standards, not vibes wearing a hard hat. This ledger records the standards sources used to justify design decisions and separates what is **observed from a source** from what is **our design interpretation**.

Important honesty boundary:

- Several standards are paywalled or have purchasable authoritative PDFs.
- This ledger uses official/public pages, OPC Foundation online references, Eclipse Sparkplug sources, and public previews/excerpts.
- Public sources are enough for RFC direction and initial conformance scaffolding.
- Formal compliance claims require the acquired standard text, reviewed clause-by-clause, and possibly external certification. Until then we claim **design alignment**, not certified compliance.

## 2. Evidence levels

| Level | Meaning | Permitted claim |
| --- | --- | --- |
| E0 | not researched | no claim |
| E1 | public official overview/source page | standards-informed direction |
| E2 | public normative excerpt or open specification text | design alignment with cited requirement |
| E3 | full official standard reviewed internally | internal compliance assertion for scoped clauses |
| E4 | implementation + tests/golden traces verify scoped obligation | verified implementation alignment |
| E5 | third-party certification or formal audit | certified/externally audited compliance |

Current RFC pack target: E1/E2 for architecture, E4 for future CI-verifiable obligations. No E5 claims.

## 3. Source anchors

### STD-OPCUA-P1-OVERVIEW — OPC UA overview and concepts

Source: OPC Foundation, OPC UA Part 1 Overview and Concepts, clause 4.
URL: https://reference.opcfoundation.org/Core/Part1/v105/docs/4
Evidence level: E2 public online reference.

Observed facts:

- OPC UA applies from sensors/actuators/control systems through MES/ERP, IIoT, and M2M.
- It defines infrastructure for information exchange including information model, message model, communication model, and conformance model.
- It is platform-independent and supports authentication, encryption, integrity, client/server services, PubSub, data, alarms/events, and history.
- OPC UA AddressSpace represents Nodes connected by References; object model represents Objects in terms of Variables, Events, Methods, and relationships.
- OPC UA supports auditing/security audit trails with traceability between Client and Server logs.

Design implications:

- `OpcUaConnector` must preserve NodeId, BrowseName, NodeClass, Reference, data value, quality/status, event/alarm identity, and security/audit metadata.
- OPC UA is not merely a tag protocol; adapters must expose browse/discovery and information-model evidence.
- Graph mapping from OPC UA should preserve References as relationship evidence, but graph remains projection.

### STD-OPCUA-P4-SERVICES — OPC UA service sets

Source: OPC Foundation, OPC UA Part 4 Services, overview.
URL: https://reference.opcfoundation.org/specs/OPC-10000-4/4
Evidence level: E2 public online reference.

Observed facts:

- OPC UA Services are grouped into Discovery, SecureChannel, Session, NodeManagement, View, Attribute, Method, MonitoredItem, and Subscription service sets.
- View services browse AddressSpace/Views.
- Attribute services read/write Node attributes and historical values.
- Method services call methods.
- MonitoredItem and Subscription services monitor attributes and objects for events, queue notifications, and provide recovery from missed messages/communication failures.

Design implications:

- Emulator and adapter contracts need browse, read, subscribe, event/alarm, and command/method/write surfaces.
- Command-capable OPC UA services must be wrapped by command governance; having a Method or writable Attribute does not confer permission to execute.
- Contract tests should cover browse, subscription recovery, value quality, method/write denial, and audit propagation.

### STD-OPCUA-P9-ALARMS — OPC UA alarms and conditions

Source: OPC Foundation, OPC UA Part 9 Alarms & Conditions, concepts/scope.
URLs:

- https://reference.opcfoundation.org/specs/OPC-10000-9
- https://reference.opcfoundation.org/Core/Part9/v105/docs/4
- https://reference.opcfoundation.org/specs/OPC-10000-9/1

Evidence level: E2 public online reference.

Observed facts:

- OPC UA Part 9 defines an Information Model for Conditions, Dialog Conditions, and Alarms including acknowledgement capabilities.
- It extends base Event handling from OPC UA Parts 3, 4, and 5.
- Scope text explicitly notes that broader alarm philosophy, lifecycle, response times, and many alarm-system details are captured in standards such as IEC 62682 and ISA-18.2.

Design implications:

- OPC UA alarm ingestion should preserve OPC UA Alarm/Condition identity, event type, acknowledgement state, and condition details.
- ISA-18.2 should own alarm-management lifecycle/philosophy decisions; OPC UA Part 9 is a transport/information-model source, not the whole alarm-management standard.

### STD-OPCUA-P11-HISTORICAL — OPC UA historical access

Source: OPC Foundation, OPC UA Part 11 Historical Access.
URL: https://reference.opcfoundation.org/Core/Part11/v104/docs/4
Evidence level: E2 public online reference.

Observed facts:

- OPC UA Historical Access defines handling of historical time-series data and historical Event data.
- Servers supporting Historical Access provide transparent access to historical data/event sources, such as process historians and event historians.

Design implications:

- Historian is a distinct port because historical data semantics are not equivalent to domain event authority.
- OPC UA Historical Access can be one implementation source for historian reads, but EventJournal remains domain transition authority.

### STD-SPARKPLUG-OP-BEHAVIOR — Sparkplug operational behavior

Source: Eclipse Sparkplug specification, chapter 5 Operational Behavior.
URL: https://github.com/eclipse-sparkplug/sparkplug/blob/3.x/specification/src/main/asciidoc/chapters/Sparkplug_5_Operational_Behavior.adoc
Evidence level: E2 open specification source.

Observed facts:

- Sparkplug uses MQTT Sessions with central MQTT Servers; hosts and edge nodes establish sessions independently.
- Birth/Death Certificates and payloads provide state and context between Primary Host and Edge Nodes.
- Only the Primary Host Application should have permission to issue commands to Edge Nodes.
- Timestamps must be UTC.
- Edge Nodes publish NBIRTH/DBIRTH before DATA; NDEATH/DDEATH mark nodes/devices offline and associated metrics stale.
- Sequence numbers and bdSeq correlate session state and allow order/rebirth logic.
- NCMD and DCMD target Edge Nodes and Devices respectively; ACLs/security may allow/disallow command publishing.

Design implications:

- Sparkplug adapter and emulator must model STATE, NBIRTH, NDEATH, DBIRTH, DDEATH, DDATA, NCMD/DCMD, sequence, bdSeq, stale quality, and primary-host behavior.
- Command governance must respect Sparkplug's distinction between data availability and command authority.
- Sparkplug command topics are adapter mechanisms; platform commands still require policy/interlock/approval/execution receipts.

### STD-SPARKPLUG-PAYLOAD — Sparkplug B payloads

Source: Eclipse Sparkplug specification, chapter 6 Payloads and Eclipse Tahu protobuf.
URLs:

- https://github.com/eclipse-sparkplug/sparkplug/blob/3.x/specification/src/main/asciidoc/chapters/Sparkplug_6_Payloads.adoc
- https://github.com/eclipse/tahu/blob/3.x/sparkplug_b/sparkplug_b.proto

Evidence level: E2 open specification source.

Observed facts:

- Sparkplug B payloads use Google Protocol Buffers.
- Metrics carry names/aliases, datatype, values, timestamp, properties, metadata, and sequence/state information depending on message type.

Design implications:

- The platform should normalize Sparkplug payloads into DMN telemetry/lifecycle envelopes while retaining raw payload references and metric metadata.
- Protobuf decoding is an adapter concern; DMN envelope schema should not leak protobuf internals except as raw/provenance metadata.

### STD-ISA95-CONCEPT — ISA-95 enterprise-control integration and OPC UA companion concept

Sources:

- ISA overview: https://www.isa.org/standards-and-publications/isa-standards/isa-95-standard
- OPC UA ISA-95 Common Object Model concept: https://reference.opcfoundation.org/ISA-95/v100/docs/4

Evidence level: E2 public overview plus OPC Foundation online reference.

Observed facts:

- ISA-95 defines five levels of activities in manufacturing organizations.
- Automation/control generally support Levels 1 and 2; MOM systems support Level 3; ERP supports Level 4.
- ISA-95 Level 3 includes maintenance, quality assurance/laboratory, inventory movement, SCADA monitoring/control, batch control, historians, document/workflow instructions, scheduling, campaign/work dispatching, and work/product tracking.
- ISA-95 defines primary exchange information about material, equipment, physical assets, and personnel/roles/qualifications.
- Equipment identification is distinct from physical asset identification; role/tag identity and individual asset identity can diverge over time.
- OPC UA ISA-95 companion model maps ISA-95 classes/objects/properties to OPC UA ObjectTypes, Variables, and References.

Design implications:

- Platform center of gravity as a Level-3-ish digital-twin/control plane is standards-aligned.
- Schema taxonomy must distinguish equipment role identity from physical asset identity.
- Graph model should support material, equipment, physical asset, personnel, operation context, and Level 3/4 exchange relationships.

### STD-ISA18-SERIES — ISA-18.2 alarm management lifecycle

Source: ISA-18 Series of Standards overview.
URL: https://www.isa.org/standards-and-publications/isa-standards/isa-18-series-of-standards
Evidence level: E1/E2 public standard overview.

Observed facts:

- ANSI/ISA-18.2 is a foundational standard for management of alarm systems for process industries.
- It covers the entire alarm lifecycle from identification and rationalization to implementation, maintenance, and ongoing change management.
- It emphasizes a clear documented alarm philosophy, alarm prioritization, performance monitoring, HMI best-practice guidance, rationalization, nuisance/flood reduction, and continuous monitoring/auditing.
- Related technical reports cover alarm philosophy, identification/rationalization, basic design, advanced methods, monitoring/assessment/auditing, batch/discrete processes, packaged systems, and non-alarm notifications.

Design implications:

- Alarm schema must separate alarm definition, occurrence, lifecycle state, rationalization, prioritization, operator action, shelving/suppression, and audit.
- Agent alarm actions must cite alarm philosophy/rationalization references where available.
- Alarm suppression/shelving/acknowledgement commands require stronger approval/audit than ordinary notifications.

### STD-IEC62443-SERIES — ISA/IEC 62443 IACS cybersecurity

Sources:

- ISA series overview: https://www.isa.org/standards-and-publications/isa-standards/isa-iec-62443-series-of-standards
- ISA Global Cybersecurity Alliance overview: https://isagca.org/isa-iec-62443-standards

Evidence level: E1/E2 public standard overview.

Observed facts:

- ISA/IEC 62443 defines requirements and processes for implementing and maintaining secure industrial automation and control systems.
- It bridges operations and information technology, and process safety and cybersecurity.
- It addresses IACS throughout lifecycle and stakeholder groups including asset owners, automation suppliers, integrators, and service suppliers.
- It includes risk assessment for system design, system security requirements/security levels, secure product development lifecycle, and component technical requirements.
- Public summaries describe shared responsibility, common terminology/concepts/models, asset-owner risk needs, product-development lifecycle, and risk assessment processes.

Design implications:

- Command governance must model actor, role, deployment profile, zone/conduit, command class, target criticality, approval, interlock, audit, and denial.
- Deployment profiles must fail closed for OT write paths unless explicitly enabled.
- Integrator/service-provider posture matters; adapter credentials/capabilities must be scoped and auditable.

### STD-PACKML-CONCEPT — PackML machine states and tags

Sources:

- OMAC PackML overview: https://packml.org/
- OPC UA PackML concept: https://reference.opcfoundation.org/PackML/v101/docs/4

Evidence level: E2 public overview plus OPC Foundation online reference.

Observed facts:

- PackML was developed by OMAC and adopted by ISA as TR88.00.02.
- PackML aims for common look/feel, industry innovation, common terminology, a standard state-based model for automated machines, and consistent machine data.
- PackML defines Unit Modes, PackML StateMachine, and PackTags.
- PackTags include command, status, and administrative tags.
- PackML can provide OEE and root-cause-analysis data and consistent SCADA/MES inputs.

Design implications:

- PackML should be a normalized overlay for applicable machines, not a forced model for every asset.
- Virtual plant machines should emit PackML-compatible state transitions and tags where the scenario uses automated machine behavior.

### STD-ISO22400-KPI — ISO 22400 manufacturing operations KPIs

Sources:

- ISO 22400-1 public page: https://www.iso.org/standard/56847.html
- ISO 22400-2 public page: https://www.iso.org/standard/87563.html

Evidence level: E1 public ISO overview.

Observed facts:

- ISO 22400 specifies an industry-neutral framework for defining, composing, exchanging, and using KPIs for manufacturing operations management, as defined in IEC 62264-1/ISA-95.
- ISO 22400-1 provides concepts and terminology for KPIs and criteria for constructing KPIs.
- ISO 22400-2 defines selected KPIs used in manufacturing operations management.

Design implications:

- OEE and KPI schemas should treat availability/performance/quality as evidence-backed MOM KPIs.
- KPI calculations need explicit production windows, downtime frames, quantities, units, source evidence, and formula/version metadata.

### STD-MIMOSA-OSA-CBM — MIMOSA / OSA-CBM / OpenO&M

Sources:

- MIMOSA standards overview: https://mimosa.org/
- OSA-CBM release page: https://www.mimosa.org/specifications/osa-cbm-3-3-1/

Evidence level: E1/E2 public overview and specification release page.

Observed facts:

- MIMOSA focuses on open standards for physical asset management and supplier-neutral interoperability.
- OSA-CBM is described as an Open System Architecture for Condition-Based Maintenance and a standard architecture for moving information in a condition-based maintenance system.
- MIMOSA/OpenO&M includes ISBM as a vendor-neutral interface to communication infrastructure for OIIE architecture and supports exchange of models including MIMOSA CCOM, ISO 15926, MESA B2MML, and OAGIS.
- MIMOSA includes work on common interoperability registry patterns for harmonizing locally unique identifiers across systems.

Design implications:

- Maintenance/asset health schemas should preserve condition evidence, diagnostic/prognostic recommendations, and physical asset identity.
- Identity reconciliation should support cross-system identifier harmonization and mapping provenance.
- The platform should avoid hardcoding a CMMS vendor identity model into core maintenance semantics.

## 4. Standards not yet acquired/reviewed in full

Formal implementation should acquire/review at least:

- ANSI/ISA-95 / IEC 62264 relevant parts.
- ANSI/ISA-18.2-2016 and relevant TR18.2 reports.
- ISA/IEC 62443-3-2, 3-3, 4-1, 4-2 and possibly 2-1/2-4 by deployment role.
- ISA-TR88.00.02 PackML full text.
- ISO 22400-1 and 22400-2 full text.
- MIMOSA OSA-CBM/CCOM specs as needed for maintenance/asset health implementation.

## 5. Reader note

Where a later RFC says “standards-aligned,” read it as “anchored to this ledger and pending clause-level proof unless already backed by implementation tests.” Prime, yes, we can absolutely be ambitious — but we will not print a fake compliance certificate on nice paper and call it architecture.
