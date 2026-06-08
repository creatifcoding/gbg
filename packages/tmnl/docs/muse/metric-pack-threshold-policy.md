# Muse Metric Pack Threshold Policy Format

Tasker: `#4649`  
Canonical schema: `src/lib/muse/schemas.ts` → `MuseMetricThresholdPolicy`

## Purpose

Threshold policies define how a metric-pack analyzer converts measured values into `pass`, `warn`, `fail`, or `not_applicable`. They are admission-control rules, not truth machines.

A policy must always state:

- which pack owns it,
- which metric it evaluates,
- whether it is hard or soft,
- what happens when the metric is missing,
- whether it blocks a downstream claim,
- why the rule exists.

## Canonical shape

```ts
MuseMetricThresholdPolicy = {
  policyId: string
  packId: MuseMetricPackId
  kind:
    | 'hard_gate'
    | 'soft_warning'
    | 'sample_size'
    | 'upstream_dependency'
    | 'claim_boundary'
  metricKey: string
  scope: MuseMetricScope
  comparator: MuseMetricComparator
  threshold?: MuseMetricValue
  warnThreshold?: MuseMetricValue
  failThreshold?: MuseMetricValue
  missingStatus: MuseMetricPackStatus
  severity: MuseMetricSeverity
  required: boolean
  blocksClaim: boolean
  description: string
  rationale: string
  source?: string
  appliesWhen?: Record<string, unknown>
}
```

## Policy kinds

| Kind | Meaning | Example |
| --- | --- | --- |
| `hard_gate` | Must pass for pack satisfaction | decode errors must equal 0 |
| `soft_warning` | Does not fail pack alone but must be disclosed | telemetry observed rate differs from declared rate |
| `sample_size` | Minimum data volume or block/window coverage | at least 30 seconds of rest samples |
| `upstream_dependency` | Requires another pack status | alpha candidate requires EEG quality pass/warn |
| `claim_boundary` | Blocks specific interpretation even if metrics look good | no-contact baseline blocks physiology claims |

## Missing metric behavior

`missingStatus` is required because absence is meaningful.

Examples:

- Missing `decodeErrors` → `fail` for transport.
- Missing `operatorContactNotes` → `warn` or `fail` for contact/fit, depending on claim target.
- Missing `poseJsonl` → `not_applicable` for optional pose sidechannel.
- Missing `events.tsv` → `fail` for protocol compliance.

## Comparator semantics

| Comparator | Meaning |
| --- | --- |
| `eq` | observed must equal threshold |
| `neq` | observed must not equal threshold |
| `lt`, `lte`, `gt`, `gte` | numeric comparison |
| `between_inclusive` | threshold is `[min, max]` |
| `outside_inclusive` | observed must be outside `[min, max]` |
| `present` | value/path/field exists |
| `absent` | value/path/field does not exist |

## Example policies

### Transport: decode errors

```json
{
  "policyId": "transport.decode_errors.zero.v1",
  "packId": "transport-integrity",
  "kind": "hard_gate",
  "metricKey": "decodeErrors",
  "scope": "session",
  "comparator": "eq",
  "threshold": 0,
  "missingStatus": "fail",
  "severity": "critical",
  "required": true,
  "blocksClaim": true,
  "description": "Controlled captures must have zero decode errors before downstream packs can trust sample contents.",
  "rationale": "Malformed packets or decoder failures undermine every later metric."
}
```

### Transport: EEG observed rate

```json
{
  "policyId": "transport.eeg_observed_hz.range.v1",
  "packId": "transport-integrity",
  "kind": "hard_gate",
  "metricKey": "observedHz",
  "scope": "channel",
  "comparator": "between_inclusive",
  "threshold": [250, 262],
  "missingStatus": "fail",
  "severity": "fail",
  "required": true,
  "blocksClaim": true,
  "description": "EEG channel observed rate should be near the expected 256 Hz after sufficient samples.",
  "rationale": "Rate drift or missing data corrupts windowing and spectral analysis.",
  "appliesWhen": { "sensor": "eeg" }
}
```

### Contact: operator notes required

```json
{
  "policyId": "contact.operator_notes.present.v1",
  "packId": "contact-fit-quality",
  "kind": "hard_gate",
  "metricKey": "environment.contactNotes",
  "scope": "session",
  "comparator": "present",
  "missingStatus": "fail",
  "severity": "fail",
  "required": true,
  "blocksClaim": true,
  "description": "Contact/fit assessment requires explicit contact notes.",
  "rationale": "Muse dry electrodes lack a decoded impedance channel in the current path; operator notes are part of the evidence."
}
```

### Alpha: upstream dependency

```json
{
  "policyId": "alpha.requires_eeg_quality.v1",
  "packId": "alpha-candidate-response",
  "kind": "upstream_dependency",
  "metricKey": "upstream.eeg-signal-quality.status",
  "scope": "session",
  "comparator": "present",
  "missingStatus": "fail",
  "severity": "critical",
  "required": true,
  "blocksClaim": true,
  "description": "Alpha candidate analysis is barred unless EEG signal quality has already passed or warned with disclosed caveats.",
  "rationale": "Spectral contrast on unusable EEG is theater. Stylish theater, perhaps, but still theater."
}
```

### ML readiness: leakage barrier

```json
{
  "policyId": "ml.no_random_window_headline_split.v1",
  "packId": "ml-readiness-invariance",
  "kind": "claim_boundary",
  "metricKey": "split.strategy",
  "scope": "model",
  "comparator": "neq",
  "threshold": "random_window_same_session",
  "missingStatus": "fail",
  "severity": "critical",
  "required": true,
  "blocksClaim": true,
  "description": "Headline ML claims cannot use random windows from the same session across train/test splits.",
  "rationale": "EEG window leakage can inflate accuracy through session/subject signatures rather than real target structure."
}
```

## Evaluation output

Analyzers do not emit policies directly as their primary result; they emit `MuseMetricThresholdEvaluation` entries in `MuseMetricPackResult.thresholdEvaluations`. Each evaluation may reference `policyId`.

```ts
{
  metricKey: string
  comparator: MuseMetricComparator
  status: MuseMetricPackStatus
  severity: MuseMetricSeverity
  threshold?: MuseMetricValue
  observed?: MuseMetricValue
  policyId?: string
  description: string
}
```

## Aggregation rule

Pack status is derived conservatively:

1. Any `critical` or required `fail` evaluation → pack `fail`.
2. Any non-critical `fail` or `warn` evaluation → pack `warn` unless the policy says it blocks claim.
3. All required gates pass and optional missing metrics are `not_applicable` → pack `pass`.
4. If the pack cannot run because upstream data is absent but no claim is attempted → `not_applicable`.

## Design doctrine

Thresholds should be boring, explicit, and reviewable. If a threshold is provisional, say so in `rationale` and cite the source or empirical baseline. Do not hide fragile science behind a single green badge.
