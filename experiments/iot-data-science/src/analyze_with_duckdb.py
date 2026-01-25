"""
Data analysis using DuckDB + Polars

Shows how to use DuckDB for SQL-based feature engineering
and Polars for fast DataFrame operations.

Requirements:
  uv pip install duckdb polars

Run:
  python analyze_with_duckdb.py
"""

import duckdb
import polars as pl
from pathlib import Path


def main():
    print("=" * 80)
    print("SMOKE DETECTION DATA ANALYSIS - DuckDB + Polars")
    print("=" * 80)

    # Paths
    train_path = "smoke_analysis/data/raw/train_dataset.csv"

    # ========================================================================
    # DuckDB Analysis
    # ========================================================================
    print("\n[DuckDB] SQL-based analysis...")

    con = duckdb.connect(":memory:")

    # Load CSV
    con.execute(f"""
        CREATE TABLE smoke AS 
        SELECT * FROM read_csv_auto('{train_path}')
    """)

    # Basic statistics
    print("\nDataset Overview:")
    result = con.execute("""
        SELECT 
            COUNT(*) as total_samples,
            SUM(CASE WHEN "Fire Alarm" = 1 THEN 1 ELSE 0 END) as fire_count,
            ROUND(AVG("Temperature[C]"), 2) as avg_temp,
            ROUND(AVG("Humidity[%]"), 2) as avg_humidity,
            ROUND(AVG(CNT), 2) as avg_cnt
        FROM smoke
    """).fetchone()

    print(f"  Total samples: {result[0]:,}")
    print(f"  Fire alarms: {result[1]:,} ({result[1] / result[0] * 100:.1f}%)")
    print(f"  Avg Temperature: {result[2]}°C")
    print(f"  Avg Humidity: {result[3]}%")
    print(f"  Avg CNT: {result[4]}")

    # Feature correlations with Fire Alarm
    print("\nTop 5 Features Correlated with Fire Alarm:")
    correlations = con.execute("""
        WITH correlations AS (
            SELECT 
                'Temperature[C]' as feature,
                CORR("Temperature[C]", "Fire Alarm") as correlation
            FROM smoke
            UNION ALL
            SELECT 'Humidity[%]', CORR("Humidity[%]", "Fire Alarm") FROM smoke
            UNION ALL
            SELECT 'TVOC[ppb]', CORR("TVOC[ppb]", "Fire Alarm") FROM smoke
            UNION ALL
            SELECT 'PM2.5', CORR("PM2.5", "Fire Alarm") FROM smoke
            UNION ALL
            SELECT 'CNT', CORR(CNT, "Fire Alarm") FROM smoke
        )
        SELECT * FROM correlations ORDER BY ABS(correlation) DESC
    """).fetchall()

    for feature, corr in correlations:
        print(f"  {feature:20s}: {corr:+.4f}")

    # Fire alarm statistics by temperature range
    print("\nFire Alarm Rate by Temperature Range:")
    temp_ranges = con.execute("""
        SELECT 
            CASE 
                WHEN "Temperature[C]" < 10 THEN 'Below 10°C'
                WHEN "Temperature[C]" < 20 THEN '10-20°C'
                WHEN "Temperature[C]" < 30 THEN '20-30°C'
                WHEN "Temperature[C]" < 40 THEN '30-40°C'
                ELSE 'Above 40°C'
            END as temp_range,
            COUNT(*) as samples,
            SUM("Fire Alarm") as fire_alarms,
            ROUND(100.0 * SUM("Fire Alarm") / COUNT(*), 1) as fire_rate
        FROM smoke
        GROUP BY temp_range
        ORDER BY 
            CASE temp_range
                WHEN 'Below 10°C' THEN 1
                WHEN '10-20°C' THEN 2
                WHEN '20-30°C' THEN 3
                WHEN '30-40°C' THEN 4
                ELSE 5
            END
    """).fetchall()

    for temp_range, samples, alarms, rate in temp_ranges:
        print(f"  {temp_range:15s}: {alarms:4d}/{samples:4d} samples ({rate:5.1f}%)")

    # ========================================================================
    # Polars Analysis
    # ========================================================================
    print("\n" + "=" * 80)
    print("[Polars] DataFrame operations...")

    # Load with Polars (10x faster than pandas)
    df = pl.read_csv(train_path)

    print(f"\nDataFrame shape: {df.shape}")
    print(f"Columns: {df.columns}")

    # Group by Fire Alarm and compute statistics
    print("\nStatistics by Fire Alarm Status:")
    stats = df.group_by("Fire Alarm").agg(
        [
            pl.count().alias("count"),
            pl.col("Temperature[C]").mean().round(2).alias("avg_temp"),
            pl.col("Humidity[%]").mean().round(2).alias("avg_humidity"),
            pl.col("CNT").mean().round(0).alias("avg_cnt"),
            pl.col("PM2.5").mean().round(2).alias("avg_pm25"),
        ]
    )

    print(stats)

    # Lazy evaluation example (Polars optimization)
    print("\n[Polars Lazy] Computing rolling statistics...")
    lazy_df = (
        df.lazy()
        .with_columns(
            [
                pl.col("Temperature[C]")
                .rolling_mean(window_size=10)
                .alias("temp_ma10"),
                pl.col("CNT").rolling_max(window_size=10).alias("cnt_max10"),
            ]
        )
        .collect()
    )

    print(f"  Added rolling features: {lazy_df.columns[-2:]}")

    # Export to Parquet (3-5x smaller than CSV)
    output_path = "smoke_analysis/data/processed/train_with_features.parquet"
    Path("smoke_analysis/data/processed").mkdir(parents=True, exist_ok=True)
    lazy_df.write_parquet(output_path)

    print(f"\n  Saved to: {output_path}")

    # Compare file sizes
    csv_size = Path(train_path).stat().st_size / 1024 / 1024
    parquet_size = Path(output_path).stat().st_size / 1024 / 1024

    print(f"  CSV size: {csv_size:.2f} MB")
    print(f"  Parquet size: {parquet_size:.2f} MB")
    print(f"  Compression: {csv_size / parquet_size:.1f}x smaller")

    print("\n" + "=" * 80)
    print("Analysis complete!")
    print("=" * 80)

    con.close()


if __name__ == "__main__":
    main()
