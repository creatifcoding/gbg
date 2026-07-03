# FRKNK SDR Research Matrix

Tasker tasks: `#4364`, `#4365`, `#4366`

Status: research draft for Prime review.

This matrix grounds the FRKNK General SDR Framework RFC in canonical SDR, metadata, protocol, cockpit, and spectrum-safety sources. It is deliberately source-first: FRKNK should borrow the shape of proven systems without becoming a lumpy clone of any one of them. Prime, this is where we keep the radio brain elegant instead of building GNU Radio's cousin in a trench coat.

---

## 1. Source ledger

| Source | Kind | Why it is canonical enough for RFC grounding |
|---|---|---|
| GNU Radio flowgraph docs | Official/API docs | Mature precedent for stream-oriented SDR graphs, block composition, scheduler tradeoffs, and runtime control. |
| GNU Radio message passing docs | Official wiki/API docs | Mature precedent for async command/control and metadata paths separate from sample streams. |
| SoapySDR Driver Guide + `Device` API | Project docs/source API | Hardware abstraction precedent: discovery, factory construction, stream lifecycle, frequency/gain/sample-rate APIs. |
| SigMF specification v1.2.6 | Formal spec | Recorded digital-signal-sample metadata standard; best anchor for FRKNK corpus/replay interchange. |
| Quisk docs/PyPI docs | Maintainer/user docs | Concrete Python SDR transceiver/cockpit behavior and Hermes-compatible verifier. |
| Hermes-Lite2 protocol wiki | Project protocol docs | First concrete FRKNK radio protocol target; OpenHPSDR Protocol 1 compatibility details. |
| JDN 3-16 Joint Electromagnetic Spectrum Operations | Public doctrine note | Conceptual grounding for EMS/EMSO/JEMSO terms, control/deconfliction vocabulary, and safety posture. |
| FCC jammer enforcement guidance | U.S. regulator page | Legal/safety anchor: jamming devices are prohibited; no casual exceptions. |
| CISA RF Interference Best Practices Guidebook page | U.S. government guidance | Public-safety framing for RF interference recognition/reporting/resolution. |
| 47 CFR Part 97 excerpts | U.S. regulation text | Amateur transmit control/license/control-operator requirements for any future ham-radio TX path. |

