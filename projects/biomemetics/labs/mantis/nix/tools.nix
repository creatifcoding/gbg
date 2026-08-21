{
  pkgs,
  lib,
}:

let
  inherit (pkgs.stdenv) isLinux isDarwin;

  tryPkg =
    name:
    let
      ev =
        if builtins.hasAttr name pkgs then builtins.tryEval pkgs.${name} else { success = false; value = null; };
    in
    if ev.success then ev.value else null;

  tryPy =
    name:
    let
      ev =
        if builtins.hasAttr name pkgs.python3Packages then
          builtins.tryEval pkgs.python3Packages.${name}
        else
          {
            success = false;
            value = null;
          };
    in
    if ev.success then ev.value else null;

  present = builtins.filter (p: p != null);

  pythonCore = pkgs.python3.withPackages (
    ps: with ps; [
      jsonschema
      pytest
      pyyaml
      numpy
      pypdf
    ]
  );

  pythonSim = pkgs.python3.withPackages (
    ps:
    [
      ps.jsonschema
      ps.numpy
      ps.scipy
      ps.pyyaml
    ]
    ++ lib.optional (tryPy "scikit-rf" != null) ps."scikit-rf"
    ++ lib.optional (tryPy "scikit_rf" != null) ps.scikit_rf
  );

  pythonCad = pkgs.python3.withPackages (
    ps:
    [
      ps.jsonschema
      ps.numpy
    ]
    ++ lib.optional (tryPy "cadquery" != null) ps.cadquery
    ++ lib.optional (tryPy "pythonocc-core" != null) ps."pythonocc-core"
    ++ lib.optional (tryPy "build123d" != null) ps.build123d
  );

  pythonAnalysis = pkgs.python3.withPackages (
    ps: with ps; [
      jsonschema
      numpy
      scipy
      pillow
      pyyaml
    ]
  );

  rustTools = with pkgs; [
    rustc
    cargo
    rustfmt
    clippy
  ];

  jsTools = with pkgs; [
    nodejs_22
    bun
    typescript
  ];

  coreCli = with pkgs; [
    jq
    ripgrep
    git
    coreutils
    findutils
    gnused
    gawk
    gnugrep
    diffutils
  ];

  linuxOnly = pkgs: names: present (map (n: if isLinux then tryPkg n else null) names);

  kicad = tryPkg "kicad";
  ngspice = tryPkg "ngspice";
  openscad = tryPkg "openscad";
  freecad = tryPkg "freecad";
  inkscape = tryPkg "inkscape";
  gmsh = tryPkg "gmsh";
  calculix = tryPkg "calculix-ccx";
  poppler = tryPkg "poppler-utils";
  xvfb = if isLinux then tryPkg "xvfb-run" else null;
  chromium = tryPkg "chromium";
  occt = tryPkg "opencascade-occt";

  missingNames =
    attrs:
    builtins.concatStringsSep "," (
      builtins.filter (n: attrs.${n} == null) (builtins.attrNames attrs)
    );
in
{
  inherit
    pythonCore
    pythonSim
    pythonCad
    pythonAnalysis
    rustTools
    jsTools
    coreCli
    kicad
    ngspice
    openscad
    freecad
    inkscape
    gmsh
    calculix
    poppler
    xvfb
    chromium
    occt
    isLinux
    isDarwin
    present
    ;

  corePackages = [ pythonCore ] ++ jsTools ++ rustTools ++ coreCli;

  eeExtra = present [
    kicad
    ngspice
    poppler
  ];

  cadExtra = present [
    freecad
    openscad
    inkscape
    occt
    pythonCad
  ];

  simExtra = present [
    pythonSim
    gmsh
    calculix
  ];

  reviewExtra = present [
    poppler
    inkscape
    freecad
    pythonCore
  ];

  assistantExtra = jsTools ++ [
    pythonCore
  ];

  assistantEvalExtra = present [ chromium ] ++ jsTools;

  edgeExtra = rustTools;

  analysisExtra = [
    pythonAnalysis
  ] ++ coreCli;

  fabricationExtra = present [
    openscad
    kicad
    inkscape
    xvfb
    pythonCore
  ];

  unsupported =
    {
      kicad = kicad == null;
      ngspice = ngspice == null;
      openscad = openscad == null;
      freecad = freecad == null;
      inkscape = inkscape == null;
      gmsh = gmsh == null;
      calculix = calculix == null;
      chromium = chromium == null;
      "scikit-rf" = tryPy "scikit-rf" == null && tryPy "scikit_rf" == null;
      cadquery = tryPy "cadquery" == null;
      pythonocc-core = tryPy "pythonocc-core" == null;
    }
    // {
      openems = true; # omitted until a headless smoke test qualifies it
    };

  # Comma-separated tool names omitted from this Nix evaluation.
  unsupportedCsv =
    let
      names = builtins.attrNames (
        lib.filterAttrs (_n: v: v) {
          kicad-cli = kicad == null;
          ngspice = ngspice == null;
          openscad = openscad == null;
          FreeCADCmd = freecad == null;
          inkscape = inkscape == null;
          gmsh = gmsh == null;
          ccx = calculix == null;
          chromium = chromium == null;
        }
      );
    in
    builtins.concatStringsSep "," names;
}
