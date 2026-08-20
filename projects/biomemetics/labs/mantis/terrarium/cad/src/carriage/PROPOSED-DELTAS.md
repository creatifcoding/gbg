# Proposed deltas (not applied)

Issue #29 does not own `params.json`, `bus.json`, `BOM.md`, `workstreams.json`, `cad/assembly`, or KiCad. These are integration-owned. Apply only after the root merges them.

## params.json

Add TARGET/UNVERIFIED records. Do not promote them to measured. Do not treat PR 34 study dims as qualified.

| Name | Value | Status | Source |
| --- | ---: | --- | --- |
| carriage.envelope.width | 60 | ref | PARAMS.md (already proposed by #28) |
| carriage.envelope.depth | 42 | ref | PARAMS.md |
| carriage.envelope.height | 28 | ref | PARAMS.md |
| carriage.s1_open_travel | 1.0 | target | gbg#29 first pinch travel |
| carriage.pinch_safe_travel | 2.2 | target | gbg#29 lift-pawl retract |
| carriage.contacts_clear_travel | 4.0 | target | gbg#29 lift complete |
| carriage.lift_cam_throw | 2.2 | target | 1.8 mm calculated clearance + 0.4 mm print stack |
| carriage.print_compensation | 0.20 | unverified | same magnitude as cassette seat; mechanism coupon absent |
| pogo.proxy_diameter | 1.0 | unverified | packaging proxy; series/PN absent (#23) |
| pogo.barrel_length | 6.0 | unverified | envelope only |
| s1.actuator_envelope | 8.0 | unverified | B48/S1 PN absent (#24) |
| s2.actuator_envelope | 8.0 | unverified | B48/S2 PN absent (#24) |
| binder.s2_open_travel | 1.0 | target | gbg#29 first binder travel |
| binder.branch_safe_travel | 2.0 | target | mechanical dwell; electrical UNVERIFIED |
| binder.free_travel | 3.5 | target | B50 unmate after dwell |
| binder.b50_key_offset | 4.0 | target | reverse-mate key; series UNVERIFIED |
| binder.unmate_clearance | 2.0 | target | B50 proxy separation |
| b26.roller_diameter | 8.0 | unverified | B26 PN absent |
| camera.module_keepout | 32.0 | unverified | B36 outline absent |
| csi.local_bend_keepout | 12.0 | unverified | B37 FPC absent |

Do not add Q1 discharge voltage/time. That is #24.

## BOM.md

No quantity change. Annotate:

- B22–B26: DRAFT OCCT envelopes under `cad/src/carriage`
- B27: contact-array **proxy**; series UNVERIFIED
- B28/B29/B34: DRAFT OCCT envelopes under `cad/src/binder`
- B48: mechanical actuator envelopes only; electrical still #24
- B50: keyed half **proxies**; series/pinout UNVERIFIED
- B36/B37: keep-outs, not sourced outlines

## bus.json

No net or state change. Optional geometry pointer: `mechanicalRef: terrarium/cad/src/carriage`. Do not add invented C01–C12 pin geometry.

## cad/assembly

Named assembly STEP lives at `cad/src/carriage/exports/MANTIS-TERRARIUM-CARRIAGE-BINDER-DRAFT.step` after FreeCADCmd. Do not duplicate it under integration-owned `cad/assembly`.
