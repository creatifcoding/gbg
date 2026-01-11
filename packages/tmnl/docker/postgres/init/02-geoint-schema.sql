-- =============================================================================
-- TMNL GEOINT Schema
-- Spatiotemporal storage for flight tracks, OSM features, and API metrics
-- =============================================================================

-- Create schema for GEOINT data
CREATE SCHEMA IF NOT EXISTS geoint;

-- =============================================================================
-- Flight Tracks - Time-series with spatial data
-- =============================================================================

CREATE TABLE geoint.flight_tracks (
  -- Primary key: composite of time + icao24
  time          TIMESTAMPTZ NOT NULL,
  icao24        TEXT NOT NULL,

  -- Spatial data (PostGIS)
  position      GEOMETRY(Point, 4326),

  -- Flight attributes
  callsign      TEXT,
  origin_country TEXT,
  altitude_m    REAL,
  velocity_mps  REAL,
  heading_deg   REAL,
  vertical_rate REAL,
  on_ground     BOOLEAN DEFAULT FALSE,
  squawk        TEXT,

  -- Data source metadata
  source        TEXT NOT NULL,  -- 'opensky', 'adsb_lol', etc.

  -- Computed columns for efficient queries
  CONSTRAINT flight_tracks_pkey PRIMARY KEY (time, icao24)
);

-- Convert to hypertable for time-series optimization (chunk by day)
SELECT create_hypertable(
  'geoint.flight_tracks',
  by_range('time', INTERVAL '1 day'),
  if_not_exists => TRUE
);

-- Spatial index for geographic queries
CREATE INDEX flight_tracks_position_idx
  ON geoint.flight_tracks
  USING GIST (position);

-- Index for callsign lookups
CREATE INDEX flight_tracks_callsign_idx
  ON geoint.flight_tracks (callsign)
  WHERE callsign IS NOT NULL;

-- Index for ICAO24 lookups
CREATE INDEX flight_tracks_icao24_idx
  ON geoint.flight_tracks (icao24, time DESC);

-- =============================================================================
-- OSM Features - Cached POI data with spatial indexing
-- =============================================================================

CREATE TABLE geoint.osm_features (
  id            BIGINT PRIMARY KEY,
  osm_type      TEXT NOT NULL,  -- 'node', 'way', 'relation'

  -- Spatial data
  geometry      GEOMETRY(Geometry, 4326) NOT NULL,
  centroid      GEOMETRY(Point, 4326),

  -- Feature properties (JSONB for flexible schema)
  tags          JSONB NOT NULL DEFAULT '{}',

  -- Cache metadata
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bbox          BOX2D,  -- Bounding box for the query that fetched this

  -- Denormalized common tags for efficient queries
  name          TEXT GENERATED ALWAYS AS (tags->>'name') STORED,
  amenity       TEXT GENERATED ALWAYS AS (tags->>'amenity') STORED,
  shop          TEXT GENERATED ALWAYS AS (tags->>'shop') STORED,
  leisure       TEXT GENERATED ALWAYS AS (tags->>'leisure') STORED
);

-- Spatial index for geographic queries
CREATE INDEX osm_features_geometry_idx
  ON geoint.osm_features
  USING GIST (geometry);

-- Index for centroid point queries
CREATE INDEX osm_features_centroid_idx
  ON geoint.osm_features
  USING GIST (centroid);

-- GIN index for tag searches
CREATE INDEX osm_features_tags_idx
  ON geoint.osm_features
  USING GIN (tags jsonb_path_ops);

-- Partial indexes for common amenity types
CREATE INDEX osm_features_amenity_restaurant_idx
  ON geoint.osm_features (amenity)
  WHERE amenity = 'restaurant';

CREATE INDEX osm_features_amenity_cafe_idx
  ON geoint.osm_features (amenity)
  WHERE amenity = 'cafe';

-- =============================================================================
-- API Metrics - Time-series for monitoring
-- =============================================================================

CREATE TABLE geoint.api_metrics (
  time          TIMESTAMPTZ NOT NULL,
  source        TEXT NOT NULL,  -- 'opensky', 'overpass', 'adsb_lol', etc.
  operation     TEXT NOT NULL,  -- 'getStates', 'query', etc.

  -- Metrics
  latency_ms    INTEGER,
  success       BOOLEAN NOT NULL,
  error_type    TEXT,           -- 'timeout', 'rate_limit', 'server_error', etc.
  response_size INTEGER,

  -- Request context
  request_id    UUID,

  CONSTRAINT api_metrics_pkey PRIMARY KEY (time, source, operation)
);

-- Convert to hypertable (chunk by hour for high-frequency metrics)
SELECT create_hypertable(
  'geoint.api_metrics',
  by_range('time', INTERVAL '1 hour'),
  if_not_exists => TRUE
);

-- Index for source-based aggregations
CREATE INDEX api_metrics_source_idx
  ON geoint.api_metrics (source, time DESC);

-- =============================================================================
-- Search Sessions - Track user search activity
-- =============================================================================

