"""
Advanced DuckDB Analysis: Time-series features, anomaly detection, SQL window functions
"""

import duckdb
import polars as pl
from pathlib import Path

# Load data
train_df = pl.read_csv("smoke_analysis/data/raw/train_dataset.csv")

print("=" * 80)
print("ADVANCED DUCKDB ANALYSIS")
print("=" * 80)

# 1. ROLLING WINDOW FEATURES
print("\n1. ROLLING WINDOW FEATURES (3-sample moving average - first 10 rows)")
print("-" * 80)

rolling_features = duckdb.query("""
    WITH windowed AS (
        SELECT 
            ROW_NUMBER() OVER () as idx,
            "Fire Alarm",
            "Temperature[C]",
            ROUND(AVG("Temperature[C]") OVER (
                ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
            ), 2) as temp_ma3,
            CNT,
            ROUND(AVG(CNT) OVER (
                ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
            ), 2) as cnt_ma3
        FROM train_df
    )
    SELECT * FROM windowed WHERE idx <= 10
""").pl()

print(rolling_features)

# 2. PERCENTILE-BASED ANOMALY DETECTION
print("\n\n2. ANOMALY DETECTION (Values > 95th percentile or < 5th percentile)")
print("-" * 80)

anomalies = duckdb.query("""
    WITH percentiles AS (
        SELECT 
            PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY CNT) as cnt_p5,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY CNT) as cnt_p95,
            PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY "Temperature[C]") as temp_p5,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "Temperature[C]") as temp_p95
        FROM train_df
    )
    SELECT 
        SUM(CASE WHEN CNT < (SELECT cnt_p5 FROM percentiles) OR 
                     CNT > (SELECT cnt_p95 FROM percentiles) THEN 1 ELSE 0 END) as cnt_anomalies,
        SUM(CASE WHEN "Temperature[C]" < (SELECT temp_p5 FROM percentiles) OR 
                     "Temperature[C]" > (SELECT temp_p95 FROM percentiles) THEN 1 ELSE 0 END) as temp_anomalies,
        ROUND((SELECT cnt_p5 FROM percentiles), 2) as cnt_5th_percentile,
        ROUND((SELECT cnt_p95 FROM percentiles), 2) as cnt_95th_percentile,
        ROUND((SELECT temp_p5 FROM percentiles), 2) as temp_5th_percentile,
        ROUND((SELECT temp_p95 FROM percentiles), 2) as temp_95th_percentile
    FROM train_df
""").pl()

print(anomalies)

# 3. CO-OCCURRENCE PATTERNS
print("\n\n3. CO-OCCURRENCE: High CNT + High Humidity + Fire Alarm")
print("-" * 80)

cooccurrence = duckdb.query("""
    WITH thresholds AS (
        SELECT 
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY CNT) as cnt_q3,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY "Humidity[%]") as humidity_q3
        FROM train_df
    )
    SELECT 
        CASE WHEN CNT > (SELECT cnt_q3 FROM thresholds) THEN 'High CNT' ELSE 'Normal CNT' END as cnt_level,
        CASE WHEN "Humidity[%]" > (SELECT humidity_q3 FROM thresholds) THEN 'High Humidity' ELSE 'Normal Humidity' END as humidity_level,
        "Fire Alarm",
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
    FROM train_df
    GROUP BY cnt_level, humidity_level, "Fire Alarm"
    ORDER BY count DESC
""").pl()

print(cooccurrence)

# 4. TEMPORAL PATTERNS
print("\n\n4. TEMPORAL PATTERNS: Fire alarm frequency over time buckets")
print("-" * 80)

temporal = duckdb.query("""
    WITH numbered AS (
        SELECT 
            *,
            NTILE(10) OVER () as time_bucket
        FROM train_df
    )
    SELECT 
        time_bucket,
        COUNT(*) as total_samples,
        SUM("Fire Alarm") as fire_alarms,
        ROUND(SUM("Fire Alarm") * 100.0 / COUNT(*), 2) as fire_rate_pct,
        ROUND(AVG(CNT), 2) as avg_cnt,
        ROUND(AVG("Temperature[C]"), 2) as avg_temp
    FROM numbered
    GROUP BY time_bucket
    ORDER BY time_bucket
""").pl()

print(temporal)

# 5. MULTI-SENSOR CORRELATION MATRIX
print("\n\n5. CORRELATION MATRIX (Top sensors)")
print("-" * 80)

correlation_matrix = duckdb.query("""
    SELECT 
        'CNT vs Humidity' as pair,
        ROUND(CORR(CNT, "Humidity[%]"), 4) as correlation
    FROM train_df
    UNION ALL
    SELECT 'CNT vs Temperature', ROUND(CORR(CNT, "Temperature[C]"), 4) FROM train_df
    UNION ALL
    SELECT 'CNT vs TVOC', ROUND(CORR(CNT, "TVOC[ppb]"), 4) FROM train_df
    UNION ALL
    SELECT 'Humidity vs Temperature', ROUND(CORR("Humidity[%]", "Temperature[C]"), 4) FROM train_df
    UNION ALL
    SELECT 'PM2.5 vs PM1.0', ROUND(CORR("PM2.5", "PM1.0"), 4) FROM train_df
    ORDER BY correlation DESC
""").pl()

print(correlation_matrix)

# 6. Z-SCORE OUTLIERS
print("\n\n6. Z-SCORE OUTLIERS (|z| > 3 for CNT)")
print("-" * 80)

z_score_outliers = duckdb.query("""
    WITH stats AS (
        SELECT AVG(CNT) as mean_cnt, STDDEV(CNT) as std_cnt FROM train_df
    )
    SELECT 
        COUNT(*) as total_outliers,
        SUM(CASE WHEN "Fire Alarm" = 1 THEN 1 ELSE 0 END) as outliers_with_fire,
        ROUND(SUM(CASE WHEN "Fire Alarm" = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as fire_rate_pct,
        ROUND(MIN(CNT), 2) as min_cnt,
        ROUND(MAX(CNT), 2) as max_cnt,
        ROUND(AVG(CNT), 2) as avg_cnt
    FROM train_df, stats
    WHERE ABS((CNT - mean_cnt) / std_cnt) > 3
""").pl()

print(z_score_outliers)

# 7. SAVE ADVANCED FEATURES
print("\n\n7. SAVING ADVANCED FEATURES")
print("-" * 80)

output_dir = Path("results")

# Create rolling window features for entire dataset
full_rolling = duckdb.query("""
    SELECT 
        *,
        AVG("Temperature[C]") OVER (ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) as temp_ma3,
        AVG(CNT) OVER (ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) as cnt_ma3,
        AVG("Humidity[%]") OVER (ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) as humidity_ma3
    FROM train_df
""").pl()

full_rolling.write_parquet(output_dir / "train_with_rolling_features.parquet")
print(f"✓ Saved: {output_dir / 'train_with_rolling_features.parquet'}")

# Save correlation matrix
correlation_matrix.write_csv(output_dir / "sensor_correlations.csv")
print(f"✓ Saved: {output_dir / 'sensor_correlations.csv'}")

# Save temporal patterns
temporal.write_csv(output_dir / "temporal_patterns.csv")
print(f"✓ Saved: {output_dir / 'temporal_patterns.csv'}")

print("\n" + "=" * 80)
print("ADVANCED ANALYSIS COMPLETE")
print("=" * 80)
