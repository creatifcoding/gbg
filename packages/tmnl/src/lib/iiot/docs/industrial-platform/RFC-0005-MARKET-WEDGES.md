# RFC-0005 — Market Wedges and Feature-Set Research Plan

Status: draft

## 1. Purpose

This RFC does not choose the product wedge permanently. It defines candidate wedges and the evidence needed to choose intelligently.

The user direction is broad: digital twin / graph intelligence product, agentic platform offering, all industrial personas potentially relevant, strong Level 3 emphasis, with interfaces and deployment designed one abstraction layer lower.

That breadth is powerful, and also how products become beautiful fog machines. This RFC keeps the fog in a jar.

## 2. Market signal summary

Current external signals suggest demand for:

- agentic factory operating layers;
- governed digital workers across enterprise and industrial systems;
- physical AI grounded in asset relationships;
- unified industrial data foundations / UNS;
- edge AI and hybrid industrial edge deployment;
- operational workflows that move from recommendation to validated action.

Representative source anchors:

- Juna AI Agentic Factory OS: shared operating layer for multiple factory AI agents.
- IFS Loops: governed digital workers executing multi-system operational workflows.
- DataMesh FactVerse AI: asset-context-grounded recommendations and work orders.
- LEK process automation report: edge AI, open control, regulation/sustainability pressure.
- UNS/OPC UA sources: industrial data foundations replacing point-to-point integration.

## 3. Candidate wedges

### Wedge A — Graph intelligence / impact analysis

Core promise:

> Understand what is affected when a machine, device, external dependency, alarm, or WorkOrder changes state.

Why it fits current assets:

- Reactor v2 already proves graph-backed impact propagation.
- SQL audit/constraints are differentiated.
- Easy to demo with virtual plant.

Primary buyer/user:

- operations manager;
- reliability engineer;
- system integrator;
- plant manager.

Risk:

- may look like “just dependency graph” unless paired with agent recommendations and action governance.

### Wedge B — Agentic maintenance planner

Core promise:

> Convert live plant context into explainable maintenance actions and CMMS updates.

Why it fits:

- WorkOrder semantics are already rich.
- Reactor constraints map naturally to maintenance blockers/releases.
- CMMS integration is a high-value enterprise action with lower OT safety risk than PLC writes.

Primary buyer/user:

- maintenance manager/planner;
- reliability engineer;
- CMMS owner.

Risk:

- depends on CMMS adapter quality and work-management domain depth.

### Wedge C — Alarm intelligence and ISA-18.2 assistant

Core promise:

> Reduce alarm flood, explain alarm impact, guide response, and audit ack/shelve/suppression decisions.

Why it fits:

- Alarm safety-hold lane exists.
- ISA-18.2 lifecycle gives strong workflow shape.
- Agent explanations can shine here.

Primary buyer/user:

- shift supervisor;
- controls engineer;
- operations manager.

Risk:

- alarm management can become highly site-specific and compliance-sensitive.

### Wedge D — Virtual plant / industrial agent testbed

Core promise:

> Give system integrators and platform teams a safe environment to build, test, and certify industrial agents.

Why it fits:

- The platform requires emulation anyway.
- Differentiates with command governance and replayable audit.
- Can sell to integrators/OEMs before full production deployment.

Primary buyer/user:

- system integrator;
- OEM machine builder;
- OT engineer;
- platform team.

Risk:

- may feel like tooling rather than operational ROI unless packaged with demos/templates.

### Wedge E — Industrial command governance

Core promise:

> Let AI agents act in industrial environments without bypassing approvals, interlocks, or audit.

Why it fits:

- This is the hard problem many agent platforms under-specify.
- IEC 62443 and approval workflows create credible safety posture.

Primary buyer/user:

- IT/OT security lead;
- plant manager;
- enterprise platform buyer.

Risk:

- alone it may be too abstract; best paired with maintenance/alarm/impact use cases.

## 4. Recommended initial product framing

Recommended wedge stack:

```text
Primary: Graph intelligence / impact analysis
Paired with: Agentic maintenance planner
Proven through: virtual plant + alarm/fault/OEE scenario
Protected by: command governance
```

This avoids building a generic “industrial AI everything” story while preserving the platform ambition.

## 5. Feature-set research plan

### Research questions

1. Which buyer has the sharpest pain and budget: maintenance, operations, reliability, security, or integrators?
2. Which workflows are underserved by existing SCADA/MES/CMMS vendors?
3. Where do agentic platforms claim governance, and where is it hand-wavy?
4. What integrations are table stakes for the first 3 pilot customers?
5. What demo converts skepticism fastest?

### Competitor/source classes

- industrial AI agent vendors;
- MES/MOM platforms with AI features;
- CMMS/EAM platforms with AI/copilot features;
- digital twin / asset graph platforms;
- SCADA/HMI vendors with alarm intelligence;
- UNS/industrial data platform vendors;
- system integrator solution patterns.

### Evidence artifacts

- competitor matrix;
- workflow pain map;
- integration expectation matrix;
- buyer/persona ranking;
- demo acceptance rubric;
- pricing/packaging hypothesis;
- pilot scope proposal.

## 6. First demo acceptance rubric

The demo is undeniable if it shows:

1. live OPC UA/Sparkplug simulation feeding the graph;
2. alarm lifecycle follows ISA-18.2 vocabulary;
3. OEE/downtime impact updates in real time;
4. Reactor identifies affected WorkOrders and dependencies;
5. agent explains root cause, affected entities, and recommended action;
6. human approves maintenance action;
7. CMMS ticket/update is emitted through a port;
8. unsafe command is blocked with policy explanation;
9. replay/audit proves every step.

## 7. Acceptance criteria

- We can describe the platform in one sentence without listing 30 features.
- We can show one workflow with cross-level integration and safety governance.
- Market research can compare wedges without rewriting architecture.
- The first implementation slice serves both product demo and platform substrate.
