# FRKNK Contract Inventory

Tasker task: `#4369 Inventory required contracts and schemas`

Status: contract-inventory draft for RFC outline review.

This inventory names the schema surfaces RFC 0001 should either define directly or reserve explicitly. TypeScript Effect Schema remains canonical for the TMNL/runtime seam; Python mirrors should be generated or tested against fixtures where possible.

---

## 1. Contract principles

1. **Schema-first domain contracts**
   - Shared domain data uses Effect Schema, not raw TypeScript types.
   - Python mirrors validate equivalent JSON fixtures.

2. **Hot payloads are referenced, not JSON stuffed**
   - IQ sample arrays are not serialized into command/event JSON.
   - JSON carries headers, references, metadata, and manifests.

3. **Every runtime object carries provenance**
   - Backend/source, capture ID, frame ID, artifact ID, command ID, or event ID.

4. **Safety state is data**
   - Locked/simulated/unavailable/approval-required must be visible in contracts.

5. **Suggestions are not truth**
   - Candidates and verifier results are separate contracts.

---

## 2. ID and primitive schemas

| Schema | Purpose | Notes |
|---|---|---|
| `DeviceId` | Stable radio/fake/replay device identity | Branded string. |
| `BackendId` | Backend instance identity | Useful for runtime logs. |
| `StreamId` | RX/TX/corpus stream identity | TX streams reserved/locked in RFC 0001. |
| `CaptureId` | Corpus capture identity | Links raw IQ to metadata. |
| `FrameId` | IQ frame identity | Monotonic per stream preferred. |
| `ArtifactId` | Derived artifact identity | Waterfall/sketch/candidate output. |
| `CommandId` | Command envelope identity | Required for audit. |
| `EventId` | Event log identity | Append-only runtime events. |
| `ProfileId` | Runtime/layout/capability profile identity | Shared with TMNL profile concept. |
| `FrequencyHz` | Frequency in Hz | Number with nonnegative or bounded domain depending field. |
| `SampleRateHz` | Samples per second | Positive number. |
| `BandwidthHz` | Bandwidth in Hz | Positive number. |
| `Db` / `Dbm` | Gain/power-ish values | Keep units explicit. |

---

## 3. Device/backend contracts

| Schema | Fields | RFC role |
|---|---|---|
| `BackendKind` | `synthetic`, `corpus-replay`, `fake-hermes`, `hermes-openhpsdr`, `soapy-future`, ... | Discriminates backend families. |
| `TransportKind` | `in-process`, `file`, `udp`, `usb`, `sound-card`, `network`, ... | Describes physical/logical transport. |
| `RadioDeviceIdentity` | `deviceId`, `backendKind`, `label`, `manufacturer?`, `model?`, `serial?`, `firmware?` | UI/device inventory. |
| `RadioDeviceLifecycle` | `idle`, `discovered`, `connected`, `streaming`, `stopping`, `faulted`, `closed` | Runtime state. |
| `RadioDeviceState` | identity + lifecycle + active streams + telemetry summary + capabilities | TMNL read model. |
| `DeviceCapability` | `capability`, `state`, `reason?`, `requiresApproval?`, `limits?` | Capability inspector/policy input. |
| `DeviceTelemetry` | temperature/current/forward/reverse/adcClip/etc as optional fields | Hermes-compatible subset first. |
| `HardwareProfile` | identity + supported controls + safe ranges + labels | Future live hardware policy. |

Capability state literals:

```text
available | simulated | requiresApproval | locked | unavailable | unsupported
```

---

## 4. IQ stream contracts

| Schema | Fields | RFC role |
|---|---|---|
| `IqSampleFormat` | `cf32-le`, `ci16-le`, `cu8`, ... | Align with SigMF where possible. |
| `IqFrameHeader` | `frameId`, `streamId`, `captureId?`, `sampleStart`, `sampleCount`, `sampleRateHz`, `centerFrequencyHz`, `format`, `timestamp?`, `source` | Required frame context. |
| `IqPayloadRef` | `kind`, `path?`, `offsetBytes?`, `byteLength?`, `sharedMemoryKey?`, `arrayShape?` | Avoid JSON sample blobs. |
| `IqFrameRef` | `header`, `payloadRef` | Cross-runtime frame pointer. |
| `IqStreamState` | `streamId`, `direction`, `status`, `sampleRateHz`, `centerFrequencyHz`, `format`, `stats` | Cockpit stream summary. |
| `IqStreamStats` | `frames`, `samples`, `droppedFrames`, `discontinuities`, `bytes`, `startedAt`, `updatedAt` | Runtime telemetry. |
| `StreamDiscontinuity` | `streamId`, `expected`, `actual`, `reason` | Corpus/replay/live honesty. |

