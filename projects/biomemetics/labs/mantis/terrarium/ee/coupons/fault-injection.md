# Safe fault-injection procedure (issue 26)

Status: `UNVERIFIED` procedure. PROTO-FAB DRAFT. Human approval required
before any energization or injection.

Consumes #24 net names and single-fault protocol facts frozen from PR40
(power-control board absent on this base; not rewritten or recreated).
P08, UID, I2C, and software are never the safety off path.

## Safe default

All `K_*` jumpers are DNP (open). Series OPEN links therefore break S1, S2, Q1
VIN, and discharge. Weld/short jumpers are parallel and also DNP. The branch
is off.

## Limits (numeric values still UNVERIFIED)

- VIN_RAIL current-limited at or below F1 TARGET 2 A until a sourced fuse
  exists.
- Carriage load is C_LOAD / dummy, not a camera module.
- Do not inject MIPI onto P10/P11.
- One fault at a time.
- Kill VIN_RAIL at the source for unsafe-stop. If S1 or S2 is welded, treat
  the fixture as energized until V_BRANCH is measured below selected v_safe.

## Probe map

| Node | TP | Notes |
| --- | --- | --- |
| VIN_RAIL | TP_VIN | source side of R_SRC |
| V_BRANCH | TP_VBR / TP_Q1OUT | after Q1B |
| I_BRANCH | TP_IBR | Q1_MID; sense MPN UNVERIFIED |
| S1 | TP_S1 | INTERLOCK_MID |
| S2 | TP_S2 | INTERLOCK_OK |
| Q1_EN | TP_Q1EN | never driven by P08 |
| Discharge | TP_DIS | Q1_EN_N reserved; discharge MPN UNVERIFIED |
| Fault latch | TP_FLT | P08_DIAG observer |
| Link lock | TP_LOCK | reserved; SerDes lock pin UNVERIFIED |
| ISO | TP_ISO | ISO_EN |
| AON | TP_AON | supervisor, not V_BRANCH |

## Cases (one at a time)

| ID | Insert | Expected screening (not a PASS) |
| --- | --- | --- |
| F-S1O | leave K_S1_OPEN DNP; S1 unactuated | Q1_EN off |
| F-S1W | stuff K_S1_WELD only | hazard: interlock true if S2 also closed; do not lift |
| F-S2O | leave K_S2_OPEN DNP | Q1_EN off before B50 move |
| F-S2W | stuff K_S2_WELD only | hazard during binder move |
| F-Q1O | leave K_Q1_OPEN DNP | V_BRANCH unavailable |
| F-Q1S | stuff K_Q1_SHORT | dual-channel bypass hazard; current-limit must trip |
| F-DIS | leave K_DIS_OPEN DNP | discharge open; lift predicate false |
| F-VINA | leave K_VINA_OPEN DNP (VIN_B still via R_VIN_B) | one VIN contact open |
| F-GNDA | remove R_GND_A / leave GND_A open | one GND contact open |
| F-UID | stuff K_UID_INJ to INJ_UID | must not force Q1 on |
| F-P08 | stuff K_P08_INJ to INJ_P08 | diagnostic only; must not force Q1 on |
| F-I2C | stuff K_I2C_INJ to INJ_SDA | backfeed/ISO path; must not force Q1 on |
| F-PART | K_PARTIAL to S1_PARTIAL | partial mate; branch off |
| F-BO | K_BROWNOUT toward VIN_BROWNOUT source | UVLO/brownout; Q1 off |

Partial mate and brownout sources are UNVERIFIED envelopes. Do not invent a
supply MPN.

## After each case

De-energize per `rollback.md`. Photograph jumper state. Do not proceed to ESD
or animal-adjacent work from this coupon.
