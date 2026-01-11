-- =============================================================================
-- TMNL Raw Storage Schema
-- Append-only storage for all external API data with dual storage pattern
-- (raw JSONB + normalized columns)
-- =============================================================================

-- Create raw schema for ingested data
CREATE SCHEMA IF NOT EXISTS raw;

-- =============================================================================
-- Flight Positions - Hypertable for time-series flight data
-- Sources: OpenSky Network, ADSB.lol
-- Retention: 30 days
-- =============================================================================

CREATE TABLE raw.flight_positions (
  -- Primary key: time + source + icao24 (append-only)
  time          TIMESTAMPTZ NOT NULL,
  icao24        TEXT NOT NULL,
  source        TEXT NOT NULL,  -- 'opensky' | 'adsb_lol'

  -- Raw API response (for debugging, schema evolution)
  raw           JSONB NOT NULL,

  -- Normalized columns (for indexing and efficient queries)
  position      GEOMETRY(Point, 4326),
  altitude_m    REAL,
  heading_deg   REAL,
  velocity_mps  REAL,
  vertical_rate REAL,
  on_ground     BOOLEAN DEFAULT FALSE,
  callsign      TEXT,
  squawk        TEXT,
  category      TEXT,
  origin_country TEXT,

  -- Primary key allows multiple sources for same aircraft at same time
  PRIMARY KEY (time, icao24, source)
);

-- Convert to hypertable (chunk by day for 30-day retention)
SELECT create_hypertable(
  'raw.flight_positions',
  by_range('time', INTERVAL '1 day'),
  if_not_exists => TRUE
);

-- Spatial index for geographic queries
CREATE INDEX flight_positions_position_idx
  ON raw.flight_positions
  USING GIST (position);

-- Index for ICAO24 lookups (most recent first)
CREATE INDEX flight_positions_icao24_idx
  ON raw.flight_positions (icao24, time DESC);

-- Index for callsign lookups
CREATE INDEX flight_positions_callsign_idx
  ON raw.flight_positions (callsign)
  WHERE callsign IS NOT NULL;

-- Index for source-based queries
CREATE INDEX flight_positions_source_idx
  ON raw.flight_positions (source, time DESC);

-- Retention policy: 30 days
SELECT add_retention_policy('raw.flight_positions',
  drop_after => INTERVAL '30 days',
  if_not_exists => TRUE
);

