# FRKNK Hands-On CEW/SDR Learning Labs

Tasker task: `#4391 Design hands-on FRKNK learning labs using synthetic/file/fake-Hermes sources`

Status: lab-design draft for Prime review.

These labs are deliberately synthetic/file/fake-device first. They teach SDR and CEW-adjacent concepts without touching live RF transmit. The goal is understanding, not accidentally turning the workstation into a tiny regulatory problem with a progress bar.

---

## 0. Lab rules

All labs in RFC 0001 must obey:

```text
No real RF transmit.
No jamming/interference.
No decoding private/protected communications.
No agentic hardware action.
Synthetic/file/fake-device before live receive.
```

Preferred command root:

```bash
cd packages/frknk/experiments/sdr-lab
```

Current validation command family:

```bash
uv run sdr-lab smoke
uv run sdr-lab sketch-demo --output-dir reports/sketch-demo
uv run sdr-lab hermes-emulator --host 127.0.0.1 --port 1024 --verbose
```

---

## Lab 1 — Synthetic tone in noise

### Concept

A receiver sees a slice of spectrum. Signals sit above, beside, or inside noise. Before live hardware, we can generate a known synthetic tone and verify the pipeline can find it.

### What Prime should learn

- center frequency;
- tone offset;
- sample rate;
- noise floor;
- known truth metadata;
- why synthetic fixtures are powerful.

### Current entry point

```bash
uv run sdr-lab smoke
```

### Observe

- generated IQ metadata;
- expected tone frequency range;
- locator candidate;
- verifier status.

### RFC implication

FRKNK needs first-class `SyntheticSource` and `SyntheticNeedleSpec` semantics so every detector can be tested against known truth before being trusted with anything noisy, real, or expensive.

---

## Lab 2 — IQ corpus write/read round trip

### Concept

Raw IQ data is the authoritative recording. Metadata tells us how to interpret it. Without metadata, IQ is just a beautifully useless pile of complex numbers.

### What Prime should learn

- complex64 IQ storage;
- sidecar metadata;
- sample rate and center frequency preservation;
- why SigMF compatibility matters.

### Current code anchors

- `experiments/sdr-lab/src/sdr_lab/iq/synthetic.py`
- `experiments/sdr-lab/src/sdr_lab/iq/corpus.py`
- `experiments/sdr-lab/tests/test_iq_corpus.py`

### Future lab command shape

```bash
uv run sdr-lab corpus-demo --output-dir reports/corpus-demo
```

Proposed artifacts:

```text
reports/corpus-demo/capture.c64
reports/corpus-demo/capture.json
reports/corpus-demo/capture.sigmf-meta   # future SigMF export
reports/corpus-demo/roundtrip-report.json
```

### RFC implication

The RFC should specify a native corpus model and a SigMF mapping. Native can be ergonomic; SigMF gives portability.

---

## Lab 3 — Waterfall as spectrum-over-time

### Concept

A waterfall is a time history of frequency power. Each row asks “what frequencies were present during this short window?”

### What Prime should learn

- FFT as frequency ingredient list;
- STFT as repeated FFT over time;
- waterfall rows/time bins;
- frequency bins;
- lossy summaries.

### Current entry point

```bash
uv run sdr-lab sketch-demo --output-dir reports/sketch-demo
```

### Observe

```text
reports/sketch-demo/waterfall-power-db.npy
reports/sketch-demo/frame.json
reports/sketch-demo/candidate.json
```

### Interpretation

- The waterfall is useful for locating energy.
- It is not the signal itself.
- Lower resolution makes detection cheaper but less exact.

### RFC implication

FRKNK analysis products need provenance:

```text
artifact kind + source capture + parameters + confidence + limitations
```

---

## Lab 4 — Destructive one-bit sketch

### Concept

A destructive sketch intentionally throws away information to expose robust structure cheaply. One-bit IQ keeps only sign-like structure. This is crude, but sometimes enough to say “something is over there.”

### What Prime should learn

- lossy representation;
- invariants;
- why cheap detectors need clean verifiers;
- confidence is not truth.

### Current entry point

```bash
uv run sdr-lab sketch-demo --output-dir reports/sketch-demo
```

### Observe

```text
reports/sketch-demo/one-bit-waterfall-power-db.npy
reports/sketch-demo/candidate.json
```

