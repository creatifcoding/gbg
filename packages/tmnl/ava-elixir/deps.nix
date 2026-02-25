{
  lib,
  beamPackages,
  cmake,
  extend,
  lexbor,
  fetchFromGitHub,
  overrides ? (x: y: { }),
  overrideFenixOverlay ? null,
  pkg-config,
  vips,
  writeText,
}:

let
  buildMix = lib.makeOverridable beamPackages.buildMix;
  buildRebar3 = lib.makeOverridable beamPackages.buildRebar3;

  workarounds = {
    portCompiler = _unusedArgs: old: {
      buildPlugins = [ beamPackages.pc ];
    };

    rustlerPrecompiled =
      {
        toolchain ? null,
        ...
      }:
      old:
      let
        extendedPkgs = extend fenixOverlay;
        fenixOverlay =
          if overrideFenixOverlay == null then
            import "${
              fetchTarball {
                url = "https://github.com/nix-community/fenix/archive/6399553b7a300c77e7f07342904eb696a5b6bf9d.tar.gz";
                sha256 = "sha256-C6tT7K1Lx6VsYw1BY5S3OavtapUvEnDQtmQB5DSgbCc=";
              }
            }/overlay.nix"
          else
            overrideFenixOverlay;
        nativeDir = "${old.src}/native/${with builtins; head (attrNames (readDir "${old.src}/native"))}";
        fenix =
          if toolchain == null then
            extendedPkgs.fenix.stable
          else
            extendedPkgs.fenix.fromToolchainName toolchain;
        native =
          (extendedPkgs.makeRustPlatform {
            inherit (fenix) cargo rustc;
          }).buildRustPackage
            {
              pname = "${old.packageName}-native";
              version = old.version;
              src = nativeDir;
              cargoLock = {
                lockFile = "${nativeDir}/Cargo.lock";
              };
              nativeBuildInputs = [
                extendedPkgs.cmake
              ];
              doCheck = false;
            };

      in
      {
        nativeBuildInputs = [ extendedPkgs.cargo ];

        env.RUSTLER_PRECOMPILED_FORCE_BUILD_ALL = "true";
        env.RUSTLER_PRECOMPILED_GLOBAL_CACHE_PATH = "unused-but-required";

        preConfigure = ''
          mkdir -p priv/native
          for lib in ${native}/lib/*
          do
            dest="$(basename "$lib")"
            if [[ "''${dest##*.}" = "dylib" ]]
            then
              dest="''${dest%.dylib}.so"
            fi
            ln -s "$lib" "priv/native/$dest"
          done
        '';

        buildPhase = ''
          suggestion() {
            echo "***********************************************"
            echo "                 deps_nix                      "
            echo
            echo " Rust dependency build failed.                 "
            echo
            echo " If you saw network errors, you might need     "
            echo " to disable compilation on the appropriate     "
            echo " RustlerPrecompiled module in your             "
            echo " application config.                           "
            echo
            echo " We think you need this:                       "
            echo
            echo -n " "
            grep -Rl 'use RustlerPrecompiled' lib \
              | xargs grep 'defmodule' \
              | sed 's/defmodule \(.*\) do/config :${old.packageName}, \1, skip_compilation?: true/'
            echo "***********************************************"
            exit 1
          }
          trap suggestion ERR
          ${old.buildPhase}
        '';
      };

    elixirMake = _unusedArgs: old: {
      preConfigure = ''
        export ELIXIR_MAKE_CACHE_DIR="$TEMPDIR/elixir_make_cache"
      '';
    };

    lazyHtml = _unusedArgs: old: {
      preConfigure = ''
        export ELIXIR_MAKE_CACHE_DIR="$TEMPDIR/elixir_make_cache"
      '';

      postPatch = ''
        substituteInPlace mix.exs           --replace-fail "Fine.include_dir()" '"${packages.fine}/src/c_include"'           --replace-fail '@lexbor_git_sha "244b84956a6dc7eec293781d051354f351274c46"' '@lexbor_git_sha ""'
      '';

      preBuild = ''
        install -Dm644           -t _build/c/third_party/lexbor/$LEXBOR_GIT_SHA/build           ${lexbor}/lib/liblexbor_static.a
      '';
    };
  };

  defaultOverrides = (
    final: prev:

    let
      apps = {
        crc32cer = [
          {
            name = "portCompiler";
          }
        ];
        explorer = [
          {
            name = "rustlerPrecompiled";
            toolchain = {
              name = "nightly-2025-06-23";
              sha256 = "sha256-UAoZcxg3iWtS+2n8TFNfANFt/GmkuOMDf7QAE0fRxeA=";
            };
          }
        ];
        snappyer = [
          {
            name = "portCompiler";
          }
        ];
      };

      applyOverrides =
        appName: drv:
        let
          allOverridesForApp = builtins.foldl' (
            acc: workaround: acc // (workarounds.${workaround.name} workaround) drv
          ) { } apps.${appName};

        in
        if builtins.hasAttr appName apps then drv.override allOverridesForApp else drv;

    in
    builtins.mapAttrs applyOverrides prev
  );

  self = packages // (defaultOverrides self packages) // (overrides self packages);

  packages =
    with beamPackages;
    with self;
    {

      ash =
        let
          version = "3.17.1";
          drv = buildMix {
            inherit version;
            name = "ash";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "ash";
              sha256 = "c8646ce07c5bf732caea3972c848489204c6fa438a7cf2857a2bdaa869a73244";
            };

            beamDeps = [
              crux
              decimal
              ecto
              ets
              jason
              plug
              reactor
              spark
              splode
              stream_data
              telemetry
            ];
          };
        in
        drv;

      ash_postgres =
        let
          version = "2.6.32";
          drv = buildMix {
            inherit version;
            name = "ash_postgres";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "ash_postgres";
              sha256 = "d1df73f9425bd8fbff325a21e06b4ae64a1eebdec38ed524121f2ebbbd62c971";
            };

            beamDeps = [
              ash
              ash_sql
              ecto
              ecto_sql
              jason
              postgrex
              spark
            ];
          };
        in
        drv;

      ash_sql =
        let
          version = "0.4.5";
          drv = buildMix {
            inherit version;
            name = "ash_sql";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "ash_sql";
              sha256 = "131e06e13ebcf06fc8d050267a5b29f6cc8ef6a781712e61a456f17726a64ea5";
            };

            beamDeps = [
              ash
              ecto
              ecto_sql
            ];
          };
        in
        drv;

      chacha20 =
        let
          version = "1.0.4";
          drv = buildMix {
            inherit version;
            name = "chacha20";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "chacha20";
              sha256 = "2027f5d321ae9903f1f0da7f51b0635ad6b8819bc7fe397837930a2011bc2349";
            };
          };
        in
        drv;

      connection =
        let
          version = "1.1.0";
          drv = buildMix {
            inherit version;
            name = "connection";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "connection";
              sha256 = "722c1eb0a418fbe91ba7bd59a47e28008a189d47e37e0e7bb85585a016b2869c";
            };
          };
        in
        drv;

      cowboy =
        let
          version = "2.14.2";
          drv = buildRebar3 {
            inherit version;
            name = "cowboy";

            src = fetchHex {
              inherit version;
              pkg = "cowboy";
              sha256 = "569081da046e7b41b5df36aa359be71a0c8874e5b9cff6f747073fc57baf1ab9";
            };

            beamDeps = [
              cowlib
              ranch
            ];
          };
        in
        drv;

      cowboy_telemetry =
        let
          version = "0.4.0";
          drv = buildRebar3 {
            inherit version;
            name = "cowboy_telemetry";

            src = fetchHex {
              inherit version;
              pkg = "cowboy_telemetry";
              sha256 = "7d98bac1ee4565d31b62d59f8823dfd8356a169e7fcbb83831b8a5397404c9de";
            };

            beamDeps = [
              cowboy
              telemetry
            ];
          };
        in
        drv;

      cowlib =
        let
          version = "2.16.0";
          drv = buildRebar3 {
            inherit version;
            name = "cowlib";

            src = fetchHex {
              inherit version;
              pkg = "cowlib";
              sha256 = "7f478d80d66b747344f0ea7708c187645cfcc08b11aa424632f78e25bf05db51";
            };
          };
        in
        drv;

      crux =
        let
          version = "0.1.2";
          drv = buildMix {
            inherit version;
            name = "crux";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "crux";
              sha256 = "563ea3748ebfba9cc078e6d198a1d6a06015a8fae503f0b721363139f0ddb350";
            };

            beamDeps = [
              stream_data
            ];
          };
        in
        drv;

      curve25519 =
        let
          version = "1.0.6";
          drv = buildMix {
            inherit version;
            name = "curve25519";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "curve25519";
              sha256 = "dd714c2da20cdddca81f0b659236c8fb2119e58697326da50785b5c1bc64af9d";
            };
          };
        in
        drv;

      db_connection =
        let
          version = "2.9.0";
          drv = buildMix {
            inherit version;
            name = "db_connection";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "db_connection";
              sha256 = "17d502eacaf61829db98facf6f20808ed33da6ccf495354a41e64fe42f9c509c";
            };

            beamDeps = [
              telemetry
            ];
          };
        in
        drv;

      decimal =
        let
          version = "2.3.0";
          drv = buildMix {
            inherit version;
            name = "decimal";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "decimal";
              sha256 = "a4d66355cb29cb47c3cf30e71329e58361cfcb37c34235ef3bf1d7bf3773aeac";
            };
          };
        in
        drv;

      ecto =
        let
          version = "3.13.5";
          drv = buildMix {
            inherit version;
            name = "ecto";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "ecto";
              sha256 = "df9efebf70cf94142739ba357499661ef5dbb559ef902b68ea1f3c1fabce36de";
            };

            beamDeps = [
              decimal
              jason
              telemetry
            ];
          };
        in
        drv;

      ecto_sql =
        let
          version = "3.13.4";
          drv = buildMix {
            inherit version;
            name = "ecto_sql";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "ecto_sql";
              sha256 = "2b38cf0749ca4d1c5a8bcbff79bbe15446861ca12a61f9fba604486cb6b62a14";
            };

            beamDeps = [
              db_connection
              ecto
              postgrex
              telemetry
            ];
          };
        in
        drv;

      ed25519 =
        let
          version = "1.5.0";
          drv = buildMix {
            inherit version;
            name = "ed25519";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "ed25519";
              sha256 = "4f94cfea85d3079464696df63a03be5eef1c138730a6c75eba68aa8be5d95ba9";
            };
          };
        in
        drv;

      equivalex =
        let
          version = "1.0.3";
          drv = buildMix {
            inherit version;
            name = "equivalex";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "equivalex";
              sha256 = "46fa311adb855117d36e461b9c0ad2598f72110ad17ad73d7533c78020e045fc";
            };
          };
        in
        drv;

      ets =
        let
          version = "0.9.0";
          drv = buildMix {
            inherit version;
            name = "ets";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "ets";
              sha256 = "2861fdfb04bcaeff370f1a5904eec864f0a56dcfebe5921ea9aadf2a481c822b";
            };
          };
        in
        drv;

      gnat =
        let
          version = "1.13.0";
          drv = buildMix {
            inherit version;
            name = "gnat";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "gnat";
              sha256 = "adaec4367632333e9ed60760c02d97cd24f6f3e6595ce3ef4a34f8a0f4ec079c";
            };

            beamDeps = [
              connection
              cowlib
              jason
              nimble_parsec
              nkeys
              telemetry
            ];
          };
        in
        drv;

      iterex =
        let
          version = "0.1.2";
          drv = buildMix {
            inherit version;
            name = "iterex";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "iterex";
              sha256 = "2e103b8bcc81757a9af121f6dc0df312c9a17220f302b1193ef720460d03029d";
            };
          };
        in
        drv;

      jason =
        let
          version = "1.4.4";
          drv = buildMix {
            inherit version;
            name = "jason";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "jason";
              sha256 = "c5eb0cab91f094599f94d55bc63409236a8ec69a21a67814529e8d5f6cc90b3b";
            };

            beamDeps = [
              decimal
            ];
          };
        in
        drv;

      kcl =
        let
          version = "1.5.0";
          drv = buildMix {
            inherit version;
            name = "kcl";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "kcl";
              sha256 = "c37205278c77e90aae047e04ef6c0c41fdd4517dd2256f047e508f457d2268b4";
            };

            beamDeps = [
              curve25519
              ed25519
              poly1305
              salsa20
            ];
          };
        in
        drv;

      libgraph =
        let
          version = "0.16.0";
          drv = buildMix {
            inherit version;
            name = "libgraph";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "libgraph";
              sha256 = "41ca92240e8a4138c30a7e06466acc709b0cbb795c643e9e17174a178982d6bf";
            };
          };
        in
        drv;

      mime =
        let
          version = "2.0.7";
          drv = buildMix {
            inherit version;
            name = "mime";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "mime";
              sha256 = "6171188e399ee16023ffc5b76ce445eb6d9672e2e241d2df6050f3c771e80ccd";
            };
          };
        in
        drv;

      nimble_parsec =
        let
          version = "1.4.2";
          drv = buildMix {
            inherit version;
            name = "nimble_parsec";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "nimble_parsec";
              sha256 = "4b21398942dda052b403bbe1da991ccd03a053668d147d53fb8c4e0efe09c973";
            };
          };
        in
        drv;

      nkeys =
        let
          version = "0.3.1";
          drv = buildMix {
            inherit version;
            name = "nkeys";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "nkeys";
              sha256 = "80d8d1d62ac9c5127ad776d8f435e5e1cc732985f6235b22e6c157808b44c108";
            };

            beamDeps = [
              ed25519
              kcl
            ];
          };
        in
        drv;

      oban =
        let
          version = "2.20.3";
          drv = buildMix {
            inherit version;
            name = "oban";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "oban";
              sha256 = "075ffbf1279a96bec495bc63d647b08929837d70bcc0427249ffe4d1dddaec33";
            };

            beamDeps = [
              ecto_sql
              jason
              postgrex
              telemetry
            ];
          };
        in
        drv;

      phoenix =
        let
          version = "1.8.3";
          drv = buildMix {
            inherit version;
            name = "phoenix";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "phoenix";
              sha256 = "36169f95cc2e155b78be93d9590acc3f462f1e5438db06e6248613f27c80caec";
            };

            beamDeps = [
              jason
              phoenix_pubsub
              phoenix_template
              plug
              plug_cowboy
              plug_crypto
              telemetry
              websock_adapter
            ];
          };
        in
        drv;

      phoenix_html =
        let
          version = "4.3.0";
          drv = buildMix {
            inherit version;
            name = "phoenix_html";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "phoenix_html";
              sha256 = "3eaa290a78bab0f075f791a46a981bbe769d94bc776869f4f3063a14f30497ad";
            };
          };
        in
        drv;

      phoenix_live_view =
        let
          version = "1.1.22";
          drv = buildMix {
            inherit version;
            name = "phoenix_live_view";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "phoenix_live_view";
              sha256 = "e1395d5622d8bf02113cb58183589b3da6f1751af235768816e90cc3ec5f1188";
            };

            beamDeps = [
              jason
              phoenix
              phoenix_html
              phoenix_template
              plug
              telemetry
            ];
          };
        in
        drv;

      phoenix_pubsub =
        let
          version = "2.2.0";
          drv = buildMix {
            inherit version;
            name = "phoenix_pubsub";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "phoenix_pubsub";
              sha256 = "adc313a5bf7136039f63cfd9668fde73bba0765e0614cba80c06ac9460ff3e96";
            };
          };
        in
        drv;

      phoenix_template =
        let
          version = "1.0.4";
          drv = buildMix {
            inherit version;
            name = "phoenix_template";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "phoenix_template";
              sha256 = "2c0c81f0e5c6753faf5cca2f229c9709919aba34fab866d3bc05060c9c444206";
            };

            beamDeps = [
              phoenix_html
            ];
          };
        in
        drv;

      plug =
        let
          version = "1.19.1";
          drv = buildMix {
            inherit version;
            name = "plug";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "plug";
              sha256 = "560a0017a8f6d5d30146916862aaf9300b7280063651dd7e532b8be168511e62";
            };

            beamDeps = [
              mime
              plug_crypto
              telemetry
            ];
          };
        in
        drv;

      plug_cowboy =
        let
          version = "2.8.0";
          drv = buildMix {
            inherit version;
            name = "plug_cowboy";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "plug_cowboy";
              sha256 = "9cbfaaf17463334ca31aed38ea7e08a68ee37cabc077b1e9be6d2fb68e0171d0";
            };

            beamDeps = [
              cowboy
              cowboy_telemetry
              plug
            ];
          };
        in
        drv;

      plug_crypto =
        let
          version = "2.1.1";
          drv = buildMix {
            inherit version;
            name = "plug_crypto";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "plug_crypto";
              sha256 = "6470bce6ffe41c8bd497612ffde1a7e4af67f36a15eea5f921af71cf3e11247c";
            };
          };
        in
        drv;

      poly1305 =
        let
          version = "1.0.4";
          drv = buildMix {
            inherit version;
            name = "poly1305";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "poly1305";
              sha256 = "e14e684661a5195e149b3139db4a1693579d4659d65bba115a307529c47dbc3b";
            };

            beamDeps = [
              chacha20
              equivalex
            ];
          };
        in
        drv;

      postgrex =
        let
          version = "0.22.0";
          drv = buildMix {
            inherit version;
            name = "postgrex";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "postgrex";
              sha256 = "a68c4261e299597909e03e6f8ff5a13876f5caadaddd0d23af0d0a61afcc5d84";
            };

            beamDeps = [
              db_connection
              decimal
              jason
            ];
          };
        in
        drv;

      ranch =
        let
          version = "2.2.0";
          drv = buildRebar3 {
            inherit version;
            name = "ranch";

            src = fetchHex {
              inherit version;
              pkg = "ranch";
              sha256 = "fa0b99a1780c80218a4197a59ea8d3bdae32fbff7e88527d7d8a4787eff4f8e7";
            };
          };
        in
        drv;

      reactor =
        let
          version = "1.0.0";
          drv = buildMix {
            inherit version;
            name = "reactor";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "reactor";
              sha256 = "ae8eb507fffc517f5aa5947db9d2ede2db8bae63b66c94ccb5a2027d30f830a0";
            };

            beamDeps = [
              iterex
              jason
              libgraph
              spark
              splode
              telemetry
              yaml_elixir
              ymlr
            ];
          };
        in
        drv;

      rustler =
        let
          version = "0.37.1";
          drv = buildMix {
            inherit version;
            name = "rustler";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "rustler";
              sha256 = "24547e9b8640cf00e6a2071acb710f3e12ce0346692e45098d84d45cdb54fd79";
            };

            beamDeps = [
              jason
            ];
          };
        in
        drv;

      salsa20 =
        let
          version = "1.0.4";
          drv = buildMix {
            inherit version;
            name = "salsa20";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "salsa20";
              sha256 = "745ddcd8cfa563ddb0fd61e7ce48d5146279a2cf7834e1da8441b369fdc58ac6";
            };
          };
        in
        drv;

      spark =
        let
          version = "2.4.1";
          drv = buildMix {
            inherit version;
            name = "spark";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "spark";
              sha256 = "8b065733de9840cac584515f82182ac5ba66a973a47bc5036348dc740662b46b";
            };

            beamDeps = [
              jason
            ];
          };
        in
        drv;

      splode =
        let
          version = "0.3.0";
          drv = buildMix {
            inherit version;
            name = "splode";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "splode";
              sha256 = "73cfd0892d7316d6f2c93e6e8784bd6e137b2aa38443de52fd0a25171d106d81";
            };
          };
        in
        drv;

      stream_data =
        let
          version = "1.2.0";
          drv = buildMix {
            inherit version;
            name = "stream_data";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "stream_data";
              sha256 = "eb5c546ee3466920314643edf68943a5b14b32d1da9fe01698dc92b73f89a9ed";
            };
          };
        in
        drv;

      telemetry =
        let
          version = "1.3.0";
          drv = buildRebar3 {
            inherit version;
            name = "telemetry";

            src = fetchHex {
              inherit version;
              pkg = "telemetry";
              sha256 = "7015fc8919dbe63764f4b4b87a95b7c0996bd539e0d499be6ec9d7f3875b79e6";
            };
          };
        in
        drv;

      websock =
        let
          version = "0.5.3";
          drv = buildMix {
            inherit version;
            name = "websock";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "websock";
              sha256 = "6105453d7fac22c712ad66fab1d45abdf049868f253cf719b625151460b8b453";
            };
          };
        in
        drv;

      websock_adapter =
        let
          version = "0.5.9";
          drv = buildMix {
            inherit version;
            name = "websock_adapter";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "websock_adapter";
              sha256 = "5534d5c9adad3c18a0f58a9371220d75a803bf0b9a3d87e6fe072faaeed76a08";
            };

            beamDeps = [
              plug
              plug_cowboy
              websock
            ];
          };
        in
        drv;

      yamerl =
        let
          version = "0.10.0";
          drv = buildRebar3 {
            inherit version;
            name = "yamerl";

            src = fetchHex {
              inherit version;
              pkg = "yamerl";
              sha256 = "346adb2963f1051dc837a2364e4acf6eb7d80097c0f53cbdc3046ec8ec4b4e6e";
            };
          };
        in
        drv;

      yaml_elixir =
        let
          version = "2.12.1";
          drv = buildMix {
            inherit version;
            name = "yaml_elixir";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "yaml_elixir";
              sha256 = "d9ac16563c737d55f9bfeed7627489156b91268a3a21cd55c54eb2e335207fed";
            };

            beamDeps = [
              yamerl
            ];
          };
        in
        drv;

      ymlr =
        let
          version = "5.1.4";
          drv = buildMix {
            inherit version;
            name = "ymlr";
            appConfigPath = ./config;

            src = fetchHex {
              inherit version;
              pkg = "ymlr";
              sha256 = "75f16cf0709fbd911b30311a0359a7aa4b5476346c01882addefd5f2b1cfaa51";
            };
          };
        in
        drv;

    };
in
self
