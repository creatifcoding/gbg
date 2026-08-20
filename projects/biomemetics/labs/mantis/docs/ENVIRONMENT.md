# Mantis lab engineering environment

The lab owns this nested flake and its committed lock. It does not import,
follow, or mutate the gbg root `flake.nix`, `flake.lock`, or `nix/**`.

Default shell: `mantis-core`. `mantis-all` is local integration only.

## Enter a shell

From `projects/biomemetics/labs/mantis`:

```bash
nix develop .#mantis-core
nix develop .#mantis-ee
nix develop .#mantis-cad
nix develop .#mantis-sim
nix develop .#mantis-review
nix develop .#mantis-assistant
nix develop .#mantis-assistant-eval
nix develop .#mantis-edge
nix develop .#mantis-analysis
nix develop .#mantis-fabrication
```

direnv uses `.envrc` → `use flake .#mantis-core`.

## Command surface

```text
mantis doctor
mantis check <workstream-id>
mantis export <domain>
mantis evidence <run>
```

Workstream ids: `environment-core`, `environment-ee`, `environment-cad`,
`environment-sim`, `environment-review`, `environment-assistant`,
`environment-assistant-eval`, `environment-edge`, `environment-analysis`,
`environment-fabrication`.

These commands do not rewrite `flake.lock` or the git tree. Caches, cargo
targets, solver temp, browser profiles, and results live under
`/tmp/mantis-lab/<worktree-id>/<run-id>/`.

## What doctor proves

Doctor runs workflows, not `--version` probes:

- Shared JSON Schema fixtures across Python, Rust, and TypeScript.
- Lab contracts through the existing Draft 2020-12 Python gate.
- OpenSCAD `--hardwarnings` on the environment cube when `openscad` is present.
- FreeCAD/OCCT 10 mm cube STEP export/re-import when `FreeCADCmd` is present.
- ngspice DC divider with a 1.0 V assertion when `ngspice` is present.
- Gmsh mesh and CalculiX static step when those solvers are present.
- Touchstone load via scikit-rf when that package is in the shell.
- PDF/SVG/STEP inspection and independent manifest verification.
- Analysis CSV reduction with no device-write tools in `mantis-analysis`.

Missing downstream domain fixtures return a typed blocker and do not count as
success:

| Check | Type | Owner |
| --- | --- | ---: |
| Native KiCad ERC/DRC | `BLOCKED_MISSING_FIXTURE` | #23 |
| Mastra/CopilotKit compat lock | `BLOCKED_MISSING_FIXTURE` | #50 |
| Assistant eval/golden | `BLOCKED_MISSING_FIXTURE` | #50 |
| Rust edge simulator | `BLOCKED_MISSING_FIXTURE` | #54 |
| openEMS | `UNSUPPORTED_TOOL` | #21 |

`ok` is false only when a tool is present and a real workflow fails, or when
the independent report verifier disagrees with the written report.

## Independent verification

`scripts/environment/py/mantis_environment/verify_report.py` and
`verify_manifest.py` never generate or repair the documents they check.
`mantis evidence <report>` is that path. Doctor launches the report verifier
in a separate process after writing the report.

## Pins

- nixpkgs follows the released `nixos-26.05` branch, not `nixos-unstable`.
- Unfree packages are disabled.
- openEMS is not in any shell until a headless smoke test qualifies it.
- Assistant product packages are `NOT_IMPLEMENTED` stubs (exit 78) owned by #50.

## CI

`.github/workflows/mantis-lab.yml` invokes the nested flake by path with
`--no-write-lock-file`. Nix cache keys are the lab `flake.lock` digest. Cache
restore is never treated as a passing check. This runner is `x86_64-linux`;
Darwin and `aarch64-linux` are flake outputs and must be named
`UNSUPPORTED_PLATFORM` by doctor when their tools are absent, not skipped
silently.

## Rollback

Revert the nested flake/lock, `nix/`, `scripts/environment/`,
`docs/ENVIRONMENT.md`, environment fixtures, `.envrc`, and
`.github/workflows/mantis-lab.yml`. No root Nix files are involved.
