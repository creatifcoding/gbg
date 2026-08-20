# Bring-up plan (issue 26)

Status: `UNVERIFIED`. Human approval required. Not a qualification.

## Order of work (do not skip)

1. Visual: marking, polarity, no animal-side metal, DNP population matches BOM.
2. Unpowered continuity of GND_A/GND_B shares and HSGND returns.
3. Confirm no CSI copper on B27/B50 pads.
4. Current-limited first-power (`first-power.md`).
5. Passive channel: de-embed procedure with adapters selected.
6. Power fixture probes, still no fault jumpers stuffed except approved
   nominal series links.
7. Fault injection, one at a time (`../../coupons/fault-injection.md`).
8. Rollback (`../../coupons/rollback.md`).

## Instruments (missing = blocker)

VNA/TDR, cal kit, current-limited supply, scope with the #24 channel list,
dummy load. Do not substitute ngspice or the #25 numpy cascade as a PASS.

## Out of scope

#27 powered-video bench qualification, animal use, shop order, ESD until
separately approved.
