# Native KiCad powered-video program

Coordination issue: [#18](https://github.com/creatifcoding/gbg/issues/18)

The SVG electrical sheet is a review diagram, not circuit authority. No native
KiCad project, SPICE deck, Touchstone model, or released PCB exists at the
current `DRAFT` maturity.

## Complete path

```text
supported camera module, exact revision TBD
  -> local 22-position 0.5 mm MIPI CSI-2
  -> selected MAX96717 suffix
  -> camera-TX launch
  -> B50 C10/C11, C09/C12 RF returns
  -> carriage controlled-impedance route
  -> B27 P10/P11, P09/P12 RF returns
  -> B19 fixed indexed dock and receiver launch
  -> selected MAX96724 suffix/input
  -> short receiver-local CSI
  -> Particle Tachyon
```

P01/P02 carry protected VIN, P03/P04 return, P05/P06 isolated I2C,
P07 identity, and P08 diagnostic fault/IRQ. P08 and software are never safety
authority. The camera carriage has no cable tether. Raw MIPI does not traverse
B50, B27, or the rail.

## Project partition

```text
terrarium/ee/kicad/
  libs/{symbols,footprints,models,sources.lock.json}
  contracts/
  system/
  power-control/
  camera-tx/
  carriage/
  rail-rx/
  fixture/
  jobsets/
  outputs/<assembly>/<revision>/
```

The system project contains reviewed black boxes and exact interface pins. Each
physical board remains independently releasable. A checker compares every
P01-P12 and C01-C12 connection against `terrarium/bus.json`.

Recommended system sheets:

1. system boundary;
2. interface and state contract;
3. source, fuse, and eFuse;
4. B19/B27 indexed dock;
5. carriage AON, S1, and Q1;
6. B50, S2, and binder;
7. camera and serializer;
8. complete GMSL channel;
9. deserializer and receiver;
10. Tachyon-local CSI;
11. low-speed, UID, and diagnostics;
12. test and fault injection.

## Source and library gate

Issue #23 selects exact camera, SerDes suffixes, Tachyon interface, B27/B50
contacts, S1/S2, Q1 safety assembly, rail protection, regulators, ESD/TVS, and
fabricator stackup. Every local symbol/footprint/model records exact MPN,
source revision, retrieval date, license, digest, pin-to-pad table, datum,
courtyard, mask/paste, height, and mating direction. An inaccessible pinout or
drawing is a blocker, not an invitation to infer.

## Power and interlock gate

Issue #24 implements the hardware truth table in KiCad and ngspice:

```text
branch authorization =
  full B27 mate
  AND full B50 mate
  AND mechanical-safe channels
  AND bounded training authorization
  AND no latched fault
```

The fault matrix covers Q1 short/open, S1/S2 open/weld, discharge open,
supervisor brownout/frozen state, low-speed/ESD/GMSL backfeed, one parallel
VIN/GND contact open, bounce, partial mate, and interrupted pinch. Simulation
screens values; scope captures qualify the selected design.

## Channel and board gate

Issue #25 owns the camera-TX, carriage, and rail-RX native projects and the
complete serializer-launch -> B50 -> carriage -> B27 -> receiver-launch model.
Use sourced stackup, Dk/Df, roughness, plating, component/contact models, and a
declared de-embedding plane. scikit-rf and a reproducibly qualified field
solver may reject a geometry; neither can qualify it.

Required checks and exports per board:

- reviewed local libraries and schematic/PCB parity;
- zero unreviewed ERC/DRC violations;
- sourced net classes/stackup, deliberate returns and ESD paths;
- KiCad STEP export and OCCT re-import against mechanical datums;
- exact-MPN BOM, Gerber X2, Excellon, position, assembly/fabrication PDF,
  netlist, raw reports, logs, and digest manifest;
- optional IPC formats only when the pinned tool/fabricator path proves them;
- independent CAM re-import and polarity/net-count review.

## Coupon and fixture gate

Issue #26 creates 2x-thru/calibration, B27-only, B50-only, full-channel, and
method-appropriate open/short/load structures. The power fixture exposes S1,
S2, Q1, branch current/voltage, discharge, bus isolation, link lock, and safe
fault injection. Every board says:

`LAB COUPON — CONCEPT VALIDATION — NOT FOR ANIMAL USE`

Ordering, assembly, energization, fault injection, and ESD testing require
human approval.

## Qualification gate

Issue #27 first establishes an active vendor-supported baseline, then inserts
the passive B50+B27 channel, then tests custom boards and Tachyon integration.
Evidence includes mixed-mode S-parameters/TDR, insertion/return loss,
impedance, skew, mode conversion, crosstalk, training/recovery, supported
eye/BER or equivalent, power sequence, current sharing, backfeed, thermal,
contamination, compression, bounce, ESD strategy, and cycle wear.

Raw instrument files, calibration identity, board/fixture revisions, limits
and their source digests, uncertainty, samples, reduction code, deviations,
and failures are mandatory. Missing instruments create an external-lab or
procurement blocker. Negative evidence is valid but never silently passes a
gate.
