# Formula DSL — Shared Research Briefing

> **All research agents MUST read this before beginning work.**
> **Pre-design doc:** `packages/datagrid/.research/FORMULA-DSL-PREDESIGN.md`
> **This briefing:** `packages/datagrid/.research/FORMULA-DSL-RESEARCH-BRIEFING.md`

---

## Mission

We are designing a **stack-based formula computation engine** for `@tmnl/datagrid` — a reactive spreadsheet abstraction where cells are atoms. This is a ground-up replacement of the current FormulaEngine spike.

The research phase produces artifacts that feed into design and spike validation. Each research agent owns a domain but coordinates with peers via **cm** (persistent state) and **pi-messenger** (real-time messaging).

## Aligned Design Decisions (Non-Negotiable)

These were established by Prime via structured questionnaire. Do NOT re-litigate:

1. **Computation model:** Stack-based RPN (Emacs calc inspired)
2. **Primary consumers:** Agents (not humans) — API-first, no formula bar needed
3. **Trust model:** Full WASM sandbox (QuickJS or equivalent) — untrusted code isolation
4. **Scope:** Effect programs + symbolic computation — formulas are Effects
5. **Agent API:** Three surfaces — REPL session, Cell RPC, DataFrame API
6. **Restructuring:** Full replace of FormulaEngine — CellCache/CrdtLayer/UndoStack preserved
7. **Phasing:** Pre-design → Spike → Build

## Research Domains

### Domain A: Stack VM & DSL Design
**Owner:** `dsl-stack-researcher`
**Scope:** Emacs calc internals, Forth/Factor/PostScript patterns, opcode set design, IR format, algebraic-to-RPN compilation, Trail (computation audit log)
**Key questions:**
- What is Emacs calc's actual IR? How does it represent operations internally?
- What opcode set do we need for spreadsheet formulas? (arithmetic, cell refs, ranges, aggregations, control flow)
- How does algebraic entry mode compile to stack ops?
- How does the Trail work? Can we use it for computation auditing?
- What can we learn from Forth's dictionary and Factor's combinators?

### Domain B: WASM Sandbox & Runtime
**Owner:** `wasm-sandbox-researcher`
**Scope:** QuickJS-WASM, Duktape, javy, Extism evaluation; host function injection; deterministic execution; memory/CPU limits; Effect ↔ WASM boundary
**Key questions:**
- Which WASM-compiled JS runtime best fits our needs? (browser + Bun, host functions, ES version, startup time, memory)
- How do we inject host functions (readCell, writeCell, getRange) into the WASM guest?
- Can we guarantee deterministic execution for CRDT consistency? (Math.random, Date.now)
- What's the FFI cost of Effect ↔ WASM calls?
- Can we interrupt WASM computation via fiber cancellation?

### Domain C: Existing Formula Art
**Owner:** `formula-art-researcher`
**Scope:** HyperFormula (Handsontable), hot-formula-parser, math.js (symbolic), algebrite, existing spreadsheet computation engines
**Key questions:**
- How does HyperFormula work? What's its architecture? What can we steal?
- What does hot-formula-parser's AST look like? Is it adaptable to our IR?
- What symbolic computation capabilities does math.js provide? Units? Matrices?
- Are there existing RPN/stack-based formula engines in JS/TS?
- What's the state of the art in browser-based spreadsheet computation?

### Domain D: Agent API Design
**Owner:** `agent-api-designer`
**Scope:** REPL session patterns, DataFrame APIs (pandas/polars mental models), Cell RPC contracts, Effect service interfaces
**Key questions:**
- What makes a good REPL for programmatic (non-human) use?
- How do pandas/polars express column operations? What's the composable API?
- What does the Cell RPC contract look like as an Effect service?
- How do the three APIs compose? Can a REPL session use DataFrame ops?
- What's the Effect service interface for each API surface?

## Artifact Requirements

Each agent produces **three artifacts:**

