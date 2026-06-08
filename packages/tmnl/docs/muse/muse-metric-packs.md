# Muse Metric Packs

Generated: 2026-06-08T17:12:59.995Z

These packs define what TMNL tracks separately for Muse work. Each pack has three research rounds:

1. Primary sources and measurement definitions.
2. Operational metrics from TMNL artifacts.
3. Crafty sidechannels, invariance design, and visual artifact plan.

Interpretation rule: a metric pack can pass without authorizing a brain claim. Transport, contact, signal, artifact, alpha, protocol, and ML readiness are separate gates.

## Canonical result contract

Every realized pack emits `MuseMetricPackResult` from `src/lib/muse/schemas.ts`:

```ts
{
  type: 'muse.metric_pack_result'
  schemaVersion: 'muse-metric-pack-result/v1'
  packId: MuseMetricPackId
  status: 'pass' | 'warn' | 'fail' | 'not_applicable'
  generatedAt: string
  sessionId?: string
  manifestPath?: string
  interpretationBoundary: string
  upstreamDependencies: MuseMetricPackDependency[]
  metrics: MuseMetric[]
  thresholdEvaluations: MuseMetricThresholdEvaluation[]
  evidence: MuseMetricPackEvidence[]
  caveats: MuseMetricPackCaveat[]
  recommendations: string[]
}
```

This envelope is the future analyzer/panel contract. It is intentionally stricter than a loose JSON blob: every result must say what pack it belongs to, what it measured, what thresholds were evaluated, what evidence backs it, and what claims remain blocked.

Shared Markdown renderer: `scripts/muse/metric_pack_report.py`.

```bash
python scripts/muse/metric_pack_report.py pack-result.json --output pack-result.md
```

## Transport Integrity Pack

**Question:** Did the live hardware stream arrive complete, ordered, decodable, and fast enough?

### Round 1 — source-grounded claims

- Muse classic stream: EEG 256 Hz, 12 samples/packet; ACC/GYRO around 52 Hz; packet sequence continuity from protocol decode.
- BIDS/LSL framing says preserve timing/provenance rather than treating files as truth by themselves.

### Round 2 — operational metric pack

**Inputs**

- muse.jsonl
- muse.summary
- muse.samples
- capture stdout
- manifest.capture

**Metrics**

- packetsSeen
- packetsDecoded
- decodeErrors
- queueDrops
- sequenceGaps/channel
- missingPacketsEstimate/channel
- duplicateSequences/channel
- observedHz/channel/axis
- interPacketDelta p50/p95/p99
- capture duration coverage
- throughput margin vs estimated line rate

**Acceptance**

Threshold spec: `docs/muse/transport-integrity-thresholds.md`  
Machine policies: `docs/muse/transport-integrity-thresholds.json`

- decodeErrors = 0 for controlled sessions
- queueDrops = 0
- summary cadence present
- exactly one capture_start and capture_stop
- timestamp regressions = 0
- sequence gaps/out-of-order counters = 0 for counter-bearing streams
- classic Muse EEG event cadence in the current BLE packet path is ~21 Hz/channel; 256 Hz applies to decoded scalar sample rate, not packet event rate
- inter-sample p99 and queue pressure stay below provisional warning limits

**Caveats**

- Clean transport is not clean EEG
- host_time_ns is epoch wall clock, not hardware clock

### Round 3 — sidechannels / invariance / visual artifact

- Use no-contact powered-device baseline as negative/control for transport only.
- Display transport separately from physiology in UI.
- Use raw packet cadence as a sidechannel to catch BLE/host stalls.

**Visual explainer:** /home/getbygenius/.agent/diagrams/muse-metric-pack-transport-integrity.html

## Contact / Fit Quality Pack

**Question:** Are the four dry electrodes plausibly touching stable anatomy in a way worth analyzing?

### Round 1 — source-grounded claims

- Muse/Mind Monitor exposes HeadBandOn and HSI quality in app-derived streams, but our classic GATT path does not yet decode HSI.
- Dry-electrode quality depends on skin-electrode impedance/contact area, pressure, hair, motion, and geometry.

### Round 2 — operational metric pack

**Inputs**

- muse.samples EEG
- IMU stillness
- no-contact baseline
- operator fit/contact notes
- optional webcam/pose
- future HSI if decoded/imported

**Metrics**

- per-channel saturation/full-scale rate
- flatline rate
- RMS/std in still rest
- line-noise ratio
- low-frequency drift
- high-frequency noise floor
- channel dropout score
- left/right symmetry proxy
- rest stability over time
- contact perturbation response if deliberately adjusted

