-- =============================================================================
-- Electric Entity Tables - Add ECS tables to Electric publication
-- Runs after ECS migrations have created the entity tables
-- =============================================================================

-- This script adds entity tables to the Electric publication for real-time sync.
-- Tables are created by the ECS migrator (src/lib/ecs/persistence/migrator.ts).
-- This script must run AFTER the migrator has created the tables.

-- Note: If tables don't exist yet, these commands will fail silently.
-- The migrator should be run first, then Electric sync enabled.

-- =============================================================================
-- Core Entity Table
-- =============================================================================

-- entity.entities - Core entity table with provenance
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'entity' AND table_name = 'entities') THEN
    BEGIN
      ALTER PUBLICATION electric_pub ADD TABLE entity.entities;
      RAISE NOTICE 'Added entity.entities to Electric publication';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'entity.entities already in Electric publication';
    END;
  ELSE
    RAISE NOTICE 'entity.entities does not exist yet - run ECS migrator first';
  END IF;
END $$;

-- =============================================================================
-- Trait Tables
-- =============================================================================

-- entity.spatial - Spatial trait (PostGIS PointZ)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'entity' AND table_name = 'spatial') THEN
    BEGIN
      ALTER PUBLICATION electric_pub ADD TABLE entity.spatial;
      RAISE NOTICE 'Added entity.spatial to Electric publication';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'entity.spatial already in Electric publication';
    END;
  ELSE
    RAISE NOTICE 'entity.spatial does not exist yet - run ECS migrator first';
  END IF;
END $$;

-- entity.kinetic - Kinetic trait (heading, speed, vertical rate)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'entity' AND table_name = 'kinetic') THEN
    BEGIN
      ALTER PUBLICATION electric_pub ADD TABLE entity.kinetic;
      RAISE NOTICE 'Added entity.kinetic to Electric publication';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'entity.kinetic already in Electric publication';
    END;
  ELSE
    RAISE NOTICE 'entity.kinetic does not exist yet - run ECS migrator first';
  END IF;
END $$;

-- entity.identifiable - Identifiable trait (external IDs, callsign)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'entity' AND table_name = 'identifiable') THEN
    BEGIN
      ALTER PUBLICATION electric_pub ADD TABLE entity.identifiable;
      RAISE NOTICE 'Added entity.identifiable to Electric publication';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'entity.identifiable already in Electric publication';
    END;
  ELSE
    RAISE NOTICE 'entity.identifiable does not exist yet - run ECS migrator first';
  END IF;
END $$;

-- entity.temporal - Temporal trait (validity windows)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'entity' AND table_name = 'temporal') THEN
    BEGIN
      ALTER PUBLICATION electric_pub ADD TABLE entity.temporal;
      RAISE NOTICE 'Added entity.temporal to Electric publication';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'entity.temporal already in Electric publication';
    END;
  ELSE
    RAISE NOTICE 'entity.temporal does not exist yet - run ECS migrator first';
  END IF;
END $$;

-- entity.classified - Classification trait (IFF)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'entity' AND table_name = 'classified') THEN
    BEGIN
      ALTER PUBLICATION electric_pub ADD TABLE entity.classified;
      RAISE NOTICE 'Added entity.classified to Electric publication';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'entity.classified already in Electric publication';
    END;
  ELSE
    RAISE NOTICE 'entity.classified does not exist yet - run ECS migrator first';
  END IF;
END $$;

-- =============================================================================
-- Indexes for ICAO24 Lookups (used by FlightEntityMaterializer)
-- =============================================================================

-- Index on identifiable.external_ids for fast ICAO24 lookup
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'entity' AND table_name = 'identifiable') THEN
    CREATE INDEX IF NOT EXISTS idx_identifiable_icao24
      ON entity.identifiable ((external_ids->>'icao24'));
    RAISE NOTICE 'Created idx_identifiable_icao24 index';
  END IF;
END $$;

-- =============================================================================
-- Verification Query
-- =============================================================================

-- List all tables in the Electric publication
SELECT 'Electric publication tables:' AS info;
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'electric_pub'
ORDER BY schemaname, tablename;
