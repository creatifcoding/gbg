# Rollback / de-energize (issue 26)

Status: `UNVERIFIED` procedure. Required before contact lift, binder release,
or leaving the bench.

## Immediate unsafe-stop

1. Kill VIN_RAIL at the source supply. Do not use P08, UID, I2C, or a software
   button.
2. Confirm TP_VIN is at the selected safe voltage.
3. If K_S1_WELD or K_S2_WELD is stuffed, treat the fixture as energized until
   TP_VBR is below selected v_safe (value UNVERIFIED until parts exist).

## Nominal rollback

1. Command Q1 off (Q1_EN low). P08 must not be the off path.
2. Confirm discharge path: K_DIS_OPEN stuffed only if a discharge MPN exists
   and was approved; otherwise do not claim v_safe.
3. Confirm ISO_EN off / U_ISO isolating SDA_BR.
4. Open S1 (unactuate or lift K_S1_OPEN) before any B27 motion.
5. Open S2 before any B50 motion.
6. Remove all fault jumpers to DNP. Photograph.
7. Cap unused RF and power connectors.

## What this does not do

It does not qualify hardware. It does not permit animal use. It does not
permit a shop order.
