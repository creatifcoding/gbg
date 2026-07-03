# FRKNK Safety, Legal, and Ethics Boundary

Tasker task: `#4390 Document safety, legal, and ethics boundary for receive-first CEW learning`

Status: safety draft for Prime review. Not legal advice.

This boundary exists so FRKNK can become a serious SDR/CEW learning and research platform without accidentally becoming a small, stylish regulatory incident. Prime, the lab coat stays on; the transmit button stays behind glass.

---

## 1. Operating stance

FRKNK RFC 0001 is:

```text
receive-first;
simulation-first;
fake-device-first;
file/corpus-replay-first;
capability-gated;
approval-first for hardware-affecting commands;
strictly non-jamming and non-interference.
```

The first implementation family is allowed to:

- generate synthetic IQ;
- replay files/corpora;
- emulate Hermes/OpenHPSDR locally;
- receive and analyze safe sample data;
- inspect protocol packets;
- produce lossy sketches and candidate suggestions;
- compare candidates against clean verifier paths.

The first implementation family is not allowed to:

- transmit RF energy;
- jam or interfere with authorized communications;
- implement real-world electronic attack workflows;
- automate hardware-affecting commands without policy evaluation;
- let agentic/chat controls bypass approval;
- treat receive-side observations as permission to act.

---

## 2. Legal grounding — high-confidence boundaries

### 2.1 Jamming is prohibited

FCC jammer enforcement guidance states that federal law prohibits operation, marketing, or sale of jamming equipment that interferes with authorized radio communications, including cellular, PCS, police radar, and GPS. It also states there are no exemptions for use within a business, classroom, residence, or vehicle, and that penalties may include monetary penalties, seizure, and criminal sanctions.

FRKNK implication:

- No jamming device implementation.
- No real RF interference tooling.
- No “for education” loophole theater. That costume is not flattering.

Source: <https://www.fcc.gov/general/jammer-enforcement>

---

### 2.2 RF interference is a public-safety issue

CISA's RF Interference Best Practices Guidebook page describes RF interference, illegal jamming operations, and their implications for public safety communications. It frames recognition, response, reporting, and resolution as important public-safety capabilities.

FRKNK implication:

- Interference may be studied as a concept and simulated offline.
- FRKNK should teach recognition/reporting/resolution framing, not interference execution.
- Safety docs and UI copy should distinguish “observe/report” from “act/interfere.”

Source: <https://www.cisa.gov/resources-tools/resources/radio-frequency-interference-best-practices-guidebook>

---

### 2.3 Amateur transmission requires license/control obligations

47 CFR § 97.5 requires station apparatus to be under the physical control of a person named in an amateur station license grant before transmitting on amateur-service frequencies where FCC regulation applies. 47 CFR § 97.7 says each amateur station must have a control operator when transmitting. 47 CFR § 97.105 says the control operator must ensure immediate proper operation and operate only within the privileges of the operator's license class. 47 CFR § 97.109 covers local, remote, and automatic station control.

FRKNK implication:

- No live amateur TX in RFC 0001.
- Future ham-radio TX support, if any, must model operator identity, license class/privileges, station control mode, and control-operator responsibility.
- Remote/automatic control requires extra scrutiny and explicit design, not a checkbox hidden in settings like a gremlin.

Sources:

- <https://www.law.cornell.edu/cfr/text/47/97.5>
- <https://www.law.cornell.edu/cfr/text/47/97.7>
- <https://www.law.cornell.edu/cfr/text/47/97.105>
- <https://www.law.cornell.edu/cfr/text/47/97.109>

---

### 2.4 Spectrum operations require authorization/deconfliction in professional contexts

JDN 3-16 frames joint electromagnetic spectrum operations around prioritizing, integrating, synchronizing, and deconflicting EMS use. It distinguishes transmission authorization, coordination measures, interference resolution, host-nation coordination, legal review, and rules of engagement as core concerns.

FRKNK implication:

- Even though FRKNK is not a military C2 system, the safety model should learn the architectural lesson: transmit/control actions need policy, deconfliction, audit, and authority.
- Receive-only/synthetic/file labs avoid most of this operational risk while still teaching the concepts.

Source: <https://irp.fas.org/doddir/dod/jdn3_16.pdf>

---

## 3. FRKNK capability states

RFC 0001 should use explicit capability states rather than ambiguous booleans.

| Capability state | Meaning | Example |
|---|---|---|
| `available` | Runtime can execute this command under current profile without extra approval. | Start synthetic RX stream. |
| `simulated` | Command is accepted only against fake/simulated device state. | Fake Hermes receives MOX bit but does not transmit. |
| `requiresApproval` | Command may execute only after explicit approval gate passes. | Future hardware gain/antenna changes, if profile marks as sensitive. |
| `locked` | Capability exists conceptually but is deliberately locked by policy. | TX/PTT/MOX/PA in cycle 1. |
| `unavailable` | Device/backend cannot perform the capability. | ATU on a backend with no ATU. |
| `unsupported` | FRKNK has no implementation path yet. | Exotic backend-specific register access outside profile. |

