{ inputs, lib, ... }:

{
  perSystem = { config, pkgs, system, lib, ... }: {
    devShells.tmnl-duckdb = pkgs.mkShell {
      name = "tmnl-duckdb";

      inputsFrom = [
        config.devShells.tmnl-python
      ];

      nativeBuildInputs = with pkgs; [
        duckdb
      ];

      shellHook = ''
        echo "[tmnl-duckdb] DuckDB CLI available."
        echo "  duckdb --version: $(duckdb --version)"
      '';
    };

    mission-control.scripts = {
      duckdb-shell = {
        description = "Open DuckDB CLI";
        category    = "Database";
        exec = ''
          set -euo pipefail
          cd "$FLAKE_ROOT/experiments/iot-data-science"
          echo "[duckdb] Opening DuckDB shell..."
          duckdb smoke.db
        '';
      };

      duckdb-query = {
        description = "Run DuckDB query on smoke detection data";
        category    = "Database";
        exec = ''
          set -euo pipefail
          cd "$FLAKE_ROOT/experiments/iot-data-science"
          echo "[duckdb] Querying smoke detection data..."
          duckdb -c "
            SELECT 
              COUNT(*) as total_samples,
              SUM(CASE WHEN \"Fire Alarm\" = 1 THEN 1 ELSE 0 END) as fire_alarms,
              AVG(\"Temperature[C]\") as avg_temp,
              AVG(\"Humidity[%]\") as avg_humidity
            FROM read_csv_auto('smoke_analysis/data/raw/train_dataset.csv');
          "
        '';
      };
    };
  };
}
