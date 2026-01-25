# =============================================================================
# TMNL IIoT Database - PostgreSQL 16 with TimescaleDB + Apache AGE + pg_lake
#
# This custom image builds on TimescaleDB HA and adds:
# - Apache AGE for graph queries (asset hierarchy, event causality)
# - pg_lake for Iceberg analytics (optional - DuckDB-powered)
#
# SCHEMA MANAGEMENT:
#   Schema is managed by Effect SQL Migrator, NOT this image.
#   The init.sql just bootstraps the user - run Migrator separately.
#   See: src/lib/iiot/models/_migrations.ts
#
# Build: docker build -t tmnl-iiot-db:latest .
# =============================================================================

FROM timescale/timescaledb-ha:pg16-ts2.17

# Switch to root for package installation
USER root

# Build arguments
ARG AGE_VERSION=1.5.0

# Install build dependencies (including PostgreSQL dev headers for extension compilation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    libreadline-dev \
    zlib1g-dev \
    flex \
    bison \
    wget \
    ca-certificates \
    postgresql-server-dev-16 \
    && rm -rf /var/lib/apt/lists/*

# =============================================================================
# Build and install Apache AGE
# =============================================================================

WORKDIR /tmp

# Clone and build Apache AGE
RUN git clone --branch release/PG16/${AGE_VERSION} --depth 1 \
    https://github.com/apache/age.git age-src \
    && cd age-src \
    && make USE_PGXS=1 PG_CONFIG=/usr/lib/postgresql/16/bin/pg_config install \
    && cd / && rm -rf /tmp/age-src

# =============================================================================
# pg_lake (Iceberg analytics - optional)
#
# pg_lake provides Iceberg table support with DuckDB-powered queries.
# Requires: shared_preload_libraries = 'pg_extension_base'
#
# Currently not built into this image - CREATE EXTENSION will fail gracefully.
# To enable, add pg_lake to shared_preload_libraries in CMD below.
#
# Reference: https://github.com/Snowflake-Labs/pg_lake
# =============================================================================

# Note: pg_lake is optional - schema will work without it
# The CREATE EXTENSION will fail gracefully if not installed

# =============================================================================
# Clean up build dependencies
# =============================================================================

RUN apt-get remove -y build-essential git flex bison \
    && apt-get autoremove -y \
    && apt-get clean

# =============================================================================
# Copy bootstrap script
# =============================================================================

# init.sql is minimal - just creates user context
# All schema DDL is managed by Effect SQL Migrator
COPY init.sql /docker-entrypoint-initdb.d/10-iiot-bootstrap.sql

# Switch back to postgres user
USER postgres

# Set default environment
ENV POSTGRES_USER=iiot
ENV POSTGRES_PASSWORD=iiot_dev
ENV POSTGRES_DB=iiot_mock
ENV TIMESCALEDB_TELEMETRY=off

# Expose PostgreSQL port
EXPOSE 5432

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
    CMD pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB} || exit 1

# Start postgres with extensions preloaded
# - timescaledb: Time-series hypertables
# - age: Apache AGE graph queries
# Note: Add pg_extension_base here when pg_lake is installed
CMD ["postgres", "-c", "shared_preload_libraries=timescaledb,age"]