### 1. Research Visual Explainer (HTML)
- Self-contained HTML page written to `~/.agent/diagrams/`
- Follow the visual-explainer skill patterns (see css-patterns.md, libraries.md)
- Use a DISTINCTIVE aesthetic — each agent should pick a different direction:
  - Domain A (Stack VM): **Terminal Mono** preset — green/cyan on dark, monospace everything
  - Domain B (WASM): **Blueprint** aesthetic — deep slate/blue, technical drawing feel
  - Domain C (Existing Art): **Warm Signal** preset — cream paper, terracotta accents
  - Domain D (Agent API): **Swiss Clean** preset — white, geometric, single bold accent
- Include Mermaid diagrams with zoom controls where architecture needs visualization
- Include data tables for comparisons (runtime benchmarks, feature matrices)
- KPI cards for key metrics discovered during research
- Filename pattern: `formula-dsl-research-{domain}.html`

### 2. Design Overview Slide Deck (HTML)
- Self-contained HTML slide deck written to `~/.agent/diagrams/`
- Follow slide-patterns.md (SlideEngine, scroll-snap, cinematic transitions)
- Use the SAME aesthetic as your research doc (maintain visual consistency)
- 12-20 slides covering: problem → findings → proposed design → risks → next steps
- Must include at least one Mermaid diagram slide and one dashboard/KPI slide
- Filename pattern: `formula-dsl-slides-{domain}.html`

### 3. Spike Code (where feasible)
- Write to `packages/datagrid/test/spike-f{n}-*.test.ts`
- Use vitest + effect-v4 patterns (see existing spikes in test/ for style)
- Domain A: Minimal stack VM executing basic opcodes
- Domain B: QuickJS-WASM hello world with host function injection
- Domain C: HyperFormula integration spike (can it drive our CellCache?)
- Domain D: REPL session service skeleton as Effect service

## Coordination Protocol

### cm (Persistent State)
Store findings in cm so other agents can query them:
```
cm.store("formula-dsl", "research-{domain}", { ... findings })
cm.store("formula-dsl", "decisions-{domain}", { ... design decisions })
cm.store("formula-dsl", "risks-{domain}", [ ... identified risks ])
```

Query other agents' findings:
```
cm.get("formula-dsl", "research-stack-vm")
cm.get("formula-dsl", "decisions-wasm")
cm.keys("formula-dsl")
```

### pi-messenger (Real-time)
- Join the mesh on startup
- Post status updates as you work
- When you discover something that affects another domain, message that agent
- When you need information from another domain, query cm first, then message if not found

### Cross-References
- Domain A ↔ Domain B: Stack VM opcodes need to include a JS_EVAL opcode that dispatches to WASM
- Domain A ↔ Domain C: Compare our proposed opcode set against HyperFormula's function set
- Domain B ↔ Domain D: REPL sessions may need to eval JS in WASM sandbox
- Domain C ↔ Domain D: HyperFormula's API design may inform our DataFrame API
- All domains: The pre-design document at `packages/datagrid/.research/FORMULA-DSL-PREDESIGN.md` is the canonical source of truth

## Technology Context

- **Runtime:** Bun (not Node) — use `bun` for all package management
- **Framework:** Effect v4 (4.0.0-beta.23) — services use `ServiceMap.Service` pattern
- **State:** `@tmnl/stx` — transactional atom families (Atom.make, Atom.family)
- **Grid:** AG-Grid Community v34 — rendering layer only
- **Testing:** vitest with `@effect/vitest` for Effect tests
- **Monorepo:** NX workspace — `packages/datagrid/` is the target package

## What NOT To Do

- Do NOT modify existing FormulaEngine code — it's being replaced, not refactored
- Do NOT build a full implementation — research artifacts + design docs + small spikes only
- Do NOT use npm/yarn — Bun only
- Do NOT use Inter/Roboto fonts in visual explainers — read the skill's anti-patterns
- Do NOT re-litigate the aligned decisions — they're settled
