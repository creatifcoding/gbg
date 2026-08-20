# CalculiX material card admission

Doctor runs CalculiX **only** when `MATERIAL-CARD.json` is present beside this
file and names a sourced card:

```json
{
  "inp": "steel-cube.inp",
  "source": {
    "url": "https://...",
    "digest": "sha256:..."
  },
  "notes": "what property set was taken from the citation"
}
```

Until that provenance exists, `sim.calculix` is SKIP. Do not invent elastic
constants or fabricate a citation. `cube.geo` remains the Gmsh mesh fixture only.

The previous unverified `cube.inp` elastic card is not admitted.
