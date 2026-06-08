# Muse 2 Experiment Design and ML Pipeline Research Ledger

Date: 2026-06-08  
Owner: Val  
Scope: Characterize Muse 2 / Muse S signals, design controlled TMNL experiments, and plan second-order ML/AI pipelines.

## Operating Doctrine

Capture is not interpretation. The BLE capture path must remain loss-minimizing and streaming-first. Experiment orchestration, labeling, video/pose capture, signal analysis, and ML model training are downstream consumers or replay pipelines.

Do not make neurophysiological claims from unlabeled captures. The pipeline must distinguish:

1. **Transport integrity** — packet rates, drops, sequence gaps, jitter, stream health.
2. **Signal quality** — value ranges, variance, clipping, flatlines, spectral stability, artifact sensitivity.
3. **Experimental evidence** — labeled block contrasts such as eyes-open vs eyes-closed, blink/jaw/head movement.
4. **Interpretation / inference** — second-order claims requiring validation, holdouts, and caveats.

## Research Questions

- What is the scientifically respectable way to evaluate a consumer four-channel Muse headset?
- How should TMNL conduct synchronized multimodal experiments using Muse EEG/IMU, webcam video, pose estimation, markers, and manifests?
- What dataset structure will remain usable for future MNE/BIDS/Braindecode/JAX/ONNX pipelines?
- When do we use LSL/Timeflux/Prefect versus custom TMNL tooling?
- What should the naive second-order baseline be, and what should wait for research-informed ML design?

---

## Source Ledger and Inferences

### 1. Consumer-grade EEG validation framework — structured three-level evaluation

**Source**: “A comprehensive evaluation framework for consumer-grade EEG devices: signal quality, robustness, and usability” (PMC)  
URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC12972051/

**Evidence from source**:

- Proposes three evaluation levels for consumer EEG:
  1. Detection of non-neural physiological artifacts / larger scalp-potential changes.
  2. Brain-wave detection using paradigms such as eyes-open vs eyes-closed alpha changes.
  3. Noise robustness under movement or environmental interference.
- Uses tasks including eye blinking, jaw clenching, eyes-open/closed, and head movements.
- Notes consumer dry wireless EEG is sensitive to motion and environmental changes.
- For Muse 2, channels are AF7, AF8, TP9, TP10 at 256 Hz.
- Experimental blocks used pre-rest, task, and post-rest structure.
- Example tasks use 20 movements cued every 3 seconds within a 1-minute task block.
- Brain wave detection uses alpha power changes / Berger effect and individual alpha peak frequency.
- Movement robustness compares spectral patterns before and after movement.

**Inference for TMNL**:

We should adopt the same three-level evaluation shape as our experimental spine:

- Level 1: artifact / signal detectability: blink, jaw clench, head turn, possibly eyebrow/forehead movement.
- Level 2: neural-feature plausibility: eyes-closed vs eyes-open alpha contrast, individual alpha peak candidate.
- Level 3: robustness: compare rest before/after motion blocks; quantify PSD correlation and signal-quality degradation.

This gives us a defensible protocol for a consumer EEG device without pretending it is clinical-grade instrumentation.

**Design consequences**:

- TMNL protocol runner should support `pre_rest`, `task`, `post_rest` blocks.
- Marker scheduler should support repeated cues every N seconds.
- Reports should separate artifact detectability from brain-wave detection.
- First-order analyzer should be able to segment by block and repetition markers.

**Confidence**: High. Directly Muse 2 relevant and provides concrete task design.

---

### 2. Consumer/research-grade EEG dataset — public paradigm and event codebook precedent

**Source**: “EEG dataset of consumer- and research-grade systems for device evaluation” (Scientific Data / Nature)  
URL: https://www.nature.com/articles/s41597-026-06962-5

**Evidence from source**:

- Dataset collected from 30 participants using consumer-grade devices including Muse 2 and a research-grade DSI-24 reference.
- Four paradigms:
  1. eye blinks,
  2. jaw clenching,
  3. head movements with eyes open,
  4. head movements with eyes closed.
