# Testing Guide for tmnl Nix Modules

## Overview

Testing Nix flakes ensures that:
1. All devShells build successfully
2. Required tools are present in each environment
3. Environment variables are set correctly
4. Mission-control scripts are accessible

## Test Types

### Unit Tests
**Purpose**: Verify individual module properties and configurations
- Test that a specific shell has expected tools
- Validate environment variables
- Check that individual scripts exist

### Integration Tests
**Purpose**: Verify that shells work together and can actually run commands
- Test that layered shells inherit correctly
- Verify tools can execute successfully
- Ensure mission-control commands are available

## Writing Tests

### Location
Add tests to `perSystem.checks` in a dedicated test module or within existing modules.

### Pattern 1: Unit Tests with `lib.debug.runTests`

`lib.debug.runTests` is the standard nixpkgs function for pure unit tests. It takes an attribute set where each attribute starting with `test` contains `expr` and `expected` fields.

**Key features:**
- Pure Nix evaluation (no derivations needed for basic checks)
- Returns empty list if all tests pass, or list of failures with details
- Fast feedback for structural and value equality tests

```nix
let
  unitTestResults = lib.debug.runTests {
    testShellExists = {
      expr = builtins.typeOf config.devShells.tmnl-core;
      expected = "set";
    };

    testWrapperName = {
      expr = config.mission-control.wrapperName;
      expected = "tmnl";
    };

    testShellHasGit = {
      expr = hasPackage "git" config.devShells.tmnl-core.nativeBuildInputs;
      expected = true;
    };
  };

  # Convert to check derivation
  unitTestCheck = pkgs.runCommand "unit-tests" {} ''
    ${if unitTestResults == []
      then "echo 'All tests passed'"
      else ''
        echo "Test failures:"
        ${lib.concatMapStringsSep "\n" (r: ''
          echo "  FAIL: ${r.name}"
          echo "    Expected: ${builtins.toJSON r.expected}"
          echo "    Got:      ${builtins.toJSON r.result}"
        '') unitTestResults}
        exit 1
      ''}
    touch $out
  '';
in
{
  checks.unit-tests = unitTestCheck;
}
```

### Pattern 2: Shell Build Tests
Verify each shell builds without errors:

```nix
checks = {
  tmnl-core-builds = config.devShells.tmnl-core.inputDerivation;
  tmnl-rust-builds = config.devShells.tmnl-rust.inputDerivation;
  tmnl-python-builds = config.devShells.tmnl-python.inputDerivation;
  tmnl-embedded-builds = config.devShells.tmnl-embedded.inputDerivation;
  tmnl-ui-builds = config.devShells.tmnl-ui.inputDerivation;
  tmnl-full-builds = config.devShells.tmnl.inputDerivation;
};
```

### Pattern 3: Tool Execution Tests

Verify specific tools are executable in their shells. Uses:
- **String interpolation** from package metadata for binary names
- **Emoji logging** for visual clarity
- **Environment variable inheritance** from devShells
- **`&& { } || { }` pattern** for clear success/failure reporting

```nix
checks.rust-toolchain = pkgs.runCommand "rust-tools-check" {
  nativeBuildInputs = config.devShells.tmnl-rust.nativeBuildInputs;
  # Inherit environment variables from the devShell
  RUST_SRC_PATH = config.devShells.tmnl-rust.RUST_SRC_PATH;
  PKG_CONFIG_PATH = config.devShells.tmnl-rust.PKG_CONFIG_PATH;
} ''
  echo "🦀 Testing Rust toolchain..."

  # Use string interpolation from package metadata
  command -v ${pkgs.rustup.meta.mainProgram or "rustup"} && {
    echo "  ✓ ${pkgs.rustup.pname} available";
  } || {
    echo "  ✗ ${pkgs.rustup.pname} not found";
    exit 1;
  }

  command -v rustc && {
    echo "  ✓ rustc available (from rustup)";
  } || {
    echo "  ✗ rustc not found";
    exit 1;
  }

  # Verify environment variables
  [ -n "$RUST_SRC_PATH" ] && {
    echo "  ✓ RUST_SRC_PATH=$RUST_SRC_PATH";
  } || {
    echo "  ✗ RUST_SRC_PATH not set";
    exit 1;
  }

  echo "✅ Rust toolchain verified"
  touch $out
'';
```

