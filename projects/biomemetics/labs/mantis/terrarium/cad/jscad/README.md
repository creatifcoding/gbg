# @tmnl/mantis-terrarium-jscad

TypeScript is the CAD authoring source. Leftover FreeCAD under `cad/src/**/export_freecad.py` is emit only.

The model is one axis-aligned 250 x 250 x 500 mm cuboid, origin at front-left-bottom. The 202 x 202 x 427 mm animal-clear box is a keep-out record, not a subtracted void: PARAMS does not lock that void's Z origin.

STL and STEP emit throw. Catalog can file the run as an entity later. Maturity is DRAFT.