Direction literals:

```text
rx | tx
```

RFC 0001: `tx` exists only as locked/reserved.

---

## 5. Corpus/replay contracts

| Schema | Fields | RFC role |
|---|---|---|
| `CaptureMetadata` | `captureId`, `sampleRateHz`, `centerFrequencyHz`, `format`, `sampleCount`, `createdAt`, `sourceKind`, `description?` | Native current metadata. |
| `SyntheticNeedleSpec` | tone/noise/truth parameters | Existing synthetic fixture concept. |
| `CorpusManifest` | captures + artifacts + labels + source notes | Multi-artifact registry. |
| `ReplaySourceConfig` | capture reference + loop/range/speed controls | Replay backend config. |
| `SigMfMapping` | mapping from FRKNK fields to SigMF `global/captures/annotations` | Spec bridge. |
| `SigMfExportReport` | exported files + validation notes + unsupported fields | Export audit. |
| `ArtifactManifest` | derived artifact records with provenance | Raw IQ → sketches/candidates. |

SigMF mapping baseline:

```text
sampleRateHz       → core:sample_rate
centerFrequencyHz  → captures[].core:frequency
format cf32-le     → core:datatype = cf32_le
synthetic truth     → annotations or frknk extension
candidate spans     → annotations or frknk sidecar
```

---

## 6. DSP/pipeline contracts

| Schema | Fields | RFC role |
|---|---|---|
| `PipelineId` | branded string | Runtime identity. |
| `BlockKind` | `waterfall`, `one-bit-iq`, `locator`, `verifier`, ... | DSP block discriminator. |
| `BlockSpec` | `blockId`, `kind`, `inputs`, `outputs`, `params`, `runtimeHints` | Inspectable pipeline building block. |
| `PipelineSpec` | blocks + edges + profile | Lightweight graph. |
| `PipelineRuntimeState` | status + active blocks + stats + faults | Runtime telemetry. |
| `LatencyProfile` | `interactive`, `offline`, `batch`, `ml-sketch` | Explicit throughput/latency intent. |
| `BlockArtifactRef` | block output linked to artifact manifest | Provenance. |

Design note:

- Keep this smaller than GNU Radio.
- Do not force every offline function into graph ceremony.

---

## 7. Sketch/candidate/verifier contracts

| Schema | Fields | RFC role |
|---|---|---|
| `SketchLaneKind` | `low-res-waterfall`, `one-bit-waterfall`, future lanes | Source of lossy representation. |
| `SignalSketchFrame` | `artifactId`, `captureId/frameId`, `lane`, `timeBins`, `frequencyBins`, params | Existing concept formalization. |
| `SignalCandidate` | `candidateId`, `sourceArtifactId`, `frequencyLowerHz`, `frequencyUpperHz`, `timeStart?`, `timeEnd?`, `confidence`, `verifierStatus` | Suggestion contract. |
| `VerifierStatus` | `unverified`, `verified`, `rejected`, `inconclusive` | Truth separation. |
| `VerifierResult` | candidate + evidence + method + artifacts | Clean verification output. |
| `QuiskSuggestion` | candidate mapped to Quisk/operator action | Existing sidecar output. |
| `CandidateProvenance` | lane, parameters, source capture/frame, algorithm version | Trust/debug. |

Invariant:

```text
SignalCandidate MUST NOT imply verified truth.
```

---

## 8. Command/policy/event contracts

| Schema | Fields | RFC role |
|---|---|---|
| `CommandEnvelope` | `commandId`, `issuedBy`, `target`, `command`, `dryRun`, `createdAt`, `profileId` | All commands enter here. |
| `CommandIssuer` | `human`, `cli`, `agent`, `test`, `system` + identity | Audit source. |
| `CommandTarget` | device/stream/pipeline/corpus target | Routing. |
| `CommandKind` | discriminated command union | Typed command plane. |
| `PolicyEvaluation` | `decision`, `capabilityState`, `reasons`, `requiredApprovals`, `effectsPreview` | Dry-run/policy output. |
| `ApprovalState` | `notRequired`, `required`, `approved`, `denied`, `expired` | Human gate. |
| `CommandResult` | executed/denied/simulated/error + event refs | Runtime response. |
| `RuntimeEvent` | discriminated event union | Event stream. |
| `EventLogEntry` | event + command link + timestamps + source | Append-only audit. |

Policy decision literals:

```text
allow | deny | simulate | requireApproval
```

Initial command union:

