# Terrarium electrical work

KiCad source, SPICE models, channel coupons, and bench evidence belong here.
The current drawing set is theoretical; no PCB has been released.

First hardware gate: a short indexed GMSL2 coupon containing the B27 rail pogo
interface, carriage routing, separate B50 binder handoff, both launches,
S1/S2/Q1 break-before-move interlocks, current-limited power, and measured
TDR/return-loss/eye/BER results. Raw MIPI remains local to the camera binder and
the Tachyon-side deserializer.

`schematics/S08-electrical.svg` is a functional review diagram, not circuit
authority. A KiCad schematic with selected protection, mate sensing, discharge,
and connector/contact parts is a release blocker.

The detailed native-source, board-partition, fixture, export, and qualification
contract is in [`KICAD-PLAN.md`](KICAD-PLAN.md). Live execution is coordinated
by GitHub issue #18 and bounded leaf issues #23 through #27.
