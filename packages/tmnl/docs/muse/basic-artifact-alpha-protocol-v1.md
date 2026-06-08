# Muse Basic Artifact + Alpha Protocol v1

Tasker: `#4599`  
Manifest schema: `docs/muse/session-manifest-schema.md`  
Canonical schema: `src/lib/muse/schemas.ts` → `MuseSessionManifest`

## Purpose

Collect a controlled, labeled Muse session that can support:

1. transport integrity verification,
2. signal-quality assessment under headset fit/contact,
3. artifact calibration for eye blinks, jaw clenching, and head motion,
4. a cautious eyes-open vs eyes-closed alpha-contrast candidate.

It cannot support clinical, diagnostic, meditation, attention, emotion, or cognitive-state claims.

## Design principles

- Use labeled blocks before analysis. No label, no claim.
- Separate rest, artifact, motion, and alpha-candidate blocks.
- Use pre-rest/task/post-rest structure around artifact and motion blocks where practical.
- Collect operator fit/contact notes before capture.
- Prefer repeatability over heroic duration.
- Abort on discomfort, dizziness, headset pain, or unsafe eyes-closed movement.

## Expected modalities

Required for v1:

- Muse JSONL sample stream.
- Marker stream.
- Session manifest.
- First-order analyzer output.

Optional but recommended:

- CSV sample artifact.
- Webcam frame ledger.
- Pose stream.
- Audio/visual cue log.

## Session phases

| Phase | Duration | Purpose | Interpretation boundary |
| --- | ---: | --- | --- |
| Preflight | 2–5 min | Device scan, connection, fit/contact notes, participant posture | Not analyzed except metadata |
| Fit check | 30 s | Verify nonzero streams and headset stability | Transport/contact only |
| Baseline still rest | 60 s | Establish quiet eyes-open stillness | Signal-quality baseline |
| Eyes-open rest | 60 s | Alpha contrast half 1 | Candidate neural contrast only after quality gate |
| Eyes-closed rest | 60 s | Alpha contrast half 2 | Candidate neural contrast only after quality gate |
| Blink calibration | 180 s | Pre-rest, cued blink task, post-rest | Artifact detection only |
| Jaw calibration | 180 s | Pre-rest, cued jaw task, post-rest | Artifact/muscle contamination only |
| Head movement EO | 180 s | Pre-rest, cued head movement task, post-rest | Motion robustness/artifact only |
| Optional head movement EC | 180 s | Same as EO but eyes closed, only if safe | Motion robustness/artifact only |
| Cooldown still rest | 60 s | End-of-session stability check | Test/retest within session |

Approximate duration without optional head movement EC: 15 minutes including preflight. With optional EC motion: 18 minutes.

## Block definitions

### `fit-check`

- Kind: `fit_check`
- Duration: 30 s
- Expected signal class: `transport_only`
- Instructions: Sit still, eyes open, adjust nothing unless operator says so.
- Acceptance: Muse emits EEG/IMU events, first-order summary shows no sequence gaps during this window.

### `still-rest-baseline`

- Kind: `rest`
- Duration: 60 s
- Expected signal class: `resting_state`
- Instructions: Sit upright, eyes open, fix gaze, jaw relaxed, no deliberate motion.
- Use: baseline distributions and motion quietness.

### `eyes-open-rest`

- Kind: `eyes_open`
- Duration: 60 s
- Expected signal class: `alpha_contrast_candidate`
- Instructions: Eyes open, fix gaze on a stable point, do not speak, jaw relaxed.
- Use: compare against `eyes-closed-rest` only after artifact and full-scale flags pass.

### `eyes-closed-rest`

- Kind: `eyes_closed`
- Duration: 60 s
- Expected signal class: `alpha_contrast_candidate`
- Instructions: Close eyes, stay still, reopen only at end cue.
- Use: candidate alpha contrast; not a cognition claim.

### `blink-pre-rest`

- Kind: `rest`
- Duration: 60 s
- Expected signal class: `resting_state`
- Instructions: Eyes open, blink normally, no deliberate motion.

### `blink-task-20x`

- Kind: `blink`
- Duration: 60 s
- Expected signal class: `artifact`
- Repetitions: 20
- Cue interval: 3 s
- Instructions: Blink once immediately on each cue. Between cues, keep eyes open and still.
- Expected observation: frontal EEG transient and possible IMU stillness.

