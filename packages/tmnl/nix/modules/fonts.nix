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
      tmnlFontPackages = with pkgs; [
        # Style-first pack
        hanken-grotesk
        commit-mono
        departure-mono

        # Utility/fallback pack
        inter
        ibm-plex
        jetbrains-mono
        atkinson-hyperlegible-mono
      ];
    in
    {
      devShells.tmnl-fonts = pkgs.mkShell {
        name = "tmnl-fonts";

        inputsFrom = [
          config.devShells.tmnl-core
        ];

        nativeBuildInputs = tmnlFontPackages ++ [ pkgs.fontconfig ];

        shellHook = ''
          echo "[tmnl-fonts] Style-first command-surface fonts loaded."
          echo "  primary: Hanken Grotesk + Commit Mono + Departure Mono"
          echo "  fallback: Inter + IBM Plex + JetBrains Mono + Atkinson"
          echo "Run: tmnl fonts-sync"
        '';
      };

      mission-control.scripts = {
        fonts-list = {
          description = "List curated Nix font packages + key files.";
          category = "UI";
          exec = ''
            set -euo pipefail

            echo "[tmnl fonts-list] Style-first pack"
            echo "  - hanken-grotesk: ${pkgs.hanken-grotesk}"
            echo "  - commit-mono: ${pkgs.commit-mono}"
            echo "  - departure-mono: ${pkgs.departure-mono}"
            echo ""
            echo "[tmnl fonts-list] Utility/fallback pack"
            echo "  - inter: ${pkgs.inter}"
            echo "  - ibm-plex: ${pkgs.ibm-plex}"
            echo "  - jetbrains-mono: ${pkgs.jetbrains-mono}"
            echo "  - atkinson-hyperlegible-mono: ${pkgs.atkinson-hyperlegible-mono}"
            echo ""
            echo "Hanken files:"
            find ${pkgs.hanken-grotesk}/share/fonts -maxdepth 2 -type f | head -n 12
            echo ""
            echo "Commit files:"
            find ${pkgs.commit-mono}/share/fonts -maxdepth 2 -type f | head -n 12
            echo ""
            echo "Departure files:"
            find ${pkgs.departure-mono}/share/fonts -maxdepth 2 -type f | head -n 8
          '';
        };

        fonts-sync = {
          description = "Sync curated Nix fonts into packages/tmnl/assets/data/fonts/nix.";
          category = "UI";
          exec = ''
            set -euo pipefail

            TMNL_ROOT="$FLAKE_ROOT/packages/tmnl"
            if [ ! -d "$TMNL_ROOT/assets/data/fonts" ]; then
              TMNL_ROOT="$FLAKE_ROOT"
            fi

            if [ ! -d "$TMNL_ROOT/assets/data/fonts" ]; then
              echo "[tmnl fonts-sync] Could not locate packages/tmnl/assets/data/fonts"
              echo "  FLAKE_ROOT=$FLAKE_ROOT"
              exit 1
            fi

            TARGET="$TMNL_ROOT/assets/data/fonts/nix"
            mkdir -p "$TARGET"

            copy_font() {
              local src="$1"
              local dst="$2"
              mkdir -p "$(dirname "$dst")"
              install -m 0644 "$src" "$dst"
              echo "  + $(realpath --relative-to="$TMNL_ROOT" "$dst")"
            }

            echo "[tmnl fonts-sync] Syncing curated fonts to $TARGET"

            # Style-first pack
            copy_font "${pkgs.hanken-grotesk}/share/fonts/variable/HankenGrotesk[wght].ttf" "$TARGET/Hanken_Grotesk/HankenGrotesk-Variable.ttf"
            copy_font "${pkgs.hanken-grotesk}/share/fonts/variable/HankenGrotesk-Italic[wght].ttf" "$TARGET/Hanken_Grotesk/HankenGrotesk-VariableItalic.ttf"
            copy_font "${pkgs.hanken-grotesk}/share/fonts/truetype/HankenGrotesk-SemiBold.ttf" "$TARGET/Hanken_Grotesk/HankenGrotesk-SemiBold.ttf"

            copy_font "${pkgs.commit-mono}/share/fonts/truetype/CommitMono-400-Regular.ttf" "$TARGET/Commit_Mono/CommitMono-Regular.ttf"
            copy_font "${pkgs.commit-mono}/share/fonts/truetype/CommitMono-700-Regular.ttf" "$TARGET/Commit_Mono/CommitMono-Bold.ttf"
            copy_font "${pkgs.commit-mono}/share/fonts/truetype/CommitMono-400-Italic.ttf" "$TARGET/Commit_Mono/CommitMono-Italic.ttf"

            copy_font "${pkgs.departure-mono}/share/fonts/otf/DepartureMono-Regular.otf" "$TARGET/Departure_Mono/DepartureMono-Regular.otf"

            # Utility/fallback pack
            copy_font "${pkgs.inter}/share/fonts/truetype/InterVariable.ttf" "$TARGET/Inter/InterVariable.ttf"
            copy_font "${pkgs.inter}/share/fonts/truetype/InterVariable-Italic.ttf" "$TARGET/Inter/InterVariable-Italic.ttf"

            copy_font "${pkgs.ibm-plex}/share/fonts/opentype/IBMPlexSans-Regular.otf" "$TARGET/IBM_Plex/IBMPlexSans-Regular.otf"
            copy_font "${pkgs.ibm-plex}/share/fonts/opentype/IBMPlexSans-Medium.otf" "$TARGET/IBM_Plex/IBMPlexSans-Medium.otf"
            copy_font "${pkgs.ibm-plex}/share/fonts/opentype/IBMPlexSans-SemiBold.otf" "$TARGET/IBM_Plex/IBMPlexSans-SemiBold.otf"
            copy_font "${pkgs.ibm-plex}/share/fonts/opentype/IBMPlexSansCondensed-Medium.otf" "$TARGET/IBM_Plex/IBMPlexSansCondensed-Medium.otf"
            copy_font "${pkgs.ibm-plex}/share/fonts/opentype/IBMPlexSansCondensed-SemiBold.otf" "$TARGET/IBM_Plex/IBMPlexSansCondensed-SemiBold.otf"

            copy_font "${pkgs.jetbrains-mono}/share/fonts/truetype/JetBrainsMono[wght].ttf" "$TARGET/JetBrains_Mono/JetBrainsMono-Variable.ttf"
            copy_font "${pkgs.jetbrains-mono}/share/fonts/truetype/JetBrainsMono-Italic[wght].ttf" "$TARGET/JetBrains_Mono/JetBrainsMono-VariableItalic.ttf"
            copy_font "${pkgs.jetbrains-mono}/share/fonts/truetype/JetBrainsMono-Regular.ttf" "$TARGET/JetBrains_Mono/JetBrainsMono-Regular.ttf"

            copy_font "${pkgs.atkinson-hyperlegible-mono}/share/fonts/variable/AtkinsonHyperlegibleMono[wght].ttf" "$TARGET/Atkinson_Hyperlegible_Mono/AtkinsonHyperlegibleMono-Variable.ttf"
            copy_font "${pkgs.atkinson-hyperlegible-mono}/share/fonts/variable/AtkinsonHyperlegibleMono-Italic[wght].ttf" "$TARGET/Atkinson_Hyperlegible_Mono/AtkinsonHyperlegibleMono-VariableItalic.ttf"

            echo "[tmnl fonts-sync] Done."
          '';
        };
      };
    };
}
