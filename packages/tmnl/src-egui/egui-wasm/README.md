# TMNL egui wasm

Build the WASM package into TMNL's Vite `public/egui` folder:

```bash
bun run egui:wasm:build
```

Requires `wasm-pack` on PATH.

This produces:

- `public/egui/tmnl_egui_wasm.js`
- `public/egui/tmnl_egui_wasm_bg.wasm`

The React `EguiCanvas` loader expects those files at `/egui/*`.
