# ADR-002: speed-independent safe-to-lift blocker

Status: accepted for working draft B by the #29 implementer. Maturity DRAFT. Not a shop release.

Operator waiver 2026-08-20: proceed on attested `cursor-grok-4.6-high`. Packet asked Grok 4.6 xhigh to arbitrate this ADR; this file records the mechanical choice and the unmet electrical remainder.

## Decision

Use a **hardware two-stage positive blocker**, not a passive cam annotation and not a timed rate limiter.

1. **Lift pawl** occupies a slot under B24 until pinch travel `q` reaches `PINCH_SAFE`. B27 cannot leave the land plane before that.
2. **Translation pawl** occupies the dovetail until carrier lift ≥ calculated clearance (`pogo.working_compression` + `pogo.released_contact_lift_min` = 1.8 mm from TARGETS). Rolling with contacts on the land is geometrically blocked.
3. **Binder release pin** occupies B28 until pinch ≥ `PINCH_SAFE`. First binder travel opens the S2 envelope while B50 stays keyed/seated.

The sequence is a function of `q` and `r` only. Human pinch speed cannot skip a pawl.

## Why not a verified delay / rate limiter

#24 is unmet. No selected S1/S2/Q1 parts, discharge voltage, or discharge time exist. Inventing a millisecond dwell would be a new electrical decision. A geometric blocker does not need that number.

## What this does not decide

- Switch PN, actuation force, bounce, and polarity (`IF-S1-actuator`, `IF-S2-actuator` remain UNVERIFIED).
- Q1 off / branch-below-safe-voltage. Mechanical `PINCH_SAFE` and `BRANCH_SAFE` are travel gates. Electrical proof waits on #24.
- B27/B50 contact series (#23).
- Admitting PR 34 frame STEP.

## Revisit

When #24 publishes a discharge time and a switch travel, keep the pawls and add a measured electrical dwell as a second, independent gate. Do not replace the pawls with firmware, P08, UID, I2C, or assumed pinch speed.
