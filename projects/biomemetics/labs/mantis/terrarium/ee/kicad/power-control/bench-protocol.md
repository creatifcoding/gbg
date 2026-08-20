# Bench protocol (issue 24)

Status: `UNVERIFIED` procedure. No PASS until selected S1/S2/Q1/F1 parts define
numeric v_safe, t_discharge, I_LIM, and contact-order limits.

## Channels (common timebase)

| Ch | Node | Probe |
| --- | --- | --- |
| 1 | S1 | TP4 / INTERLOCK_MID vs GND |
| 2 | S2 | TP5 / INTERLOCK_OK vs GND |
| 3 | Q1_EN | TP1 |
| 4 | V_BRANCH | TP2, 10x, limited to selected VIN |
| 5 | I_BRANCH | TP3 / sense across R_SNS |
| 6 | P08_DIAG | TP6 (diagnostic only; not the off command) |
| 7 | SDA_RAIL vs SDA_BR | backfeed |
| 8 | B27/B50 displacement or make-switches | fixture |

## Loads and limits

- VIN_RAIL: selected supply, current-limited at or below F1 TARGET 2 A until a
  sourced fuse exists.
- Carriage load: current-limited dummy, not a camera module.
- Do not inject MIPI onto P10/P11.

## Unsafe-stop

Kill VIN_RAIL at the source. Do not use P08, UID, I2C, or a software button as
the safety off path. If S1 or S2 is welded, treat the fixture as energized until
V_BRANCH is measured below the selected v_safe.

## Cases

Nominal seat/train, slow/partial/interrupted pinch, S1/S2 bounce and
disagreement, brownout, stuck-open, stuck-closed (hazard), Q1A short, Q1 open,
dual-channel short (hazard), output short, discharge-open (lift predicate
false), unpowered backfeed, repeated detach/remate, S2-open before B50 move.

ngspice screens these in `simulations/electrical/power-control/`. Scope captures
qualify them. Missing instruments are a blocker, not a simulated PASS.
