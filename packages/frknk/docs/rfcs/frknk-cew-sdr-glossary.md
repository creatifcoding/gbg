# FRKNK CEW/SDR Glossary

Tasker task: `#4388 Draft CEW/SDR glossary for FRKNK RFC`

Status: learning draft for Prime review.

Purpose: define the terms the RFC will use before architecture starts leaning on them. This is intentionally intuitive-first. Equations can wait outside like civilized adults.

---

## 1. Orientation terms

### SDR — Software Defined Radio

A radio where much of the tuning, filtering, demodulation, and signal handling is done in software rather than fixed analog circuitry.

In FRKNK:

- Python handles IQ, protocol, DSP, emulator, corpus, and ML/sketch work.
- TypeScript/Effect Schema handles contracts and TMNL-facing semantics.
- TMNL is the cockpit; FRKNK is the radio brain.

Source grounding:

- Quisk describes itself as a Software Defined Radio that reads I/Q data, tunes, filters, demodulates, and sends audio to speakers/headphones.
- GNU Radio frames SDR applications as flowgraphs of connected processing blocks carrying streams of samples.

---

### CEW / CEMA / EMSO

These terms are doctrine-heavy and context-sensitive. For FRKNK's learning/RFC scope:

- **CEW** is treated as the broad learning area around cyber/electromagnetic effects and awareness.
- **CEMA** usually means cyber electromagnetic activities: integrating cyberspace, electronic warfare, and spectrum management activities.
- **EMSO** means electromagnetic spectrum operations: coordinated actions to exploit, attack, protect, and manage the electromagnetic environment.

In FRKNK cycle 1:

```text
Allowed: receive, observe, simulate, replay, classify, explain.
Deferred/locked: transmit, jam, interfere, deceive, attack.
```

Source grounding:

- JDN 3-16 defines EMSO/JEMSO around exploiting, attacking, protecting, and managing the electromagnetic environment.
- JDN 3-16 also emphasizes deconfliction, authorization, ROE, and legal review.

---

### EMS — Electromagnetic Spectrum

The range of electromagnetic frequencies: radio, microwave, infrared, visible light, and beyond. FRKNK mostly cares about the RF slice used by radios.

Intuition:

```text
EMS = the whole piano.
RF = the section FRKNK is learning to listen to first.
```

In FRKNK:

- `centerFrequencyHz` says where the receiver is pointed.
- `sampleRateHz` and bandwidth describe how wide a slice we see.
- Corpus metadata must preserve these values, or recordings become archaeological riddles.

---

### RF — Radio Frequency

The portion of the electromagnetic spectrum commonly used for radio communication, radar, navigation, broadcast, telemetry, and many sensors.

In FRKNK:

- RF is represented after digitization as IQ samples.
- Live RF hardware is optional for early work; synthetic IQ, file replay, and fake Hermes are first-class.

---

### EMOE — Electromagnetic Operational Environment

The actual electromagnetic situation around an operation: background emissions, friendly/neutral/adversarial emitters, interference, propagation conditions, and who is using what part of the spectrum.

Beginner intuition:

```text
Spectrum chart = map.
EMOE = weather + traffic + road closures + other drivers.
```

In FRKNK:

- The safe lab EMOE is synthetic/file/fake-device.
- Future live receive can help observe a local spectrum slice, but not imply permission to transmit or interfere.

---

## 2. Signal and sampling terms

### Signal

A time-varying quantity that carries information or structure. In SDR, a signal may be a broadcast, a carrier, noise, a digital waveform, a test tone, or a synthetic fixture.

In FRKNK:

- A `SignalCandidate` is a suspected signal region, not truth.
- A clean verifier must confirm suggestions produced by lossy sketches.

---

### Noise floor

The baseline background power level beneath signals. A weak signal may be invisible if it sits near or below the noise floor.

Intuition:

```text
Noise floor = room noise.
Signal = someone speaking.
Detection = deciding someone is speaking above the room noise.
```

In FRKNK:

- Synthetic sources should control noise level.
- Sketch demos should report confidence cautiously.

---

### Bandwidth

How wide a slice of frequency a signal or receiver occupies.

In FRKNK:

- Receiver bandwidth is related to sample rate and filtering.
- Candidate bandwidth should be estimated, not blindly asserted.
- Capability policy should prevent a command from asking hardware for unsupported bandwidth.

---

### Center frequency

The frequency the receiver is tuned around. SDR receive usually observes a span centered on this frequency.

In FRKNK:

