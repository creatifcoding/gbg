# Binder OCCT source

Working draft B. Maturity DRAFT. Not a shop release. Evidence class: theoretical/UNVERIFIED.

B28 carries moments around B50. B50 is a keyed 12-net proxy; series and pinout are not selected. B29 holds UNVERIFIED camera/serializer keep-outs. Raw MIPI stays inside the binder.

## Binder coordinate

Release is mechanically blocked unless pinch ≥ `PINCH_SAFE`. Then `r` (mm):

| `r` TARGET | State | B50 |
| ---: | --- | --- |
| 0.0 | `PINCH_SAFE` | seated |
| 1.0 | `S2_OPEN` | seated |
| 2.0 | `BRANCH_SAFE` | seated; electrical discharge UNVERIFIED (#24) |
| 3.5 | `BINDER_FREE` | unmated |

Partial click cannot clear the key. `IF-S2-actuator` is an UNVERIFIED envelope. Do not invent a switch PN.
