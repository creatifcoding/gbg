# TMNL Durable Streams Server
#
# HTTP API for persistent, resumable byte streams with offset-based replay.
# Based on Electric SQL's durable-streams protocol.
#
# Build: docker build -t tmnl/durable-streams ./docker/durable-streams
# Run:   docker run -p 3030:3030 -v durable-data:/data tmnl/durable-streams

FROM node:22-alpine

LABEL org.opencontainers.image.title="TMNL Durable Streams Server"
LABEL org.opencontainers.image.description="Persistent stream primitive for real-time sync"
LABEL org.opencontainers.image.source="https://github.com/durable-streams/durable-streams"

WORKDIR /app

# Install durable-streams server package
RUN npm install @durable-streams/server@^0.1.0

# Copy server script
COPY --chown=node:node server.mjs ./server.mjs

# Create data directory for persistence
RUN mkdir -p /data && chown -R node:node /data /app

# Run as non-root user
USER node

# Default environment
ENV PORT=3030
ENV HOST=0.0.0.0
ENV DATA_DIR=/data
ENV LONG_POLL_TIMEOUT=30000

EXPOSE 3030

# Health check endpoint (HEAD on any stream returns 404 if not found, which is fine)
HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=5s \
  CMD wget -q --spider http://localhost:3030/v1/stream/__health__ || exit 0

CMD ["node", "server.mjs"]
