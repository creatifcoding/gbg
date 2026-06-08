# Muse EEG Neuroscience Limitations Note

Tasker: `#4601`  
Applies to: Muse 2 / Muse S controlled sessions in TMNL

## Executive boundary

TMNL Muse captures are suitable for engineering-grade transport validation, consumer-EEG signal-quality characterization, labeled artifact calibration, and cautious exploratory comparisons between controlled task blocks. They are not sufficient for clinical, diagnostic, attention, meditation, emotion, disease, or cognitive-state claims.

Any analysis output must state which layer it belongs to:

1. transport integrity,
2. signal quality,
3. labeled experimental contrast,
4. model/inference output.

Never collapse those layers into one claim.

## Device limitations

Muse-family devices are consumer-grade dry-electrode headsets with limited channel count and frontal/temporal coverage. For the observed Muse S classic GATT path, the primary EEG channels are:

- TP9,
- AF7,
- AF8,
- TP10.

Limitations:

- no full-scalp coverage,
- limited anatomical localization,
- dry-electrode contact variability,
- susceptibility to blink, jaw, facial muscle, and motion artifacts,
- no clinical impedance workflow in the current TMNL capture path,
- consumer firmware/protocol behavior may differ across hardware revisions,
- Bluetooth transport and host timestamping are not equivalent to hardware-synchronized lab acquisition.

## Method limitations

### Uncontrolled captures

Uncontrolled captures, including successful BLE keepalive captures, can support:

- decoder correctness checks,
- stream inventory,
- packet/sample cadence estimates,
- sequence-gap detection,
- basic value distribution inspection.

They cannot support physiological interpretation. If headset fit, participant state, task labels, and markers are absent, the capture is transport/signal plumbing evidence only.

### Controlled single-subject captures

Controlled single-subject sessions can support within-session or within-subject exploratory contrasts if:

- manifest exists before capture,
- markers segment every task block,
- first-order quality gates pass,
- artifact calibration blocks are present,
- limitations are reported.

They still cannot support population-level claims.

### Eyes-open / eyes-closed alpha contrast

An eyes-open vs eyes-closed contrast may be reported only as an alpha-candidate contrast when:

- both blocks pass first-order quality checks,
- obvious blink/jaw/motion artifacts are characterized,
- spectral method and windowing are documented,
- negative/null results are reported honestly,
- the report avoids claims about attention, relaxation, meditation, or health.

### Artifact blocks

Blink, jaw, and head-motion blocks are artifact calibration tasks. They should not be interpreted as neural features. Their value is to identify contamination patterns and validate that downstream algorithms can avoid confusing artifacts with candidate EEG phenomena.

## Synchronization limitations

TMNL v1 marker and Muse capture streams may share host timestamps, but multimodal claims involving webcam, pose, or external streams require explicit synchronization evidence.

Acceptable claims by sync level:

| Sync evidence | Permitted claim |
| --- | --- |
| Same host timestamp source for Muse + markers | Block-level Muse segmentation |
| Camera frame timestamps without latency calibration | Coarse visual audit only |
| Pose stream with frame ledger but no latency calibration | Coarse motion-context labels only |
| LSL/XDF or measured clock mapping | Stronger multimodal alignment claims, still caveated |

## Reporting requirements

Every report should include:

- device model and channels,
- capture command and artifact paths,
- manifest/protocol ID,
- marker integrity status,
- packet/sample continuity status,
- observed rates,
- quality flags,
- artifact caveats,
- explicit interpretation boundary,
- whether results are controlled, exploratory, or validated.

## ML / AI limitations

ML models trained on Muse data require:

- labeled windows derived from valid markers,
- train/validation/test separation by session or run where possible,
- leakage checks,
- baseline comparison,
- calibration or confidence reporting,
- failure-case reporting,
- clear statement of target label.

Unsupported targets for early TMNL Muse work:

- clinical diagnosis,
- disease detection,
- emotional state,
- meditation score,
- attention score,
- generalized cognitive state,
- claims about other people from single-subject data.

Appropriate early targets:

- artifact detection,
- motion contamination detection,
- contact/signal-quality proxy,
- protocol compliance proxy,
- within-session eyes-open/closed contrast candidate.

## Required language for reports

Use:

- “transport integrity was clean in this artifact,”
- “EEG cadence matched expected 256 Hz,”
- “full-scale values require signal-quality review,”
- “artifact block produced detectable contamination,”
- “eyes-closed block showed/failed to show an alpha-band candidate contrast under these conditions.”

Avoid:

- “the headset detected attention,”
- “the subject was relaxed,”
- “the model reads cognitive state,”
- “this proves alpha response” without caveats,
- “clinical-grade,”
- “diagnostic.”

## Review posture

The correct posture is conservative and evidence-forward:

- report negative findings,
- separate engineering success from neuroscience evidence,
- keep raw/replay artifacts available,
- preserve marker and manifest provenance,
- make limitations visible in UI panels and exported reports.

A result that says “transport works, signal quality failed” is a successful scientific outcome. It prevents the next layer from building on sand.