- Each paradigm used 1 minute pre-rest, 1 minute task, 1 minute post-rest.
- Eye-blink and jaw-clench tasks used 20 repetitions, cued every 3 seconds.
- Head movement used main beep every 3 seconds plus sub-beeps every 1 second to regulate movement speed.
- Event markers delimit experimental phases and repetitions; code 3 indicates task repetition onset.
- Dataset includes raw data and event information in EDF/MAT.
- Validation includes physical signal detection, brain wave detection, and movement robustness.

**Inference for TMNL**:

We should implement a TMNL-native version of this staged paradigm, not invent a bespoke neuroscience protocol from scratch. We can begin with single-subject repeated sessions, then scale to multiple sessions. The key is not sample count alone but controlled labels and repeatability.

**Design consequences**:

- Create protocol YAML/JSON definitions with blocks and cue schedules.
- Generate marker streams with integer and string labels.
- Session manifest should record task order, cue schedule, and artifact expectations.
- Video/pose capture should be aligned to the same markers so artifact blocks can be verified visually.

**Confidence**: High. This is highly aligned with the user’s stated goal: characterize Muse 2 and maximize useful output.

---

### 3. Medical vs consumer EEG comparison — Muse limitations and artifact caveats

**Source**: “Comparison of Medical and Consumer Wireless EEG Systems for Use in Clinical Trials” (PMC)  
URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC5540902/

**Evidence from source**:

- Compared medical-grade and consumer EEG in eyes-open and eyes-closed resting state.
- PSDs computed with Welch’s modified periodogram using 1-second epochs.
- Muse showed broadband increase in power spectra and higher relative variation across test-retest acquisitions.
- Consumer systems were more prone to eye-blink and muscle-movement artifacts in frontal regions.
- Muse lacked impedance checking compared to medical-grade systems.
- Consumer systems may collect usable EEG but have limitations in data quality, artifact susceptibility, anatomical coverage, and test/retest reliability.

**Inference for TMNL**:

Our analysis must treat Muse output as useful but artifact-sensitive. Strong claims need repeated sessions, condition contrasts, artifact controls, and reports of instability. If we show alpha contrast, we should also report broadband noise, blink/jaw/motion confounds, and repeatability.

**Design consequences**:

- Include repeated sessions/runs for test-retest.
- Add broadband power and variability metrics.
- Report what is not stable, not just what looks cool.
- Use Welch PSD baseline early; it is simple and established.

**Confidence**: High for caveats; moderate for exact Muse 2 transfer because older Muse configurations differ.

---

### 4. Lab Streaming Layer time synchronization — timestamps, offset history, and dejitter

**Source**: LSL time synchronization docs  
URL: https://github.com/sccn/labstreaminglayer/blob/master/docs/info/time_synchronization.rst

**Evidence from source**:

- LSL does not synchronize by default but provides timestamps and clock-offset measurements.
- File recorders should store synchronization information to disk.
- XDF importers use clock-offset history to synchronize streams post-hoc.
- Multi-stream recordings use linear fits through clock offsets and timestamp smoothing/dejitter.
- For non-LSL clocks, create a mapping between LSL time and the other clock or use hardware/common pulse methods.
- For video streams, LSL metadata can declare whether streams can drop samples and include offset estimates.

**Inference for TMNL**:

For webcam/pose/EEG alignment, we need a serious clock strategy. Either:

1. Put all streams into LSL/XDF where practical, or
2. Use a TMNL monotonic timestamp domain and record clock-pair mappings for non-LSL devices.

Naively writing separate JSONL files with `time_ns()` is acceptable for initial analysis but not sufficient for tight multimodal claims unless clock domains and frame timing are recorded.

**Design consequences**:

- Every stream event needs monotonic timestamp and source clock metadata.
- Camera frames need frame index, capture monotonic time, processing time, and possible dropped-frame accounting.
- Marker events must be in the same time domain or have explicit mapping.
- Consider XDF export or LSL outlets for EEG, markers, pose, and possibly frame metadata.

**Confidence**: High. This is foundational for multimodal experiment design.

---

### 5. BIDS / EEG-BIDS — dataset organization and metadata fields

**Source**: BIDS EEG specification 1.11.1  
URL: https://bids-specification.readthedocs.io/en/stable/modality-specific-files/electroencephalography.html

