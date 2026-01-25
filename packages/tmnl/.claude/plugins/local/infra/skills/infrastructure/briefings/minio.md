# MinIO Service

## Purpose

S3-compatible object storage for files, images, and large binary data.

## Configuration

| Property | Value |
|----------|-------|
| Image | `minio/minio:latest` |
| Port | 9000 (API), 9001 (Console) |
| Volume | `minio-data` |
| Health | HTTP /minio/health/live |

## Dependencies

- **None** (independent service)

## Dependents

- File uploads
- Image storage
- Document attachments
- Backup storage

## Ports

| Port | Purpose |
|------|---------|
| 9000 | S3 API |
| 9001 | Web Console |

## Commands

```bash
# View logs
docker compose logs -f minio

# Health check
curl http://localhost:9000/minio/health/live

# Access console
open http://localhost:9001

# List buckets (using mc CLI)
docker compose exec minio mc ls local

# Create bucket
docker compose exec minio mc mb local/uploads

# Upload file
docker compose exec minio mc cp /path/to/file local/uploads/
```

## Web Console

Access at `http://localhost:9001`

Default credentials:
- Username: `minioadmin`
- Password: `minioadmin`

## Environment Variables

```yaml
MINIO_ROOT_USER: minioadmin
MINIO_ROOT_PASSWORD: minioadmin
MINIO_BROWSER_REDIRECT_URL: http://localhost:9001
```

## Health Check

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## S3 API Usage

### TypeScript (aws-sdk)

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
  },
  forcePathStyle: true, // Required for MinIO
})

// Upload
await s3.send(new PutObjectCommand({
  Bucket: 'uploads',
  Key: 'file.txt',
  Body: 'Hello World',
}))

// Download
const response = await s3.send(new GetObjectCommand({
  Bucket: 'uploads',
  Key: 'file.txt',
}))
const content = await response.Body?.transformToString()
```

### Presigned URLs

```typescript
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Generate upload URL (valid 1 hour)
const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({
  Bucket: 'uploads',
  Key: 'file.txt',
}), { expiresIn: 3600 })

// Generate download URL
const downloadUrl = await getSignedUrl(s3, new GetObjectCommand({
  Bucket: 'uploads',
  Key: 'file.txt',
}), { expiresIn: 3600 })
```

## Bucket Policies

### Public Read

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": ["s3:GetObject"],
    "Resource": ["arn:aws:s3:::public/*"]
  }]
}
```

Apply via console or mc:
```bash
docker compose exec minio mc anonymous set download local/public
```

## Common Issues

### Access denied

Check credentials match environment variables:
```bash
docker compose exec minio env | grep MINIO
```

### Bucket not found

Create bucket first:
```bash
docker compose exec minio mc mb local/mybucket
```

### Slow uploads

- Check network between client and MinIO
- Consider multipart uploads for large files
- Adjust chunk size for your network

### Disk space

Check storage:
```bash
docker compose exec minio mc admin info local
```

To clean up:
```bash
# Remove old versions
docker compose exec minio mc rm --recursive --older-than 30d local/uploads
```

## Backup

```bash
# Export bucket
docker compose exec minio mc mirror local/uploads ./backup/

# Import bucket
docker compose exec minio mc mirror ./backup/ local/uploads
```

## Production Considerations

For production:
- Use strong credentials
- Enable TLS
- Configure bucket lifecycle policies
- Set up replication for high availability
- Monitor with Prometheus metrics at `/minio/v2/metrics/cluster`