-- Compression policy: compress after 1 day
ALTER TABLE raw.flight_positions SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'icao24, source',
  timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('raw.flight_positions',
  compress_after => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- =============================================================================
-- OSM Elements - Cache with TTL for OpenStreetMap POIs
-- Sources: Overpass API
-- Retention: 7-day TTL (cache)
-- =============================================================================

CREATE TABLE raw.osm_elements (
  -- Primary key: OSM ID + type (way/node/relation can share IDs)
  osm_id        BIGINT NOT NULL,
  osm_type      TEXT NOT NULL,  -- 'node' | 'way' | 'relation'

  -- Raw API response
  raw           JSONB NOT NULL,

  -- Normalized spatial data
  geometry      GEOMETRY(Geometry, 4326) NOT NULL,
  centroid      GEOMETRY(Point, 4326),

  -- Tags as JSONB for flexible querying
  tags          JSONB NOT NULL DEFAULT '{}',

  -- Cache metadata
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',

  -- Query context (bounding box used to fetch this element)
  query_bbox    BOX2D,

  -- Denormalized common tags for efficient queries
  name          TEXT GENERATED ALWAYS AS (tags->>'name') STORED,
  amenity       TEXT GENERATED ALWAYS AS (tags->>'amenity') STORED,
  shop          TEXT GENERATED ALWAYS AS (tags->>'shop') STORED,
  leisure       TEXT GENERATED ALWAYS AS (tags->>'leisure') STORED,
  tourism       TEXT GENERATED ALWAYS AS (tags->>'tourism') STORED,

  PRIMARY KEY (osm_id, osm_type)
);

-- Spatial index for geographic queries
CREATE INDEX osm_elements_geometry_idx
  ON raw.osm_elements
  USING GIST (geometry);

-- Spatial index for centroid queries
CREATE INDEX osm_elements_centroid_idx
  ON raw.osm_elements
  USING GIST (centroid);

-- GIN index for JSONB tag searches
CREATE INDEX osm_elements_tags_idx
  ON raw.osm_elements
  USING GIN (tags jsonb_path_ops);

-- Index for cache expiration cleanup
CREATE INDEX osm_elements_expires_idx
  ON raw.osm_elements (expires_at)
  WHERE expires_at < NOW() + INTERVAL '1 day';

-- Partial indexes for common amenity types
CREATE INDEX osm_elements_amenity_restaurant_idx
  ON raw.osm_elements (amenity)
  WHERE amenity = 'restaurant';

CREATE INDEX osm_elements_amenity_cafe_idx
  ON raw.osm_elements (amenity)
  WHERE amenity = 'cafe';

CREATE INDEX osm_elements_shop_idx
  ON raw.osm_elements (shop)
  WHERE shop IS NOT NULL;

-- =============================================================================
-- Weather Observations - Hypertable for time-series weather data
-- Sources: Open-Meteo
-- Retention: 3 days raw, 30 days aggregated
-- =============================================================================

CREATE TABLE raw.weather_observations (
  -- Primary key: time + location
  time          TIMESTAMPTZ NOT NULL,
  location_id   TEXT NOT NULL,  -- Hash of lat/lon for deduplication

  -- Raw API response
  raw           JSONB NOT NULL,

  -- Normalized spatial data
  position      GEOMETRY(Point, 4326) NOT NULL,

  -- Current conditions
  temperature   REAL,           -- Celsius
  feels_like    REAL,           -- Celsius
  humidity      REAL,           -- Percentage (0-100)
  pressure      REAL,           -- hPa
  weather_code  INTEGER,        -- WMO weather code
  weather_desc  TEXT,           -- Human-readable description

  -- Wind
  wind_speed    REAL,           -- m/s
  wind_dir      REAL,           -- Degrees (0-360)
  wind_gusts    REAL,           -- m/s

  -- Precipitation
  precipitation REAL,           -- mm
  rain          REAL,           -- mm
  snow          REAL,           -- mm

  -- Visibility
  visibility    REAL,           -- meters
  cloud_cover   REAL,           -- Percentage (0-100)

  PRIMARY KEY (time, location_id)
);

-- Convert to hypertable (chunk by hour for high-frequency updates)
SELECT create_hypertable(
  'raw.weather_observations',
  by_range('time', INTERVAL '1 hour'),
  if_not_exists => TRUE
);

-- Spatial index for geographic queries
CREATE INDEX weather_observations_position_idx
  ON raw.weather_observations
  USING GIST (position);

-- Index for location lookups
CREATE INDEX weather_observations_location_idx
  ON raw.weather_observations (location_id, time DESC);

-- Retention policy: 3 days raw
SELECT add_retention_policy('raw.weather_observations',
  drop_after => INTERVAL '3 days',
  if_not_exists => TRUE
);

-- Compression policy: compress after 1 hour
ALTER TABLE raw.weather_observations SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'location_id',
  timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('raw.weather_observations',
  compress_after => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- =============================================================================
-- Imagery Items - Metadata for satellite imagery
-- Sources: Planet Labs, Sentinel Hub
-- Retention: 90 days raw, 1 year aggregated
-- =============================================================================

CREATE TABLE raw.imagery_items (
  -- Primary key: provider + item_id
  item_id       TEXT NOT NULL,
  provider      TEXT NOT NULL,  -- 'planet' | 'sentinel'

  -- Raw API response
  raw           JSONB NOT NULL,

  -- Normalized metadata
  collection    TEXT,           -- e.g., 'PSScene', 'sentinel-2-l2a'
  acquired      TIMESTAMPTZ,    -- Acquisition timestamp
  published     TIMESTAMPTZ,    -- Publication timestamp
  updated       TIMESTAMPTZ,    -- Last update timestamp

  -- Quality metrics
  cloud_cover   REAL,           -- Percentage (0-100)
  gsd           REAL,           -- Ground sample distance (meters)
  sun_azimuth   REAL,           -- Degrees
  sun_elevation REAL,           -- Degrees

  -- Spatial data
  bbox          BOX2D,          -- Bounding box
  geometry      GEOMETRY(Geometry, 4326),
  centroid      GEOMETRY(Point, 4326),

  -- Cache metadata
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (item_id, provider)
);

-- Spatial index for geographic queries
CREATE INDEX imagery_items_geometry_idx
  ON raw.imagery_items
  USING GIST (geometry);

-- Spatial index for centroid queries
CREATE INDEX imagery_items_centroid_idx
  ON raw.imagery_items
  USING GIST (centroid);

-- Index for acquisition time queries
CREATE INDEX imagery_items_acquired_idx
  ON raw.imagery_items (acquired DESC)
  WHERE acquired IS NOT NULL;

-- Index for cloud cover filtering
CREATE INDEX imagery_items_cloud_cover_idx
  ON raw.imagery_items (cloud_cover)
  WHERE cloud_cover IS NOT NULL;

-- Composite index for provider + collection
CREATE INDEX imagery_items_provider_collection_idx
  ON raw.imagery_items (provider, collection);

-- =============================================================================
-- Ingestion Log - Track all ingestion operations
-- =============================================================================

CREATE TABLE raw.ingestion_log (
  -- Primary key
  time          TIMESTAMPTZ NOT NULL,
  source        TEXT NOT NULL,  -- 'opensky' | 'adsb_lol' | 'overpass' | 'openmeteo' | 'planet' | 'sentinel'
  operation     TEXT NOT NULL,  -- 'ingest' | 'poll' | 'refresh'

  -- Metrics
  records_ingested  INTEGER NOT NULL DEFAULT 0,
  records_updated   INTEGER NOT NULL DEFAULT 0,
  records_skipped   INTEGER NOT NULL DEFAULT 0,
  latency_ms        INTEGER,

  -- Request context
  request_id    UUID,
  region_bbox   BOX2D,          -- Geographic region that was ingested

  -- Status
  success       BOOLEAN NOT NULL DEFAULT TRUE,
  error         TEXT,
  error_type    TEXT,           -- 'timeout' | 'rate_limit' | 'server_error' | 'parse_error'

  PRIMARY KEY (time, source, operation)
);

-- Convert to hypertable (chunk by hour)
SELECT create_hypertable(
  'raw.ingestion_log',
  by_range('time', INTERVAL '1 hour'),
  if_not_exists => TRUE
);

-- Index for source-based queries
CREATE INDEX ingestion_log_source_idx
  ON raw.ingestion_log (source, time DESC);

-- Index for error analysis
CREATE INDEX ingestion_log_errors_idx
  ON raw.ingestion_log (source, error_type, time DESC)
  WHERE NOT success;

-- Retention policy: 30 days
SELECT add_retention_policy('raw.ingestion_log',
  drop_after => INTERVAL '30 days',
  if_not_exists => TRUE
);

-- Compression policy: compress after 1 day
ALTER TABLE raw.ingestion_log SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'source, operation',
  timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('raw.ingestion_log',
  compress_after => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Function to clean expired OSM cache entries
CREATE OR REPLACE FUNCTION raw.cleanup_expired_osm()
RETURNS INTEGER
LANGUAGE SQL
AS $$
  WITH deleted AS (
    DELETE FROM raw.osm_elements
    WHERE expires_at < NOW()
    RETURNING osm_id
  )
  SELECT COUNT(*)::INTEGER FROM deleted;
$$;

-- Function to get latest flight position for an aircraft
CREATE OR REPLACE FUNCTION raw.get_latest_position(p_icao24 TEXT)
RETURNS TABLE (
  observed_at TIMESTAMPTZ,
  source TEXT,
  lon FLOAT,
  lat FLOAT,
  altitude_m REAL,
  heading_deg REAL,
  velocity_mps REAL,
  callsign TEXT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    fp.time AS observed_at,
    fp.source,
    ST_X(fp.position)::FLOAT AS lon,
    ST_Y(fp.position)::FLOAT AS lat,
    fp.altitude_m,
    fp.heading_deg,
    fp.velocity_mps,
    fp.callsign
  FROM raw.flight_positions fp
  WHERE fp.icao24 = p_icao24
  ORDER BY fp.time DESC
  LIMIT 1;
$$;

-- Function to get ingestion health summary
CREATE OR REPLACE FUNCTION raw.get_ingestion_health(
  lookback INTERVAL DEFAULT INTERVAL '5 minutes'
)
RETURNS TABLE (
  source TEXT,
  total_ops BIGINT,
  success_rate NUMERIC,
  total_records BIGINT,
  avg_latency_ms NUMERIC,
  last_success TIMESTAMPTZ,
  last_error TEXT
)
LANGUAGE SQL STABLE
AS $$
  WITH recent AS (
    SELECT *
    FROM raw.ingestion_log
    WHERE time >= NOW() - lookback
  ),
  stats AS (
    SELECT
      source,
      COUNT(*) AS total_ops,
      ROUND(100.0 * COUNT(*) FILTER (WHERE success) / NULLIF(COUNT(*), 0), 2) AS success_rate,
      SUM(records_ingested) AS total_records,
      ROUND(AVG(latency_ms)::NUMERIC, 2) AS avg_latency_ms,
      MAX(time) FILTER (WHERE success) AS last_success
    FROM recent
    GROUP BY source
  ),
  last_errors AS (
    SELECT DISTINCT ON (source)
      source,
      error AS last_error
    FROM recent
    WHERE NOT success
    ORDER BY source, time DESC
  )
  SELECT
    s.source,
    s.total_ops,
    s.success_rate,
    s.total_records,
    s.avg_latency_ms,
    s.last_success,
    e.last_error
  FROM stats s
  LEFT JOIN last_errors e USING (source)
  ORDER BY s.source;
$$;

-- =============================================================================
-- Grant Permissions
-- =============================================================================

GRANT USAGE ON SCHEMA raw TO tmnl;
GRANT ALL ON ALL TABLES IN SCHEMA raw TO tmnl;
GRANT ALL ON ALL SEQUENCES IN SCHEMA raw TO tmnl;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA raw TO tmnl;
