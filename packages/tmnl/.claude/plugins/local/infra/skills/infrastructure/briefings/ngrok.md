# Ngrok Service

## Purpose

Secure tunneling for remote access. Exposes local services to the internet for testing, demos, and mobile development.

## Configuration

| Property | Value |
|----------|-------|
| Image | `ngrok/ngrok:latest` |
| Port | 4040 (inspector) |
| Config | `docker/ngrok/ngrok.yml` |
| Health | HTTP inspector |

## Dependencies

- Services being tunneled (e.g., Tauri dev server)

## Dependents

- Mobile app testing
- Webhook receivers
- External API callbacks
- Demo/presentation access

## Commands

```bash
# View logs
docker compose logs -f ngrok

# Check tunnel status
curl http://localhost:4040/api/tunnels

# Open web inspector
open http://localhost:4040
```

## Web Inspector

Access at `http://localhost:4040`

Features:
- Active tunnel URLs
- Request/response inspector
- Replay requests
- Traffic metrics

## Configuration File

Located at `docker/ngrok/ngrok.yml`:

```yaml
version: 2
authtoken: YOUR_AUTHTOKEN

tunnels:
  tmnl:
    proto: http
    addr: host.docker.internal:1420
    inspect: true

  api:
    proto: http
    addr: host.docker.internal:3030
    inspect: true
```

## Environment Variables

```yaml
NGROK_AUTHTOKEN: your-auth-token
```

Get authtoken from https://dashboard.ngrok.com/auth

## Tunnel Types

| Proto | Use Case |
|-------|----------|
| `http` | Web apps, APIs |
| `tcp` | Database, SSH |
| `tls` | HTTPS with custom domain |

## API

### List Tunnels

```bash
curl http://localhost:4040/api/tunnels | jq
```

Response:
```json
{
  "tunnels": [{
    "name": "tmnl",
    "public_url": "https://abc123.ngrok.io",
    "proto": "https",
    "config": {
      "addr": "host.docker.internal:1420"
    }
  }]
}
```

### Get Tunnel URL Programmatically

```typescript
const response = await fetch('http://localhost:4040/api/tunnels')
const { tunnels } = await response.json()
const publicUrl = tunnels[0].public_url
```

## Common Issues

### Tunnel not starting

1. Check authtoken is set:
   ```bash
   docker compose exec ngrok env | grep NGROK
   ```

2. Check config file syntax:
   ```bash
   docker compose exec ngrok ngrok config check
   ```

### "host.docker.internal" not resolving

On Linux, add to docker-compose.yml:
```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

### Rate limited (free tier)

Free tier limits:
- 1 online tunnel
- Random URLs
- 40 connections/minute

Upgrade for:
- Custom domains
- Multiple tunnels
- Higher rate limits

### Connection timeout

Check target service is running:
```bash
curl http://localhost:1420
```

## Security

### For Development Only

Ngrok exposes local services publicly. For dev:
- Use random URLs (don't share widely)
- Enable basic auth if needed
- Disable when not in use

### Basic Auth

```yaml
tunnels:
  tmnl:
    proto: http
    addr: host.docker.internal:1420
    auth: "user:password"
```

### IP Restrictions (paid)

```yaml
tunnels:
  tmnl:
    proto: http
    addr: host.docker.internal:1420
    ip_restriction:
      allow_cidrs:
        - "192.168.1.0/24"
```

## Webhook Development

For testing webhooks (Stripe, GitHub, etc.):

1. Start ngrok tunnel
2. Get public URL from inspector
3. Configure webhook URL in external service
4. Monitor requests in inspector
5. Replay failed requests as needed

## Alternative: SSH Tunnel

For simpler needs without ngrok:

```bash
# Requires SSH service running
ssh -R 80:localhost:1420 serveo.net
```
