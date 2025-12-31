#!/bin/bash
# ngrok-notify: Query ngrok tunnels and send notifications
#
# This script:
#   1. Waits for ngrok to be ready
#   2. Queries the ngrok API for tunnel URLs
#   3. Sends a Telegram notification with the URLs
#   4. Stores URLs in NATS KV for persistence
#
# Environment variables required:
#   TELEGRAM_BOT_TOKEN - Telegram bot token from @BotFather
#   TELEGRAM_CHAT_ID   - Your Telegram chat ID
#   NGROK_API_URL      - ngrok API endpoint (default: http://ngrok:4040)
#   NATS_URL           - NATS server URL (default: nats://nats:4222)

set -e

# Configuration
NGROK_API_URL="${NGROK_API_URL:-http://ngrok:4040}"
NATS_URL="${NATS_URL:-nats://nats:4222}"
MAX_RETRIES=30
RETRY_DELAY=2

echo "🚀 ngrok-notify starting..."
echo "   NGROK_API_URL: $NGROK_API_URL"
echo "   NATS_URL: $NATS_URL"

# Wait for ngrok to be ready
echo "⏳ Waiting for ngrok API to be available..."
retries=0
until curl -sf "${NGROK_API_URL}/api/tunnels" > /dev/null 2>&1; do
  retries=$((retries + 1))
  if [ $retries -ge $MAX_RETRIES ]; then
    echo "❌ Timeout waiting for ngrok API"
    exit 1
  fi
  echo "   Retry $retries/$MAX_RETRIES..."
  sleep $RETRY_DELAY
done
echo "✅ ngrok API is ready"

# Fetch tunnel information
echo "🔍 Fetching tunnel URLs..."
TUNNELS=$(curl -sf "${NGROK_API_URL}/api/tunnels")

# Parse tunnel URLs using jq
SSH_URL=$(echo "$TUNNELS" | jq -r '.tunnels[] | select(.name == "ssh") | .public_url // empty')
TMNL_URL=$(echo "$TUNNELS" | jq -r '.tunnels[] | select(.name == "tmnl") | .public_url // empty')

# If names don't match, try by proto
if [ -z "$SSH_URL" ]; then
  SSH_URL=$(echo "$TUNNELS" | jq -r '.tunnels[] | select(.proto == "tcp") | .public_url // empty' | head -1)
fi
if [ -z "$TMNL_URL" ]; then
  TMNL_URL=$(echo "$TUNNELS" | jq -r '.tunnels[] | select(.proto == "https" or .proto == "http") | .public_url // empty' | head -1)
fi

echo "📡 Tunnel URLs:"
echo "   SSH:  ${SSH_URL:-NOT FOUND}"
echo "   TMNL: ${TMNL_URL:-NOT FOUND}"

# Build notification message
HOSTNAME=$(hostname)
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")

MESSAGE="🖥️ *TMNL Tunnels Active*

📅 \`${TIMESTAMP}\`
🏠 Host: \`${HOSTNAME}\`

*SSH Access (Termius):*
\`${SSH_URL:-❌ Not available}\`

*Web App:*
${TMNL_URL:-❌ Not available}

_Tunnels regenerate on restart_"

# Send Telegram notification
if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
  echo "📱 Sending Telegram notification..."

  RESPONSE=$(curl -sf -X POST \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{
      \"chat_id\": \"${TELEGRAM_CHAT_ID}\",
      \"text\": $(echo "$MESSAGE" | jq -Rs .),
      \"parse_mode\": \"Markdown\",
      \"disable_web_page_preview\": true
    }" 2>&1) || true

  if echo "$RESPONSE" | jq -e '.ok == true' > /dev/null 2>&1; then
    echo "✅ Telegram notification sent"
  else
    echo "⚠️  Telegram notification failed: $RESPONSE"
  fi
else
  echo "⚠️  Telegram credentials not configured, skipping notification"
fi

# Store in NATS KV (if nats CLI available)
if command -v nats &> /dev/null; then
  echo "💾 Storing URLs in NATS KV..."

  # Create KV bucket if not exists
  nats kv add ngrok_tunnels --server="$NATS_URL" 2>/dev/null || true

  # Store tunnel data as JSON
  TUNNEL_DATA=$(jq -n \
    --arg ssh "$SSH_URL" \
    --arg tmnl "$TMNL_URL" \
    --arg timestamp "$TIMESTAMP" \
    '{ssh: $ssh, tmnl: $tmnl, timestamp: $timestamp}')

  echo "$TUNNEL_DATA" | nats kv put ngrok_tunnels current --server="$NATS_URL" - 2>/dev/null && \
    echo "✅ Stored in NATS KV (bucket: ngrok_tunnels, key: current)" || \
    echo "⚠️  Failed to store in NATS KV"
else
  echo "⚠️  nats CLI not available, skipping KV storage"
fi

# Write to local file as fallback
echo "📝 Writing to /tmp/ngrok-tunnels.json..."
jq -n \
  --arg ssh "$SSH_URL" \
  --arg tmnl "$TMNL_URL" \
  --arg timestamp "$TIMESTAMP" \
  '{ssh: $ssh, tmnl: $tmnl, timestamp: $timestamp}' > /tmp/ngrok-tunnels.json

echo ""
echo "🎉 ngrok-notify complete!"
echo ""
echo "Quick connect:"
echo "  SSH:  ssh -p $(echo "$SSH_URL" | grep -oP ':\K\d+') prime@$(echo "$SSH_URL" | grep -oP 'tcp://\K[^:]+' || echo 'HOSTNAME')"
echo "  Web:  $TMNL_URL"