- `centerFrequencyHz` belongs in `IqFrame`, device state, corpus metadata, and SigMF captures.
- Tuning commands change center frequency and must be represented as typed commands/events.

---

### Sample rate

How many samples per second are captured. Higher sample rates can observe wider bandwidth, but cost more CPU/memory/storage.

In FRKNK:

- `sampleRateHz` is mandatory on IQ frames and corpus metadata.
- Runtime profiles should choose sample rate based on workload: cockpit, offline replay, ML sketch, or protocol verifier.

---

### ADC — Analog-to-Digital Converter

Hardware that turns an analog signal into digital samples.

In FRKNK:

- Real devices contain ADCs.
- Synthetic/file/fake-device sources act as ADC stand-ins for safe labs.

---

### IQ samples

A representation of a radio signal as two streams:

- **I**: in-phase component;
- **Q**: quadrature component, shifted 90 degrees.

Intuition:

```text
I/Q is how SDR preserves both “how much” and “which way around the circle” a signal is moving.
```

Why it matters:

- IQ lets software tune, filter, demodulate, and analyze signals around a center frequency.
- Complex samples are the normal currency of SDR receive chains.

In FRKNK:

- The lab uses complex64 (`.c64`) IQ.
- SigMF maps this to `cf32_le` when little-endian complex float samples are stored.

---

### FFT — Fast Fourier Transform

A computational method for answering: “What frequencies are present in this chunk of samples?”

Intuition:

```text
Time samples = waveform over time.
FFT = ingredient list of frequencies inside that waveform.
```

In FRKNK:

- Waterfall sketches are built from repeated FFT-like windows over time.
- FFT results are analysis artifacts, not replacement for raw IQ.

---

### STFT / waterfall

A short-time Fourier transform computes frequency content over successive time windows. A waterfall display stacks these windows over time so signals draw trails.

In FRKNK:

- `low_res_waterfall` is the current coarse sketch lane.
- TMNL cockpit should eventually render waterfall/spectrum as operator surfaces.

---

## 3. SDR runtime terms

### Flowgraph

A graph of sources, processing blocks, and sinks through which samples flow. GNU Radio uses this as its core model.

In FRKNK:

- Borrow the separation of sources/blocks/sinks.
- Do not clone GNU Radio. That way lies ceremony, and Prime already has enough robes.

---

### DSP block

A unit of digital signal processing: filter, demodulator, decimator, detector, sketch generator, etc.

In FRKNK:

- DSP blocks should have explicit input/output contracts.
- Blocks may run in live pipelines or offline corpus jobs.

---

### Decimation

Reducing sample rate, usually after filtering, to make data cheaper to process.

In FRKNK:

- Lossy sketches are an extreme form of “make it cheaper.”
- The raw IQ remains authoritative; sketches are attention aids.

---

### Demodulation

Recovering useful information/audio/data from a modulated carrier.

In FRKNK:

- Quisk is currently the clean verifier/demodulator reference.
- FRKNK can defer serious demodulator implementation until the runtime and corpus contracts are clean.

---

### Verifier

A cleaner, more faithful analysis path used to check a cheap/lossy suggestion.

In FRKNK:

```text
Sketch: “look here.”
Verifier: “yes/no/uncertain, with evidence.”
```

The sketch sidecar must never become the truth oracle.

---

## 4. Device/protocol terms

### Radio device

A physical, fake, file-backed, or synthetic source/sink of SDR data and radio-control state.

In FRKNK:

```text
RadioDevice = identity + capabilities + streams + controls + telemetry + policy profile
```

---

### Backend

The implementation family behind a `RadioDevice`:

- fake Hermes emulator;
- Hermes/OpenHPSDR hardware;
- corpus replay;
- synthetic source;
- future SoapySDR/UHD/RTL-SDR/HackRF/audio-card.

---

### Capability

A declared operation a device/profile can or cannot perform.

Examples:

- RX stream available;
- set RX frequency available;
- TX unavailable;
- MOX locked;
- PA simulated;
- ATU requires approval.

In FRKNK:

- UI and agents must query capabilities before offering actions.
- Policy must enforce capabilities even if UI gets clever. Especially if UI gets clever.

---

### Profile

A named bundle of layout, backend, limits, and safety policy.

In FRKNK/TMNL:

- FRKNK profile: runtime/backend/capability rules.
- TMNL profile: cockpit layout and enabled controls.
- They must agree; otherwise the UI lies about the radio.

---

### Hermes / OpenHPSDR

A family/protocol ecosystem for SDR hardware. Hermes-Lite2 uses a core subset of OpenHPSDR Protocol 1 and can work with standard OpenHPSDR-compatible software.

