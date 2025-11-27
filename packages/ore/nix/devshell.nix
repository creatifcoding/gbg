{
  nixpkgs,
  inputs,
  lib,
  pkgs,
  ...
}:

{
  imports = [ inputs.devshell.flakeModule ];
  config.perSystem =
    { pkgs, lib, ... }:
    let
      inherit (pkgs.stdenv) isLinux isDarwin;
    in
    {
      config.devshells.default = {

        env = [
          {
            name = "RUST_SRC_PATH";
            value = "${pkgs.rust.packages.stable.rustPlatform.rustLibSrc}";
          }
          {
            name = "PKG_CONFIG_PATH";
            value = lib.concatStringsSep ":" (
              [
                "${pkgs.openssl.dev}/lib/pkgconfig"
              ]
              ++ lib.optionals isLinux [
                "${pkgs.gtk3.dev}/lib/pkgconfig"
                "${pkgs.webkitgtk_4_1.dev}/lib/pkgconfig"
                "${pkgs.glib.dev}/lib/pkgconfig"
                "${pkgs.cairo.dev}/lib/pkgconfig"
                "${pkgs.pango.dev}/lib/pkgconfig"
                "${pkgs.harfbuzz.dev}/lib/pkgconfig"
                "${pkgs.gdk-pixbuf.dev}/lib/pkgconfig"
                "${pkgs.librsvg.dev}/lib/pkgconfig"
                "${pkgs.atk.dev}/lib/pkgconfig"
                "${pkgs.libsoup_3.dev}/lib/pkgconfig"
              ]
            );
          }
          {
            name = "LD_LIBRARY_PATH";
            value = lib.optionalString isLinux (
              lib.makeLibraryPath [
                pkgs.gtk3
                pkgs.webkitgtk_4_1
                pkgs.glib
                pkgs.cairo
                pkgs.pango
                pkgs.harfbuzz
                pkgs.librsvg
                pkgs.atk
                pkgs.libsoup_3
                pkgs.zlib
              ]
            );
          }
          {
            name = "LIBRARY_PATH";
            value = lib.optionalString isLinux (
              lib.makeLibraryPath [
                pkgs.gtk3
                pkgs.webkitgtk_4_1
                pkgs.glib
                pkgs.cairo
                pkgs.pango
                pkgs.harfbuzz
                pkgs.librsvg
                pkgs.atk
                pkgs.libsoup_3
                pkgs.zlib
              ]
            );
          }
        ];
        packages =
          with pkgs;
          lib.mkMerge [
            [
              rustup
              lldb_18
              pkg-config
              openssl
            ]
            (lib.mkIf isLinux [
              gtk3
              webkitgtk_4_1
              cargo-tauri
              glib
              cairo
              pango
              harfbuzz
              atk
              libsoup_3
              librsvg
              zlib
            ])
            (lib.mkIf isDarwin [ iconv ])
          ];

        # commands = [ ];
      };
    };
}
