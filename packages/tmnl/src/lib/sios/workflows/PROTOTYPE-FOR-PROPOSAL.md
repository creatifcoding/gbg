# Prototype for Proposal — Process Extraction

A codified methodology for converting latent opportunities into working prototypes that sell themselves. Derived from the JCK USA / SIOS engagement. Written for agent dispatch at scale.

---

## The Thesis

A working prototype beats a résumé, a pitch deck, and a proposal document — combined. The prototype IS the proposal. When you walk into a call with a running system that speaks the prospect's domain language, the conversation shifts from "can you do this?" to "when can you start?"

The economics: each prototype takes 2-4 focused sessions to reach demo-ready. A portfolio of 10-15 completed prototypes, even without immediate sales, compounds into an asset that sells perpetually. Every implementation is a win — it's either a sale or a portfolio piece that sells the next one.

---

## The Pipeline

```
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ SURFACE  │───>│ RESEARCH │───>│  MODEL   │───>│  BUILD   │───>│  DEMO    │───>│ OUTREACH │───>│ COLLECT  │
│          │    │          │    │          │    │          │    │          │    │          │    │          │
│ Find the │    │ Learn    │    │ Design   │    │ Implement│    │ Design   │    │ Execute  │    │ Archive  │
│ opening  │    │ their    │    │ their    │    │ the      │    │ the      │    │ contact  │    │ into     │
│          │    │ world    │    │ system   │    │ vertical │    │ workflows│    │ sequence │    │ portfolio│
└─────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
  ~1 hour       ~2-4 hours      ~2-3 hours      ~4-8 hours      ~3-4 hours      ~1 hour        ~1 hour
```

Total: roughly 15-25 hours per prototype, spread across 2-4 sessions.

---

## Phase 1 — SURFACE

**Goal:** Find an opportunity where you can credibly build a prototype that maps to a real business need.

### Opportunity Types

| Type | Signal | Example |
|---|---|---|
| **Job posting** | They're hiring for a builder. That means they need the thing built. | JCK: "AI & Digital Execution Architect" |
| **RFP/RFI** | They're formally requesting solutions. | Government agency modernization |
| **Pain signal** | Public complaints, manual processes, legacy systems mentioned in articles/posts | "We track everything in Excel" |
| **Expansion signal** | New facility, new market, fundraise | Company opens new warehouse |
| **Technology signal** | Adopting a platform, evaluating vendors | "Looking for Palantir alternatives" |

### What to Extract

From any opportunity signal, extract:

1. **Company name + domain** — What industry, what they make/do
2. **Decision makers** — Who has budget authority (President/VP) and who evaluates technical fit (Director/Manager)
3. **The stated need** — What they say they want (often a wish list)
4. **The actual need** — What they actually need (often different — narrower and more urgent)
5. **Existing tools** — What they currently use (this is what you replace or integrate with)
6. **Capability overlap** — What you already have that maps to their need

### Reframe

Every opportunity gets the **consultant reframe:**

| Applicant frame | Consultant frame |
|---|---|
| "I'm applying for your role" | "I already solved your problem" |
| "Here's my résumé" | "Here's a working prototype" |
| "I have 5 years experience in X" | "I built the thing you're describing" |
| "Can I have an interview?" | "Want me to demo it in 15 minutes?" |

**Output:** A 1-paragraph opportunity brief. Company, domain, stated need, decision makers, reframe angle.

---

## Phase 2 — RESEARCH

**Goal:** Develop enough domain expertise to speak the prospect's language credibly. Not academic depth — operational depth. "Enough to walk a job site and know what I'm looking at."

### Research Artifacts

1. **Research Journal** — Running log of sources, findings, vocabulary. 50-100 sources minimum. Organized by topic.
2. **Domain Primers** — 3-7 visual HTML documents covering the domain's key concepts. These are learning artifacts AND portfolio pieces.
3. **Vocabulary Extraction** — The specific terms this industry uses. Equipment types, process names, role titles, metrics, standards.

### Research Sources (Priority Order)

1. **Company website** — What they say about themselves. Products, services, case studies, team bios.
2. **Job posting** — Read between the lines. The requirements reveal what they're building and what tools they use.
3. **Industry standards** — The frameworks their domain operates under (ISA-95, IEC 62381, EVM, OSHA, etc.)
4. **Competitor analysis** — Who else operates in their space. What tools do competitors use?
5. **YouTube / trade publications** — Operational footage, conference talks, trade journal articles.
6. **LinkedIn** — Decision maker profiles. Their background tells you what they value.

