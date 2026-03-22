# AVA REST API Design

## Transport Strategy

**Primary**: gRPC via Cosmo Connect (protobuf, streaming)
**Secondary**: REST/JSON via gRPC-Gateway (auto-generated)

REST endpoints are automatically derived from the proto definitions using gRPC-Gateway annotations. This ensures consistency between gRPC and REST APIs.

## Base URL

```
https://api.tmnl.dev/ava/v1
```

## Discovery Endpoints

### List Sources

```http
GET /sources
```

**Response:**
```json
{
  "sources": [
    {
      "id": "assets-db",
      "name": "Assets Database",
      "description": "Primary asset storage",
      "kind": "SOURCE_KIND_SQL",
      "connected": true,
      "schema": {
        "tables": [
          {
            "name": "assets",
            "columns": [
              { "name": "id", "dataType": "Utf8", "nullable": false },
              { "name": "name", "dataType": "Utf8", "nullable": true },
              { "name": "value", "dataType": "Float64", "nullable": true }
            ]
          }
        ],
        "defaultTable": "assets"
      },
      "capabilities": {
        "sqlQuery": true,
        "filtering": true,
        "projection": true,
        "aggregation": true,
        "joins": true,
        "windowFunctions": false,
        "streaming": false,
        "writable": false
      },
      "tags": {
        "env": "production"
      }
    }
  ]
}
```

### Get Source

```http
GET /sources/{sourceId}
```

**Path Parameters:**
- `sourceId` (required): Source identifier

**Response:** Single `SourceDescriptor` object

### Get Source Schema

```http
GET /sources/{sourceId}/schema
GET /sources/{sourceId}/schema?tableName=assets
```

**Query Parameters:**
- `tableName` (optional): Filter to specific table

**Response:** `SourceSchema` object

### Get Source Capabilities

```http
GET /sources/{sourceId}/capabilities
```

**Response:** `SourceCapabilities` object

## Execution Endpoints

### Execute Spec

```http
POST /execute
```

**Request Body:**
```json
{
  "spec": {
    "id": "user-view-1",
    "name": "Active Fleet by Site",
    "channels": [
      {
        "id": "state",
        "role": "CHANNEL_ROLE_STATE",
        "source": {
          "id": "assets-db",
          "kind": "SOURCE_KIND_SQL",
          "connection": ""
        },
        "pipeline": [
          { "filter": { "predicate": "status = 'active'" } },
          { "project": { "columns": ["id", "name", "site_id", "value"] } },
          {
            "aggregate": {
              "groupBy": ["site_id"],
              "aggregates": [
                { "function": "sum", "column": "value", "alias": "total" }
              ]
            }
          }
        ],
        "materialization": "MATERIALIZATION_TIER_ON_DEMAND"
      }
    ],
    "version": 1
  },
  "outputFormat": "OUTPUT_FORMAT_JSON"
}
```

**Success Response (200):**
```json
{
  "success": {
    "data": "[{\"site_id\":\"site-1\",\"total\":1250.5},{\"site_id\":\"site-2\",\"total\":890.0}]",
    "rowCount": 2,
    "executionTimeMs": 45
  }
}
```

**Validation Error Response (400):**
```json
{
  "failure": {
    "errors": [
      {
        "columnNotFound": {
          "column": "statuz",
          "sourceId": "assets-db",
          "availableColumns": ["id", "name", "status", "value"],
          "location": {
            "channelId": "state",
            "pipelineIndex": 0,
            "field": "predicate"
          }
        }
      }
    ]
  }
}
```

### Compile Spec (Debug)

```http
POST /compile
```

**Request Body:** Same as `/execute`, without `outputFormat`

**Success Response (200):**
```json
{
  "success": {
    "sql": "SELECT site_id, SUM(value) as total FROM assets WHERE status = 'active' GROUP BY site_id",
    "logicalPlan": "Aggregate: groupBy=[site_id], aggr=[SUM(value) AS total]\n  Filter: status = 'active'\n    TableScan: assets"
  }
}
```

**Validation Error Response (400):** Same as `/execute`

### Subscribe to View (WebSocket)

```
WS /views/{viewId}/subscribe?outputFormat=OUTPUT_FORMAT_JSON
```

**Connection Upgrade:**
```http
GET /views/{viewId}/subscribe HTTP/1.1
Upgrade: websocket
Connection: Upgrade
```

**Server Messages:**
```json
// Data message
{ "data": "<base64 or JSON>" }

// Error message
{ "error": { "message": "Source disconnected", "code": "SOURCE_ERROR" } }

// Complete message
{ "complete": { "totalRows": 1000 } }
```

## Registry Endpoints

### List Templates

```http
GET /templates
```

