# Muse First-Order Capture Characterization — Keepalive Live Artifact

Date: 2026-06-08  
Input artifact: `/tmp/muse-capture-keepalive-20260607-111018.jsonl`  
Machine summary: `/tmp/muse-live-first-order-summary.json`  
Analyzer: `scripts/muse/analyze_capture.py`

## Scope

This is a first-order artifact characterization only. It evaluates transport integrity, stream inventory, observed rates, sequence continuity, value distributions, and conservative quality flags. It does **not** make neurophysiological claims. The capture was not a controlled, labeled, headset-fit experiment.

## Loader validation

The analyzer was validated before this report:

- Streams JSONL line-by-line; no whole-file capture load.
- Tolerates non-sample events and counts them separately.
- Rejects malformed JSON with `path:line` diagnostics and exit code `2`.
- Avoids false sequence-gap bridging across multiple capture files by resetting sequence continuity at file boundaries.
- Accepts future `--manifest` and `--labels` JSON sidecars.

## Event inventory

| Metric | Value |
| --- | ---: |
| Sample events | 1,952 |
| Non-sample events | 25 |
| Sequence gaps detected | 0 |
| Missing packet estimate | 0 |

Observed sample-event inventory:

| Sensor | Events |
| --- | ---: |
| EEG | 1,276 |
| ACC | 265 |
| GYRO | 265 |
| Telemetry | 146 |

## Channel rates and continuity

| Stream | Events | Scalars | Duration (s) | Event Hz | Axis/value Hz | Sequence gaps |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `eeg:TP9` | 319 | 3,828 | 14.909 | 21.40 | 256.75 | 0 |
| `eeg:AF7` | 319 | 3,828 | 14.911 | 21.39 | 256.72 | 0 |
| `eeg:AF8` | 319 | 3,828 | 14.911 | 21.39 | 256.72 | 0 |
| `eeg:TP10` | 319 | 3,828 | 14.911 | 21.39 | 256.72 | 0 |
| `acc:acc` | 265 | 2,385 | 14.881 | 17.81 | 53.42 per axis | 0 |
| `gyro:gyro` | 265 | 2,385 | 14.881 | 17.81 | 53.42 per axis | 0 |
| `telemetry:telemetry` | 146 | 876 | 14.833 | 9.84 | 9.84 per field | 0 |

Inference: transport continuity looks clean for this artifact. EEG value cadence matches the declared 256 Hz expectation. IMU per-axis cadence is close to the expected ~52 Hz family. Telemetry observed around 9.8 Hz, which conflicts with the conservative 1 Hz metadata currently in `protocol.py`; treat this as a protocol metadata correction candidate, not a device-quality issue.

## Value distribution snapshot

| Stream / axis | Min | Max | Mean | Stddev |
| --- | ---: | ---: | ---: | ---: |
| `eeg:TP9` | -1000.000 | 999.512 | 80.309 | 762.129 |
| `eeg:AF7` | -1000.000 | 999.512 | 3.141 | 769.816 |
| `eeg:AF8` | -1000.000 | 999.512 | -103.189 | 752.633 |
| `eeg:TP10` | -1000.000 | 999.512 | 14.410 | 766.677 |
| `acc:x` | -0.0838 | 1.0209 | 0.341 | 0.481 |
| `acc:y` | -0.0804 | 1.0201 | 0.341 | 0.481 |
| `acc:z` | -0.0821 | 1.0209 | 0.341 | 0.481 |
| `gyro:x` | -4.1347 | 1.8169 | 0.606 | 0.609 |
| `gyro:y` | -8.0002 | 1.7944 | 0.606 | 0.701 |
| `gyro:z` | -2.7141 | 1.9888 | 0.622 | 0.600 |

## Quality flags

Analyzer flags from this artifact:

- `eeg_full_scale_values_present:value` on all four EEG channels.
- `observed_rate_above_declared:<telemetry-field>` on telemetry fields.
- No sequence-gap or missing-packet flags.

Interpretation discipline:

- EEG full-scale values mean the signal-quality state deserves scrutiny. Given this was not a controlled fit/contact session, do not infer physiology from this distribution.
- Telemetry rate flags likely indicate our declared telemetry rate metadata is too conservative for observed classic Muse packets.
- Clean sequence continuity supports the BLE decoder/capture path as viable for controlled follow-up.

## Conclusions

1. **Transport integrity**: clean for this artifact. No sequence gaps, no missing packets estimated, and observed EEG cadence aligns with expected 256 Hz.
2. **Signal quality**: not established. EEG channels hit full-scale values; this capture cannot support physiological interpretation.
3. **Protocol metadata**: telemetry sample-rate metadata should be revisited; observed event rate is ~9.8 Hz.
4. **Next required evidence**: controlled, labeled headset-fit sessions with manifest, markers, and task blocks before spectral or ML claims.

## Next actions

- Correct or qualify telemetry rate metadata after comparing Muse protocol sources and another live capture.
- Use the controlled protocol branch to collect eyes-open/closed, blink, jaw, and motion-labeled sessions.
- Extend first-order analysis to produce protocol-aware segment summaries once marker artifacts exist.
