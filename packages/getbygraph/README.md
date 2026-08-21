# getbygraph

`@gbg/graph`. Graph is a projection of `Used` / `Generated` components. Components remain what systems write. There is no second source of truth and no edges table in specimendb.

SQL walk always works (`usedBy`, `generated`, `edges`). When Apache AGE is loaded (the #94 Timescale+AGE image), `projectToAge` MERGEs that projection into graph `lab_catalog`.

Keep `getbygraph()` for the stub test.
