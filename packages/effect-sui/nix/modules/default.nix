{ inputs, lib, ... }:

{
  perSystem =
    {
      config,
      pkgs,
      system,
      ...
    }:
    {
      devShells = {
        effect-sui = pkgs.mkShell {
          name = "effect-sui";

          inputsFrom = [
            config.devShells.effect-sui-core
            config.devShells.effect-sui-sui
          ];

          shellHook = ''
            echo "[effect-sui] Full Effect-Sui development environment"
            echo "  → Effect-smol + TypeScript + Sui localnet + Move/gRPC tooling"
            echo ""
            effect-sui info || true
          '';
        };

        default = config.devShells.effect-sui;
      };
    };
}