**Key improvements:**
- `${pkgs.package.pname}` - Uses actual package name from derivation
- `${pkgs.package.meta.mainProgram or "fallback"}` - Uses declared binary name
- Emojis (🦀 🐍 🔧 🎨 ✓ ✗ ✅) - Visual test feedback
- Environment variables inherited from devShell configuration

### Pattern 4: Aggregated Integration Tests

**Best Practice**: Don't duplicate test logic! Instead, make the full integration test depend on individual toolchain tests. This ensures:
- Zero duplication (DRY principle)
- Individual tests provide detailed output
- Nix's dependency graph ensures proper execution order
- Parallel execution of independent tests

```nix
checks.full-integration = pkgs.runCommand "full-shell-integration" {
  # Depend on all individual toolchain tests - they must pass first
  rust = config.checks.rust-toolchain;
  python = config.checks.python-toolchain;
  embedded = config.checks.embedded-toolchain;
  ui = config.checks.ui-toolchain;
} ''
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
```

**Why this pattern?**
- Modify test logic once, affects both individual and full tests
- If `rust-toolchain` fails, you get detailed Rust-specific error output
- Full integration only runs if all component tests pass
- Clear separation between specific tests and aggregation

## Example: Complete Test Module

Create `nix/modules/tests.nix`:

```nix
{ inputs, lib, ... }:

{
  perSystem = { config, pkgs, system, ... }:
    let
      # Helper to check if a package is in a list
      hasPackage = pkgName: pkgList:
        builtins.any (pkg: pkg.pname or pkg.name or "" == pkgName) pkgList;

      # Unit tests using lib.debug.runTests
      unitTestResults = lib.debug.runTests {
        testCoreShellExists = {
          expr = builtins.typeOf config.devShells.tmnl-core;
          expected = "set";
        };

        testRustShellHasRustup = {
          expr = hasPackage "rustup" config.devShells.tmnl-rust.nativeBuildInputs;
          expected = true;
        };

        testPythonShellHasRuff = {
          expr = hasPackage "ruff" config.devShells.tmnl-python.nativeBuildInputs;
          expected = true;
        };

        testMissionControlWrapperName = {
          expr = config.mission-control.wrapperName or null;
          expected = "tmnl";
        };
      };

      # Convert test results to a check derivation
      unitTestCheck = pkgs.runCommand "tmnl-unit-tests" {} ''
        ${if unitTestResults == []
          then "echo 'All unit tests passed'"
          else ''
            echo "Unit test failures:"
            ${lib.concatMapStringsSep "\n" (result: ''
              echo "  FAIL: ${result.name}"
              echo "    Expected: ${builtins.toJSON result.expected}"
              echo "    Got:      ${builtins.toJSON result.result}"
            '') unitTestResults}
            exit 1
          ''}
        touch $out
      '';
    in
    {
      checks = {
        # Unit tests
        unit-tests = unitTestCheck;

        # Build tests
        core-shell-builds = config.devShells.tmnl-core.inputDerivation;
        rust-shell-builds = config.devShells.tmnl-rust.inputDerivation;
        python-shell-builds = config.devShells.tmnl-python.inputDerivation;
        embedded-shell-builds = config.devShells.tmnl-embedded.inputDerivation;
        ui-shell-builds = config.devShells.tmnl-ui.inputDerivation;
        full-shell-builds = config.devShells.tmnl.inputDerivation;

        # Tool execution tests with string interpolation and emoji logging
        rust-toolchain = pkgs.runCommand "rust-tools-check" {
          nativeBuildInputs = config.devShells.tmnl-rust.nativeBuildInputs;
          RUST_SRC_PATH = config.devShells.tmnl-rust.RUST_SRC_PATH;
          PKG_CONFIG_PATH = config.devShells.tmnl-rust.PKG_CONFIG_PATH;
        } ''
          echo "🦀 Testing Rust toolchain..."
          command -v ${pkgs.rustup.meta.mainProgram or "rustup"} && {
            echo "  ✓ ${pkgs.rustup.pname} available";
          } || {
            echo "  ✗ ${pkgs.rustup.pname} not found";
            exit 1;
          }
          command -v rustc && {
            echo "  ✓ rustc available";
          } || {
            echo "  ✗ rustc not found";
            exit 1;
          }
          [ -n "$RUST_SRC_PATH" ] && {
            echo "  ✓ RUST_SRC_PATH set";
          } || {
            echo "  ✗ RUST_SRC_PATH not set";
            exit 1;
          }
          echo "✅ Rust toolchain verified"
          touch $out
        '';

        python-toolchain = pkgs.runCommand "python-tools-check" {
          nativeBuildInputs = config.devShells.tmnl-python.nativeBuildInputs;
          LD_LIBRARY_PATH = config.devShells.tmnl-python.LD_LIBRARY_PATH or "";
        } ''
          echo "🐍 Testing Python toolchain..."
          command -v ${pkgs.ruff.meta.mainProgram or "ruff"} && {
            echo "  ✓ ${pkgs.ruff.pname} available";
          } || {
            echo "  ✗ ${pkgs.ruff.pname} not found";
            exit 1;
          }
          command -v ${pkgs.mypy.meta.mainProgram or "mypy"} && {
            echo "  ✓ ${pkgs.mypy.pname} available";
          } || {
            echo "  ✗ ${pkgs.mypy.pname} not found";
            exit 1;
          }
          echo "✅ Python toolchain verified"
          touch $out
        '';

        # Aggregated integration test - depends on all component tests
        full-integration = pkgs.runCommand "full-shell-integration" {
          rust = config.checks.rust-toolchain;
          python = config.checks.python-toolchain;
          embedded = config.checks.embedded-toolchain;
          ui = config.checks.ui-toolchain;
        } ''
          echo "🚀 Running full tmnl integration test suite..."
          echo ""
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
```

