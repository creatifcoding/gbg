# GitHub handoff

Target repository: `creatifcoding/gbg`

Target path: `projects/biomemetics/labs/mantis`

## Integration boundary

The current SpecimenDB implementation is isolated in draft PR
[`creatifcoding/gbg#12`](https://github.com/creatifcoding/gbg/pull/12). It owns
its existing package write-set and exposes intake/get/list only. This workspace
must not become a second implementer on that PR, must not merge it, and must not
bypass its repository/RPC layer with direct PGlite writes.

Land the mantis workspace on a separate branch. Its TypeScript adapter keeps
`@tmnl/specimendb` optional and reports
`specimendb-attach-unavailable` until a separately reviewed, governed
component-attachment operation exists after the draft settles.

The editable terrarium set is working draft B. The ZIP under
`terrarium/releases/rA/` is the immutable pre-workspace Release A capture and
must not be confused with the current files.

## Before publication

1. Overlay this directory at the exact target path in a fresh `gbg` checkout.
2. Reconcile the nested `flake.nix` with root Nix/Nx conventions; generate and
   commit `flake.lock` if the nested flake remains.
3. Install the pinned TypeScript development dependencies and commit the
   resulting package-manager lock; generate and commit
   `tooling/rust/mantis-lab-verifier/Cargo.lock`.
4. Run the CAD/drawing generators in the pinned environment, then refresh the
   working `terrarium/MANIFEST.sha256`; never rewrite the manifest inside the
   immutable Release A ZIP.
5. Run `nix develop --command python3 scripts/validate-contracts.py`.
6. Run `nix develop --command bash scripts/verify-core.sh`.
7. Run `nix develop .#fabrication --command bash scripts/verify-fabrication.sh`.
8. Review the proposed issue/write-set graph in
   `.agents/control/workstreams.json`; create real GitHub issues before agents
   claim them.

Staging, committing, pushing, and opening a pull request are distinct
publication actions. Keep them separate so the local artifact can be reviewed
before repository history or remote state changes.
