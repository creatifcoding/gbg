# Current-limited first-power protocol (issue 26)

Status: `UNVERIFIED`. Human approval required before energization.

## Setup

- Supply: selected VIN TARGET 12 V from `PARAMS.md` (read-only). Current limit
  at or below F1 TARGET 2 A.
- All `K_*` DNP. Q1 path therefore open (K_Q1_OPEN series).
- No camera module. C_LOAD remains DNP until MPN selected.
- Operator at the source kill switch.

## Sequence

1. Probe TP_VIN, TP_VBR, TP_S1, TP_S2, TP_Q1EN before applying VIN.
2. Apply VIN_RAIL through R_SRC envelope (MPN UNVERIFIED: if unstuffed, do not
   claim a connected source).
3. Expect V_BRANCH near 0 with Q1 open. If V_BRANCH rises, kill source.
4. Do not stuff K_Q1_SHORT. Do not assert Q1_EN from P08.
5. AON (VIN_AON) is a separate supervisor envelope; MPN UNVERIFIED. Do not
   invent a regulator.
6. After observations, kill source and follow `../../coupons/rollback.md`.

Numeric v_safe / I_LIM / t_discharge remain UNVERIFIED until S1/S2/Q1/F1 are
selected. This protocol cannot produce a PASS without those numbers.