Recommended invariant:

```text
No command executes from UI, script, CLI, or agent unless runtime policy returns allow.
```

---

## 4. Command classes and default policy

| Command class | Examples | RFC 0001 default |
|---|---|---|
| Safe local analysis | Read file, generate synthetic IQ, compute waterfall, run sketch locator | `available` |
| Fake-device receive | Start fake Hermes emulator, stream deterministic endpoint-6 IQ | `available` / `simulated` |
| Live receive | Start RX-only stream on real hardware | Deferred; later `requiresApproval` or profile-gated |
| Non-radiating hardware config | Set RX frequency, sample rate, RX gain | Deferred; policy-gated when hardware exists |
| Transmit intent | PTT, MOX, TX drive, PA enable, tune/spot, ATU | `locked` |
| Interference/jamming | Any intentional disruption of authorized communications | Prohibited / out of scope |
| Agentic hardware action | Chat/agent proposes device state change | Dry-run only unless policy and human approval pass |

---

## 5. Agentic control boundary

A future TMNL command island/chat surface may propose actions, but it must not own authority.

Required command flow:

```text
User/Agent proposal
  → typed CommandEnvelope
  → dry-run evaluation
  → capability policy
  → safety/legal profile check
  → human approval if required
  → runtime execution
  → append-only event log
```

Hard rule:

```text
Agentic command paths are never privileged paths.
```

If a human cannot do something through the normal policy gate, an agent cannot do it by sounding confident in a sidebar.

---

## 6. Receive-side ethics and privacy

Receive-only is safer, not automatically harmless.

FRKNK docs and labs should avoid encouraging interception or analysis of private/protected communications. The initial labs use:

- synthetic IQ;
- local corpus fixtures;
- fake Hermes streams;
- public/reference signals only where appropriate and lawful;
- no decoding of private communications.

RFC language should avoid implying that “I can receive it” means “I am allowed to decode, store, publish, or act on it.”

---

## 7. Safety requirements for RFC 0001

The RFC should require these implementation properties:

1. **Policy before execution**
   - Every command passes policy.
   - Policy result is explicit and serializable.

2. **Audit log**
   - Log allowed, denied, simulated, and dry-run commands.
   - Include issuer, target, profile, timestamp, policy result, and reason.

3. **Capability-aware UI**
   - TMNL must render locked/unavailable controls as such.
   - Hidden controls are not sufficient; safety state should be inspectable.

4. **Backend honesty**
   - Fake devices must declare themselves fake.
   - Simulated commands must be labeled simulated in events and UI.

5. **TX locks by default**
   - TX/PTT/MOX/PA/ATU/drive commands are locked in RFC 0001.
   - Protocol parsers may observe these bits for compatibility, but runtime must not radiate.

6. **No silent fallback to live hardware**
   - If synthetic/file/fake backend is requested, FRKNK must not auto-upgrade to hardware.
   - Backend identity must be explicit.

7. **No harmful recipes**
   - Educational docs may explain concepts.
   - Docs must not provide operational steps for jamming/interference or evasion.

---

## 8. Ethics framing for the learning track

FRKNK should teach CEW/SDR as:

- spectrum awareness;
- responsible RF engineering;
- protocol understanding;
- safe simulation;
- detection and verification;
- operator accountability.

FRKNK should not frame itself as:

- a jammer toolkit;
- an intrusion/exploitation platform;
- an automated RF attack surface;
- a “because SDR can, SDR should” machine.

Short version:

```text
Listen first. Simulate deeply. Verify cleanly. Transmit only after law, license, policy, hardware, and human approval all agree.
```

---

## 9. Prime review questions

1. Do you want RFC 0001 to completely omit live hardware receive, or define it as a future-but-designed capability?
2. Should the first policy model include operator identity/license fields now, even while TX is locked?
3. Should fake Hermes simulate TX state changes as telemetry-only, or reject TX/MOX state changes as locked?
4. What should TMNL show when a command is locked: disabled control, warning drawer, or capability inspector?

---

## 10. Source URLs

- FCC Jammer Enforcement: <https://www.fcc.gov/general/jammer-enforcement>
- CISA RF Interference Best Practices Guidebook: <https://www.cisa.gov/resources-tools/resources/radio-frequency-interference-best-practices-guidebook>
- JDN 3-16 Joint Electromagnetic Spectrum Operations: <https://irp.fas.org/doddir/dod/jdn3_16.pdf>
- 47 CFR § 97.5 Station license required: <https://www.law.cornell.edu/cfr/text/47/97.5>
- 47 CFR § 97.7 Control operator required: <https://www.law.cornell.edu/cfr/text/47/97.7>
- 47 CFR § 97.105 Control operator duties: <https://www.law.cornell.edu/cfr/text/47/97.105>
- 47 CFR § 97.109 Station control: <https://www.law.cornell.edu/cfr/text/47/97.109>