CREATE TABLE geoint.search_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Search parameters
  search_area   GEOMETRY(Polygon, 4326),
  entity_types  TEXT[] NOT NULL DEFAULT '{}',

  -- Results summary
  result_count  INTEGER,
  duration_ms   INTEGER,
  sources_used  TEXT[] NOT NULL DEFAULT '{}',

  -- Session metadata
  cancelled     BOOLEAN DEFAULT FALSE,
  error         TEXT
);

-- Spatial index for search area overlap queries
CREATE INDEX search_sessions_area_idx
  ON geoint.search_sessions
  USING GIST (search_area);

-- =============================================================================
-- Continuous Aggregates for API Metrics (TimescaleDB feature)
-- =============================================================================

-- Hourly API metrics summary
CREATE MATERIALIZED VIEW geoint.api_metrics_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  source,
  operation,
  COUNT(*) AS request_count,
  COUNT(*) FILTER (WHERE success) AS success_count,
  COUNT(*) FILTER (WHERE NOT success) AS error_count,
  AVG(latency_ms)::INTEGER AS avg_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::INTEGER AS p95_latency_ms,
  MAX(latency_ms) AS max_latency_ms
FROM geoint.api_metrics
GROUP BY bucket, source, operation
WITH NO DATA;

-- Refresh policy: update every 5 minutes, with 1 hour lag
SELECT add_continuous_aggregate_policy('geoint.api_metrics_hourly',
  start_offset => INTERVAL '2 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '5 minutes',
  if_not_exists => TRUE
);

-- =============================================================================
-- Retention Policies (TimescaleDB feature)
-- =============================================================================

-- Keep flight tracks for 30 days
SELECT add_retention_policy('geoint.flight_tracks',
  drop_after => INTERVAL '30 days',
  if_not_exists => TRUE
);

-- Keep raw API metrics for 7 days (aggregates preserved longer)
SELECT add_retention_policy('geoint.api_metrics',
  drop_after => INTERVAL '7 days',
  if_not_exists => TRUE
);

-- =============================================================================
-- Compression Policies (TimescaleDB feature)
-- =============================================================================

-- Enable compression on flight tracks (compress after 1 day)
ALTER TABLE geoint.flight_tracks SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'icao24',
  timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('geoint.flight_tracks',
  compress_after => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- Enable compression on API metrics (compress after 1 hour)
ALTER TABLE geoint.api_metrics SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'source, operation',
  timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('geoint.api_metrics',
  compress_after => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Function to get flights within a bounding box
CREATE OR REPLACE FUNCTION geoint.get_flights_in_bbox(
  min_lon FLOAT,
  min_lat FLOAT,
  max_lon FLOAT,
  max_lat FLOAT,
  since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 hour'
)
RETURNS TABLE (
  time TIMESTAMPTZ,
  icao24 TEXT,
  callsign TEXT,
  lon FLOAT,
  lat FLOAT,
  altitude_m REAL,
  heading_deg REAL,
  velocity_mps REAL
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    ft.time,
    ft.icao24,
    ft.callsign,
    ST_X(ft.position)::FLOAT AS lon,
    ST_Y(ft.position)::FLOAT AS lat,
    ft.altitude_m,
    ft.heading_deg,
    ft.velocity_mps
  FROM geoint.flight_tracks ft
  WHERE ft.time >= since
    AND ft.position && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
  ORDER BY ft.time DESC;
$$;

-- Function to get API health summary
CREATE OR REPLACE FUNCTION geoint.get_api_health(
  lookback INTERVAL DEFAULT INTERVAL '5 minutes'
)
RETURNS TABLE (
  source TEXT,
  request_count BIGINT,
  success_rate NUMERIC,
  avg_latency_ms NUMERIC,
  last_error TEXT,
  last_error_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE
AS $$
  WITH recent_metrics AS (
    SELECT *
    FROM geoint.api_metrics
    WHERE time >= NOW() - lookback
  ),
  stats AS (
    SELECT
      source,
      COUNT(*) AS request_count,
      ROUND(100.0 * COUNT(*) FILTER (WHERE success) / NULLIF(COUNT(*), 0), 2) AS success_rate,
      ROUND(AVG(latency_ms)::NUMERIC, 2) AS avg_latency_ms
    FROM recent_metrics
    GROUP BY source
  ),
  last_errors AS (
    SELECT DISTINCT ON (source)
      source,
      error_type AS last_error,
      time AS last_error_at
    FROM recent_metrics
    WHERE NOT success
    ORDER BY source, time DESC
  )
  SELECT
    s.source,
    s.request_count,
    s.success_rate,
    s.avg_latency_ms,
    e.last_error,
    e.last_error_at
  FROM stats s
  LEFT JOIN last_errors e USING (source)
  ORDER BY s.source;
$$;

-- Grant permissions
GRANT USAGE ON SCHEMA geoint TO tmnl;
GRANT ALL ON ALL TABLES IN SCHEMA geoint TO tmnl;
GRANT ALL ON ALL SEQUENCES IN SCHEMA geoint TO tmnl;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA geoint TO tmnl;