**Evidence from source**:

- EEG-BIDS defines raw EEG file organization and sidecars.
- Raw EEG should be stored in accepted formats such as EDF or BrainVision; sidecar JSON contains metadata.
- Required or recommended metadata includes `EEGReference`, `SamplingFrequency`, `PowerLineFrequency`, `SoftwareFilters`, manufacturer/model, channel counts, recording duration/type, placement scheme, task name, task description, instructions, and channel descriptions.
- `channels.tsv` requires channel name, type, units, and can include sampling frequency, reference, status, and status description.
- `events.tsv` is used for timing and properties of events, stimuli, responses, and markers.
- Distinguishes electrodes from channels; this matters for Muse because TP9/AF7/AF8/TP10 are channels/electrodes but reference/ground handling is limited.

**Inference for TMNL**:

We should not necessarily force early artifacts into perfect BIDS, but the TMNL session manifest should be BIDS-inspired from the start so conversion is possible. Our dataset ledger should map to:

- participant/session/run/task naming,
- channels metadata,
- events table,
- sidecar acquisition metadata,
- recording type and duration.

**Design consequences**:

- Create `manifest.json` with BIDS-compatible fields where possible.
- Export `events.tsv` or `events.csv` sidecar from marker stream.
- Export `channels.tsv` for Muse channels and non-EEG streams (ACC/GYRO/PPG as MISC/PPG or modality-specific sidecars).
- Plan later MNE-BIDS conversion flow.

**Confidence**: High. BIDS is the right target shape for long-lived datasets.

---

### 6. MediaPipe Pose Landmarker — webcam-derived movement/pose stream

**Source**: Google AI Edge MediaPipe Pose Landmarker docs  
URL: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker

**Evidence from source**:

- Pose Landmarker accepts still images, decoded video frames, or live video feeds.
- It can run in `IMAGE`, `VIDEO`, or `LIVE_STREAM` modes.
- Outputs normalized image landmarks and 3D world coordinates.
- Tracks 33 body landmarks.
- Provides configurable detection, presence, and tracking confidence thresholds.
- Live-stream mode uses async result callback.

**Inference for TMNL**:

MediaPipe is a pragmatic first pose source. We do not need perfect biomechanics initially; we need enough pose/motion context to annotate artifacts and verify task compliance. Head landmarks (nose, eyes, ears, mouth) and shoulder landmarks are enough for head turn, nod, posture, and gross motion context.

**Design consequences**:

- Add webcam capture stream with frame index and timestamp.
- Add pose-derived stream with landmarks, confidence, and processing latency.
- Do not store only derived pose; preserve video or frame metadata for audit where privacy allows.
- Use pose to validate task compliance and correlate motion artifacts with EEG/IMU.

**Confidence**: High for feasibility; moderate for timing unless sync strategy is engineered.

---

### 7. Timeflux — biosignal graph framework worth evaluating, not immediate dependency

**Source**: Timeflux documentation  
URL: https://doc.timeflux.io/en/stable/

**Evidence from source**:

- Timeflux is a Python framework for acquisition and real-time processing of biosignals.
- Includes LSL, ZeroMQ, OSC, HDF5 saving/replay, generic data manipulation, signal processing nodes, machine learning tools, JavaScript API for precise stimulus presentation and bidirectional streaming.
- Documentation notes that parts are coarse / code needs polishing.

**Inference for TMNL**:

Timeflux overlaps heavily with what we are building. We should research/evaluate it as an external reference or optional backend, but not immediately replace TMNL’s custom capture path. It may influence graph design, replay model, HDF5/LSL handling, and real-time biofeedback architecture.

**Design consequences**:

- Add evaluation task: prototype Timeflux graph ingesting our LSL/OSC or Muse stream.
- Compare Timeflux vs custom TMNL pipeline for real-time and reproducible offline analysis.
- Avoid dependency commitment until our first-order needs are clear.

**Confidence**: Medium. Promising but documentation/code maturity caveat.

---

### 8. Prefect 3 assets and flows — orchestration and lineage for large datasets/models

