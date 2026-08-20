# Single-fault interlock protocol

Status: `UNVERIFIED`; procedure draft only.

Inject one fault at a time: S1 welded/open, S2 welded/open, P08 asserted/open,
UID missing/wrong, I2C stuck low/high, firmware frozen, link lock false/true,
Q1 control open/short, discharge open, and one bent/late B27 or B50 contact.
Repeat during absent, partial mate, training, active, first pinch travel,
pinch-safe, lifted, and interrupted-pinch conditions.

Acceptance: no single injected fault may energize or retain energy in the local
carriage load branch while B27 or B50 geometry is moving or ambiguous. P08,
software, UID, and link lock may diagnose but may not waive S1/S2 hardware
authority. Numeric safe-voltage/time and current limits must be selected before
the protocol can produce a PASS.
