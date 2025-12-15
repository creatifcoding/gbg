-- TMNL PostgreSQL Initialization Script
-- Extensions and schema setup for Phase 0

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Note: pg_mooncake requires separate installation (Phase 3)

-- Create application schemas
CREATE SCHEMA IF NOT EXISTS ams;      -- Asset Management System
CREATE SCHEMA IF NOT EXISTS ava;      -- AVA (Asset View Agent)
CREATE SCHEMA IF NOT EXISTS obs;      -- Observability
CREATE SCHEMA IF NOT EXISTS chain;    -- Blockchain data

-- Grant permissions
GRANT ALL ON SCHEMA ams TO postgres;
GRANT ALL ON SCHEMA ava TO postgres;
GRANT ALL ON SCHEMA obs TO postgres;
GRANT ALL ON SCHEMA chain TO postgres;

-- Create sample table for testing
CREATE TABLE IF NOT EXISTS ams.device_readings (
  id SERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert to hypertable (TimescaleDB)
SELECT create_hypertable('ams.device_readings', 'timestamp', if_not_exists => TRUE);

-- Create index
CREATE INDEX IF NOT EXISTS device_readings_device_id_idx ON ams.device_readings(device_id);
CREATE INDEX IF NOT EXISTS device_readings_timestamp_idx ON ams.device_readings(timestamp DESC);

-- Insert sample data
INSERT INTO ams.device_readings (device_id, metric, value, timestamp)
VALUES 
  ('device-001', 'temperature', 25.5, NOW() - INTERVAL '1 hour'),
  ('device-001', 'temperature', 26.2, NOW() - INTERVAL '30 minutes'),
  ('device-001', 'temperature', 24.8, NOW()),
  ('device-002', 'humidity', 65.0, NOW() - INTERVAL '1 hour'),
  ('device-002', 'humidity', 67.5, NOW())
ON CONFLICT DO NOTHING;

-- Create view for latest readings
CREATE OR REPLACE VIEW ams.latest_device_readings AS
SELECT DISTINCT ON (device_id, metric)
  device_id,
  metric,
  value,
  timestamp
FROM ams.device_readings
ORDER BY device_id, metric, timestamp DESC;

COMMENT ON SCHEMA ams IS 'Asset Management System data';
COMMENT ON SCHEMA ava IS 'AVA reconciler data';
COMMENT ON SCHEMA obs IS 'Observability data (logs, traces, metrics)';
COMMENT ON SCHEMA chain IS 'Blockchain indexed data';
