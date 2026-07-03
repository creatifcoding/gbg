{
  inputs,
  lib,
  pkgs,
  ...
}:

{
  config.perSystem =
    { pkgs, lib, ... }:
    {
      config.devshells.limitlessrp = {
        name = "limitlessrp";
        motd = ''
          LimitlessRP polyglot shell
          - TypeScript: bun run typecheck/build/smoke
          - Python: PYTHONPATH=python python -m limitlessrp.smoke
          - Rust: cargo test --manifest-path rust/limitlessrp-core/Cargo.toml
        '';

        env = [
          {
            name = "LIMITLESSRP_ROOT";
            value = "packages/limitlessrp";
          }
          {
            name = "PYTHONPATH";
            value = "packages/limitlessrp/python";
          }
        ];

        packages = with pkgs; [
          bun
          nodejs_24
          typescript
          python312
          uv
          rustc
          cargo
          rustfmt
          clippy
          pkg-config
          jq
        ];
      };
    };
}