**Source**: Prefect Assets docs  
URL: https://docs.prefect.io/v3/concepts/assets

**Evidence from source**:

- Prefect assets represent outputs of workflows and model lineage/dependencies between transformations.
- Asset keys are URIs and can represent external storage systems.
- Asset states include materialized, referenced, and external.
- Materialization and reference events support lineage and health monitoring.
- Runtime metadata can attach row counts, processing times, and data-quality metrics.

**Additional source**: Prefect Flows docs  
URL: https://www.prefect.io/v3/concepts/flows

**Inference for TMNL**:

Prefect is a good candidate for the offline/large-dataset pipeline layer:

- ingest raw JSONL/video/pose,
- validate manifests,
- materialize BIDS-like datasets,
- compute first-order reports,
- compute feature tables,
- train JAX models,
- export ONNX,
- evaluate/compare runs.

This should not be in the hot capture UI path. It is the data-production and model-production backend.

**Design consequences**:

- Create Prefect flow specs after first-order analyzer stabilizes.
- Use asset keys for raw captures, manifests, synchronized streams, features, models, ONNX exports, and reports.
- Attach data-quality metrics as asset metadata.

**Confidence**: High for offline orchestration; not needed for initial single-session capture.

---

### 9. MNE and Braindecode — preprocessing and brain decoding baseline ecosystem

**Sources**:

- MNE typical M/EEG workflow: https://mne.tools/1.2/overview/cookbook.html
- Braindecode basic EEG decoding tutorial: https://braindecode.org/stable/auto_examples/model_building/plot_bcic_iv_2a_moabb_trial.html
- Braindecode preprocessing classes: https://braindecode.org/stable/auto_examples/model_building/plot_preprocessing_classes.html

**Evidence from sources/search**:

- MNE represents the typical EEG workflow: read raw, inspect/mark bad channels, filtering, artifact handling, events/epochs, analysis.
- Braindecode builds on MNE/MOABB, supports preprocessing, datasets, and trial-based EEG decoding models.
- Braindecode expects trials/labels or properly organized arrays; this reinforces the need for protocol markers and manifests.

**Inference for TMNL**:

MNE should be the analysis compatibility target. Braindecode is useful if we move toward supervised decoding tasks. Before that, we need clean labels and enough repeated windows.

**Design consequences**:

- First-order analyzer can be pure Python/NumPy initially, but dataset export should keep MNE compatibility in mind.
- Second-order supervised ML should not start until task labels and sufficient windows exist.
- Use MNE/Braindecode as validation references for preprocessing and trial construction.

**Confidence**: High.

---

### 10. JAX to ONNX — model export path for custom second-order models

**Source**: jax2onnx PyPI  
URL: https://pypi.org/project/jax2onnx/

**Evidence from source**:

- `jax2onnx` converts JAX/Flax/Equinox functions to ONNX.
- Supports file output mode for model export.
- Has version constraints around JAX, Flax, Optax, Orbax, etc.

**Inference for TMNL**:

JAX is viable for custom models if we want control and speed, but the ONNX export path should be treated as its own validation step. Model serving in TMNL can consume ONNX once exported, avoiding Python/JAX in the UI runtime.

**Design consequences**:

- Define model interface early: input tensor shape `[batch, channels, time, features?]`, output schema, class labels/regression targets.
- Add export and ONNX-runtime validation tasks.
- Track model artifacts through Prefect assets.

**Confidence**: Medium-high. Tool exists, but export compatibility depends on model ops.

---

## Current Design Inferences

### A. Experimental protocol must precede neuro claims

We should not continue with only “headset on desk / not stuck to forehead” packet captures for interpretation. Those are valid transport tests only. Physiological characterization requires headset contact, controlled posture, and labeled blocks.

### B. Use a staged consumer-EEG validation paradigm

Adopt this first protocol family:

1. **Fit/contact baseline** — still, seated, headset adjusted, contact notes.
2. **Eyes closed rest** — 60 s.
3. **Eyes open rest** — 60 s with fixation.
4. **Eye blink block** — 20 blinks, 3 s cue interval, with pre/post rest.
5. **Jaw clench block** — 20 light clenches, 3 s cue interval, with pre/post rest.
6. **Head movement eyes open** — 20 guided turns, 3 s main cue, 1 s sub-cue.
7. **Head movement eyes closed** — same, if safe and comfortable.
8. **Repeat runs** — minimum two runs on separate fit attempts for test/retest.

