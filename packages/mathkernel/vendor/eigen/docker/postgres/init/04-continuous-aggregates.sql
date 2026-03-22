-- =============================================================================
-- TMNL Entity Continuous Aggregates
-- TimescaleDB continuous aggregates for canonical entity materialization
-- =============================================================================

-- Create entity schema for canonical views
CREATE SCHEMA IF NOT EXISTS entity;

-- =============================================================================
-- Flight Current Positions - Latest position per aircraft (1-minute buckets)
-- Refresh: every 30 seconds, covers last 5 minutes of data
-- Query with WHERE bucket > NOW() - INTERVAL to filter recent data
-- =============================================================================

CREATE MATERIALIZED VIEW entity.flights_current
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', time) AS bucket,
  icao24,
  LAST(position, time) AS position,
  LAST(altitude_m, time) AS altitude_m,
  LAST(heading_deg, time) AS heading_deg,
  LAST(velocity_mps, time) AS velocity_mps,
  LAST(vertical_rate, time) AS vertical_rate,
  LAST(callsign, time) AS callsign,
  LAST(category, time) AS category,
  LAST(source, time) AS source,
  LAST(on_ground, time) AS on_ground,
  MAX(time) AS last_seen,
  COUNT(*) AS position_count
FROM raw.flight_positions
GROUP BY bucket, icao24
WITH NO DATA;

-- Enable real-time aggregation (combine materialized + raw data)
ALTER MATERIALIZED VIEW entity.flights_current SET (
  timescaledb.materialized_only = false
);

-- Refresh policy: every 30 seconds, cover data from 5 minutes ago to 1 minute ago
-- The 1-minute end_offset allows the last minute to use real-time aggregation
SELECT add_continuous_aggregate_policy('entity.flights_current',
  start_offset => INTERVAL '1 hour',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '30 seconds',
  if_not_exists => TRUE
);

-- =============================================================================
-- Flight Tracks - Trajectory summary per hour
-- Note: PostGIS ST_MakeLine is not immutable, so we store bounds only
-- Full trajectory reconstruction done at query time via raw.flight_positions
-- Refresh: every 5 minutes
-- =============================================================================

CREATE MATERIALIZED VIEW entity.flight_tracks
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  icao24,
  -- Bounding box for spatial queries (immutable)
  MIN(ST_X(position)) AS min_lon,
  MAX(ST_X(position)) AS max_lon,
  MIN(ST_Y(position)) AS min_lat,
  MAX(ST_Y(position)) AS max_lat,
  -- Summary stats
  MIN(time) AS start_time,
  MAX(time) AS end_time,
  COUNT(*) AS point_count,
  -- Altitude range
  MIN(altitude_m) AS min_altitude_m,
  MAX(altitude_m) AS max_altitude_m,
  AVG(altitude_m)::REAL AS avg_altitude_m,
  -- Speed stats
  AVG(velocity_mps)::REAL AS avg_velocity_mps,
  MAX(velocity_mps) AS max_velocity_mps,
  -- Last known state
  LAST(callsign, time) AS callsign,
  LAST(source, time) AS source
FROM raw.flight_positions
GROUP BY bucket, icao24
WITH NO DATA;

-- Enable real-time aggregation
ALTER MATERIALIZED VIEW entity.flight_tracks SET (
  timescaledb.materialized_only = false
);

-- Refresh policy: every 5 minutes (2 hour window covers 2+ buckets)
SELECT add_continuous_aggregate_policy('entity.flight_tracks',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '5 minutes',
  if_not_exists => TRUE
);

-- =============================================================================
-- Weather Current - Latest weather per location (1-hour buckets)
-- =============================================================================

CREATE MATERIALIZED VIEW entity.weather_current
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  location_id,
  LAST(position, time) AS position,
  LAST(temperature, time) AS temperature,
  LAST(feels_like, time) AS feels_like,
  LAST(humidity, time) AS humidity,
  LAST(pressure, time) AS pressure,
  LAST(weather_code, time) AS weather_code,
  LAST(weather_desc, time) AS weather_desc,
  LAST(wind_speed, time) AS wind_speed,
  LAST(wind_dir, time) AS wind_dir,
  LAST(cloud_cover, time) AS cloud_cover,
  MAX(time) AS last_observed
FROM raw.weather_observations
GROUP BY bucket, location_id
WITH NO DATA;

-- Enable real-time aggregation
ALTER MATERIALIZED VIEW entity.weather_current SET (
  timescaledb.materialized_only = false
);

-- Refresh policy: every 5 minutes (3 hour window covers 3+ buckets)
SELECT add_continuous_aggregate_policy('entity.weather_current',
  start_offset => INTERVAL '4 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '5 minutes',
  if_not_exists => TRUE
);

-- =============================================================================
-- Ingestion Statistics - Hourly ingestion metrics
-- For monitoring ingestion health
-- =============================================================================

CREATE MATERIALIZED VIEW entity.ingestion_stats_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  source,
  operation,
  COUNT(*) AS operation_count,
  SUM(records_ingested) AS total_records,
  SUM(records_updated) AS total_updated,
  SUM(records_skipped) AS total_skipped,
  AVG(latency_ms)::INTEGER AS avg_latency_ms,
  MAX(latency_ms) AS max_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::INTEGER AS p95_latency_ms,
  COUNT(*) FILTER (WHERE success) AS success_count,
  COUNT(*) FILTER (WHERE NOT success) AS error_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success) / NULLIF(COUNT(*), 0), 2) AS success_rate
