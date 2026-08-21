# Characterization coupons (issue 26)

Theoretical / `PROTO-FAB DRAFT` / **UNQUALIFIED**.

`LAB COUPON — CONCEPT VALIDATION — NOT FOR ANIMAL USE`

These procedures are executable as written only after human approval, sourced
MPNs, a pinned stackup, and instruments. They do not claim measured SI or PI.
#23 remains on the lab base as UNVERIFIED envelopes. #24/#25 boards are absent
on this base (not recreated); net names are frozen from closed PR 40 @
`a9918b32`.

## Index

| File | Role |
| --- | --- |
| `coupon-map.json` | Machine-readable structure list and planes |
| `deembed-procedure.md` | 2x-thru / OSL / declared planes |
| `fault-injection.md` | Safe one-at-a-time faults |
| `rollback.md` | De-energize / rollback |

Native KiCad lives in `../kicad/fixture/`. PROTO-FAB packaging lives in
`../fab/prototype/`.
