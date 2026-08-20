# Proposed hot-file deltas (not applied)

Issue 26 must not rewrite `BOM.md`, `params.json`, `bus.json`,
`workstreams.json`, `kicad/system`, CAD assembly, the #23 library, #24
power-control, or #25 camera-tx / carriage / rail-rx.

## `terrarium/BOM.md`

No MPN fills for B19/B27/B36/B44/B45/B46/B48/B50 from this leaf. Keep
UNVERIFIED. Root may later add a balloon for the lab-coupon panel; this leaf
does not edit the register.

## `kicad/system`

Not this write set. Later system sheet 12 (test and fault injection) should
point at `fixture/net-map.json`. Black-box pins should match the consumed #24
and #25 net maps.

## `ee/kicad/jobsets` and `ee/kicad/outputs`

KICAD-PLAN.md sketches those paths. This leaf places planning jobsets and
blocked outputs under `ee/fab/prototype/` because that is the #26 write set.

## DFM returns to #25

No silent edit of camera-tx, carriage, or rail-rx. See
`dfm-change-requests.md`.
