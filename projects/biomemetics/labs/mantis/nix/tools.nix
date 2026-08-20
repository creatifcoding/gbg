{
  pkgs,
  lib,
}:

let
  inherit (pkgs.stdenv) isLinux isDarwin;

  pyHas = name: builtins.hasAttr name pkgs.python3Packages;
  pyPkg = name: if pyHas name then pkgs.python3Packages.${name} else null;
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
    ++ lib.optional (builtins.hasAttr "scikit-rf" ps) ps.scikit-rf
    ++ lib.optional (builtins.hasAttr "scikit_rf" ps) ps.scikit_rf
  );

  pythonCad = pkgs.python3.withPackages (
    ps:
    [
      ps.jsonschema
      ps.numpy
    ]
    ++ lib.optional (builtins.hasAttr "cadquery" ps) ps.cadquery
    ++ lib.optional (builtins.hasAttr "pythonocc-core" ps) ps.pythonocc-core
    ++ lib.optional (builtins.hasAttr "build123d" ps) ps.build123d
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

  linuxOnly = pkgs: names: present (map (n: if isLinux then pkgs.${n} or null else null) names);

  kicad = pkgs.kicad or null;
  ngspice = pkgs.ngspice or null;
  openscad = pkgs.openscad or null;
  freecad = pkgs.freecad or null;
  inkscape = pkgs.inkscape or null;
  gmsh = pkgs.gmsh or null;
  calculix = pkgs.calculix or null;
  poppler = pkgs.poppler-utils or pkgs.poppler or null;
  xvfb = if isLinux then pkgs.xvfb-run or null else null;
  chromium = pkgs.chromium or null;
  occt = pkgs.opencascade-occt or null;

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
    pyPkg
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
      "scikit-rf" = !(pyHas "scikit-rf" || pyHas "scikit_rf");
      cadquery = !(pyHas "cadquery");
      pythonocc-core = !(pyHas "pythonocc-core");
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