### C. TMNL should become the experiment conductor

TMNL should present instructions, emit markers, start/stop capture, record webcam/pose streams, maintain session manifests, and show live health. Capture CLI becomes one actor in a larger experiment runtime.

### D. Multimodal synchronization is a first-class design problem

For credible EEG+video+pose claims, every source needs timestamps and clock-domain metadata. LSL/XDF is a strong candidate for synchronized recording. If TMNL keeps JSONL streams, it must record monotonic timestamps and clock-pair mappings.

### E. Dataset artifacts should be BIDS-inspired from day one

Even if we initially store JSONL/CSV, the session tree should be shaped for later BIDS/MNE conversion:

- `participants.tsv` or participant metadata.
- `sessions/<session-id>/manifest.json`.
- `events.tsv` equivalent.
- `channels.tsv` equivalent.
- raw stream files.
- derived first-order reports.

### F. Prefect belongs to offline pipeline orchestration

Prefect should orchestrate batch materialization of reports/features/models, not single-packet capture. Use assets for lineage: raw capture → synchronized dataset → first-order report → feature table → trained model → ONNX export → evaluation report.

### G. Naive second-order analysis should remain humble

Initial second-order features:

- Welch PSD / bandpower.
- eyes-closed vs eyes-open alpha ratio.
- alpha peak candidate.
- blink/jaw/motion artifact markers.
- ACC/GYRO/pose correlation with EEG artifact bursts.

No attention/meditation/cognitive-state claims without labeled task validation.

---

## Proposed TMNL Architecture Direction

### Online acquisition layer

- Muse BLE capture: existing `scripts/muse/capture.py`.
- Webcam capture: new TMNL-controlled camera source.
- Pose estimation: MediaPipe Pose Landmarker, initially live or post-hoc.
- Marker stream: TMNL protocol conductor emits block/repetition markers.
- Health stream: packet drops, pose confidence, camera FPS, marker timing.

### Session artifact layer

- `session_manifest.json` — metadata, protocol, device config, environment, notes.
- `muse.jsonl` — canonical Muse events.
- `muse_samples.csv` — scalar side-effect artifact.
- `markers.jsonl` / `events.tsv` — protocol markers and cues.
- `video.mp4` or frame-index ledger — privacy-dependent.
- `pose.jsonl` — pose landmarks, confidence, frame timestamps.
- `sync.json` — clock mapping and timestamp assumptions.

### Offline analysis layer

- First-order analyzer: channel inventory, rates, gaps, distributions, quality flags.
- Protocol-aware analyzer: segment by events; compute block-level metrics.
- Naive second-order: bandpower, artifact heuristics, alpha contrast.
- Research-informed second-order: after literature/data validation.

### ML/data pipeline layer

- Prefect flows materialize assets and lineage.
- Feature store tables for windows/trials.
- JAX/Flax/Equinox model training for custom second-order models.
- ONNX export and validation against JAX outputs.
- TMNL panel runtime consumes ONNX or precomputed inference streams.

---

## Open Questions

1. Should TMNL standardize on LSL/XDF for synchronized session recording, or maintain JSONL plus explicit clock mapping and later XDF/BIDS export?
2. How much raw video do we store, given privacy and disk concerns? Full video, frame hashes, pose-only, or opt-in video?
3. Should pose estimation run online during capture or post-hoc from video?
4. What ML target labels are actually useful: artifact detection, contact-quality proxy, alpha-rest detection, movement contamination, or state classification?
5. How many sessions/runs are needed before training anything custom is not theater?

---

## Immediate Tasker Implications

- Add a TMNL experiment conductor feature branch.
- Add multimodal synchronization and marker design tasks.
- Add BIDS-inspired dataset/session manifest tasks.
- Add Prefect pipeline design tasks for offline assets.
- Add JAX/ONNX model pipeline tasks, gated behind first-order + naive baseline.
- Update visual briefing after this research pass.

