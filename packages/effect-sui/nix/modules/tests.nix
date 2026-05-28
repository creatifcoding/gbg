{ inputs, lib, ... }:

{
  perSystem =
    {
      config,
      pkgs,
      system,
      lib,
      ...
    }:
    let
      requiredScripts = [
        "info"
        "sui-localnet"
        "sui-move"
        "sui-e2e"
      ];
      scripts = config.mission-control.scripts;
      missingScripts = builtins.filter (name: !(builtins.hasAttr name scripts)) requiredScripts;
    in
    {
      checks = {
        effect-sui-core-shell-builds = config.devShells.effect-sui-core.inputDerivation;
        effect-sui-sui-shell-builds = config.devShells.effect-sui-sui.inputDerivation;
        effect-sui-shell-builds = config.devShells.effect-sui.inputDerivation;

        effect-sui-mission-control-contract =
          assert missingScripts == [ ];
          pkgs.runCommand "effect-sui-mission-control-contract" { } ''
            test "${config.mission-control.wrapperName}" = "effect-sui"
            cat > $out <<'EOF'
            wrapper=effect-sui
            scripts=${builtins.concatStringsSep "," requiredScripts}
            EOF
          '';
      };
    };
}
