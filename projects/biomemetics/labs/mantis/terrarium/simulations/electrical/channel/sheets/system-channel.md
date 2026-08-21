# System channel sheets (issue 25)

Theoretical / UNVERIFIED. Not `ee/kicad/system` (forbidden this write-set).
These sheets are the complete-path view owned by #25.

## Sheet S-CH0 — path

```text
IMX519_AF_MODULE_UNVERIFIED
  -- local MIPI CSI-2 (camera-tx only) -->
MAX96717_GMSL2_SER_UNVERIFIED
  -- GMSL launch UNVERIFIED -->
B50 C09 HSGND / C10 GMSL+ / C11 GMSL- / C12 HSGND
  -- carriage 100 ohm TARGET route UNVERIFIED -->
B27 P09 HSGND / P10 GMSL+ / P11 GMSL- / P12 HSGND
  -- rail-rx launch UNVERIFIED -->
MAX96724_GMSL2_DES_UNVERIFIED
  -- local MIPI CSI-2 (rail-rx only) -->
TACHYON_CSI1_22P
```

Raw MIPI does not appear on P01–P12 or C01–C12. Pogos do not carry CSI.
Carriage is untethered. Video-while-rolling is out of v1.

## Sheet S-CH1 — budget

100 ohm differential TARGET from bus.json. Insertion-loss / return-loss numbers
in `results/summary.json` are numpy placeholders. ADI GMSL channel limits were
not retrieved (analog.com timeout). Treat every dB figure as UNVERIFIED.

## Sheet S-CH2 — de-embed plan (EE-04)

See `deembed-plan.md`. 2x-thru, B27-only, B50-only, full channel. Not implemented
here. Fixture is a declared interface only.

## Sheet S-CH3 — blockers

| Missing | Effect |
| --- | --- |
| IMX519 orderable SKU | Module outline/connector orientation UNVERIFIED |
| MAX96717 / MAX96724 suffix + pad map | Launch geometry cannot be drawn as copper |
| B27/B50 contact series | Pogo S-params UNVERIFIED |
| Fabricator stackup | Trace width/gap for 100 ohm UNVERIFIED |
| #28/#29 STEP | Board outline TARGET only |
| analog.com PDF | No sourced IL mask |