- `StartRxStream`
- `StopRxStream`
- `SetRxFrequency`
- `SetSampleRate`
- `SetRxGain`
- `StartReplay`
- `StopReplay`
- `RunSketchPipeline`
- `ExportSigMf`
- reserved/locked: `SetTxFrequency`, `SetTxDrive`, `SetMox`, `SetPtt`, `EnablePa`, `RunAtuTune`

---

## 9. Safety/operator contracts

| Schema | Fields | RFC role |
|---|---|---|
| `SafetyProfile` | locked capabilities + approval policy + legal notes | Runtime guardrails. |
| `OperatorIdentity` | user/person/session identity | Approval/audit. |
| `LicenseInfo` | jurisdiction, service, license class, call sign, expires | Future TX only. |
| `StationControlMode` | `local`, `remote`, `automatic` | Future Part 97 alignment. |
| `SafetyNotice` | severity + message + source URL | UI and docs surfacing. |
| `RestrictedAction` | command kinds that cannot execute under profile | Hard locks. |

RFC 0001 stance:

- Define enough shape to avoid future schema breaking.
- Do not implement live TX enablement.

---

## 10. TMNL integration contracts

| Schema | Fields | RFC role |
|---|---|---|
| `CockpitDeviceSummary` | device state compressed for UI | Read-only cockpit. |
| `CockpitStreamSummary` | stream stats/current tuning | Waterfall/spectrum panels. |
| `CockpitCapabilitySummary` | capability labels/states/reasons | Inspector/disabled controls. |
| `CockpitCandidateSummary` | candidate rows/cards | Sidecar suggestions. |
| `CockpitCommandPreview` | dry-run result for UI confirmation | Command island. |
| `CockpitArtifactSummary` | capture/sketch/verifier artifact cards | Lab/corpus browser. |

Implementation warning:

- TMNL-specific layout state can live in TMNL/STX.
- FRKNK should only export domain truth/read models.

---

## 11. Protocol/conformance contracts

| Schema | Fields | RFC role |
|---|---|---|
| `ProtocolAdapterKind` | `hermes-openhpsdr-v1`, future kinds | Adapter identity. |
| `MetisDiscoveryRequest` | parsed packet fields | Test fixture. |
| `MetisDiscoveryReply` | MAC/version/board ID/etc | Emulator behavior. |
| `HermesStartStopCommand` | command byte + bit interpretation | Prior bug guard. |
| `HermesControlWord` | C0-C4 address/data/MOX/RQST | Protocol parser. |
| `HermesControlState` | sample rate, RX count, frequencies, LNA, MOX | Current Python state. |
| `HermesRxFrameHeader` | endpoint, sequence, block info | Endpoint-6 stream. |
| `ProtocolConformanceReport` | test cases + packet logs + verdicts | Verification artifact. |

Important invariant:

```text
Command bit parsing must use bit masks, not full-byte equality.
```

That little dragon already bit once.

---

## 12. Cross-runtime fixture strategy

Required fixture categories:

1. Synthetic capture metadata.
2. IQ frame header + file payload reference.
3. Signal sketch frame.
4. Signal candidate unverified.
5. Device state for fake Hermes.
6. Capability summary with locked TX.
7. Command dry-run allow.
8. Command dry-run deny/locked.
9. SigMF export mapping sample.
10. Protocol conformance report sample.

Each fixture should round-trip through:

```text
Effect Schema decode/encode
Python validation/decode
JSON file fixture comparison
```

---

## 13. Existing vs proposed contract surfaces

| Area | Existing | Proposed next |
|---|---|---|
| TS base contracts | `src/contracts.ts` | Expand IDs/device/commands/events. |
| TS IQ corpus | `src/iq-corpus.ts` | Add SigMF mapping schemas. |
| TS cockpit tangent | `src/cockpit.ts` | Park until TMNL seam chosen. |
| Python contracts | `sdr_lab/contracts.py` | Mirror selected JSON fixtures. |
| Python IQ corpus | `iq/corpus.py` | SigMF export/import. |
| Python Hermes | `openhpsdr/protocol.py`, `emulator.py` | Conformance report artifacts. |
| Python sketch locator | `locator.py`, `sketches/*` | Candidate provenance/artifact manifest. |

---

## 14. Recommended first contract implementation slice

After RFC approval:

```text
FRKNK Contract Slice 0002
  1. Add CommandEnvelope / PolicyEvaluation / CapabilityState schemas.
  2. Add ArtifactManifest / SigMfMapping schemas.
  3. Add cross-runtime fixtures.
  4. Add Python validators or Pydantic mirrors for fixtures.
  5. Add receive-only policy demo CLI.
```

This slice gives TMNL and the Python runtime a safe command seam before any cockpit gets ideas.