### Interpretation

The one-bit lane should be treated as a scout. If it points somewhere interesting, clean IQ/DSP verifies.

### RFC implication

`SignalCandidate` should encode:

- source sketch lane;
- confidence;
- estimated frequency span;
- verifier status;
- link to raw capture and derived artifact.

---

## Lab 5 — Fake Hermes/OpenHPSDR protocol loop

### Concept

A radio device is not just IQ data. It also has discovery, start/stop, control packets, frequency/gain state, stream endpoints, watchdog behavior, and telemetry.

### What Prime should learn

- device discovery;
- start/stop stream lifecycle;
- command/control words;
- RX endpoint streaming;
- what an emulator proves and does not prove.

### Current entry point

Terminal A:

```bash
uv run sdr-lab hermes-emulator --host 127.0.0.1 --port 1024 --verbose
```

Optional verifier:

- packaged Quisk configured with `quisk/frknk_quisk_conf.py`.

### Observe

- Metis discovery;
- stop/start packets;
- PC→Hermes control packet parsing;
- endpoint-6 IQ streaming;
- frequency/sample-rate/LNA/MOX state updates.

### Safety

This is fake-device only. MOX/PTT/TX bits may be parsed for compatibility, but no RF is transmitted.

### RFC implication

FRKNK should define protocol adapters and conformance harnesses separately:

```text
Protocol parser ≠ hardware authority.
Emulator state ≠ live RF action.
```

---

## Lab 6 — Command dry-run and policy inspection

### Concept

Before hardware-affecting commands can exist safely, every command must be inspectable and dry-runnable.

### What Prime should learn

- command envelope;
- capability state;
- policy result;
- approval gates;
- audit log.

### Future lab command shape

```bash
uv run sdr-lab policy-demo --profile receive-only --command set-rx-frequency --hz 7100000
uv run sdr-lab policy-demo --profile receive-only --command mox-on
```

Expected behavior:

```text
set-rx-frequency: allowed or simulated depending backend/profile
mox-on: denied/locked in RFC 0001 profile
```

### RFC implication

Policy is not a UI feature. Policy is runtime law. UI is just one client.

---

## Lab 7 — SigMF export/import compatibility

### Concept

A corpus should be portable. SigMF is the canonical metadata target for recorded digital signal samples.

### What Prime should learn

- `.sigmf-meta` vs `.sigmf-data`;
- `global`, `captures`, `annotations`;
- `core:datatype`, `core:sample_rate`, `core:frequency`;
- how candidates/truth can map to annotations or extensions.

### Future lab command shape

```bash
uv run sdr-lab sigmf-export reports/sketch-demo/capture.c64 --metadata reports/sketch-demo/capture.json
uv run sdr-lab sigmf-inspect reports/sketch-demo/capture.sigmf-meta
```

### RFC implication

FRKNK should support SigMF export before it invents any elaborate corpus registry. We are building foundations, not a museum labyrinth.

---

## 8. Lab progression map

| Lab | Source kind | Teaches | Current state |
|---|---|---|---|
| 1 Synthetic tone | Synthetic | RF basics, known truth | Available via `smoke` |
| 2 IQ corpus round trip | File | IQ + metadata | Code/tests exist; CLI demo proposed |
| 3 Waterfall | Synthetic/file | FFT/STFT/waterfall | Available via `sketch-demo` |
| 4 One-bit sketch | Synthetic/file | lossy scout vs verifier | Available via `sketch-demo` |
| 5 Fake Hermes | Fake device | protocol/device lifecycle | Available via `hermes-emulator` |
| 6 Policy dry-run | Simulated command | safety command plane | Proposed |
| 7 SigMF export/import | File/spec | corpus interoperability | Proposed |

---

## 9. RFC adoption recommendation

RFC 0001 should include Labs 1, 3, 4, and 5 as current proof points, then name Labs 2, 6, and 7 as immediate implementation candidates.

Suggested next implementation slice after RFC approval:

```text
FRKNK Corpus + Policy Slice
  1. SigMF export/import for current IQ captures.
  2. CommandEnvelope + PolicyEvaluation schemas.
  3. Receive-only policy demo CLI.
  4. Artifact manifest linking raw IQ → sketches → candidates.
```