### `blink-post-rest`

- Kind: `rest`
- Duration: 60 s
- Expected signal class: `resting_state`
- Instructions: Return to still eyes-open rest.

### `jaw-pre-rest`

- Kind: `rest`
- Duration: 60 s
- Expected signal class: `resting_state`
- Instructions: Jaw relaxed, eyes open, still.

### `jaw-task-20x`

- Kind: `jaw_clench`
- Duration: 60 s
- Expected signal class: `artifact`
- Repetitions: 20
- Cue interval: 3 s
- Instructions: Lightly clench jaw once on cue, then relax. Do not grind teeth.
- Expected observation: broadband muscle artifact; not neural.

### `jaw-post-rest`

- Kind: `rest`
- Duration: 60 s
- Expected signal class: `resting_state`
- Instructions: Jaw relaxed, still.

### `head-open-pre-rest`

- Kind: `rest`
- Duration: 60 s
- Expected signal class: `resting_state`
- Instructions: Eyes open, head centered, still.

### `head-open-task-20x`

- Kind: `head_motion`
- Duration: 60 s
- Expected signal class: `motion_contamination`
- Repetitions: 20
- Cue interval: 3 s
- Instructions: On each cue, turn head gently left then return center, alternating left/right if the conductor supports direction labels.
- Optional sub-cue: 1 s pacing ticks for start / turn / return.
- Expected observation: IMU motion and EEG motion artifact.

### `head-open-post-rest`

- Kind: `rest`
- Duration: 60 s
- Expected signal class: `resting_state`
- Instructions: Return to centered stillness.

### `head-closed-task-optional`

- Kind: `head_motion`
- Duration: 60 s task plus pre/post rest if enabled
- Expected signal class: `motion_contamination`
- Safety: Optional. Skip if uncomfortable or unsafe. No standing. No large motion.
- Use: robustness under eyes-closed motion only; not required for v1 acceptance.

### `cooldown-rest`

- Kind: `rest`
- Duration: 60 s
- Expected signal class: `resting_state`
- Instructions: Final stillness block, eyes open, jaw relaxed.
- Use: crude within-session repeatability check against earlier rest.

## Recommended block order

1. `fit-check`
2. `still-rest-baseline`
3. `eyes-open-rest`
4. `eyes-closed-rest`
5. `blink-pre-rest`
6. `blink-task-20x`
7. `blink-post-rest`
8. `jaw-pre-rest`
9. `jaw-task-20x`
10. `jaw-post-rest`
11. `head-open-pre-rest`
12. `head-open-task-20x`
13. `head-open-post-rest`
14. optional `head-closed-*` triplet
15. `cooldown-rest`

## Acceptance criteria

A session is usable for first-order and artifact analysis if:

- Manifest exists and block IDs match emitted markers.
- Capture has no unrecovered decode errors.
- Muse EEG cadence is near 256 Hz in each EEG block.
- Sequence gaps are zero or explicitly reported.
- Fit/contact notes exist.
- Artifact task markers are present for each repetition.
- Full-scale EEG flags are reported and reviewed before spectral analysis.

A session is usable for eyes-open/closed alpha-candidate analysis only if:

- Both eyes-open and eyes-closed blocks pass first-order quality gates.
- Blink/jaw/motion artifact blocks can distinguish obvious artifacts.
- No severe full-scale/clipping/flatline flags dominate the rest blocks.
- The report states this is a candidate contrast, not a medical or cognitive conclusion.

## Stop / abort rules

Abort or pause if:

- headset causes discomfort,
- participant feels dizzy or disoriented,
- BLE stream drops unrecoverably,
- marker conductor and capture clock are not both recording,
- participant cannot follow task safely,
- environment changes invalidate the session.

## Notes for future conductor implementation

- The conductor should emit `block_start`, `cue_onset`, `cue_offset`, and `block_end` markers.
- Cue repetition markers should include `blockId`, `repetitionIndex`, `expectedAction`, and `cueIntervalSec`.
- Optional webcam/pose streams should record frame timestamps and confidence, but pose is not required for v1.
- Every block should be replay-segmentable from markers alone.
