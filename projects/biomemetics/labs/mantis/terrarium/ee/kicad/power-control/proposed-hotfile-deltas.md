# Proposed hot-file deltas (not applied)

Issue 24 must not rewrite `BOM.md`, `params.json`, `bus.json`,
`workstreams.json`, `kicad/system`, CAD assembly, the #23 library, or PR 12.

## `terrarium/bus.json`

After independent review of this screening, root may attach evidence refs on
`sr-power-sequence` and `sr-single-fault`. Do not mark them verified from
ngspice.

## `terrarium/BOM.md`

B44/B48 stay UNVERIFIED. No F1/S1/S2/Q1 MPN fill from this leaf.

## `terrarium/params.json`

Rail VIN 12 V and F1 2 A remain TARGET.

## `kicad/system`

Not this write set. System black-box pins should later match `net-map.json`.
