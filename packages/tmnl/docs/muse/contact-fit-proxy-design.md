# Muse Contact / Fit Quality Proxy Design

Tasker: `#4655`  
Feature: `#F1285 Realize Contact / Fit Quality Pack`  
Depends on: Protocol Compliance + Transport Integrity

## Purpose

The Contact / Fit Quality Pack answers a narrow admission-control question:

> Is there enough evidence that the headset was worn with plausible, stable electrode contact to proceed toward EEG signal-quality analysis?

It does **not** measure clinical impedance. The current classic BLE path does not decode a Muse HSI/contact-quality stream. This pack therefore uses operator notes, labeled fit blocks, per-channel signal pathologies, stillness checks, and negative controls as a conservative proxy.

Clean transport is not contact. Contact proxy is not clean EEG. Prime, the bouncer has multiple doors for a reason.

## Grounding

Local sources:

- `docs/muse/neuroscience-limitations-note.md`
- `docs/muse/muse-metric-packs.md#contact--fit-quality-pack`
- `research/muse2-research-synthesis.md`

Relevant constraints from those sources:

- Muse-family devices are consumer-grade dry-electrode headsets.
- Current TMNL capture path observes EEG channels `TP9`, `AF7`, `AF8`, `TP10` but does not decode clinical impedance or Muse HSI.
- Dry electrode contact is affected by hair, skin contact area, pressure, geometry, motion, blink, jaw, and facial muscle artifacts.
- No-contact/device-only captures must remain transport-only negative controls.

## Inputs

Required for any contact claim:

- Protocol Compliance result: `pass` or `warn` with no label/artifact hard failures.
- Transport Integrity result: `pass` or `warn` with hard transport gates passing.
- `manifest.json` with explicit `environment.contactNotes` / `fitNotes`.
- `markers.jsonl` with a labeled `fit_check` or worn-still rest block.
- `muse.jsonl` or `muse_samples.csv` for per-channel contact proxy metrics.

Optional / future:

- camera/pose audit sidechannel,
- imported HSI / HeadBandOn stream from Mind Monitor or another app-derived source,
- deliberate contact-adjustment block,
- repeated fit-check blocks over time.

## Hard claim boundaries

The pack must return `fail` or `not_applicable` for contact claims when:

- manifest says no contact / device-only / not worn,
- `environment.contactNotes` says no electrode contact,
- no worn/contact block exists,
- protocol/marker integrity failed,
- transport hard gates failed,
- no EEG sample artifact exists.

No-contact sessions may still be useful as **negative controls**, but they cannot pass Contact / Fit.

## V1 proxy metrics

### Manifest / operator evidence

| Metric | Scope | Meaning | Gate |
| --- | --- | --- | --- |
| `contact.operatorContactNotes.present` | session | `environment.contactNotes` non-empty | hard |
| `contact.operatorFitNotes.present` | session | `environment.fitNotes` non-empty | warn initially |
| `contact.noContactDetected` | session | no-contact/device-only language detected | claim-boundary fail |
| `contact.wornBlock.present` | session | fit_check/rest block intended for contact assessment exists | hard |

### Channel pathologies

These are computed per EEG channel over the fit-check / worn-still block when markers are available, otherwise over the full capture with a warning that segmentation is absent.

| Metric | Scope | Meaning | Gate |
| --- | --- | --- | --- |
| `contact.channel.fullScaleFraction` | channel/block | fraction of values at/near decoder full-scale sentinel (`abs(value) >= 999`) | hard/warn threshold |
| `contact.channel.flatlineWindowFraction` | channel/block | fraction of fixed windows with near-zero variance | hard/warn threshold |
| `contact.channel.nonFiniteCount` | channel/block | NaN/inf/non-numeric values | hard |
| `contact.channel.decodedScalarCount` | channel/block | available scalar count for channel | sample-size gate |
| `contact.channel.stddevUv` | channel/block | simple amplitude spread; proxy only | warn/descriptor |
| `contact.channel.dropoutFraction` | channel/block | missing expected chunks/windows from marker interval | warn/hard if severe |

### Stillness / motion context

| Metric | Scope | Meaning | Gate |
| --- | --- | --- | --- |
| `contact.imu.stillnessRms` | block | ACC/GYRO RMS during fit-check/rest | warn |
| `contact.motionContamination.present` | block | IMU movement exceeds stillness threshold during contact assessment | warn / blocks contact certainty |
| `contact.cameraPoseAudit.present` | artifact | optional visual audit exists | optional |

