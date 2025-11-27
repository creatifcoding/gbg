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
      # Helper to check if a package is in a list
      hasPackage = pkgName: pkgList: builtins.any (pkg: pkg.pname or pkg.name or "" == pkgName) pkgList;

      # Helper to extract package names from a devShell
      getShellPackages = shell: shell.nativeBuildInputs or [ ];

      # Unit tests using lib.debug.runTests
      unitTestResults = lib.debug.runTests {
        # Test that each shell has expected structure
        testCoreShellExists = {
          expr = builtins.typeOf config.devShells.tmnl-core;
          expected = "set";
        };

        testRustShellExists = {
          expr = builtins.typeOf config.devShells.tmnl-rust;
          expected = "set";
        };

        testPythonShellExists = {
          expr = builtins.typeOf config.devShells.tmnl-python;
          expected = "set";
        };

        testEmbeddedShellExists = {
          expr = builtins.typeOf config.devShells.tmnl-embedded;
          expected = "set";
        };

        testUiShellExists = {
          expr = builtins.typeOf config.devShells.tmnl-ui;
          expected = "set";
        };

        testFullShellExists = {
          expr = builtins.typeOf config.devShells.tmnl;
          expected = "set";
        };

        testDefaultShellIsSet = {
          expr = builtins.typeOf config.devShells.default;
          expected = "set";
        };

        # Test that rust shell has rustup
        testRustShellHasRustup = {
          expr = hasPackage "rustup" (getShellPackages config.devShells.tmnl-rust);
          expected = true;
        };

        # Test that python shell has ruff
        testPythonShellHasRuff = {
          expr = hasPackage "ruff" (getShellPackages config.devShells.tmnl-python);
          expected = true;
        };

        # Test that python shell has mypy
        testPythonShellHasMypy = {
          expr = hasPackage "mypy" (getShellPackages config.devShells.tmnl-python);
          expected = true;
        };

        # Test that UI shell has nodejs
        testUiShellHasNodejs = {
          expr = hasPackage "nodejs" (getShellPackages config.devShells.tmnl-ui);
          expected = true;
        };

        # Test that UI shell has pnpm
        testUiShellHasPnpm = {
          expr = hasPackage "pnpm" (getShellPackages config.devShells.tmnl-ui);
          expected = true;
        };

        # Test that core shell has git
        testCoreShellHasGit = {
          expr = hasPackage "git" (getShellPackages config.devShells.tmnl-core);
          expected = true;
        };

        # Test that mission-control wrapper is named tmnl
        testMissionControlWrapperName = {
          expr = config.mission-control.wrapperName or null;
          expected = "tmnl";
        };

        # Test that mission-control has scripts defined
        testMissionControlHasScripts = {
          expr = builtins.length (builtins.attrNames config.mission-control.scripts) > 0;
          expected = true;
        };
      };

      # Convert test results to a derivation for nix flake check
      unitTestCheck = pkgs.runCommand "tmnl-unit-tests" { } ''
        ${
          if unitTestResults == [ ] then
            "echo 'All unit tests passed'"
          else
            ''
              echo "Unit test failures:"
              ${lib.concatMapStringsSep "\n" (result: ''
                echo "  FAIL: ${result.name}"
                echo "    Expected: ${builtins.toJSON result.expected}"
                echo "    Got:      ${builtins.toJSON result.result}"
              '') unitTestResults}
              exit 1
            ''
        }
        touch $out
      '';

    in
    {
      checks = {
        # Unit tests check
        unit-tests = unitTestCheck;

        # Build tests - ensure shells can be instantiated
        core-shell-builds = config.devShells.tmnl-core.inputDerivation;
        rust-shell-builds = config.devShells.tmnl-rust.inputDerivation;
        python-shell-builds = config.devShells.tmnl-python.inputDerivation;
        embedded-shell-builds = config.devShells.tmnl-embedded.inputDerivation;
        ui-shell-builds = config.devShells.tmnl-ui.inputDerivation;
        full-shell-builds = config.devShells.tmnl.inputDerivation;

        # Integration tests - verify tools are actually executable
        rust-toolchain =
          pkgs.runCommand "rust-tools-check"
            {
              nativeBuildInputs = config.devShells.tmnl-rust.nativeBuildInputs;
              RUST_SRC_PATH = config.devShells.tmnl-rust.RUST_SRC_PATH;
              PKG_CONFIG_PATH = config.devShells.tmnl-rust.PKG_CONFIG_PATH;
            }
            ''
              echo "🦀 Testing Rust toolchain..."
              command -v ${
                pkgs.rustup.meta.mainProgram or "rustup"
              } && { echo "  ✓ ${pkgs.rustup.name} available"; } || { echo "  ✗ ${pkgs.rustup.name} not found"; exit 1; }
              command -v rustc && { echo "  ✓ rustc available (from rustup)"; } || { echo "  ✗ rustc not found"; exit 1; }
              command -v cargo && { echo "  ✓ cargo available (from rustup)"; } || { echo "  ✗ cargo not found"; exit 1; }
              [ -n "$RUST_SRC_PATH" ] && { echo "  ✓ RUST_SRC_PATH=$RUST_SRC_PATH"; } || { echo "  ✗ RUST_SRC_PATH not set"; exit 1; }
              [ -n "$PKG_CONFIG_PATH" ] && { echo "  ✓ PKG_CONFIG_PATH=$PKG_CONFIG_PATH"; } || { echo "  ✗ PKG_CONFIG_PATH not set"; exit 1; }
              echo "✅ Rust toolchain verified"
              touch $out
            '';

        python-toolchain =
          pkgs.runCommand "python-tools-check"
            {
              nativeBuildInputs = config.devShells.tmnl-python.nativeBuildInputs;
              LD_LIBRARY_PATH = config.devShells.tmnl-python.LD_LIBRARY_PATH or "";
            }
            ''
              echo "🐍 Testing Python toolchain..."
              command -v ${
                pkgs.ruff.meta.mainProgram or "ruff"
              } && { echo "  ✓ ${pkgs.ruff.name} available"; } || { echo "  ✗ ${pkgs.ruff.name} not found"; exit 1; }
              command -v ${
                pkgs.mypy.meta.mainProgram or "mypy"
              } && { echo "  ✓ ${pkgs.mypy.name} available"; } || { echo "  ✗ ${pkgs.mypy.name} not found"; exit 1; }
              command -v ${
                pkgs.uv.meta.mainProgram or "uv"
              } && { echo "  ✓ ${pkgs.uv.name} available"; } || { echo "  ✗ ${pkgs.uv.name} not found"; exit 1; }
              command -v ${
                pkgs.jupyter.meta.mainProgram or "jupyter"
              } && { echo "  ✓ ${pkgs.jupyter.name} available"; } || { echo "  ✗ ${pkgs.jupyter.name} not found"; exit 1; }
              [ -n "$LD_LIBRARY_PATH" ] && { echo "  ✓ LD_LIBRARY_PATH set"; } || { echo "  ⚠ LD_LIBRARY_PATH not set (optional)"; }
              echo "✅ Python toolchain verified"
              touch $out
            '';

        embedded-toolchain =
          pkgs.runCommand "embedded-tools-check"
            {
              nativeBuildInputs = config.devShells.tmnl-embedded.nativeBuildInputs;
            }
            ''
              echo "🔧 Testing Embedded toolchain..."
              command -v ${
                pkgs.openocd.meta.mainProgram or "openocd"
              } && { echo "  ✓ ${pkgs.openocd.name} available"; } || { echo "  ✗ ${pkgs.openocd.name} not found"; exit 1; }
              command -v qemu-system-arm && { echo "  ✓ ${pkgs.qemu.name} (qemu-system-arm) available"; } || { echo "  ✗ qemu-system-arm not found"; exit 1; }
              command -v probe-rs && { echo "  ✓ ${
                pkgs.probe-rs-tools.name or "probe-rs"
              } available"; } || { echo "  ⚠ probe-rs not found (optional)"; }
              echo "✅ Embedded toolchain verified"
              touch $out
            '';

        ui-toolchain =
          pkgs.runCommand "ui-tools-check"
            {
              nativeBuildInputs = config.devShells.tmnl-ui.nativeBuildInputs;
            }
            ''
              echo "🎨 Testing UI toolchain..."
              command -v ${
                pkgs.nodejs_22.meta.mainProgram or "node"
              } && { echo "  ✓ ${pkgs.nodejs_22.name} $(node --version)"; } || { echo "  ✗ ${pkgs.nodejs_22.name} not found"; exit 1; }
              command -v ${
                pkgs.pnpm.meta.mainProgram or "pnpm"
              } && { echo "  ✓ ${pkgs.pnpm.name} $(pnpm --version)"; } || { echo "  ✗ ${pkgs.pnpm.name} not found"; exit 1; }
              echo "✅ UI toolchain verified"
              touch $out
            '';

        # Integration test - aggregates all toolchain tests
        full-integration =
          pkgs.runCommand "full-shell-integration"
            {
              # Depend on all individual toolchain tests
              rust = config.checks.rust-toolchain;
              python = config.checks.python-toolchain;
              embedded = config.checks.embedded-toolchain;
              ui = config.checks.ui-toolchain;
            }
            ''
              echo "🚀 Running full tmnl integration test suite..."
              echo ""

              # Each dependency must have passed for this to run
              echo "  ✓ Rust toolchain verified    → $rust"
              echo "  ✓ Python toolchain verified  → $python"
              echo "  ✓ Embedded toolchain verified → $embedded"
              echo "  ✓ UI toolchain verified      → $ui"
              echo ""

              echo "✅ Full integration test passed - all toolchains operational!"
              touch $out
            '';
      };
    };
}
