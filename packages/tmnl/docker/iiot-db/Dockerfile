# =============================================================================
# TMNL IIoT Database - Unified PostgreSQL 16 with TimescaleDB + Apache AGE + pg_mooncake
#
# This custom image builds on TimescaleDB HA and adds:
# - Apache AGE for graph queries (asset hierarchy, event causality)
# - pg_mooncake for columnar analytics (historical data, batch queries)
#
# Build: docker build -t tmnl-iiot-db:latest .
# =============================================================================

FROM timescale/timescaledb-ha:pg16-ts2.17

# Switch to root for package installation
USER root

# Build arguments
ARG AGE_VERSION=1.5.0
ARG MOONCAKE_VERSION=0.1.0

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
# Install pg_mooncake (columnar storage)
# Note: pg_mooncake may need to be built from source if binary not available
# =============================================================================

# Option 1: Try pgxn install (if available)
# RUN pgxn install pg_mooncake || echo "pg_mooncake not available via PGXN"

# Option 2: Build from source (fallback - commented out until mooncake releases PG16 binaries)
# RUN git clone --depth 1 https://github.com/Mooncake-Labs/pg_mooncake.git mooncake-src \
#     && cd mooncake-src \
#     && make USE_PGXS=1 PG_CONFIG=/usr/lib/postgresql/16/bin/pg_config install \
#     && cd / && rm -rf /tmp/mooncake-src

# Note: pg_mooncake is experimental - schema will work without it
# The CREATE EXTENSION will fail gracefully if not installed

# =============================================================================
# Clean up build dependencies
# =============================================================================

RUN apt-get remove -y build-essential git flex bison \
    && apt-get autoremove -y \
    && apt-get clean

# =============================================================================
# Copy initialization scripts
# =============================================================================

COPY init.sql /docker-entrypoint-initdb.d/10-iiot-schema.sql

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

# Start postgres with AGE preloaded (alongside timescaledb from base image)
# This eliminates the need for LOAD 'age' in every session/function
CMD ["postgres", "-c", "shared_preload_libraries=timescaledb,age"]
