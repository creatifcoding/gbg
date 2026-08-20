# Frame OCCT source

Working draft B. Maturity DRAFT. Not shop-release.

FreeCAD `Part`/OCCT owns released BRep for the 250/500 perimeter, corner/edge/mid-span blocks, and cassette seats. OpenSCAD remains study.

X-right, Y-back, Z-up. Origin is the exterior front-left-bottom of the 250 x 250 x 500 mm envelope.

## Export

From the lab root, after FreeCADCmd is on PATH:

```text
export FREECADCMD=$(command -v FreeCADCmd || command -v freecadcmd)
python3 terrarium/simulations/mechanical/frame/check.py
```

`check.py` writes cut profiles and the geometry report. If FreeCADCmd is present it also writes STEP/binary STL and re-imports the assembly STEP. OpenSCAD is not STEP authority.

## Unique printed parts

B01 corner block, B02 250 mm edge (including mid-span placement), B03 splice, B04 cassette retainer, B10 non-metal ceiling frame.
