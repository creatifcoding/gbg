# Release A capture

`mantis-terrarium-schematics-rA.zip` is the immutable, pre-workspace Release A
capture. It retains its original drawing generator, SVG sheets, combined PDF,
and embedded `MANIFEST.sha256`; do not regenerate or edit the archive in place.

- Archive SHA-256: `b816def02aee14aeebe25b5bb32064d0b7a4bc1e1530fbcaaab2ed6dd1882891`
- Current editable sources: [`../../`](../../)
- Current vector sheet build: [`../../cad/build_pdf.py`](../../cad/build_pdf.py)

To verify the captured files, extract the ZIP and run
`sha256sum -c MANIFEST.sha256` from its `mantis-terrarium/` directory. The
working tree has advanced since this capture, so its current hashes are
expected to differ from the archive's embedded manifest.