FROM raw.ingestion_log
GROUP BY bucket, source, operation
WITH NO DATA;

-- Enable real-time aggregation
ALTER MATERIALIZED VIEW entity.ingestion_stats_hourly SET (
  timescaledb.materialized_only = false
);

-- Refresh policy: every 5 minutes (3 hour window covers 3+ buckets)
SELECT add_continuous_aggregate_policy('entity.ingestion_stats_hourly',
  start_offset => INTERVAL '4 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '5 minutes',
  if_not_exists => TRUE
);

-- =============================================================================
-- Helper Functions for Entity Queries
-- =============================================================================

-- Get current flights in bounding box (uses continuous aggregate + real-time)
CREATE OR REPLACE FUNCTION entity.get_current_flights(
  min_lon FLOAT,
  min_lat FLOAT,
  max_lon FLOAT,
  max_lat FLOAT,
  since_minutes INTEGER DEFAULT 5
)
RETURNS TABLE (
  icao24 TEXT,
  callsign TEXT,
  lon FLOAT,
  lat FLOAT,
  altitude_m REAL,
  heading_deg REAL,
  velocity_mps REAL,
  on_ground BOOLEAN,
  source TEXT,
  last_seen TIMESTAMPTZ
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    fc.icao24,
    fc.callsign,
    ST_X(fc.position)::FLOAT AS lon,
    ST_Y(fc.position)::FLOAT AS lat,
    fc.altitude_m,
    fc.heading_deg,
    fc.velocity_mps,
    fc.on_ground,
    fc.source,
    fc.last_seen
  FROM entity.flights_current fc
  WHERE fc.bucket >= NOW() - (since_minutes || ' minutes')::INTERVAL
    AND fc.position && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
  ORDER BY fc.last_seen DESC;
$$;

-- Get flight track summary for a specific aircraft (from continuous aggregate)
CREATE OR REPLACE FUNCTION entity.get_flight_track_summary(
  p_icao24 TEXT,
  p_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 hour',
  p_to TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  icao24 TEXT,
  bucket TIMESTAMPTZ,
  min_lon FLOAT,
  max_lon FLOAT,
  min_lat FLOAT,
  max_lat FLOAT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  point_count BIGINT,
  avg_altitude_m REAL,
  avg_velocity_mps REAL,
  callsign TEXT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    ft.icao24,
    ft.bucket,
    ft.min_lon::FLOAT,
    ft.max_lon::FLOAT,
    ft.min_lat::FLOAT,
    ft.max_lat::FLOAT,
    ft.start_time,
    ft.end_time,
    ft.point_count,
    ft.avg_altitude_m,
    ft.avg_velocity_mps,
    ft.callsign
  FROM entity.flight_tracks ft
  WHERE ft.icao24 = p_icao24
    AND ft.bucket >= time_bucket('1 hour', p_from)
    AND ft.bucket <= time_bucket('1 hour', p_to)
  ORDER BY ft.bucket;
$$;

-- Get detailed flight positions for trajectory reconstruction (from raw data)
CREATE OR REPLACE FUNCTION entity.get_flight_positions(
  p_icao24 TEXT,
  p_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 hour',
  p_to TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  observed_at TIMESTAMPTZ,
  lon FLOAT,
  lat FLOAT,
  altitude_m REAL,
  heading_deg REAL,
  velocity_mps REAL,
  source TEXT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    fp.time AS observed_at,
    ST_X(fp.position)::FLOAT AS lon,
    ST_Y(fp.position)::FLOAT AS lat,
    fp.altitude_m,
    fp.heading_deg,
    fp.velocity_mps,
    fp.source
  FROM raw.flight_positions fp
  WHERE fp.icao24 = p_icao24
    AND fp.time BETWEEN p_from AND p_to
  ORDER BY fp.time;
$$;

-- Get current weather near a point
CREATE OR REPLACE FUNCTION entity.get_weather_near(
  p_lon FLOAT,
  p_lat FLOAT,
  p_radius_km FLOAT DEFAULT 50
)
RETURNS TABLE (
  location_id TEXT,
  distance_km FLOAT,
  temperature REAL,
  feels_like REAL,
  humidity REAL,
  weather_code INTEGER,
  weather_desc TEXT,
  wind_speed REAL,
  last_observed TIMESTAMPTZ
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    wc.location_id,
    ST_Distance(
      wc.position::geography,
      ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
    ) / 1000 AS distance_km,
    wc.temperature,
    wc.feels_like,
    wc.humidity,
    wc.weather_code,
    wc.weather_desc,
    wc.wind_speed,
    wc.last_observed
  FROM entity.weather_current wc
  WHERE wc.bucket >= NOW() - INTERVAL '1 hour'
    AND ST_DWithin(
      wc.position::geography,
      ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
      p_radius_km * 1000
    )
  ORDER BY distance_km
  LIMIT 10;
$$;

-- =============================================================================
-- Grant Permissions
-- =============================================================================

GRANT USAGE ON SCHEMA entity TO tmnl;
GRANT SELECT ON ALL TABLES IN SCHEMA entity TO tmnl;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA entity TO tmnl;