### Depth Calibration

You need three levels of understanding:

| Level | Test | Example |
|---|---|---|
| **Vocabulary** | Can you use their terms correctly? | "Crossbelt sorter" not "sorting machine" |
| **Process** | Can you describe their workflow? | "I/O checkout → conveyor run test → site acceptance" |
| **Pain** | Can you name their operational frustrations? | "Badge tracking is manual, time sheets are Excel-based" |

You do NOT need:
- Academic expertise in their field
- Ability to operate their equipment
- Understanding of every edge case

**Output:** Research journal, 3-7 domain primers, vocabulary glossary.

---

## Phase 3 — MODEL

**Goal:** Design the domain model. This is where the prototype becomes real — the data architecture determines everything downstream.

### The Entity Discovery Process

Start from the prospect's language, not from a standard:

1. **List their nouns** — From the job posting, website, and research: what objects do they talk about? Projects, zones, work orders, crews, workers, issues, inspections...
2. **Identify lifecycles** — Which nouns have meaningful state transitions? A project goes from bidding → active → complete. An issue goes from open → resolved → closed. These become entities with state machines.
3. **Identify data objects** — Which nouns are just data? A time entry is a record. A crew is a grouping. These become CRUD entities without state machines.
4. **Map relationships** — FK chains. Project has Zones. Zone has WorkPackages. WorkPackage has Tasks. Task has TimeEntries.
5. **Identify the value calculation** — What metric does the prospect care about? For JCK: Earned Value (EVM). This becomes the cross-cutting service that justifies the entire data model.

### The Entity Specification

For each entity, define:

```
Entity: WorkPackage
  Status enum: planned | active | suspended | complete | closed
  Has lifecycle? YES → needs Graph + Machine
  Key fields: name, code, discipline, plannedQty, actualQty, budgetedCost, actualCost
  Key methods: percentComplete(), earnedValue(), cpi(), isOverBudget()
  Parent: Zone (FK)
  Children: Task (1:N)
  Create params: what you need to make one
  Update params: what you can change after creation
```

### The Build Plan

Always 3 passes:

| Pass | Layers | Dependency |
|---|---|---|
| **Pass 1** | Schema → Graph → State → Machine → Entity | None (pure domain logic) |
| **Pass 2** | Model → DDL → Migration | Depends on schemas from Pass 1 |
| **Pass 3** | Repo → HTTP → E2E Test | Depends on models from Pass 2 |

Within each pass, build in FK dependency order: parent entities before children.

### Standards → Custom Model

Never adopt a standard wholesale. Derive from standards:

| Standard | What to take | What to leave |
|---|---|---|
| ISA-95 | Hierarchy levels, state concepts | The full ontology (too broad) |
| EVM | CPI, SPI, EV, AC, PV formulas | The PMI ceremony (too heavy) |
| IEC 62381 | Commissioning phases, SAT/FAT | The document requirements (not our job) |
| Industry vocabulary | Equipment names, process terms | Implementation-specific procedures |

**Output:** ARCHITECTURE.md — entity map, lifecycle definitions, build plan, 3-pass breakdown.

---

## Phase 4 — BUILD

**Goal:** Implement the full entity vertical. All layers, all entities, zero compile errors.

### The 8-Layer Vertical (Per Entity)

This is the core pattern. Every entity follows it. Reference implementation: the IIoT module.

```
Layer 1: Schema     → Schema.TaggedClass with domain METHODS (not just fields)
Layer 2: Graph      → Graph.directed with typed states + transitions (lifecycle entities only)
Layer 3: State      → Context.Tag service, in-memory Ref<Map> impl
Layer 4: Machine    → Machine.make with Internal* TaggedRequests (lifecycle entities only)
Layer 5: Entity     → Entity.make with Rpc.make public contract
Layer 6: Model      → Model.Class mapping to SQL columns + co-located DDL
Layer 7: Repo       → Direct SQL queries, decode utilities
Layer 8: HTTP       → EntityProxy.toHttpApiGroup, server composition
```

### Key Implementation Principles

1. **Schema determines everything.** Design the schema first. Get the fields, methods, and status enums right. Everything downstream derives from it.

2. **Entities are calculators, not data bags.** `TaggedClass` with methods: `wp.percentComplete()`, `wp.cpi()`, `worker.isDeployable()`. The entity knows how to interpret itself.

