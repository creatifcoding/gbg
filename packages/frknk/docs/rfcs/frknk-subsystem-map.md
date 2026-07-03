# FRKNK General SDR Framework — Subsystem Map

Tasker task: `#4368 Design FRKNK subsystem map`

Status: subsystem-map draft for RFC outline review.

This map defines FRKNK's architectural seams before implementation resumes. The goal is a clean spine: Python owns radio/runtime heat; TypeScript owns contracts; TMNL consumes state; Quisk verifies selected behavior. No spaghetti radio. No occult side channels. Very chic.

---

## 1. High-level subsystem graph

```text
┌───────────────────────────────────────────────────────────────────┐
│                           TMNL Cockpit                             │
│  layout profiles • operator controls • capability inspector • UX    │
└───────────────────────────────▲───────────────────────────────────┘
                                │ typed state/events/commands
┌───────────────────────────────┴───────────────────────────────────┐
│                    TypeScript Contract Surface                      │
│      Effect Schema • JSON Schema export • fixtures • tests          │
└───────────────────────────────▲───────────────────────────────────┘
                                │ schema mirror / encoded messages
┌───────────────────────────────┴───────────────────────────────────┐
│                         FRKNK Python Runtime                        │
│ ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ Device/     │ │ IQ Stream    │ │ DSP/Sketch   │ │ Command/     │ │
│ │ Backends    │ │ Runtime      │ │ Pipelines    │ │ Policy Plane │ │
│ └──────▲──────┘ └──────▲───────┘ └──────▲───────┘ └──────▲───────┘ │
│        │               │                │                │         │
│ ┌──────┴──────┐ ┌──────┴───────┐ ┌──────┴───────┐ ┌──────┴───────┐ │
│ │ Protocol    │ │ Corpus/      │ │ Verifier/    │ │ Event Log /  │ │
│ │ Adapters    │ │ Replay       │ │ Conformance  │ │ Telemetry    │ │
│ └─────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │
└───────────────────────────────▲───────────────────────────────────┘
                                │
        ┌───────────────────────┼────────────────────────┐
        │                       │                        │
┌───────┴────────┐      ┌───────┴────────┐       ┌───────┴────────┐
│ Synthetic      │      │ File/Corpus    │       │ Fake/Live      │
│ Sources        │      │ Replay         │       │ Radio Protocol │
└────────────────┘      └────────────────┘       └────────────────┘
```

---

## 2. Subsystem responsibilities

### 2.1 TypeScript Contract Surface

Owns canonical cross-runtime vocabulary.

Responsibilities:

- Effect Schema definitions;
- JSON Schema export target;
- TypeScript type inference;
- contract fixtures;
- encode/decode tests;
- TMNL-facing state/command/event schemas.

Does not own:

- hot IQ arrays;
- UDP loops;
- DSP kernels;
- ML inference runtime.

Key files today:

- `packages/frknk/src/contracts.ts`
- `packages/frknk/src/iq-corpus.ts`
- parked tangent: `packages/frknk/src/cockpit.ts`

---

### 2.2 Python Runtime

Owns hot SDR behavior and research-lab execution.

Responsibilities:

- synthetic IQ generation;
- corpus read/write/replay;
- fake Hermes emulator;
- OpenHPSDR packet parsing;
- IQ frame production;
- waterfall/sketch computation;
- locator/candidate generation;
- future protocol adapters;
- future policy enforcement runtime.

Key files today:

- `experiments/sdr-lab/src/sdr_lab/iq/synthetic.py`
- `experiments/sdr-lab/src/sdr_lab/iq/corpus.py`
- `experiments/sdr-lab/src/sdr_lab/openhpsdr/protocol.py`
- `experiments/sdr-lab/src/sdr_lab/openhpsdr/emulator.py`
- `experiments/sdr-lab/src/sdr_lab/sketches/waterfall.py`
- `experiments/sdr-lab/src/sdr_lab/sketches/destructive.py`
- `experiments/sdr-lab/src/sdr_lab/locator.py`

---

### 2.3 Device/Backend Abstraction

Normalizes sources of IQ and device state.

Backend families:

| Backend | RFC 0001 status | Notes |
|---|---|---|
| Synthetic source | First-class | Deterministic truth fixtures. |
| File/corpus replay | First-class | Regression/offline analysis. |
| Fake Hermes/OpenHPSDR | First-class | Safe protocol harness. |
| Hermes-Lite/OpenHPSDR hardware | Design target, not live default | Future profile. |
| SoapySDR family | Future compatibility check | API-shape precedent. |
| UHD/RTL-SDR/HackRF/audio-card | Future | Do not overfit RFC 0001. |

Core seam:

```text
RadioDevice
  identity
  backendKind
  transportKind
  lifecycle
  rxStreams
  capabilities
  telemetry
  profile
```

---

### 2.4 Protocol Adapter Layer

Translates backend protocols into FRKNK device state/events.

First adapter:

- Hermes/OpenHPSDR Protocol 1 subset.

Responsibilities:

- parse discovery/start/stop/control packets;
- emit typed protocol events;
- produce endpoint-6 IQ frames for fake Hermes;
- map control words into `HermesControlState`;
- preserve TX/MOX/PTT bits as observed state without authorizing live TX.

