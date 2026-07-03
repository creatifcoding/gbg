{ inputs, lib, ... }:

{
  perSystem = { config, pkgs, system, lib, ... }:
    let
      quiskRuntimeLibs = with pkgs; [
        alsa-lib
        fftw
        libpulseaudio
        portaudio
        stdenv.cc.cc.lib
        zlib
      ];
    in
    {
      devShells.frknk-sdr = pkgs.mkShell {
        name = "frknk-sdr";

        inputsFrom = [
          config.devShells.frknk-python
        ];

        # Native SDR/DSP libraries are here for experiments and later bindings.
        # GNU Radio is intentionally not in cycle 1; keep the shell nimble.
        LD_LIBRARY_PATH = lib.makeLibraryPath quiskRuntimeLibs;

        nativeBuildInputs = with pkgs; [
          fftw
          liquid-dsp
          libsndfile
          libusb1
          quisk
          rtl-sdr
          soapysdr
        ];

        shellHook = ''
          export FRKNK_ROOT="$FLAKE_ROOT"
          export FRKNK_SDR_LAB="$FRKNK_ROOT/experiments/sdr-lab"
          export FRKNK_QUISK_CONF="$FRKNK_SDR_LAB/quisk/frknk_quisk_conf.py"
          echo "[frknk-sdr] SDR lab shell"
          echo "  → Quisk/Hermes/OpenHPSDR emulator work lives under $FRKNK_SDR_LAB"
          echo "  → Quisk config: $FRKNK_QUISK_CONF"
        '';
      };

      mission-control.scripts = {
        sdr-smoke = {
          description = "Run the SDR lab smoke pipeline.";
          category = "SDR";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT/experiments/sdr-lab"
            echo "[frknk sdr-smoke] uv run sdr-lab smoke"
            uv run sdr-lab smoke
          '';
        };

        hermes-emulator = {
          description = "Run the receive-only fake Hermes-Lite/OpenHPSDR emulator for Quisk.";
          category = "SDR";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT/experiments/sdr-lab"
            echo "[frknk hermes-emulator] uv run sdr-lab hermes-emulator $*"
            uv run sdr-lab hermes-emulator "$@"
          '';
        };
      };
    };
}
