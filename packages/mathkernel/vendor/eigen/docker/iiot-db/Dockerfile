# =============================================================================
# TMNL IIoT Database - PostgreSQL 16 with TimescaleDB + Apache AGE + pg_lake
#
# This custom image builds on TimescaleDB HA and adds:
# - Apache AGE for graph queries (asset hierarchy, event causality)
# - pg_lake for Iceberg analytics (DuckDB-powered, S3/MinIO storage)
#
# SCHEMA MANAGEMENT:
#   Schema is managed by Effect SQL Migrator, NOT this image.
#   The init.sql just bootstraps the user - run Migrator separately.
#   See: src/lib/iiot/models/_migrations.ts
#
# Build: docker build -t tmnl-iiot-db:latest .
# Build time: ~15-20 minutes (DuckDB compilation is slow)
# =============================================================================

FROM timescale/timescaledb-ha:pg16-ts2.17

# Switch to root for package installation
USER root

# Build arguments
ARG AGE_VERSION=1.5.0
ARG PG_CONFIG=/usr/lib/postgresql/16/bin/pg_config

# =============================================================================
# Install ALL build dependencies upfront
# =============================================================================

RUN apt-get update && apt-get install -y --no-install-recommends \
    # Basic build tools
    build-essential \
    git \
    cmake \
    ninja-build \
    pkg-config \
    # PostgreSQL dev
    postgresql-server-dev-16 \
    # AGE dependencies
    libreadline-dev \
    zlib1g-dev \
    flex \
    bison \
    # pg_lake / DuckDB dependencies
    libssl-dev \
    libcurl4-openssl-dev \
    libxml2-dev \
    libxslt1-dev \
    libicu-dev \
    liblz4-dev \
    libzstd-dev \
    liblzma-dev \
    libsnappy-dev \
    libjansson-dev \
    uuid-dev \
    libjson-c-dev \
    libkrb5-dev \
    # vcpkg dependencies
    curl \
    zip \
    unzip \
    tar \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /tmp

# =============================================================================
# Build and install Apache AGE
# =============================================================================

RUN git clone --branch release/PG16/${AGE_VERSION} --depth 1 \
    https://github.com/apache/age.git age-src \
    && cd age-src \
    && make USE_PGXS=1 PG_CONFIG=${PG_CONFIG} install \
    && cd / && rm -rf /tmp/age-src

# =============================================================================
# Install vcpkg for pg_lake Azure SDK dependencies
# =============================================================================

ENV VCPKG_ROOT=/opt/vcpkg
ENV VCPKG_TOOLCHAIN_PATH=${VCPKG_ROOT}/scripts/buildsystems/vcpkg.cmake

RUN git clone --depth 1 https://github.com/microsoft/vcpkg.git ${VCPKG_ROOT} \
    && ${VCPKG_ROOT}/bootstrap-vcpkg.sh -disableMetrics \
    && ${VCPKG_ROOT}/vcpkg install \
        azure-identity-cpp \
        azure-storage-blobs-cpp \
        azure-storage-files-datalake-cpp \
        openssl \
    && rm -rf ${VCPKG_ROOT}/buildtrees ${VCPKG_ROOT}/downloads ${VCPKG_ROOT}/packages

# =============================================================================
# Build and install pg_lake (DuckDB-powered Iceberg analytics)
# =============================================================================

ENV PATH="${PG_CONFIG%/*}:${PATH}"

RUN git clone --recurse-submodules --depth 1 \
    https://github.com/Snowflake-Labs/pg_lake.git pg_lake-src \
    && cd pg_lake-src \
    && make install \
    && cd / && rm -rf /tmp/pg_lake-src

# Copy pgduck_server to a stable location
RUN mkdir -p /usr/local/bin \
    && cp /usr/lib/postgresql/16/bin/pgduck_server /usr/local/bin/ 2>/dev/null || true

# =============================================================================
# Clean up build dependencies (keep runtime libs)
# =============================================================================

RUN apt-get remove -y \
    build-essential \
    cmake \
    ninja-build \
    git \
    flex \
    bison \
    pkg-config \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf ${VCPKG_ROOT}

# =============================================================================
# Copy bootstrap script
# =============================================================================

# init.sql is minimal - just creates user context
# All schema DDL is managed by Effect SQL Migrator
COPY init.sql /docker-entrypoint-initdb.d/10-iiot-bootstrap.sql

# Copy pgduck_server startup script
COPY start-pgduck.sh /usr/local/bin/start-pgduck.sh
RUN chmod +x /usr/local/bin/start-pgduck.sh

# Switch back to postgres user
USER postgres

# Set default environment
ENV POSTGRES_USER=iiot
ENV POSTGRES_PASSWORD=iiot_dev
ENV POSTGRES_DB=iiot_mock
ENV TIMESCALEDB_TELEMETRY=off

# pgduck_server config
ENV PGDUCK_SOCKET_DIR=/tmp
ENV PGDUCK_PORT=5332

# Expose PostgreSQL port
EXPOSE 5432

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
    CMD pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB} || exit 1

# Start postgres with extensions preloaded
# - timescaledb: Time-series hypertables
# - age: Apache AGE graph queries
# - pg_extension_base: Required for pg_lake
CMD ["postgres", "-c", "shared_preload_libraries=timescaledb,age,pg_extension_base"]