Stillness is not proof of contact; it only prevents motion from masquerading as contact instability.

### Symmetry / stability descriptors

These are **warnings/descriptors**, not hard gates in v1:

- `contact.leftRightStddevRatio` for TP9/TP10,
- `contact.frontPairStddevRatio` for AF7/AF8,
- `contact.restStabilityDrift` comparing early vs late fit-check windows,
- `contact.badChannelCount` from full-scale/flatline/non-finite flags.

## Provisional thresholds for v1 implementation

These are intentionally conservative and should be revisited after real worn captures.

| Metric | Initial threshold | Status |
| --- | ---: | --- |
| `contact.operatorContactNotes.present` | `true` | hard fail if absent |
| `contact.noContactDetected` | `false` | claim-boundary fail if true |
| `contact.wornBlock.present` | `true` | hard fail for contact claims |
| `contact.channel.nonFiniteCount` | `0` | hard fail |
| `contact.channel.decodedScalarCount` | `>= 256 * 10` for EEG fit/rest block | hard/sample-size fail |
| `contact.channel.fullScaleFraction` | warn `> 0.001`, fail `> 0.01` | provisional |
| `contact.channel.flatlineWindowFraction` | warn `> 0.05`, fail `> 0.20` | provisional |
| `contact.badChannelCount` | warn `>= 1`, fail `>= 2` | provisional |
| `contact.motionContamination.present` | warning if true | blocks certainty, not contact evidence alone |

Why not tighter? We do not yet have enough worn captures to tune dry-electrode Muse thresholds responsibly. The first implementation should expose metrics and block obvious garbage, not pretend to be a laboratory impedance meter.

## Negative/control sessions

### 1. No-contact transport baseline

Existing artifact:

- `/tmp/muse-20260608-135640-controlled-v1`
- manifest says not connected to brain/scalp
- expected Contact/Fit status: `not_applicable` or `fail` for contact claims
- expected caveat: useful transport negative only

This is the primary guard against accidental physiology claims from plumbing evidence.

### 2. Worn-still fit-check baseline

Future required artifact:

- headset worn normally,
- participant still,
- explicit fit/contact notes,
- marker block `fit_check` or `rest`,
- expected result: candidate pass/warn if full-scale/flatline metrics are low.

### 3. Deliberate contact perturbation

Future artifact:

- controlled block where one channel/contact is adjusted or lifted,
- expected result: affected channel full-scale/flatline/drift metrics worsen,
- purpose: sanity-check that proxy metrics respond to contact degradation.

### 4. Motion/blink/jaw blocks

Future artifact:

- blink/jaw/head-motion calibration blocks,
- expected result: motion/artifact warnings, not contact pass/fail alone,
- purpose: avoid confusing artifact contamination with electrode contact quality.

## Analyzer behavior for no-contact sessions

For a no-contact manifest, the Contact/Fit analyzer should:

1. emit metrics where possible,
2. set status to `not_applicable` or `fail` depending whether a contact claim was requested,
3. include a critical caveat blocking contact/EEG/physiology claims,
4. recommend a worn-still fit-check capture before EEG Signal Quality Pack.

## Output contract

The analyzer emits `MuseMetricPackResult`:

```json
{
  "type": "muse.metric_pack_result",
  "schemaVersion": "muse-metric-pack-result/v1",
  "packId": "contact-fit-quality",
  "status": "pass | warn | fail | not_applicable",
  "metrics": [],
  "thresholdEvaluations": [],
  "evidence": [],
  "caveats": [],
  "recommendations": []
}
```

## V1 implementation plan

`#4656` should implement:

1. summary/manifest loader,
2. no-contact/contact-notes boundary detector,
3. marker block selector for `fit_check` / worn-still `rest`,
4. streaming sample scan over `muse.jsonl` or `muse_samples.csv`,
5. per-channel full-scale, non-finite, decoded count, flatline-window, and stddev metrics,
6. optional IMU stillness metrics,
7. canonical Markdown report via `metric_pack_report.py`.

## Non-goals

- Clinical impedance estimation.
- HSI decoding before the data path exists.
- Declaring EEG signal quality.
- Alpha/attention/relaxation/meditation claims.
- Cross-person generalization.

Those are separate gates, darling.
