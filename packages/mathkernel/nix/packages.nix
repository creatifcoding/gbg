{ inputs, ... }:

{
  perSystem =
    { pkgs, lib, ... }:
    {
      # The WASM artifact as a Nix package (for CI / downstream consumption)
      packages.mathkernel-wasm = pkgs.stdenv.mkDerivation {
        pname = "mathkernel-wasm";
        version = "0.1.0";

        src = lib.cleanSource ../.;

        nativeBuildInputs = with pkgs; [
          emscripten
          cmake
          ninja
        ];

        buildInputs = [ pkgs.eigen ];

        configurePhase = ''
          runHook preConfigure
          emcmake cmake -B build -S . \
            -G Ninja \
            -DCMAKE_BUILD_TYPE=Release \
            -DEIGEN_INCLUDE_DIR="${pkgs.eigen}/include/eigen3"
          runHook postConfigure
        '';

        buildPhase = ''
          runHook preBuild
          emmake cmake --build build --parallel
          runHook postBuild
        '';

        installPhase = ''
          runHook preInstall
          mkdir -p $out/wasm
          cp build/mathkernel.js build/mathkernel.wasm $out/wasm/
          [ -f build/mathkernel.d.ts ] && cp build/mathkernel.d.ts $out/wasm/
          runHook postInstall
        '';

        meta = with lib; {
          description = "C++/WASM numerical computing kernel — Eigen-backed linear algebra, regression, DSP";
          homepage = "https://github.com/gbg/gbg/tree/master/packages/mathkernel";
          license = licenses.mit;
          platforms = platforms.all;
        };
      };
    };
}
