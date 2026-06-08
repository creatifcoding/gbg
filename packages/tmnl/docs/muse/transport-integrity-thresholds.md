# Muse Transport Integrity Thresholds

Tasker: `#4653`  
Feature: `#F1284 Realize Transport Integrity Pack`  
Machine policy file: `docs/muse/transport-integrity-thresholds.json`

## Purpose

Transport Integrity answers one narrow question:

> Did the capture path preserve the Muse data stream with coherent timing and counters?

It does **not** say the headset touched skin, EEG is usable, alpha changed, or ML is admissible. Clean plumbing is not clean physiology. Prime, this is where we prevent a green badge from cosplaying as science.

## Input summary contract

The pack consumes `scripts/muse/analyze_capture.py` first-order summaries, especially:

- `totals.*`
- `byType`, `bySensor`, `byChannel`
- `qualityFlagCounts`
- `transport.*`
- `streams[<sensor>:<channel>].*`

The analyzer now emits transport timing fields:

- aggregate inter-event deltas: `transport.interEventDeltaSec.{p50Sec,p95Sec,p99Sec}`
- aggregate inter-sample deltas: `transport.interSampleEventDeltaSec.{p50Sec,p95Sec,p99Sec}`
- summary cadence deltas: `transport.interSummaryDeltaSec.{p50Sec,p95Sec,p99Sec}`
- lifecycle coverage: `captureStartEvents`, `captureStopEvents`, `sampleCoverageRatio`
- counters: `decodeErrorsLast`, `packetsDroppedLast`, `queueFillFractionMax`
- per-stream event deltas and sequence counters

## Baseline evidence

No-contact transport baseline:

- Session: `/tmp/muse-20260608-135640-controlled-v1`
- First-order summary: `/tmp/muse-20260608-135640-controlled-v1/first_order_summary.json`
- Observed sample-event line rate: ~130.9 events/sec
- Final decode errors: `0`
- Final packet drops: `0`
- Aggregate inter-sample p99: ~43 ms
- EEG stream event rate: ~21.38 Hz/channel
- ACC/GYRO event rate: ~17.78 Hz/stream
- Telemetry duplicate sequence behavior observed; telemetry sequence duplicates must not be treated like EEG packet loss.

This baseline is transport-only. It intentionally remains barred from physiology claims because the device was not connected to brain/scalp.

## Required hard gates

| Policy | Metric | Rule | Why |
| --- | --- | --- | --- |
| `transport.decode_errors.zero.v1` | `transport.decodeErrorsLast` | `== 0` | Decoder failures corrupt packet contents. |
| `transport.packets_dropped.zero.v1` | `transport.packetsDroppedLast` | `== 0` | Queue drops prove loss in the capture path. |
| `transport.summary_cadence.present.v1` | `transport.summaryCadencePresent` | `true` | Summary cadence carries counters and queue pressure. |
| `transport.capture_lifecycle.single_start_stop.v1` | `captureStartEvents` and `captureStopEvents` | exactly one each | Lifecycle bounds are needed for reproducibility. |
| `transport.timestamp_regressions.zero.v1` | aggregate timestamp regressions | `== 0` | Negative host-time deltas break ordering. |
| `transport.sequence_gaps.zero.v1` | per-stream `sequenceGaps` | `== 0` for counter-bearing streams | Sequence gaps indicate missed notifications/loss. |
| `transport.out_of_order.zero.v1` | per-stream `outOfOrderSequences` | `== 0` | Out-of-order chunks corrupt time-series order. |
| `transport.eeg_event_rate.range.v1` | EEG stream `eventRateHzObserved` | `18–24 Hz` | Classic Muse EEG notifications arrive around 21.3 Hz/channel. |

## Soft warnings

| Policy | Metric | Rule | Why |
| --- | --- | --- | --- |
| `transport.imu_event_rate.range.v1` | ACC/GYRO `eventRateHzObserved` | `14–22 Hz` | Motion context should be present when enabled, but deviations are not EEG transport failure by themselves. |
| `transport.inter_sample_p99.max.v1` | `transport.interSampleEventDeltaSec.p99Sec` | `<= 0.1 s` | Catches BLE/host stalls while tolerating normal stream interleaving. |
| `transport.summary_delta_p95.range.v1` | `transport.interSummaryDeltaSec.p95Sec` | `0.8–1.2 s` | Summary cadence should be ~1 Hz away from startup/shutdown edges. |
| `transport.queue_fill.max.v1` | `transport.queueFillFractionMax` | `<= 0.25` | Queue pressure warns before drops occur. |
| `transport.sample_coverage.min.v1` | `transport.sampleCoverageRatio` | `>= 0.75` | Allows scan/setup/shutdown edges while flagging very short sample coverage. |

## Telemetry duplicate-sequence exception

Telemetry packets in the current artifact repeat sequence values. Until the telemetry packet semantics are proven equivalent to EEG/IMU sequence counters, duplicate telemetry sequences are disclosed but **do not fail** Transport Integrity. EEG/ACC/GYRO sequence gaps and out-of-order counters remain hard gates.

## Status aggregation

- `fail`: any required hard gate fails.
- `warn`: all hard gates pass but one or more soft warnings fail or telemetry duplicate behavior is present.
- `pass`: all hard gates pass and no warning threshold fails.
- `not_applicable`: no first-order summary or capture artifact is available and no transport claim is attempted.

## Claim boundary

Passing Transport Integrity allows only this claim:

> The BLE/capture/decoder/artifact path preserved the expected Muse stream for this session, subject to disclosed timing and counter caveats.

It does not admit:

- contact/fit quality,
- EEG signal quality,
- artifact calibration validity,
- alpha contrast,
- physiology/cognitive/clinical claims,
- ML readiness.

Those belong to later packs. Architecture is a bouncer, not a hype man.