**Response:**
```json
{
  "templates": [
    {
      "id": "tmpl-001",
      "name": "Fleet Overview",
      "description": "Standard fleet monitoring view",
      "createdAt": "2025-12-11T15:30:00Z",
      "updatedAt": "2025-12-11T16:00:00Z",
      "version": 3,
      "tags": ["fleet", "monitoring"]
    }
  ]
}
```

### Get Template

```http
GET /templates/{templateId}
```

**Response:** Full `ViewProfileSpec` object

### Save Spec as Template

```http
POST /templates
```

**Request Body:**
```json
{
  "spec": { /* ViewProfileSpec */ },
  "description": "Fleet monitoring with drill-down",
  "tags": ["fleet", "monitoring"]
}
```

**Response:**
```json
{
  "templateId": "tmpl-002",
  "version": 1
}
```

### Delete Template

```http
DELETE /templates/{templateId}
```

**Response:** 204 No Content

### List Assemblages

```http
GET /assemblages
```

### Get Assemblage

```http
GET /assemblages/{assemblageId}
```

### Save Assemblage

```http
POST /assemblages
PUT /assemblages/{assemblageId}
```

### Delete Assemblage

```http
DELETE /assemblages/{assemblageId}
```

## Content Types

| Format | Content-Type | Use Case |
|--------|--------------|----------|
| JSON | `application/json` | Default, human-readable |
| Arrow IPC | `application/vnd.apache.arrow.stream` | Efficient binary for large datasets |
| Protobuf | `application/x-protobuf` | gRPC-compatible binary |

Request `outputFormat` or `Accept` header determines response format.

## Error Responses

### Standard Error Format

All errors follow this structure:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Spec validation failed",
  "details": [
    {
      "type": "columnNotFound",
      "column": "statuz",
      "sourceId": "assets-db",
      "availableColumns": ["id", "name", "status"],
      "location": {
        "channelId": "state",
        "pipelineIndex": 0,
        "field": "predicate"
      }
    }
  ]
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Validation error (invalid spec) |
| 404 | Source/template/assemblage not found |
| 500 | Internal server error |
| 503 | Source unavailable |

## gRPC-Gateway Annotations

The REST API is generated from proto definitions with these annotations:

```protobuf
import "google/api/annotations.proto";

service DiscoveryService {
  rpc ListSources(google.protobuf.Empty) returns (ListSourcesResponse) {
    option (google.api.http) = {
      get: "/v1/sources"
    };
  }

  rpc GetSource(GetSourceRequest) returns (SourceDescriptor) {
    option (google.api.http) = {
      get: "/v1/sources/{source_id}"
    };
  }
}

service ExecutionService {
  rpc ExecuteSpec(ExecuteSpecRequest) returns (ExecuteSpecResponse) {
    option (google.api.http) = {
      post: "/v1/execute"
      body: "*"
    };
  }
}
```

## Implementation Notes

1. **gRPC-Gateway** generates REST endpoints from proto annotations
2. **Cosmo Router** provides both GraphQL and REST gateways
3. **Arrow IPC** responses use streaming for large datasets
4. **WebSocket** for subscriptions maps to gRPC streaming

## Axum Route Implementation

For direct Axum implementation (bypassing gRPC-Gateway):

```rust
use axum::{
    routing::{get, post, delete},
    Router,
    extract::{Path, Query, State, Json},
};

pub fn router() -> Router {
    Router::new()
        // Discovery
        .route("/sources", get(list_sources))
        .route("/sources/:source_id", get(get_source))
        .route("/sources/:source_id/schema", get(get_schema))
        .route("/sources/:source_id/capabilities", get(get_capabilities))
        // Execution
        .route("/execute", post(execute_spec))
        .route("/compile", post(compile_spec))
        // Registry
        .route("/templates", get(list_templates).post(save_template))
        .route("/templates/:id", get(get_template).delete(delete_template))
        .route("/assemblages", get(list_assemblages).post(save_assemblage))
        .route("/assemblages/:id", get(get_assemblage).delete(delete_assemblage))
}
```

## WebSocket Handler

```rust
use axum::{
    extract::{ws::WebSocket, WebSocketUpgrade, Path, Query},
    response::Response,
};

async fn subscribe_view(
    ws: WebSocketUpgrade,
    Path(view_id): Path<String>,
    Query(params): Query<SubscribeParams>,
) -> Response {
    ws.on_upgrade(move |socket| handle_subscription(socket, view_id, params))
}

async fn handle_subscription(mut socket: WebSocket, view_id: String, params: SubscribeParams) {
    // Bridge to gRPC streaming
    let stream = execution_client.subscribe_view(view_id, params.output_format).await;

    while let Some(update) = stream.next().await {
        let msg = serde_json::to_string(&update).unwrap();
        if socket.send(Message::Text(msg)).await.is_err() {
            break;
        }
    }
}
```
