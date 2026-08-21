# Assembly drawing (planning)

No PDF is produced this run (`kicad-cli` absent). The panel is
`ee/kicad/fixture/fixture.kicad_pcb`.

Required notes on any future drawing:

1. `LAB COUPON — CONCEPT VALIDATION — NOT FOR ANIMAL USE` on F.SilkS, B.SilkS,
   and F.Fab.
2. `PROTO-FAB DRAFT — UNQUALIFIED — NOT A SHOP RELEASE`.
3. All parts DNP until sourced MPNs exist.
4. Fault jumpers `K_*` default DNP (safe branch-off).
5. SerDes are courtyard-only. Do not add invented pads at assembly.
6. Do not populate IMX519 or Tachyon CSI on this coupon.
7. Polarity of B50 key is UNVERIFIED; do not assume mate direction.
