# CAM re-import / polarity / net-count (issue 26)

Status: **not performed**.

`kicad-cli` is absent, so Gerber X2 and Excellon were not exported. There is
nothing to re-import. Net-count and polarity review wait on that export.

Declared net intent (from `fixture/net-map.json`): complete 12-net coupons
plus #24 power names. GMSL is not MIPI. C01/C02 on binder coupons after Q1
are V_BRANCH.

When a pinned KiCad exists:

1. Export Gerber X2 + Excellon from the jobset.
2. Re-import in CAM.
3. Count nets against `net-map.json`.
4. Confirm polarity of every `LAB COUPON` silk and F.Fab mark.
5. Record SHA of gerbers next to `outputs/planning/manifest.sha256`.

Until then this file is a blocker, not a waiver that CAM passed.