3. **Two kinds of entities:** Lifecycle entities (7 of 9 in SIOS) get Graph + Machine. CRUD entities (Crew, TimeEntry) get State + Entity only. Don't force state machines where they don't belong.

4. **Internal\* vs Rpc — the two-layer pattern.** Internal requests are the machine's private vocabulary (for testing, direct access). Rpc requests are the public contract (for HTTP, cluster, wire protocol). The Entity layer maps between them.

5. **In-memory first.** Every state service starts with `Ref<Map>`. No database needed for the demo. SQL repos are added in Pass 3 but the demo runs entirely in-memory.

6. **E2E test before UI.** Prove the full lifecycle works (create → transition → calculate → complete) with a test before building any React. If the data layer is wrong, the UI is wasted effort.

### Compile Check Discipline

After every pass: `tsc --noEmit`. Zero errors before moving to the next pass. Non-negotiable.

**Output:** N files across 8 layers, zero compile errors, passing E2E test.

---

## Phase 5 — DEMO

**Goal:** Design interactive workflows that demonstrate the system to stakeholders on a call.

### Workflow Design Principles

1. **Not dashboards — sequences.** A dashboard shows data. A workflow shows cause and effect. "Click this button → watch this gauge change."

2. **Beat-by-beat scripted.** Every workflow has an interaction script: what you click, what changes on screen, what you say. Timed to fit a 15-minute call.

3. **Domain vocabulary in the UI.** Task names, equipment references, zone names — all from the prospect's world. "Belt Conveyor Installation — Zone A Ticketing Hall" not "Task 1 — Area 1."

4. **Show guard rails, not just happy paths.** Try an invalid transition — system blocks it. Try to assign an expired worker — system rejects it. The "you can't do that" moments are as powerful as the "look what I can do" moments.

5. **3-4 workflows per call.** Reserve the rest for follow-up. Leave them wanting more.

### Shared Component Architecture

Workflows share primitives and compounds. Extract before building:

- **33 primitives** — Typography, layout, feedback, data display, inputs, interactive
- **11 compounds** — StatePipeline, TransitionButton, EntityRow, EntityList, MetricCard, FormModal, etc.
- **N workflows** — Stateful orchestrators that compose compounds

A workflow is ~50-100 lines of composition. It boots machines, seeds data, composes compounds, manages modals. Nothing else.

**Output:** Workflow specs (interaction scripts, state flows, seed data), component architecture doc.

---

## Phase 6 — OUTREACH

**Goal:** Get 15 minutes on a call to demo the prototype.

### The Staggered Multi-Channel Pattern

| Day | Channel | Target | Angle |
|---|---|---|---|
| D1 | Email | General / info@ | Lead with prototype link. Consultant frame. |
| D3 | LinkedIn DM | Technical evaluator | Speak their professional language. Reference their metrics. |
| D5 | LinkedIn DM | Decision maker | Shorter, strategic. Velocity-to-value. |
| D10 | Follow-up | Same channels | "Just making sure this landed. Demo link still live." |

### Message Anatomy

Every outreach message follows the same structure:

1. **Hook** — "I saw X and recognized I've already built Y."
2. **Evidence** — 3-5 bullet points of specific capabilities (use their terminology)
3. **Proof** — Link to live demo + video walkthrough
4. **Frame** — "This isn't a mockup. It's running code."
5. **Ask** — "15 minutes to walk you through it live."

### Deliverables

| Deliverable | Format | Purpose |
|---|---|---|
| Live demo | Deployed web app (Vercel/Cloudflare) | Clickable proof |
| Video walkthrough | 3-min Loom/YouTube (unlisted) | Async proof for busy execs |
| Technical portfolio | Single-page HTML | Replaces résumé |
| Outreach copy | 3 messages (email, 2× LinkedIn) | Contact sequence |

**Output:** Deployed demo, video, portfolio page, outreach messages sent.

---

## Phase 7 — COLLECT

**Goal:** Archive the prototype into the portfolio regardless of outcome.

### Every Prototype is an Asset

| Outcome | Action |
|---|---|
| **Sale** | Client engagement. Prototype becomes v0.1 of the product. |
| **Call but no sale** | Follow up in 30/60/90 days. Prototype stays in portfolio. |
| **No response** | Prototype stays in portfolio. Demo link stays live. |
| **Rejected** | Learn why. Prototype still demonstrates capability. |

### Portfolio Architecture

Each prototype gets:
- A route in the portfolio app (`/prototypes/jck-sios`)
- A card with: company name, domain, entity count, key metric, live demo link
- Tags: industry, entity types, standards used, tech stack

