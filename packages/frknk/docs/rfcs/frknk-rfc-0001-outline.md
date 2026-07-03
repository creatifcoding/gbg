# RFC 0001 Outline — FRKNK General SDR Framework

Tasker task: `#4367 Draft full RFC table of contents`

Status: outline draft for Prime review gate.

This is not the full RFC yet. It is the proposed skeleton that will become `rfc-0001-frknk-general-sdr-framework.md` after Prime approves the shape. Yes, Prime, we are making the skeleton before teaching it to dance.

---

## 0. Front matter

- RFC number: `0001`
- Title: `FRKNK General SDR Framework`
- Status: Draft
- Owners: Prime + FRKNK/TMNL architecture
- Tasker feature: `#F1186`
- Decision gates:
  - research matrix accepted;
  - outline accepted;
  - full RFC review;
  - roadmap ratification.

---

## 1. Abstract

Short statement:

```text
FRKNK is a Python-owned SDR runtime and research-lab foundation with TypeScript/Effect Schema contracts and TMNL integration seams. It supports synthetic sources, file/corpus replay, fake Hermes/OpenHPSDR emulation, future hardware backends, strict capability policy, and clean verifier loops for lossy sketch/ML sidecars.
```

---

## 2. Goals and non-goals

### Goals

- Establish FRKNK as a general SDR framework substrate.
- Preserve research-lab toolkit ergonomics.
- Define device/runtime/IQ/corpus/control abstractions.
- Ground corpus in SigMF compatibility.
- Ground device abstraction in SoapySDR precedent without depending on SoapySDR in cycle 1.
- Use Hermes/OpenHPSDR as first concrete protocol profile.
- Keep Quisk as verifier/reference.
- Define TMNL integration seam without making FRKNK a UI framework.
- Define receive-first safety/capability policy.
- Teach CEW/SDR concepts as the RFC goes.

### Non-goals

- No live RF transmit in RFC 0001.
- No jamming/interference implementation.
- No full GNU Radio clone.
- No final TMNL cockpit implementation.
- No generic hardware support beyond first-class design seams.
- No agentic command bypass.

---

## 3. Learning prelude — SDR/CEW vocabulary

Purpose: summarize key terms from `frknk-cew-sdr-glossary.md`.

Pattern:

```text
Concept primer → source grounding → FRKNK design implication
```

Terms to introduce:

- SDR;
- EMS/RF/EMOE;
- IQ samples;
- center frequency / sample rate / bandwidth;
- FFT/waterfall/sketch;
- radio device/backend/profile;
- capability/policy/dry-run;
- TX/PTT/MOX locked semantics.

---

## 4. System model

Define the high-level architecture:

```text
Synthetic/File/Fake/Hardware Backends
  → RadioDevice adapters
  → IQ Stream Runtime
  → DSP / Sketch / Verifier Pipelines
  → Corpus + Artifact Manifest
  → Command/Event/Policy Plane
  → TMNL Contract Seam
```

Explicit ownership:

| Layer | Owner |
|---|---|
| Hot IQ/protocol/ML runtime | Python |
| Canonical contracts | TypeScript Effect Schema |
| Python validation mirror | Pydantic/generated schema |
| Cockpit/operator UI | TMNL |
| Reference verifier/cockpit | Quisk |

---

## 5. Device and transport abstraction

### Concept primer

A radio device is more than a sample source: it has discovery, stream lifecycle, frequency/gain/sample-rate controls, capabilities, telemetry, and failure modes.

### Source grounding

- SoapySDR discovery/factory/device API.
- Hermes-Lite2 protocol discovery/start/stop/control packets.
- Quisk hardware config and Hermes support.

### FRKNK design

Define:

- `RadioDeviceIdentity`
- `BackendKind`
- `TransportKind`
- `RadioDeviceState`
- `DeviceCapability`
- `RadioDeviceOps`
- `DeviceTelemetry`

Required first backends:

- synthetic source;
- corpus replay;
- fake Hermes/OpenHPSDR.

Future compatibility checks:

- SoapySDR;
- UHD;
- RTL-SDR;
- HackRF;
- audio-card SDR.

