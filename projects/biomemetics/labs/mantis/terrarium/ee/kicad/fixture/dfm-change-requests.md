# DFM change requests returned to #25

Issue 26 does not silently edit or recreate camera-tx, carriage, or rail-rx.
Those boards are absent on `feat/mantis-biomemetics-lab` and stay absent.

| Finding | Disposition | Note |
| --- | --- | --- |
| none | No DFM finding on absent #25 boards was applied. | Coupon uses courtyard-only SerDes and TARGET 2.54 mm B27/B50 envelopes from #23. |

If CAM/DFM later finds a geometry conflict with a future #25 board leaf, open
it on #25. Do not patch those projects from this write set.