**Acceptance**

- operator contact notes present
- no sustained flatlines
- full-scale rate below threshold in rest blocks
- stillness confirmed during contact assessment
- per-channel quality flags not severe

**Caveats**

- Proxy contact quality is not impedance
- TP9/TP10 behind ears have hair/geometry issues
- AF7/AF8 forehead contacts are blink/muscle-prone

### Round 3 — sidechannels / invariance / visual artifact

- Measure invariance by comparing no-contact vs worn-still vs deliberate contact-adjustment blocks.
- Use pose/camera only as fit/audit sidechannel, not physiology.
- Make analyses reject bad channels rather than silently averaging them.

**Visual explainer:** /home/getbygenius/.agent/diagrams/muse-metric-pack-contact-fit-quality.html

## EEG Signal Quality Pack

**Question:** Does the worn, still signal look electrically usable before interpretation?

### Round 1 — source-grounded claims

- Consumer EEG studies compare PSDs, artifact rates, and test/retest reliability; Muse can collect usable EEG but is artifact-sensitive.
- Welch PSD is a common first spectral method for eyes-open/closed and device comparisons.

### Round 2 — operational metric pack

**Inputs**

- quality-gated rest blocks
- first-order summary
- markers
- manifest environment

**Metrics**

- amplitude min/max/mean/std
- saturation fraction
- flatline fraction
- nonfinite count
- line noise power ratio
- bandpower delta/theta/alpha/beta/gamma
- broadband power
- spectral slope proxy
- window rejection rate
- channel covariance/correlation
- test-retest within session

**Acceptance**

- quality flags reviewed before PSD
- rest windows have stillness and markers
- line/noise/saturation thresholds pass or are disclosed
- bad channels explicitly marked

**Caveats**

- Muse has limited frontal/temporal montage; no full scalp inference
- absolute bandpower depends on contact and reference

### Round 3 — sidechannels / invariance / visual artifact

- Prefer within-channel and within-session normalized measures.
- Use no-contact and motion blocks to identify non-EEG spectral signatures.
- Store rejected windows and reasons as first-class artifacts.

**Visual explainer:** /home/getbygenius/.agent/diagrams/muse-metric-pack-eeg-signal-quality.html

## Artifact Susceptibility Pack

**Question:** How strongly do blink, jaw, and motion contaminate each channel, and can we detect/reject them?

### Round 1 — source-grounded claims

- Consumer EEG validation paradigms use eye blinks, jaw clenching, and head movement blocks.
- Muse/Mind Monitor-style stacks include blink/jaw artifact detection; external studies emphasize frontal/muscle susceptibility.

### Round 2 — operational metric pack

**Inputs**

- cue markers
- EEG windows around cue onset
- ACC/GYRO
- pose/video optional

**Metrics**

- artifact evoked peak amplitude per channel
- artifact RMS ratio vs pre-cue baseline
- latency to peak
- recovery time
- broadband power burst
- frontal-vs-temporal signature
- IMU/EEG correlation during motion
- detector precision/recall against cue labels
- false positives during rest

**Acceptance**

- cue markers complete
- artifact signatures visible or null reported
- detector never trained/tested on same session windows without split discipline

**Caveats**

- Blink/jaw are not neural events
- successful artifact detection is a rejection tool, not a BCI claim

### Round 3 — sidechannels / invariance / visual artifact

- Use artifacts as calibration attacks against downstream algorithms.
- Use jaw/blink/motion blocks to build invariant feature masks.
- Visual explainer should show “artifact corridor” around cues.

**Visual explainer:** /home/getbygenius/.agent/diagrams/muse-metric-pack-artifact-susceptibility.html

## Alpha Candidate Response Pack

**Question:** Is there a cautious, artifact-gated eyes-closed vs eyes-open alpha-band candidate contrast?

### Round 1 — source-grounded claims

- Eyes-open/closed PSD comparison is common in consumer EEG validation.
- Muse montage lacks occipital channels, so alpha claims must be cautious; TP9/TP10 may be more useful than frontal AF channels.

### Round 2 — operational metric pack

**Inputs**

- eyes-open block
- eyes-closed block
- quality gates
- artifact rejection masks

**Metrics**

- Welch alpha power 8-13 Hz per channel
- relative alpha ratio closed/open
- individual alpha peak candidate
- alpha SNR vs neighboring bands
- window-level effect size
- block-level confidence interval
- channel-specific alpha consistency
- artifact-rejected window count

**Acceptance**

- both blocks pass quality gates
- motion/artifact contamination low
- effect described as candidate contrast only
- negative/null result preserved

**Caveats**