Primary URLs are collected in [§9 Source URLs](#9-source-urls).

---

## 2. GNU Radio — flowgraph/runtime precedent

### Source facts

GNU Radio describes the basic data structure as a **flowgraph**: an acyclic directional graph where source blocks insert samples, sink blocks terminate/export samples, and processing blocks sit in between. A `top_block` controls the graph and exposes lifecycle operations such as `start`, `stop`, and `wait`. GNU Radio also documents the throughput/latency tradeoff caused by scheduler chunk sizes and the ability to set maximum output items to bound latency.

### FRKNK design implications

FRKNK should adopt the _conceptual split_ but not inherit the full framework:

- `IqSource` / `IqSink` / `DspBlock` are useful conceptual roles.
- FRKNK should model an explicit `PipelineRuntime` with lifecycle states: `idle`, `starting`, `running`, `stopping`, `stopped`, `faulted`.
- Pipeline links should distinguish:
  - hot IQ stream links;
  - metadata/event links;
  - command/control links.
- FRKNK should expose latency/throughput policy at the runtime/profile layer, not hide it in implementation magic.
- Early implementation should remain Python-owned and deliberately smaller than GNU Radio.

### RFC open questions

1. Should FRKNK pipeline topology be static while running, or allow lock/reconfigure/unlock behavior later?
2. What are the first latency classes: `interactiveCockpit`, `offlineCorpus`, `batchAnalysis`, `mlSketch`?
3. Do we want pipeline graph serialization in RFC 0001, or defer it?

---

## 3. GNU Radio — async message/control precedent

### Source facts

GNU Radio message passing exists because streams are good for samples/bits, but not ideal for control data, metadata, packet structures, upstream communication, or external application interaction. Blocks register named input/output message ports; messages are asynchronous, can move upstream, and are commonly represented as PMTs. GNU Radio recommends command messages as key/value pairs or dictionaries for inspectability and interoperability.

### FRKNK design implications

FRKNK needs a separate command/event plane from IQ streams:

- IQ stream: high-volume ordered sample frames.
- Event stream: observations, status, telemetry, errors, sketch candidates.
- Command stream: typed commands with dry-run, policy evaluation, approval status, and resulting events.

Recommended command shape:

```text
CommandEnvelope
  id
  issuedBy
  targetDeviceId
  command
  requestedAt
  dryRun
  capabilityEvaluation
  approval
```

GNU Radio uses flexible PMTs; FRKNK should use strict cross-runtime schemas:

- TypeScript: Effect Schema canonical contracts.
- Python: Pydantic mirrors / generated validators.
- Serialization: JSON for control/event; binary/NumPy/SigMF-compatible formats for IQ payloads.

### RFC open questions

1. Should command/event transport be local in-process first, then ZeroMQ/NATS/WebSocket later?
2. Should every command produce an append-only event-log entry, including rejected commands?
3. Should sketch candidates be events, stream sidebands, or corpus annotations?

---

## 4. SoapySDR — device abstraction precedent

### Source facts

SoapySDR's driver guide says hardware support modules implement a custom `SoapySDR::Device` class, register discovery and factory functions, and expose application-support APIs for identity, channels, streams, direct buffers, antennas, gain, frequency, sample rate, bandwidth, clocking, time, and sensors. The `Device.hpp` API includes static enumeration and construction functions, stream setup/activation/read/write, frequency/gain/sample-rate setters/getters, and sensor/settings/register/GPIO/I2C/SPI/UART surfaces.

### FRKNK design implications

FRKNK should define a device abstraction that is smaller than SoapySDR but shaped by it:

```text
RadioDevice
  identity
  capabilities
  streams
  controls
  telemetry
  profile
```

Minimum first-class operations:

- discover devices;
- connect/open;
- configure RX stream;
- start/stop RX;
- set/get center frequency;
- set/get sample rate;
- set/get gain/LNA where supported;
- read telemetry/sensors;
- close.

TX-related operations must exist as schema-level concepts but remain locked/unavailable unless policy permits:

- set TX frequency;
- set drive/power;
- set MOX/PTT;
- tune/ATU;
- PA enable.

### RFC open questions

1. Should FRKNK eventually wrap SoapySDR as a backend, or only use it as an API-shape reference?
2. Should every backend expose a Soapy-like normalized model, with backend-specific escape hatches?
3. How much low-level bus control — I2C/SPI/registers — belongs in a safe general framework?

---

## 5. SigMF — corpus/replay metadata precedent

### Source facts

SigMF specifies metadata in JSON for recorded digital signal samples. It defines a `Recording` as a dataset plus metadata. The top-level metadata contains `global`, `captures`, and `annotations`. Core fields include dataset datatype, sample rate, center frequency, capture sample start, timestamps, and annotation frequency edges/labels. SigMF defines sample datatypes such as `cf32_le`, and complex samples are interleaved I/Q with the in-phase component first. SigMF's goal is portability, reproducibility, and avoiding metadata bitrot.

### FRKNK design implications

FRKNK's corpus model should be SigMF-compatible rather than inventing a lonely island format:

- Current `.c64 + .json` sidecar can remain a lab-native fixture format.
- RFC should define a mapping to/from SigMF:
  - `sampleRateHz` → `core:sample_rate`
  - `centerFrequencyHz` → capture `core:frequency`
  - `complex64 little-endian` → `core:datatype = cf32_le`
  - known synthetic truth/candidates → `annotations`
- FRKNK-specific metadata should use an extension namespace rather than polluting SigMF core semantics.
- Derived artifacts (`waterfall`, `oneBitWaterfall`, `candidate`) are not the primary recording; they are analysis products attached to a capture/corpus run.

### RFC open questions

1. Should FRKNK emit native SigMF directly in the next implementation slice?
2. Should sketch outputs become SigMF annotations, FRKNK sidecars, or both?
3. Do we need a `frknk:` SigMF extension namespace for synthetic truth and verifier state?

---

## 6. Quisk — reference cockpit/verifier precedent

### Source facts

Quisk describes itself as a Python SDR. It reads I/Q data from UDP, sound card, Ethernet, or USB, tunes, filters, demodulates, and outputs audio. It supports radios including Hermes-Lite, can operate as a complete transceiver, exposes graph/waterfall/scope/config/help screens, supports multiple receivers on Hermes-like hardware, and can record/play digital I/Q samples.

### FRKNK design implications

Quisk should remain a reference/verifier, not the UI destination:

- Use Quisk to verify that fake Hermes/OpenHPSDR packets are compatible enough to stream real-looking IQ.
- Mine Quisk for operational semantics:
  - graph/waterfall/scope display modes;
  - tuning line behavior;
  - RX/TX split concepts;
  - multiple receiver behavior;
  - I/Q record/play expectations.
- Do not copy the cockpit grammar directly into TMNL. The TMNL architecture brief already correctly moves toward island/tiling/profile-driven operator UI.
- Quisk's file recording and playback behavior validates that corpus replay is not an afterthought in SDR tooling.

### RFC open questions

1. Should Quisk remain in CI as an optional/manual verifier due to GUI/runtime dependencies?
2. Should FRKNK expose a Quisk-compatible emulator profile separate from a Hermes-Lite profile?
3. What is the minimum artifact Quisk verification should produce: packet log, screenshot, audio/IQ capture, or all three?

---

## 7. Hermes-Lite / OpenHPSDR — first protocol target

### Source facts

The Hermes-Lite2 protocol is based on the original OpenHPSDR Protocol 1 and intended to remain compatible with a core subset so standard OpenHPSDR software can operate it in basic mode. The Hermes-Lite2 Board ID is `0x06`. The Metis discovery packet remains `<0xEFFE><0x02><60 bytes of 0x00>`. Start/stop packets use `<0xEFFE><0x04><Command><60 bytes of 0x00>`, with command bit 0 controlling radio start/stop and bit 1 controlling wideband data. Command/control C0 bit 0 is MOX. The memory map includes sample-rate speed, receiver count, RX/TX NCO frequencies, PA/tune-related bits, LNA gain, watchdog controls, and telemetry responses.

### FRKNK design implications

The existing fake Hermes emulator is the correct first conformance harness:

- It proves discovery/start/stop/control packet parsing and endpoint-6 IQ streaming.
- It gives FRKNK a deterministic fake hardware target that Quisk already understands.
- It should become a named backend profile:
  - `backendKind = "hermes-openhpsdr-v1"`
  - `deviceKind = "fake-hermes" | "hermes-lite2" | "openhpsdr-compatible"`
- Protocol parsing should remain byte-tested. The earlier fix around command bit parsing is exactly why this needs tests. The scalpel was useful; the microscope was mandatory.

### RFC open questions

1. Which subset of the memory map is RFC 0001 mandatory?
2. Should fake Hermes intentionally reject unsafe TX/PA/ATU commands, or simulate them as locked no-ops?
3. How should watchdog/host-heartbeat behavior appear in the FRKNK device lifecycle?

---

## 8. JEMSO / CEW / safety doctrine — conceptual boundary

### Source facts

JDN 3-16 defines JEMSO as military actions to exploit, attack, protect, and manage the electromagnetic operational environment. It emphasizes that EMS use must be prioritized, integrated, synchronized, and deconflicted. It distinguishes receive/sensing from transmission authorization in a military planning context: EMS users provide requirements, and frequency authorization is required for transmissions. It also treats legal review, ROE, coordination measures, protected/taboo frequencies, host-nation coordination, and interference resolution as core planning concerns.

FCC jammer guidance states that federal law prohibits operating, marketing, or selling jamming equipment that interferes with authorized radio communications; there are no consumer/business/classroom/residence/vehicle exemptions; penalties may include monetary penalties, equipment seizure, and criminal sanctions. CISA's RF Interference Best Practices Guidebook frames RF interference and illegal jamming as public-safety communications concerns. 47 CFR Part 97 requires amateur station licensing before transmitting on amateur frequencies and requires a control operator when transmitting.

### FRKNK design implications

FRKNK's first RFC safety stance should be stricter than the minimum:

- Default mode: receive-only, fake-device/file/synthetic first.
- TX-capable concepts are allowed in schemas so the architecture is honest, but implementations default to `locked` or `unavailable`.
- Every hardware-affecting command must pass capability policy.
- Every TX/PA/PTT/MOX/ATU/drive command must require explicit enablement and approval.
- Agentic control can propose and dry-run. It cannot bypass policy.
- Logs must preserve rejected commands. Safety without audit is just vibes with a badge.

### RFC open questions

1. What is the exact FRKNK `CapabilityState`: `available`, `simulated`, `locked`, `unavailable`, `requiresApproval`?
2. Should policy live in TypeScript contracts, Python runtime, or both with a shared generated artifact?
3. What approvals are human-only, and what can profile policy pre-authorize?

---

## 9. Source URLs

### SDR/framework/corpus/protocol

- GNU Radio — Operating a Flowgraph: <https://www.gnuradio.org/doc/doxygen-3.7.5/page_operating_fg.html>
- GNU Radio — `gr::top_block`: <https://www.gnuradio.org/doc/doxygen-v3.10.9.1/classgr_1_1top__block.html>
- GNU Radio — Message Passing: <https://wiki.gnuradio.org/index.php/Message_Passing>
- SoapySDR — Driver Guide: <https://github.com/pothosware/SoapySDR/wiki/DriverGuide>
- SoapySDR — `Device.hpp`: <https://pothosware.github.io/SoapySDR/doxygen/latest/Device_8hpp_source.html>
- SigMF Specification: <https://sigmf.org/>
- SigMF PDF: <https://sigmf.org/sigmf-spec.pdf>
- Quisk Help: <https://james.ahlstrom.name/quisk/help.html>
- Quisk PyPI: <https://pypi.org/project/quisk/>
- Hermes-Lite2 Protocol: <https://github.com/softerhardware/Hermes-Lite2/wiki/Protocol>

### Safety/legal/doctrine

- JDN 3-16 Joint Electromagnetic Spectrum Operations: <https://irp.fas.org/doddir/dod/jdn3_16.pdf>
- FCC Jammer Enforcement: <https://www.fcc.gov/general/jammer-enforcement>
- CISA RF Interference Best Practices Guidebook: <https://www.cisa.gov/resources-tools/resources/radio-frequency-interference-best-practices-guidebook>
- 47 CFR § 97.5 Station license required: <https://www.law.cornell.edu/cfr/text/47/97.5>
- 47 CFR § 97.7 Control operator required: <https://www.law.cornell.edu/cfr/text/47/97.7>
- 47 CFR § 97.105 Control operator duties: <https://www.law.cornell.edu/cfr/text/47/97.105>
- 47 CFR § 97.109 Station control: <https://www.law.cornell.edu/cfr/text/47/97.109>

---

## 10. Provisional RFC architecture thesis

The research supports this first RFC thesis:

```text
FRKNK should be a typed SDR runtime and research lab with:

1. Soapy-shaped device abstraction, not Soapy dependency by default.
2. GNU-Radio-inspired stream/control separation, not full flowgraph clone.
3. SigMF-compatible corpus/replay, with FRKNK extensions for synthetic truth and sketches.
4. Hermes/OpenHPSDR as first real protocol profile, fake Hermes as conformance harness.
5. Quisk as verifier/reference, TMNL as future cockpit consumer.
6. Strict capability-gated command plane with receive-first defaults and TX locked until explicitly approved.
```

The next RFC artifact should be the outline/subsystem map, after Prime accepts this research matrix as sufficient grounding.
