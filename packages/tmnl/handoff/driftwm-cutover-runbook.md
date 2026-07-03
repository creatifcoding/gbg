# DriftWM/GetByShell cutover runbook

Status: prepared, not yet activated.

## Objective

Switch ASUS Zenbook Duo UX8406CA from the current live compositor state to the
Nix-built DriftWM/GetByShell setup, with GetByShell running as shell chrome under
DriftWM.

## Current constraints

- Do not restart/switch/relogin the compositor without explicit approval.
- DriftWM/GetByShell only; niri is not part of this goal.
- DriftWM runtime config is intentionally hotfixable plain TOML, not embedded
  Nix.

## Prepared generation

Latest validated generation at time of writing:

```txt
/nix/store/inh85k80mvwimb597sni4x4qzzr5wazh-nixos-system-getbyzenbook-26.05.20260107.5912c17
```

Known included DriftWM closure:

```txt
/nix/store/m2g99krmqc5dlvfg4wfg3ynigqz5jw9a-driftwm-0.12.1
```

## Runtime config model

After activation, Home Manager links:

```txt
~/.config/driftwm/config.toml
→ /home/getbygenius/.config/nix/configs/driftwm/config.toml
```

Hotfix loop after activation:

```bash
$EDITOR ~/.config/nix/configs/driftwm/config.toml
driftwm-config check
driftwm-config reload
```

The output-layout helper is also hotfixable:

```txt
/home/getbygenius/.config/nix/configs/driftwm/zenbook-wlrandr-layout.sh
```

## Pre-activation checks

From `packages/tmnl`:

```bash
bun run smoke:getbyshell:driftwm:preactivation
```

The bundle is non-mutating. It first verifies the DriftWM/GetByShell Nix files
under `~/.config/nix` are tracked/indexed so the flake source snapshot can see
them. If `TMNL_DRIFTWM_GENERATION` is omitted, it then runs
`nix build /home/getbygenius/.config/nix#nixosConfigurations.getbyzenbook.config.system.build.toplevel --no-link --print-out-paths`
to derive the current inactive generation without switching. It then runs
generation/offline/GTK smokes, TypeScript checking, isolated Cargo checks,
shell syntax checks, JSON checks, focused `git diff --check`, and the
niri-specific no-churn guard. To validate a specific already-built generation,
override:

```bash
TMNL_DRIFTWM_GENERATION=/nix/store/...-nixos-system-getbyzenbook-... \
  bun run smoke:getbyshell:driftwm:preactivation
```

From `~/.config/nix`:

```bash
nix build .#nixosConfigurations.getbyzenbook.config.system.build.toplevel --no-link --print-out-paths
```

## Activation command

Requires explicit approval because it mutates the live system generation:

```bash
sudo nixos-rebuild switch --flake /home/getbygenius/.config/nix#getbyzenbook
```

## Relogin / DriftWM restart

The generation switch alone does not replace a running compositor process.
After activation, relogin through greetd. The generated tuigreet command uses
`--cmd driftwm-session` and intentionally does **not** use
`--remember-user-session`, so a remembered older compositor selection cannot
silently win the cutover. Restart DriftWM directly only with explicit approval.

## Live verification

After logging into the activated DriftWM session, from `packages/tmnl`:

```bash
TMNL_DRIFTWM_GENERATION=/run/current-system \
  bun run smoke:getbyshell:driftwm:generation

TMNL_DRIFTWM_EXPECTED_BIN=/nix/store/m2g99krmqc5dlvfg4wfg3ynigqz5jw9a-driftwm-0.12.1/bin/driftwm \
  TMNL_DRIFTWM_REQUIRE_SERVICE_ENV=1 \
  bun run smoke:getbyshell:driftwm

# The live smoke also checks that GetByShell signal toggles would target exactly
# one process each before trusting Mod+Space/Ctrl+Semicolon/Mod+P:
# - pgrep -af -- 'tmnl-shell$'
# - pgrep -af -- 'tmnl-panel$'

bun run smoke:getbyshell:gtk-skin
```

## HITL visual checks

- No inactive-output mirror cursor.
- Zoom is bounded; no abyss zoom-out.
- Focused windows show the cyan `#7ec8b0` border.
- GetByShell bar remains physically `48px`, with `.75` density and readable text.
- `tmnl-shell` is layer-shell chrome, not a normal permanent slab/window.
- GTK3/GTK4 apps pick up JetBrainsMono 12, cursor size 36, dark skin, and cyan focus styling.

## Rollback / hotfix safety

For DriftWM runtime config mistakes after activation:

```bash
$EDITOR ~/.config/nix/configs/driftwm/config.toml
driftwm-config check
driftwm-config reload
```

For package/session-level mistakes, roll back with the normal NixOS generation
rollback flow from bootloader or `nixos-rebuild switch --rollback`.
