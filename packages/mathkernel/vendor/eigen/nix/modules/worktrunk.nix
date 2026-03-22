{ inputs, lib, ... }:

{
  perSystem =
    {
      config,
      pkgs,
      system,
      ...
    }:
    let
      worktrunk = pkgs.rustPlatform.buildRustPackage rec {
        pname = "worktrunk";
        version = "0.9.5";

        src = pkgs.fetchCrate {
          inherit pname version;
          hash = "sha256-hD3PyUOlAfs/py77sLU6B/wN/ZFtYxzvJar/inRnWNs=";
        };

        cargoHash = "sha256-Z020zYSaAYAbP4rc0ZZ80Ys6FIlgibSNyAIVeBWR86U=";

        # Skip tests - has a flaky SOURCE_DATE_EPOCH-sensitive test
        doCheck = false;

        meta = with lib; {
          description = "A CLI for Git worktree management, designed for parallel AI agent workflows";
          homepage = "https://crates.io/crates/worktrunk";
          license = licenses.mit;
          maintainers = [ ];
        };
      };
    in
    {
      # Export the package
      packages.worktrunk = worktrunk;
    };
}
