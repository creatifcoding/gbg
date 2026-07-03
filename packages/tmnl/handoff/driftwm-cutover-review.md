# DriftWM/GetByShell cutover review

## 1. Verdict: READY_WITH_NOTES

Non-live cutover evidence is strong enough to proceed to the explicit activation gate. The full objective is not complete until the new generation is activated, the user relogs into DriftWM, and live smoke/HITL checks pass.

Latest validated generation:

```txt
/nix/store/inh85k80mvwimb597sni4x4qzzr5wazh-nixos-system-getbyzenbook-26.05.20260107.5912c17
```

Patched DriftWM closure:

```txt
/nix/store/m2g99krmqc5dlvfg4wfg3ynigqz5jw9a-driftwm-0.12.1
```

## 2. Blocking findings

None in non-live review.

Activation/relogin remains an explicit user-approval boundary, not a technical blocker.

## 3. High-risk findings

### Found and fixed: TMNL services lacked DriftWM CLI in their overridden PATH

`tmnl-bar` / `tmnl-panel` systemd user services set an explicit `PATH` from the GetByShell shared runtime environment. The DriftWM bridge uses `Command::new("driftwm")` for IPC actions such as workspace focus, so those actions could fail inside the service even though shell-level smokes passed.

Fix applied:

- `nix/lib/getbyshell/shared-env.nix`
- `/home/getbygenius/.config/nix/modules/home/getbyshell/lib/shared-env.nix`

Both now include `pkgs.driftwm` in `runtimePkgs` when that package exists. The generation smoke now asserts each TMNL service unit PATH contains the generated DriftWM closure's `bin` directory.

Verified in generated units: both `tmnl-bar.service` and `tmnl-panel.service` PATH contain the generated DriftWM closure's `bin` directory (`/nix/store/m2g99krmqc5dlvfg4wfg3ynigqz5jw9a-driftwm-0.12.1/bin` in the current validated generation).

## 4. Evidence reviewed

- Nix build succeeded:
  - `/nix/store/inh85k80mvwimb597sni4x4qzzr5wazh-nixos-system-getbyzenbook-26.05.20260107.5912c17`
- One-command preactivation bundle passed:
  - `bun run smoke:getbyshell:driftwm:preactivation`
  - Verifies DriftWM/GetByShell Nix files under `~/.config/nix` are tracked/indexed for the flake source snapshot, derives the inactive NixOS generation with non-mutating `nix build --no-link --print-out-paths` when `TMNL_DRIFTWM_GENERATION` is omitted, then runs generation/offline/GTK smokes, TypeScript check, isolated Cargo tests/checks, shell syntax checks, JSON checks, focused `git diff --check`, and the niri-specific no-churn guard.
- Generation smoke inside the bundle verifies `driftwm-session` re-enters a login shell, generated login PATH includes home/per-user/system profile bins, generated zshenv sources NixOS environment, `driftwm-config`, `driftwm-workspace`, `vicinae`, system-profile spawned commands (`wlr-randr`, `mako`, `kitty`, `emacsclient`, `firefox`, `pkill`, `swaylock`, `grim`, `slurp`, `wl-copy`), generated DriftWM CLI PATH in TMNL services, live-checkout Tauri/Vite `WorkingDirectory`, store-provided `cargo-tauri dev`/`bunx vite` launchers, stale target-binary rejection, and hotfixable config symlink.
- Offline DriftWM smoke passed:
  - `TMNL_DRIFTWM_OFFLINE=1 ... bun run smoke:getbyshell:driftwm`
  - Verifies cursor/zoom/focus contracts, spatial workspace focus/move keybinding helpers, and GetByShell signal bindings (`pkill -USR1 -f tmnl-shell$` / `tmnl-panel$`). Live mode now also checks those regexes resolve to exactly one process before trusting palette/panel toggles.
- GTK skin smoke passed against latest generated GTK artifacts. The smoke discovers Home Manager GTK settings/CSS from `TMNL_GTK_GENERATION` / `TMNL_DRIFTWM_GENERATION`, so pre-activation checks do not falsely fail on the current live home profile.
- DriftWM shared Rust tests/checks passed using an isolated Cargo target dir to avoid live `cargo-tauri dev` target locks:
  - `CARGO_TARGET_DIR=/tmp/tmnl-cutover-cargo-target cargo test -p tmnl-shared -- --nocapture`
  - `CARGO_TARGET_DIR=/tmp/tmnl-cutover-cargo-target cargo check -p tmnl-shell -p tmnl-panel`
  - Covers compositor override precedence, invalid override fail-safe behavior, explicit/Wayland DriftWM socket discovery, stale regular socket-file rejection, connectable-socket live-state auto-detect, stale socket + state-file rejection, XDG runtime state-file parsing, workspace mapping, and state parser shape.
- Syntax/metadata checks passed:
  - smoke shell scripts via `bash -n`
  - `package.json` / `project.json` via `python3 -m json.tool`
  - focused `git diff --check`
- TMNL niri-specific source diff guard passed:
  - `src-shared/src/niri.rs`
  - `src/lib/getbyshell/niri.ts`
  - `src/lib/getbyshell/types.ts`
- Installed DriftWM source/docs confirm `driftwm msg action reload-config` is valid.
- Installed upstream `driftwm-session` confirms user-systemd session flow with `graphical-session.target`, matching GetByShell service wiring.
- Generated `greetd.toml` uses `--cmd driftwm-session` and intentionally does not include `--remember-user-session`.
- GLM 5.2 bounded review found two real DriftWM selection risks: invalid `TMNL_COMPOSITOR` falling through to auto-detect, and stale Unix socket inode plus stale state file being treated as live. Both were fixed: invalid overrides now fail safe, and `has_live_state()` requires a successful Unix socket connection plus readable state. Follow-up hardening made `is_available()` / `run_msg()` require a live connectable DriftWM IPC socket before command actions are attempted.

## 5. Recommended pre-activation command sequence

From `packages/tmnl`:

```bash
bun run smoke:getbyshell:driftwm:preactivation
```

The bundle is non-mutating and wraps the individual generation/offline/GTK
smokes, TypeScript check, isolated Cargo checks, shell syntax checks, JSON
checks, focused `git diff --check`, and the niri-specific no-churn guard.
To validate a newer inactive generation, override:

```bash
TMNL_DRIFTWM_GENERATION=/nix/store/...-nixos-system-getbyzenbook-... \
  bun run smoke:getbyshell:driftwm:preactivation
```

Activation requires explicit approval:

```bash
sudo nixos-rebuild switch --flake /home/getbygenius/.config/nix#getbyzenbook
```

After activation, relogin through greetd. Then run live checks:

```bash
TMNL_DRIFTWM_GENERATION=/run/current-system \
  bun run smoke:getbyshell:driftwm:generation

TMNL_DRIFTWM_EXPECTED_BIN=/nix/store/m2g99krmqc5dlvfg4wfg3ynigqz5jw9a-driftwm-0.12.1/bin/driftwm \
  TMNL_DRIFTWM_REQUIRE_SERVICE_ENV=1 \
  bun run smoke:getbyshell:driftwm

bun run smoke:getbyshell:gtk-skin
```

HITL visual checks remain required: no inactive-output mirror cursor, bounded zoom, cyan focused border, readable 48px GetByShell bar at `.75` density, no permanent transparent/black slab, acceptable GTK3/GTK4 skin.