Boundary:

```text
Protocol compatibility does not equal capability permission.
```

---

### 2.5 IQ Stream Runtime

Moves sample frames through live/replay/synthetic paths.

Responsibilities:

- frame identity and ordering;
- sample format metadata;
- center frequency/sample rate propagation;
- discontinuity/error reporting;
- stream lifecycle events;
- stats/throughput accounting.

Core seam:

```text
IqFrame = header + payload reference
```

Payload can be:

- in-memory NumPy array;
- file slice reference;
- shared memory reference;
- future socket/zero-copy buffer.

---

### 2.6 DSP / Pipeline Layer

Runs transformations over IQ and derived artifacts.

Current blocks:

- low-res waterfall;
- one-bit IQ;
- one-bit waterfall;
- locator.

Future blocks:

- decimator;
- channelizer;
- demod verifier;
- classifier;
- metrics evaluator.

Design stance:

```text
Pipeline specs are explicit enough to inspect, not so grand they become a second GNU Radio.
```

---

### 2.7 Sketch / ML Sidecar Layer

Runs cheap analysis lanes and emits candidate suggestions.

Responsibilities:

- generate sketch artifacts;
- emit `SignalCandidate`;
- track provenance;
- keep verifier status explicit;
- avoid claiming truth.

Core rule:

```text
Lossy sketch says “look here.” Clean verifier decides whether “here” matters.
```

---

### 2.8 Corpus / Replay / Artifact Manifest

Preserves raw IQ and derived artifacts.

Responsibilities:

- native `.c64 + json` support;
- SigMF export/import mapping;
- artifact manifest linking raw capture → derived sketches → candidates → verifier results;
- deterministic regression fixtures;
- synthetic truth labels.

Immediate gap:

- SigMF export/import not implemented yet.

---

### 2.9 Command / Policy Plane

Controls device/runtime actions safely.

Responsibilities:

- typed command envelopes;
- dry-run evaluation;
- capability checks;
- approval checks;
- event/audit logging;
- rejection reasons.

Default policy:

```text
RX lab actions: available/simulated.
TX/PTT/MOX/PA/ATU/drive: locked.
Jamming/interference: prohibited/out-of-scope.
```

---

### 2.10 Event Log / Telemetry

Records what happened and why.

Responsibilities:

- command accepted/denied/simulated events;
- device lifecycle events;
- stream lifecycle events;
- candidate events;
- verifier events;
- error/fault events;
- audit trail.

Design implication:

- Rejected commands are events too.
- Safety needs evidence.

---

### 2.11 Quisk Verifier Seam

Uses Quisk as reference behavior, not architecture owner.

Responsibilities:

- verify fake Hermes compatibility;
- provide cockpit/DSP operational reference;
- optional/manual GUI verifier until dependency problems are solved.

Does not own:

- FRKNK UI grammar;
- final DSP architecture;
- safety policy.

---

### 2.12 TMNL Integration Seam

Consumes FRKNK contracts and events.

Responsibilities:

- render cockpit layout/profile;
- display device/stream/candidate state;
- present command dry-runs and approval prompts;
- inspect capabilities;
- browse corpus/artifacts;
- show locked/unavailable/simulated states clearly.

Boundary:

```text
TMNL can propose commands.
FRKNK policy decides commands.
```

---

## 3. Data/control flows

### 3.1 Receive flow

```text
Backend → RadioDevice → IqFrame → Pipeline/Sketch → Candidate → Event/Artifact → TMNL
```

### 3.2 Replay flow

```text
CorpusManifest → ReplaySource → IqFrame → Pipeline/Verifier → ArtifactManifest
```

### 3.3 Command flow

```text
TMNL/CLI/Agent → CommandEnvelope → PolicyEvaluation → Runtime execution/rejection → EventLog
```

### 3.4 Conformance flow

```text
ProtocolFixture/Quisk interaction → Fake Hermes → Packet/Event log → ConformanceReport
```

---

## 4. Boundary decisions

| Boundary | Decision |
|---|---|
| Python vs TypeScript | Python executes hot runtime; TypeScript defines canonical contracts. |
| FRKNK vs TMNL | FRKNK owns radio truth; TMNL owns cockpit interaction. |
| Sketch vs verifier | Sketch suggests; verifier confirms/rejects. |
| Protocol parser vs hardware authority | Parser observes state; policy authorizes action. |
| Corpus vs artifact | Raw IQ is primary; sketches/candidates are derived artifacts. |
| Fake vs live device | Fake must be explicit; no silent live fallback. |

---

## 5. Immediate subsystem gaps

1. SigMF export/import.
2. CommandEnvelope + PolicyEvaluation contracts.
3. Artifact manifest linking raw IQ to sketches/candidates.
4. Protocol conformance report format.
5. TMNL-facing read-only state seam.
6. Python/TypeScript contract fixture round-trip strategy.

---

## 6. Recommended implementation order after RFC

```text
1. Corpus + SigMF + artifact manifest
2. Command/policy contracts + dry-run CLI
3. Protocol conformance reports
4. TMNL read-only cockpit seam
5. Richer sketch lanes + verifier metrics
```