## Running Tests

### Run all checks
```sh
nix flake check
```

### Run specific check
```sh
nix build .#checks.x86_64-linux.rust-toolchain -L
```

The `-L` flag shows build logs in real-time, letting you see emoji output and progress.

### Run with verbose output
```sh
nix flake check --show-trace
```

### In CI
```sh
nix flake check --all-systems
```

## Best Practices

1. **Use `lib.debug.runTests` for unit tests**: Pure Nix evaluation is faster and provides better error messages
2. **String interpolation for binary names**: Use `${pkgs.package.pname}` and `${pkgs.package.meta.mainProgram}` instead of hardcoded strings
3. **Inherit environment variables**: Copy shell env vars (`RUST_SRC_PATH`, `LD_LIBRARY_PATH`) to test derivations
4. **Emoji logging**: Use emojis (🦀 🐍 🔧 🎨 ✓ ✗ ✅) for visual clarity in test output
5. **DRY principle**: Aggregate tests should depend on component tests, not duplicate logic
6. **Fast Feedback**: Unit tests (pure) < build tests < tool tests < integration tests
7. **Fail Fast**: Test critical dependencies first (shell builds before tool availability)
8. **Clear Failures**: Use `&& { echo success } || { echo failure; exit 1 }` pattern
9. **Layered Testing**: Test each layer independently before testing the combined shell
10. **CI Integration**: Run `nix flake check` in CI to catch regressions

## Why `lib.debug.runTests`?

**Advantages:**
- **Pure evaluation**: No derivations needed for basic checks, instant feedback
- **Better error reporting**: Shows expected vs actual values clearly
- **Composable**: Easy to add more tests, reuse helper functions
- **Standard**: Official nixpkgs testing pattern used throughout the ecosystem
- **Type-safe**: Catches structural issues at eval time, not build time

**When to use it:**
- Testing attribute existence and structure
- Validating configuration values
- Checking package presence in lists
- Testing pure Nix functions

**When NOT to use it:**
- Testing actual tool execution (use `runCommand` integration tests)
- Validating environment variables at runtime
- Testing build outputs

## Test Pyramid

```
       /\
      /  \      Integration Tests (few, expensive)
     /----\
    /      \    Tool Execution Tests (some, moderate)
   /--------\
  /          \  Shell Build Tests (many, cheap)
 /------------\
/______________\ Unit Tests with lib.debug.runTests (most, instant)
```

- **Most unit tests** (`lib.debug.runTests`): Instant, pure evaluation, catch logic errors
- **Many shell build tests**: Fast, catch syntax and dependency errors
- **Some tool execution tests**: Moderate, verify tools are in PATH and executable
- **Few integration tests**: Slower, validate end-to-end functionality across layers

## Adding to Your Flake

Import the test module in your root flake:

```nix
{
  imports = [
    ./nix/modules/core.nix
    ./nix/modules/rust.nix
    ./nix/modules/python.nix
    ./nix/modules/embedded.nix
    ./nix/modules/ui.nix
    ./nix/modules/default.nix
    ./nix/modules/tests.nix  # Add this
  ];
}
```

Then run `nix flake check` to execute all tests.
