# FRKNK CEW/SDR Learning Roadmap

Tasker feature: `#F1192 Learning Track — CEW and SDR Foundations for FRKNK RFC`

This roadmap calibrates the educational layer for the FRKNK General SDR Framework RFC.

---

## 1. Prime learning profile

Captured from the CEW/SDR learning calibration checkpoint:

| Dimension | Chosen direction |
|---|---|
| Current RF/radio background | Beginner — broad concepts, not radio math/protocols |
| DSP/math depth | Intuitive first; equations only when necessary |
| CEW-adjacent scope | Spectrum awareness/monitoring, signal detection/classification, protocol/waveform understanding, legal/ethical boundaries |
| Hands-on style | Synthetic/file/fake-device labs first |
| Learning artifacts | Glossary, concept maps/diagrams, small labs/runbooks, annotated reading list |

Interpretation:

FRKNK RFC sections must not assume prior SDR fluency. Each subsystem should teach the underlying SDR/CEW concept before proposing FRKNK architecture.

Preferred section pattern:

```text
1. What this concept is
2. Why it matters in SDR/CEW
3. What canonical systems/specs do
4. What FRKNK should adopt/change
5. Hands-on lab or inspection path
6. Open questions for Prime
```

---

## 2. Safety and scope stance

This learning track is:

- receive-first;
- simulation-first;
- fake-device-first;
- legal/ethical-boundary explicit;
- strict about TX/agentic control gates.

Allowed first labs:

- synthetic IQ generation;
- file/corpus replay;
- fake Hermes/OpenHPSDR emulator;
- Quisk receive-path verification;
- offline sketch locator experiments;
- protocol packet inspection.

Deferred unless explicitly approved later:

- real RF transmit;
- jamming/interference implementation;
- uncontrolled hardware control;
- agentic execution of hardware-affecting commands;
- operational CEW tactics beyond defensive/simulation-level understanding.

Prime may be exploring CEW. FRKNK still keeps its boots tied.

---

## 3. Learning modules mapped to RFC sections

### Module 0 — Orientation: What CEW/SDR means here

Learning goals:

- distinguish SDR, RF monitoring, SIGINT-adjacent analysis, EW/CEW terminology, and FRKNK's safe research scope;
- understand the line between receive/analysis/simulation and harmful operational use;
- establish why strict capability policy matters.

RFC sections supported:

- intro/goals/non-goals;
- safety and ethics;
- command/capability policy.

Artifacts:

- glossary entries;
- safety/legal/ethics boundary doc;
- concept map: `CEW → SDR → FRKNK safe subset`.

---

### Module 1 — RF and spectrum basics

Learning goals:

- understand frequency, bandwidth, sampling rate, center frequency, tuning, and noise floor;
- understand why a radio sees a span around a center frequency;
- understand what an operator sees in a spectrum/waterfall display.

RFC sections supported:

- IQ stream runtime;
- signal workbench/cockpit seam;
- receiver state.

Hands-on lab:

```bash
cd packages/frknk/experiments/sdr-lab
uv run sdr-lab smoke
```

Observe:

- center frequency;
- tone offset;
- candidate frequency range;
- confidence vs verification status.

---

### Module 2 — IQ data and SDR receive chain

Learning goals:

- understand complex IQ samples intuitively;
- understand why IQ represents amplitude/phase around a center frequency;
- understand sample formats like complex64;
- understand how IQ moves through a receive pipeline.

RFC sections supported:

- `IqFrame` contract;
- file/corpus replay;
- device/stream abstraction.

Hands-on lab:

- synthesize noise + tone IQ;
- write/read `.c64` plus JSON sidecar;
- compare full-fidelity IQ to derived sketch artifacts.

Existing files:

- `experiments/sdr-lab/src/sdr_lab/iq/synthetic.py`
- `experiments/sdr-lab/src/sdr_lab/iq/corpus.py`

---

### Module 3 — FFT/STFT, spectrum, and waterfall

Learning goals:

- understand FFT as “what frequencies are present?”;
- understand STFT/waterfall as “how frequencies change over time?”;
- understand lossy time/frequency bins;
- understand why coarse waterfall tiles can still locate signals.

RFC sections supported:

- DSP block layer;
- analysis sidecars;
- cockpit display seam.

Hands-on lab:

```bash
cd packages/frknk/experiments/sdr-lab
uv run sdr-lab sketch-demo --output-dir reports/sketch-demo
```

