//! # NATS Ingestion — Authenticated Sensor Data Bridge
//!
//! Full-stack ava-web application wiring NATS bridge with macaroon auth:
//!
//! ## Authenticated Routes (require `Authorization: Bearer <token>`)
//!
//! - `POST /api/v1/sensor/:kind/:source/:format` — sensor ingest → NATS publish
//! - `POST /api/v1/ctl/:component/:command`       — control plane → NATS request-reply
//! - `GET  /api/v1/fusion/:tier/:entity_class`     — fusion stream → SSE
//!
//! ## Public Routes (no auth required)
//!
//! - `GET  /ws/ingest/:kind`  — WebSocket ingest (upgrade + server-level recv loop)
//! - `GET  /health`           — health check
//! - `POST /api/v1/token`     — mint a device token (demo only)
//!
//! # NATS Subject Taxonomy (AVA-RFC-001)
//!
//! ```text
//! sensor.{kind}.{source}.{format}     — inbound sensor data
//! fusion.{tier}.{entity_class}.results — fusion output
//! ctl.{component}.{command}            — control plane
//! ```
//!
//! # Run
//!
//! ```bash
//! cargo run --example nats_ingestion
//! ```
//!
//! # Test
//!
//! ```bash
//! # 1. Mint a device token (demo endpoint, no auth required)
//! TOKEN=$(curl -s -X POST http://127.0.0.1:3000/api/v1/token | jq -r .bearer)
//!
//! # 2. Sensor ingest (authenticated)
//! curl -X POST http://127.0.0.1:3000/api/v1/sensor/adsb/opensky/json \
//!   -H "Authorization: $TOKEN" \
//!   -H 'Content-Type: application/json' \
//!   -d '{"icao":"A12345","lat":40.7,"lon":-74.0}'
//!
//! # 3. Without auth → 401
//! curl -v http://127.0.0.1:3000/api/v1/fusion/tier1/aircraft
//!
//! # 4. Health check (always public)
//! curl http://127.0.0.1:3000/health
//!
//! # 5. WebSocket ingest (public, no auth header needed)
//! # wscat -c ws://127.0.0.1:3000/ws/ingest/radar
//! ```

use std::sync::Arc;

use ava_web::auth::{MacaroonAuth, MacaroonIssuer, token_to_bearer};
use ava_web::handler::{FnHandler, FnHandler1, FnHandler3};
use ava_web::middleware::Logger;
use ava_web::nats_bridge::{
    control_plane_handler, fusion_stream_handler, sensor_ingest_handler, ws_ingest_handler,
    NatsClientWrapper, NatsState, PathParams,
};
use ava_web::response::Json;
use ava_web::extractor::{RawBody, State};
use ava_web::ws::WebSocketUpgrade;
use ava_web::{get, Router};
use ava_web::router;

// ── Shared Issuer ───────────────────────────────────────────────────────

/// Arc-wrapped issuer for sharing across handlers.
///
/// `MacaroonIssuer` doesn't implement Clone (the root key is sensitive),
/// so we wrap in Arc for state injection.
#[derive(Clone)]
struct SharedIssuer(Arc<MacaroonIssuer>);

// ── Handlers ────────────────────────────────────────────────────────────

/// Health check — always public, no auth required.
fn health() -> &'static str {
    r#"{"status":"ok","bridge":"nats","auth":"macaroon","version":"0.2.0"}"#
}

/// Token minting endpoint (demo only).
///
/// In production, this would be behind its own auth (e.g., mTLS, API key)
/// or issued out-of-band. Here it's public for demonstration purposes.
fn mint_token(State(issuer): State<SharedIssuer>) -> Json<serde_json::Value> {
    let token = issuer
        .0
        .mint()
        .time_before(u64::MAX) // Never expires (demo)
        .resource_scope("/api/**") // Full API access
        .finish();

    let bearer = token_to_bearer(&token);

    Json(serde_json::json!({
        "bearer": bearer,
        "caveats": ["time_before(MAX)", "resource_scope(/api/**)"],
        "note": "Demo token — in production, use out-of-band issuance"
    }))
}

// ── Main ────────────────────────────────────────────────────────────────