---

## 6. IQ stream runtime and frame semantics

### Concept primer

IQ samples are the primary representation of received RF slices. Frames need sample format, time/order, frequency context, and provenance.

### Source grounding

- GNU Radio stream flowgraph model.
- SigMF sample datatype/capture metadata.
- Quisk I/Q record/play behavior.

### FRKNK design

Define:

- `IqFrameHeader`
- `IqFrameRef`
- `IqSampleFormat`
- `IqStreamState`
- `IqStreamStats`
- `StreamDiscontinuity`

First-frame rule:

```text
Every IQ frame must carry enough metadata to interpret its samples without global guessing.
```

---

## 7. DSP block and pipeline layer

### Concept primer

DSP blocks transform sample streams or derived artifacts. Pipelines connect blocks but should not force all FRKNK work into one universal graph abstraction.

### Source grounding

- GNU Radio flowgraph and scheduler lifecycle.
- GNU Radio runtime reconfiguration cautions.

### FRKNK design

Define:

- `PipelineSpec`
- `BlockSpec`
- `BlockInput`
- `BlockOutput`
- `PipelineRuntimeState`
- `LatencyProfile`

Design stance:

```text
FRKNK borrows graph vocabulary but keeps execution Pythonic and bounded.
```

---

## 8. Command, event, and policy plane

### Concept primer

Samples and commands are different species. Samples flow hot; commands must be inspectable, policy-checked, and auditable.

### Source grounding

- GNU Radio message passing as separate async control/data mechanism.
- JDN 3-16 deconfliction/authorization concepts.
- FCC/Part 97 safety boundaries.

### FRKNK design

Define:

- `CommandEnvelope`
- `CommandKind`
- `PolicyEvaluation`
- `ApprovalState`
- `CommandResult`
- `RuntimeEvent`
- `EventLogEntry`

Invariant:

```text
No command executes unless capability policy returns allow.
```

---

## 9. Hardware profiles and capability policy

### Concept primer

A profile is the contract between what the backend can do, what policy permits, and what the UI may show.

### Source grounding

- SoapySDR capability surfaces.
- Hermes-Lite2 memory map/control features.
- Part 97 control-operator requirements for any future ham TX.

### FRKNK design

Define capability states:

- `available`
- `simulated`
- `requiresApproval`
- `locked`
- `unavailable`
- `unsupported`

Default RFC 0001 profile:

```text
receive-only-lab:
  synthetic: available
  corpusReplay: available
  fakeHermesRx: available/simulated
  liveRx: unavailable or deferred
  tx/mox/ptt/pa/atu/drive: locked
```

---

## 10. TX safety and approval model

### Concept primer

Transmit is a different legal/safety category from receive. Even simulated TX state must be labeled honestly.

### Source grounding

- FCC jammer enforcement.
- CISA RF interference guidance.
- 47 CFR Part 97 station license/control operator duties.
- JDN 3-16 authorization/deconfliction vocabulary.

### FRKNK design

- TX commands exist in schemas for honesty.
- RFC 0001 runtime locks them.
- Future activation requires separate feature plan, legal/safety review, hardware profile, explicit operator identity, approval UX, and audit log.

---

## 11. Corpus, replay, and SigMF compatibility

### Concept primer

Recorded IQ without metadata decays into mystery bytes. Corpus replay turns experiments into regression tests.

### Source grounding

- SigMF recording model: dataset + JSON metadata.
- SigMF `global`, `captures`, `annotations`.
- Quisk I/Q recording/playback.

### FRKNK design

Define:

- `CaptureMetadata`
- `CorpusManifest`
- `ReplaySource`
- `DerivedArtifactManifest`
- `SigMfExportMapping`
- `SyntheticTruthAnnotation`

Immediate recommendation:

```text
Next implementation slice should add SigMF export/import for current IQ captures.
```

---

## 12. Protocol adapters — Hermes/OpenHPSDR first

### Concept primer

Protocol adapters translate packets into typed device state/events and typed commands into packets.

### Source grounding

- Hermes-Lite2 protocol wiki.
- Existing FRKNK fake Hermes emulator tests.
- Quisk/Hermes integration verification.