Inspect:

- `waterfall-power-db.npy`
- `frame.json`
- `candidate.json`

Existing files:

- `experiments/sdr-lab/src/sdr_lab/sketches/waterfall.py`
- `experiments/sdr-lab/src/sdr_lab/locator.py`

---

### Module 4 — Destructive sketches and detection/classification

Learning goals:

- understand a sketch as a cheap, lossy representation;
- understand why deliberately damaging a signal can expose robust invariants;
- distinguish locator confidence from truth;
- understand verifier status.

RFC sections supported:

- ML/sketch sidecar architecture;
- verifier loop;
- corpus/evaluation metrics.

Hands-on lab:

- compare low-res waterfall lane vs one-bit IQ lane;
- inspect `one-bit-waterfall-power-db.npy`;
- observe that `SignalCandidate.verifierStatus` remains `unverified`.

Existing files:

- `experiments/sdr-lab/src/sdr_lab/sketches/destructive.py`
- `docs/lossy-sketch-locator-pipeline.md`

---

### Module 5 — Protocols and radio device models

Learning goals:

- understand device discovery/connect/start/stop at a high level;
- understand why Hermes/OpenHPSDR packets matter;
- understand what fake Hermes proves and does not prove;
- understand how device profiles differ from streams.

RFC sections supported:

- device/transport abstraction;
- hardware profiles;
- protocol adapters;
- emulator/conformance harness.

Hands-on lab:

```bash
cd packages/frknk/experiments/sdr-lab
uv run sdr-lab hermes-emulator --host 127.0.0.1 --port 1024 --verbose
```

Observe:

- discovery packets;
- start/stop stream;
- endpoint-6 IQ frames;
- control state updates.

Existing files:

- `experiments/sdr-lab/src/sdr_lab/openhpsdr/protocol.py`
- `experiments/sdr-lab/src/sdr_lab/openhpsdr/emulator.py`
- `docs/openhpsdr-emulator-seam.md`

---

### Module 6 — SDR framework precedents

Learning goals:

- learn what GNU Radio, SoapySDR, SigMF, Quisk, and OpenHPSDR each contribute;
- identify what FRKNK should imitate, avoid, or interoperate with;
- distinguish framework, device API, metadata format, app, and protocol.

RFC sections supported:

- research matrix;
- device abstraction;
- corpus/replay model;
- DSP graph design;
- hardware profile strategy.

Research anchors:

- GNU Radio docs/source;
- SoapySDR docs/source;
- SigMF spec;
- Quisk source/docs;
- OpenHPSDR/Hermes references.

Artifacts:

- annotated reading list;
- comparison matrix;
- concept map.

---

### Module 7 — Control plane, safety, and agentic interfaces

Learning goals:

- understand typed operator commands;
- understand capability gates;
- understand TX safety concerns;
- understand why agentic control must dry-run and require approval.

RFC sections supported:

- command plane;
- capability policy;
- TX safety;
- TMNL command island.

Hands-on lab:

- inspect fake command flow using non-hardware-affecting commands;
- compare `live`, `simulated`, `locked`, and `unavailable` capability states.

---

### Module 8 — FRKNK/TMNL architecture synthesis

Learning goals:

- understand why FRKNK owns runtime/contracts and TMNL owns cockpit/UI;
- understand how profiles, islands, commands, and streams interlock;
- understand the roadmap from lab prototype to framework substrate.

RFC sections supported:

- system model;
- TMNL integration seam;
- implementation roadmap.

Artifacts:

- subsystem map;
- contract inventory;
- roadmap and next feature-plan candidates.

---

## 4. First glossary seed

The glossary should cover at least:

- SDR
- CEW / cyber-electromagnetic warfare
- RF
- carrier
- center frequency
- bandwidth
- sample rate
- IQ samples
- FFT
- STFT
- spectrum
- waterfall
- demodulation
- modulation
- noise floor
- SNR
- AGC
- squelch
- LNA
- OpenHPSDR
- Hermes-Lite
- endpoint-6 IQ frames
- SigMF
- GNU Radio
- SoapySDR
- corpus replay
- sketch lane
- verifier
- capability policy
- TX safety

---

## 5. Immediate next actions

1. Draft glossary.
2. Draft safety/legal/ethics boundary.
3. Build annotated reading list and research matrix.
4. Produce RFC outline that embeds learning modules into subsystem sections.