In FRKNK:

- First concrete protocol target.
- Fake Hermes emulator provides deterministic, safe protocol tests.

---

### Metis discovery

A UDP discovery/start/stop mechanism used by OpenHPSDR-compatible software/hardware.

In FRKNK:

- The emulator responds to Metis discovery.
- Tests should keep protocol bit parsing honest.

---

### MOX / PTT

Transmit-control concepts:

- **MOX**: manual transmit control bit in OpenHPSDR command/control.
- **PTT**: push-to-talk, start transmitting.

In FRKNK cycle 1:

- These are contract concepts and emulator observations.
- They are not live transmit features.
- They must default to `locked` or `unavailable`.

---

## 5. Corpus and ML/sketch terms

### Corpus

A collection of signal recordings and metadata for replay, regression, and analysis.

In FRKNK:

- Corpus replay is a first-class backend, not test leftovers.
- SigMF compatibility should prevent metadata bitrot.

---

### Synthetic source

A generated signal source with known truth metadata.

In FRKNK:

- Best first lab material.
- Lets tests know where a tone/signal should be before the detector runs.

---

### Sketch

A cheap, lossy representation of a larger signal, designed to preserve enough structure for quick attention/detection.

In FRKNK:

- `low_res_waterfall` and `one_bit_waterfall` are sketch lanes.
- Sketches trade fidelity for speed and cheapness.
- Sketch output must carry provenance and uncertainty.

---

### Candidate

A proposed signal region emitted by an analysis/sketch sidecar.

In FRKNK:

- A candidate should include frequency span, confidence, source sketch lane, and verifier status.
- A candidate is not a confirmed signal.

---

## 6. Safety and control terms

### TX — Transmit

Sending RF energy out of a device/antenna.

In FRKNK cycle 1:

- Live TX is out of scope.
- TX-related contracts exist so the policy model is honest.
- Live TX commands are locked unless explicitly approved in a future feature plan.

---

### Jamming / interference

Intentional or unintentional disruption of authorized communications.

In FRKNK:

- Illegal/harmful jamming implementation is out of scope.
- The lab may discuss interference conceptually and simulate receive-side effects, but not build tools to interfere with real systems.

Source grounding:

- FCC jammer enforcement guidance prohibits operating, marketing, or selling jamming devices that interfere with authorized radio communications.
- CISA treats RF interference and illegal jamming as public-safety communication concerns.

---

### Approval gate

A required explicit human or policy approval before executing a sensitive command.

In FRKNK:

- Required for TX/PA/PTT/MOX/ATU/drive and any future agentic hardware-affecting command.
- Rejections must be logged too.

---

### Dry run

A command evaluation mode that checks what would happen without doing it.

In FRKNK:

- Agentic/chat controls must dry-run first.
- Dry-run result should include policy result, capability state, expected device effect, and required approvals.

---

### Control operator

In U.S. amateur-radio regulation, an amateur station must have a control operator when transmitting, and the station may only operate within that operator's privileges.

In FRKNK:

- If future ham-radio transmit support ever appears, profile policy must include operator/license constraints.
- Cycle 1 avoids this by staying receive/sim/fake/file first.

---

## 7. FRKNK glossary source URLs

- GNU Radio — Operating a Flowgraph: <https://www.gnuradio.org/doc/doxygen-3.7.5/page_operating_fg.html>
- GNU Radio — Message Passing: <https://wiki.gnuradio.org/index.php/Message_Passing>
- SoapySDR — Driver Guide: <https://github.com/pothosware/SoapySDR/wiki/DriverGuide>
- SigMF Specification: <https://sigmf.org/>
- Quisk Help: <https://james.ahlstrom.name/quisk/help.html>
- Hermes-Lite2 Protocol: <https://github.com/softerhardware/Hermes-Lite2/wiki/Protocol>
- JDN 3-16 Joint Electromagnetic Spectrum Operations: <https://irp.fas.org/doddir/dod/jdn3_16.pdf>
- FCC Jammer Enforcement: <https://www.fcc.gov/general/jammer-enforcement>
- CISA RF Interference Best Practices Guidebook: <https://www.cisa.gov/resources-tools/resources/radio-frequency-interference-best-practices-guidebook>
- 47 CFR § 97.7 Control operator required: <https://www.law.cornell.edu/cfr/text/47/97.7>
- 47 CFR § 97.105 Control operator duties: <https://www.law.cornell.edu/cfr/text/47/97.105>