### FRKNK design

Define:

- `ProtocolAdapter`
- `HermesControlState`
- `MetisDiscoveryEvent`
- `HermesRxFrameEvent`
- `HermesCommandParseResult`
- `ProtocolConformanceReport`

Explicit boundary:

```text
Parsing TX/MOX bits for compatibility does not authorize real transmission.
```

---

## 13. Emulator and conformance harness

### Concept primer

A fake device lets us test protocol and UI/runtime behavior deterministically before hardware.

### Source grounding

- Hermes-Lite2 protocol start/stop/discovery/control details.
- Quisk compatibility run.

### FRKNK design

- Fake Hermes remains a first-class backend.
- Conformance tests should cover discovery, start/stop, control packet parsing, IQ frame sequence, and telemetry.
- Quisk is optional/manual verifier unless dependency/runtime constraints are solved.

---

## 14. ML/sketch/analysis sidecars and clean verifier loop

### Concept primer

Sketches are cheap scouts. They do not replace raw IQ or clean DSP verification.

### Source grounding

- Current FRKNK lossy sketch locator pipeline.
- SigMF annotations for candidate/truth mapping.
- Quisk clean demod/verification precedent.

### FRKNK design

Define:

- `SignalSketchFrame`
- `SketchLaneKind`
- `SignalCandidate`
- `VerifierStatus`
- `AnalysisArtifact`
- `CandidateProvenance`

Rule:

```text
Candidate = suggestion. Verifier = evidence. Operator = decision.
```

---

## 15. TMNL cockpit integration seam

### Concept primer

TMNL should consume FRKNK state/contracts. FRKNK should not become UI.

### Source grounding

- Quisk cockpit observations.
- Existing TMNL SDR cockpit architecture brief.
- Effect Schema / effect-atom/STX project conventions.

### FRKNK design

Define TMNL-facing surfaces:

- device summary atom/state;
- stream summary;
- candidate list;
- command dry-run endpoint;
- policy/capability inspector;
- artifact/corpus browser.

Boundary:

```text
FRKNK owns truth and runtime events.
TMNL owns layout, interaction grammar, and operator affordances.
```

---

## 16. Cross-runtime contract strategy

### Concept primer

Python and TypeScript need one shared vocabulary, not vibes and mirrored interface drift.

### Source grounding

- Project Effect Schema discipline.
- Existing FRKNK TypeScript contracts and Python dataclasses/Pydantic-adjacent models.

### FRKNK design

- TypeScript Effect Schema remains canonical for UI/runtime seam.
- Python uses generated JSON Schema/Pydantic mirror where feasible.
- Contract tests validate encode/decode fixtures across runtimes.

---

## 17. Packaging, Nix, developer workflow, and testing

### Concept primer

SDR dependencies are messy. Reproducible lab shells are part of the architecture, not garnish.

### Source grounding

- Existing FRKNK package-local Nix flake.
- Current validation command record.
- Quisk dependency/runtime lessons.

### FRKNK design

- Package-local Nix remains the intended environment.
- Python `uv` project owns SDR lab deps.
- Bun owns TypeScript contracts/tests.
- Nix path tracking issue remains documented until package is git-tracked.

---

## 18. Risks and open questions

Minimum risk categories:

- legal/safety;
- hardware damage/misconfiguration;
- scope creep into GNU Radio clone;
- schema drift between Python and TypeScript;
- UI/runtime coupling;
- corpus metadata drift;
- real-time performance assumptions;
- Quisk verifier dependency fragility.

---

## 19. Roadmap and next feature-plan candidates

Recommended first post-RFC implementation candidates:

1. Corpus + SigMF compatibility slice.
2. CommandEnvelope + PolicyEvaluation slice.
3. Protocol adapter/conformance report hardening.
4. TMNL read-only cockpit seam prototype.
5. Richer sketch lanes + verifier metrics.

---

## 20. Appendices

- A. Research matrix summary.
- B. Glossary.
- C. Safety boundary.
- D. Lab progression.
- E. Source URL ledger.
- F. Contract inventory.
