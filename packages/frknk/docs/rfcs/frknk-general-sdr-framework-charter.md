# FRKNK General SDR Framework RFC — Charter

Tasker feature plan: `#F1186 FRKNK General SDR Framework RFC Program`

This charter captures Prime's initial scope decisions before research and RFC drafting. The RFC must be research-grounded, subsystem-by-subsystem, and reviewed through explicit Prime involvement gates.

---

## 1. RFC ambition

FRKNK should target a **general SDR framework foundation** while preserving the **research lab toolkit** character.

Because this is Prime's first foray into CEW development, the RFC is also an educational artifact. It must teach the CEW/SDR concepts it depends on instead of assuming field fluency. Each major subsystem should include a learning layer before the architecture layer:

```text
Concept primer → source grounding → FRKNK design implication
```

Meaning:

- FRKNK is not only a Quisk/Hermes experiment.
- FRKNK is not only an ML sketch playground.
- FRKNK should become a reusable SDR substrate with device/runtime abstractions, IQ stream semantics, corpus/replay, command/control policy, safety, conformance, and sidecar analysis.
- The research-lab dimension remains first-class: synthetic sources, corpus replay, sketch lanes, experiments, and verification harnesses are not afterthoughts.

Working thesis:

```text
FRKNK = general SDR framework substrate + research lab toolkit
TMNL  = cockpit/operator UI consumer
Quisk = reference/verifier/protocol oracle, not the final UI grammar
```

---

## 2. First-class backend targets

The RFC must treat these backend families as first-class design targets:

1. **Hermes-Lite / OpenHPSDR**
   - Current concrete protocol seam.
   - Grounded by fake Hermes emulator and Quisk integration.
   - Provides real radio-control semantics: discovery, control packets, RX endpoint streaming, LNA/sample-rate/frequency state.

2. **File / corpus replay**
   - Required for deterministic testing, offline analysis, regression suites, and ML sidecars.
   - Must support full-fidelity IQ plus derived artifacts and labels.

3. **Synthetic source**
   - Required for reproducible tests, conformance, known-answer fixtures, and early algorithm development.
   - Must produce IQ frames with known truth metadata.

Explicitly deferred but likely future targets:

- SoapySDR family.
- UHD / USRP.
- RTL-SDR.
- HackRF.
- Audio-card SDR.

These can appear in the RFC as future backend compatibility checks, but the first RFC does not need to overfit their APIs.

---

## 3. Runtime boundary

The RFC assumes:

```text
Python owns hot SDR/runtime/protocol/ML work.
TypeScript owns contracts, profile/state semantics, and TMNL integration.
```

Implications:

- Python remains the primary environment for IQ arrays, UDP protocol loops, sketch lanes, DSP experiments, corpus tooling, and ML sidecars.
- TypeScript/Effect Schema remains the canonical contract surface for TMNL and cross-runtime validation.
- FRKNK should define contract artifacts that Python can mirror with Pydantic and TMNL can consume through Effect Schema.
- Native Rust/C/C++ acceleration is allowed as a future implementation detail, not a first-RFC assumption.

---

## 4. Mandatory research anchors

The RFC research matrix must include at least these systems/specifications:

| Anchor | Why it matters |
|---|---|
| GNU Radio | canonical SDR flowgraph/block/runtime precedent |
| SoapySDR | device abstraction and hardware-agnostic SDR API precedent |
| SigMF | IQ metadata/corpus interchange precedent |
| Quisk | concrete reference cockpit/protocol/DSP behavior |
| OpenHPSDR / Hermes-Lite | first concrete radio protocol and hardware profile target |

Research should prefer primary/canonical sources:

- official docs;
- source repositories;
- protocol specifications;
- package docs;
- design papers where available.

Agent summaries are useful only after source grounding.

---

## 5. Safety stance

The RFC must use **strict capability-gated, approval-first control**.

Required design stance:

```text
Every hardware-affecting command passes through capability policy.
TX/PA/ATU/agentic commands require explicit capability, telemetry, and approval rules.
```

Control states must distinguish:

- `live`
- `simulated`
- `locked`
- `unavailable`

Agentic control must not bypass policy. A command island/chat surface can propose actions, but actions must dry-run, pass capability guards, and request confirmation when required.

Prime may be enthusiastic; RF hardware should remain unimpressed and well-guarded.

---

## 6. RFC must answer

The RFC must answer, at minimum:

1. What is a `RadioDevice` in FRKNK?
2. What is an `IqFrame`, and how do live/replay/synthetic streams differ?
3. How do DSP blocks compose without forcing FRKNK to become GNU Radio badly?
4. What is the typed command path from UI/agent/tooling to hardware/runtime?
5. How do hardware profiles and capability policies work?
6. How do file/corpus replay and synthetic sources fit into the same runtime as live radio?
7. How do lossy sketch/ML sidecars make suggestions without becoming truth?
8. How does TMNL consume FRKNK without FRKNK becoming a UI framework?
9. What does the fake Hermes emulator prove, and what does it not prove?
10. What implementation slices should follow the RFC?

---

## 7. Provisional subsystem sections

The RFC should be organized around these subsystems:

1. Introduction, goals, non-goals, and system model.
2. Device and transport abstraction.
3. IQ stream runtime and frame semantics.
4. DSP block/pipeline layer.
5. Control command plane and event log.
6. Hardware profiles and capability policy.
7. TX safety and approval model.
8. File/corpus/replay model, including SigMF compatibility analysis.
9. Protocol adapters, beginning with Hermes/OpenHPSDR.
10. Emulator and conformance harness.
11. ML/sketch/analysis sidecars and clean verifier loop.
12. TMNL cockpit integration seam.
13. Cross-runtime contract strategy: Effect Schema + Pydantic mirror.
14. Packaging, Nix, developer workflows, and testing.
15. Roadmap and next feature-plan candidates.

---

## 8. Governance and Prime involvement

Prime involvement is required at these gates:

1. Charter/scope approval.
2. Learning roadmap/depth approval.
3. Research matrix approval.
4. RFC outline approval.
5. Full RFC review workshop.
6. Final roadmap ratification.

No implementation work should proceed from this RFC until the relevant architectural slice is explicitly chosen.

---

## 9. Current status

Captured from the RFC charter interview:

- Ambition: general SDR framework foundation, with research lab toolkit also first-class.
- First-class backends: Hermes/OpenHPSDR, file/corpus replay, synthetic source.
- Runtime boundary: Python hot SDR runtime + TypeScript contracts/UI seam.
- Mandatory anchors: GNU Radio, SoapySDR, SigMF, Quisk, OpenHPSDR/Hermes-Lite.
- Safety: strict capability-gated, approval-first control.

Learning profile artifact: `frknk-cew-sdr-learning-roadmap.md`.

Next step: draft glossary and safety/legal/ethics boundary, then build the research matrix.