The portfolio itself is a prototype — it demonstrates you can build and ship repeatedly.

**Output:** Portfolio entry with demo link, architecture summary, and domain tags.

---

## Agent Dispatch Model

For running 3-5 prototypes in parallel:

### Skill Set Required

| Skill | Purpose | Phase |
|---|---|---|
| `prospect-scout` | Surface opportunities from job boards, RFPs, LinkedIn, news | 1 |
| `domain-researcher` | Build research journal + primers for a new domain | 2 |
| `entity-architect` | Design entity model from domain research | 3 |
| `entity-builder` | Implement the 8-layer vertical per entity | 4 |
| `workflow-designer` | Design interactive demo workflows | 5 |
| `outreach-crafter` | Write consultant-framed contact messages | 6 |

### Dispatch Pattern

```
Agent 1 (scout):     Surface 3-5 opportunities
                     ↓
Agent 2 (researcher): Research domain for Opportunity A    ← parallel
Agent 3 (researcher): Research domain for Opportunity B    ← parallel
                     ↓
Agent 4 (architect):  Design entity model for A            ← parallel
Agent 5 (architect):  Design entity model for B            ← parallel
                     ↓
Agent 6 (builder):    Build vertical for A                 ← parallel (biggest timebox)
Agent 7 (builder):    Build vertical for B                 ← parallel
                     ↓
You (chaperon):       Review, correct, ensure alignment     ← serial checkpoints
```

### What the Human Does

The human is NOT hands-off. The human:

1. **Approves opportunity selection** — Agent surfaces 5, human picks 3
2. **Reviews domain model** — The entity map is the highest-leverage decision. 30 minutes of review here saves 10 hours of rework.
3. **Validates schema design** — Schema determines everything. Review the TaggedClass fields and methods before Pass 2.
4. **Tests the E2E flow** — Click through the test. Does the lifecycle make sense for the domain?
5. **Narrates the demo** — The human does the stakeholder call. The agent can't do this.

### What Agents Do Autonomously

- Research (Phase 2) — fully autonomous with web search
- Implementation (Phase 4) — fully autonomous given approved ARCHITECTURE.md
- Component building — fully autonomous given approved COMPONENTS.md
- Outreach copy — draft, human reviews before sending

### Critical Checkpoints (Human Required)

| Checkpoint | Phase | Why |
|---|---|---|
| Opportunity selection | 1 | Agents can't assess market fit or personal interest |
| Entity model review | 3 | Wrong model = wasted build. 30 min review = 10 hours saved |
| Schema approval | 4 (Pass 1) | Fields and methods determine everything downstream |
| E2E test review | 4 (Pass 3) | Does the lifecycle actually make domain sense? |
| Outreach approval | 6 | Never send without human eyes |

---

## Metrics

| Metric | Target | JCK Actual |
|---|---|---|
| Time to first prototype commit | < 8 hours | ~6 hours |
| Total lines of domain code | 5,000 - 15,000 | 9,565 |
| Entity count | 5-15 | 9 |
| Compile errors at completion | 0 | 0 |
| E2E test coverage | Full lifecycle | 2/2 passing |
| Demo workflows designed | 3-8 | 8 |
| Research sources | 50-100 | 92 |
| Domain primers | 3-7 | 7 |
| Time to demo-ready | 3-5 sessions | 4 sessions (UI pending) |

---

## Lessons from JCK

1. **Schema design is the highest-leverage decision.** We deleted and rewrote the entity layer twice before getting it right. The third time stuck because we got the schemas right first.

2. **The "wrong API" trap is real.** Graph.addNode vs mutable.node — a pattern mismatch that compiles but fails at runtime. Always run the E2E test, never trust just tsc.

3. **Domain vocabulary matters more than architecture.** JCK doesn't care about Effect-TS or Graph.directed. They care that the system says "I/O checkout" and "divert accuracy" and "SIDA badge." Speaking their language is the sale.

4. **Consultant frame changes everything.** "I built what you're looking for" lands differently than "I'd like to apply." It shifts the power dynamic — you're offering, not asking.

5. **Every prototype, even unsold, is portfolio.** The SIOS architecture, the domain primers, the workflow designs — these demonstrate capability to every future prospect, not just JCK.

6. **The E2E test is the proof.** Not the slides, not the architecture doc. The test that creates a project, walks it through its lifecycle, and verifies the EVM calculations are correct. That's what proves the system works.