- No meditation/attention/relaxation claims
- frontal alpha asymmetry requires additional validation and careful reference handling

### Round 3 — sidechannels / invariance / visual artifact

- Normalize within session and compare against no-contact/motion negative controls.
- Prefer effect size + uncertainty over binary pass/fail.
- Require repeat-run consistency before model labels.

**Visual explainer:** /home/getbygenius/.agent/diagrams/muse-metric-pack-alpha-candidate-response.html

## Motion + Head Geometry Pack

**Question:** How do head motion, form factor, electrode placement, and anatomy explain signal changes?

### Round 1 — source-grounded claims

- Muse form factor: AF7/AF8 forehead, TP9/TP10 around ears; soft headband and dry contacts make pressure/hair/anatomy relevant.
- Muse has ACC/GYRO sidechannels around 52 Hz and can support motion context.

### Round 2 — operational metric pack

**Inputs**

- ACC/GYRO samples
- optional camera/pose landmarks
- operator fit notes
- task markers

**Metrics**

- acc magnitude
- gyro magnitude
- jerk
- stillness index
- head-turn compliance score
- motion burst overlap with EEG artifacts
- left/right electrode asymmetry notes
- pose-derived yaw/pitch/roll proxy
- headband slip annotations

**Acceptance**

- still rest actually still
- motion blocks visibly separate from rest
- pose/video sidechannel labeled optional and privacy-gated

**Caveats**

- IMU is on headset, not skull ground truth
- head geometry notes are contextual, not anatomical measurement unless explicitly measured

### Round 3 — sidechannels / invariance / visual artifact

- Use motion as both confound detector and protocol compliance signal.
- Make EEG features invariant by rejecting/high-weighting windows based on stillness.
- Consider simple calibration: neutral, left turn, right turn, nod, jaw relaxed.

**Visual explainer:** /home/getbygenius/.agent/diagrams/muse-metric-pack-motion-head-geometry.html

## Protocol Compliance Pack

**Question:** Did the session follow the manifest and produce analyzable labels?

### Round 1 — source-grounded claims

- BIDS events.tsv stores timing/properties of events; HED can make annotations machine-actionable.
- Manifest, events, channels, and sidecars prevent unlabeled signal soup.

### Round 2 — operational metric pack

**Inputs**

- manifest.json
- markers.jsonl
- events.tsv
- muse.jsonl
- first_order_summary.json

**Metrics**

- manifest schema pass
- artifact path existence
- marker session/protocol match
- block start/end pairing
- cue count expected vs observed
- timestamp monotonicity
- sample coverage per block
- environment notes completeness
- labels usable for BIDS export

**Acceptance**

- all required artifacts present
- marker integrity passes
- block durations match protocol tolerance
- fit/contact notes filled before physiology claims

**Caveats**

- Post-hoc markers are allowed for transport audit but not equivalent to live conductor cues

### Round 3 — sidechannels / invariance / visual artifact

- Turn compliance into an admission-control gate before FFT/ML.
- Visual explainer should show manifest→markers→windows chain.
- Future sophistication: HED labels and BIDS validator integration.

**Visual explainer:** /home/getbygenius/.agent/diagrams/muse-metric-pack-protocol-compliance.html

## ML Readiness + Invariance Pack

**Question:** Is the dataset safe to train/evaluate without leakage or artifact shortcuts?

### Round 1 — source-grounded claims

- EEG deep learning commonly suffers leakage when windows from the same subject/session cross splits.
- Cross-participant EEG requires careful split decisions due to individual differences and non-stationarity.

### Round 2 — operational metric pack

**Inputs**

- quality-gated windows
- labels from markers
- session IDs
- participant IDs
- feature tables
- negative controls

**Metrics**

- window count per class
- session/run count
- class balance
- rejected-window reasons
- train/val/test split by session/participant
- negative-control performance
- artifact shortcut audit
- calibration curve
- confidence entropy
- domain shift score across runs

**Acceptance**

- no random window split across same session for headline claims
- artifact-only negative controls tested
- model target explicitly scoped
- holdout protocol documented

**Caveats**

- Single-subject models are personal calibration artifacts, not general EEG models
- high accuracy may mean leakage or artifact detection

### Round 3 — sidechannels / invariance / visual artifact

- Make features invariant with within-session normalization, channel-quality masks, motion rejection, and no-contact negatives.
- Export ONNX only after JAX/reference parity and holdout sanity.
- Visual explainer should center leakage barriers, not model architecture glamour.

**Visual explainer:** /home/getbygenius/.agent/diagrams/muse-metric-pack-ml-readiness-invariance.html

