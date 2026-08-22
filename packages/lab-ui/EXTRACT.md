# Extract

`@gbg/lab-ui` owns type, color, space, radius, and chrome. Vanta is the paint. Change tokens in `src/lib/`. Product UI reads `VANTA_*` or the `chrome` facade, never a second hex dump.

The first cut was mined from six Variant boards: Workbench, Terminal, Catalog, Assay, Dactyl, and Accession. Matching those files harder is done. Do not add more HTML-cited tokens.

Workbench set the chrome this package ships. Space and blank sockets stay from that extract. Color and type now resolve to TMNL Vantablack. Tables come from `Grid`, which wraps `@tmnl/datagrid` and paints with VANTA.

The box is drawn. The value is blank.

97 and procurement import this package later. This cut does not wire them.