fn main() {
    // --- Step 1: Root key + Issuer ---
    //
    // In production, the root key comes from a secure vault (e.g., HashiCorp
    // Vault, AWS KMS). Here we use a deterministic seed for reproducibility.
    let root_key = asupersync::security::AuthKey::from_seed(42);
    let issuer = SharedIssuer(Arc::new(
        MacaroonIssuer::new(root_key.clone(), "ava-sensor-api", "ava-web"),
    ));

    // --- Step 2: NATS connection ---
    //
    // In production:
    //   let cx = Cx::new();
    //   let client = NatsClient::connect(&cx, "nats://127.0.0.1:4222").await?;
    //   let nats_state = NatsState::from_client(client);
    //
    // For this example, we use the logging-only wrapper.
    let nats_state = NatsState::new(NatsClientWrapper::default());

    // --- Step 3: Build authenticated API routes ---
    //
    // These routes require a valid macaroon token in the Authorization header.
    // MacaroonAuth middleware validates the HMAC chain and all caveats before
    // the handler runs. Middleware is scoped to this router only.
    let auth = MacaroonAuth::new(root_key);

    let api_routes = Router::new()
        .route(
            "/api/v1/sensor/:kind/:source/:format",
            router::post(FnHandler3::<
                _,
                State<NatsState>,
                PathParams,
                RawBody,
            >::new(sensor_ingest_handler)),
        )
        .route(
            "/api/v1/ctl/:component/:command",
            router::post(FnHandler3::<
                _,
                State<NatsState>,
                PathParams,
                RawBody,
            >::new(control_plane_handler)),
        )
        .route(
            "/api/v1/fusion/:tier/:entity_class",
            router::get(FnHandler1::<_, PathParams>::new(fusion_stream_handler)),
        )
        .with_state(nats_state.clone())
        .layer(auth);

    // --- Step 4: Build public routes ---
    //
    // Health check and WebSocket ingest don't require auth.
    // Token minting is also public (demo only — production would gate this).
    //
    // The WS handler needs NatsState, and the token endpoint needs SharedIssuer.
    // Since with_state() injects a single type, we build two separate routers
    // and merge them.
    let ws_routes = Router::new()
        .route(
            "/ws/ingest/:kind",
            router::get(FnHandler3::<
                _,
                State<NatsState>,
                PathParams,
                WebSocketUpgrade,
            >::new(ws_ingest_handler)),
        )
        .with_state(nats_state);

    let token_routes = Router::new()
        .route(
            "/api/v1/token",
            router::post(FnHandler1::<_, State<SharedIssuer>>::new(mint_token)),
        )
        .with_state(issuer.clone());

    // --- Step 5: Compose the application ---
    //
    // Merge authenticated and public routes. Logger wraps everything.
    //
    // Route scoping:
    //   - api_routes: MacaroonAuth middleware (HMAC verification)
    //   - ws_routes:  No auth (WebSocket upgrade via RFC 6455 headers)
    //   - token_routes: No auth (demo token minting)
    //   - /health:    No auth
    let app = Router::new()
        .route("/health", get(FnHandler::new(health)))
        .merge(api_routes)
        .merge(ws_routes)
        .merge(token_routes)
        .layer(Logger);

    // --- Step 6: Print startup info ---
    //
    // Mint a sample token for immediate testing.
    let sample_token = issuer
        .0
        .mint()
        .time_before(u64::MAX)
        .resource_scope("/api/**")
        .finish();
    let sample_bearer = token_to_bearer(&sample_token);

    println!("NATS ingestion bridge on http://127.0.0.1:3000");
    println!();
    println!("Authenticated routes (require Bearer token):");
    println!("  POST /api/v1/sensor/:kind/:source/:format  — sensor ingest → NATS publish");
    println!("  POST /api/v1/ctl/:component/:command        — control plane → NATS request-reply");
    println!("  GET  /api/v1/fusion/:tier/:entity_class     — fusion stream → SSE");
    println!();
    println!("Public routes:");
    println!("  GET  /ws/ingest/:kind                      — WebSocket ingest → NATS publish");
    println!("  GET  /health                                — health check");
    println!("  POST /api/v1/token                          — mint device token (demo)");
    println!();
    println!("Sample bearer token:");
    println!("  {}", &sample_bearer);
    println!();
    println!("Valid signal kinds: adsb, radar, ais, elint, comint, ir, eo, acoustic, seismic, weather");
    println!();
    println!("Quick test:");
    println!("  # Mint token");
    println!("  TOKEN=$(curl -s -X POST http://127.0.0.1:3000/api/v1/token | jq -r .bearer)");
    println!();
    println!("  # Authenticated sensor ingest");
    println!("  curl -X POST http://127.0.0.1:3000/api/v1/sensor/adsb/opensky/json \\");
    println!("    -H \"Authorization: $TOKEN\" \\");
    println!("    -d '{{\"icao\":\"A12345\"}}'");

    let rt = asupersync::runtime::RuntimeBuilder::current_thread()
        .build()
        .expect("failed to build runtime");
    let server = rt.block_on(async {
        ava_web::HttpServer::bind("127.0.0.1:3000")
            .await
            .expect("failed to bind")
    });
    drop(rt);
    let _ = server.serve(app);
}
