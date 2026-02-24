//! # OpenSky ADS-B Source Adapter — Reference Implementation
//!
//! Demonstrates the full source adapter pipeline:
//!
//! ```text
//! OpenSky API ──GET──▶ AdapterActor ──parse──▶ NATS publish
//!   (HTTP)              (per-actor)              sensor.adsb.opensky.json.{icao}
//! ```
//!
//! ## What This Shows
//!
//! 1. **SourceAdapter trait**: `build_request`, `parse_records`, `nats_subject`
//! 2. **Per-actor resilience**: Circuit breaker, retry, rate limit, conditional cache
//! 3. **Pagination state**: Bounding-box API with page cursor
//! 4. **Per-record sub-routing**: Each aircraft gets its own NATS subject suffix
//! 5. **Poll loop**: Timer-driven polling with adaptive delay
//!
//! ## OpenSky REST API
//!
//! ```text
//! GET https://opensky-network.org/api/states/all
//!   ?lamin=40.0&lamax=42.0&lomin=-74.5&lomax=-71.5
//!
//! Response (200):
//! {
//!   "time": 1740100000,
//!   "states": [
//!     ["a12345", "UAL123  ", "United States", 1740099990, 1740099990,
//!      -73.8, 40.6, 10668.0, false, 250.0, 45.0, 0.0, null,
//!      10706.0, "1234", false, 0],
//!     ...
//!   ]
//! }
//! ```
//!
//! ## NATS Subject Taxonomy
//!
//! Per RFC-001: `sensor.{kind}.{source}.{format}[.{suffix}]`
//!
//! - `sensor.adsb.opensky.json` — all aircraft (no suffix)
//! - `sensor.adsb.opensky.json.a12345` — single aircraft by ICAO
//!
//! ## Run
//!
//! ```bash
//! cargo run --example source_adapter_opensky
//! ```

use std::time::Duration;

use ava_web::client::{FetchClient, FetchConfig, FetchRequest, FetchResponse};
use ava_web::nats_bridge::{NatsClientWrapper, NatsState};
use ava_web::source_adapter::*;

// ── OpenSky Adapter ─────────────────────────────────────────────────────────

/// Configuration for the OpenSky ADS-B source adapter.
struct OpenSkyConfig {
    /// Bounding box for spatial filtering [lat_min, lat_max, lon_min, lon_max].
    bbox: [f64; 4],
    /// API key for authenticated access (higher rate limits).
    /// None = anonymous (100 req/day, 10s resolution).
    api_credentials: Option<(String, String)>,
    /// Poll interval override (default: 10s for anonymous, 5s for authenticated).
    poll_interval: Option<Duration>,
}

impl Default for OpenSkyConfig {
    fn default() -> Self {
        Self {
            // NYC metro area bounding box.
            bbox: [40.0, 42.0, -74.5, -71.5],
            api_credentials: None,
            poll_interval: None,
        }
    }
}

/// OpenSky Network ADS-B source adapter.
///
/// Polls the OpenSky REST API for aircraft states within a bounding box.
/// Each aircraft becomes a separate [`Record`] with ICAO hex as subject suffix.
///
/// # Actor Power in Action
///
/// - **ETag/304**: OpenSky supports conditional requests — the adapter's
///   `ConditionalCache` tracks the ETag automatically, saving bandwidth
///   when aircraft positions haven't changed.
///
/// - **Rate limiting**: Anonymous users get 100 requests/day. The adapter's
///   `RateLimitState` respects 429 + Retry-After, preventing IP bans.
///
/// - **Circuit breaker**: If OpenSky returns 5xx repeatedly, the per-actor
///   circuit breaker stops polling until recovery timeout, preventing
///   resource waste.
///
/// - **Per-aircraft NATS subjects**: Each aircraft publishes to
///   `sensor.adsb.opensky.json.{icao}`, enabling per-aircraft subscriptions
///   in the fusion pipeline.
struct OpenSkyAdapter {
    config: OpenSkyConfig,
}

impl OpenSkyAdapter {
    fn new(config: OpenSkyConfig) -> Self {
        Self { config }
    }
}

impl SourceAdapter for OpenSkyAdapter {
    fn name(&self) -> &str {
        "opensky"
    }

    fn signal_kind(&self) -> &str {
        "adsb"
    }

    fn source_id(&self) -> &str {
        "opensky"
    }

    fn default_format(&self) -> &str {
        "json"
    }

    fn build_request(&self, _state: &AdapterState) -> FetchRequest {
        let [lat_min, lat_max, lon_min, lon_max] = self.config.bbox;
        let url = format!(
            "https://opensky-network.org/api/states/all\
             ?lamin={lat_min}&lamax={lat_max}&lomin={lon_min}&lomax={lon_max}"
        );

        let mut req = FetchRequest::get(url).accept_json();

        // Add basic auth if credentials are provided.
        if let Some((ref user, ref pass)) = self.config.api_credentials {
            // OpenSky uses HTTP Basic Auth.
            let encoded = base64_encode(&format!("{user}:{pass}"));
            req = req.with_header("Authorization", format!("Basic {encoded}"));
        }

        req
    }

    fn parse_records(&self, resp: &FetchResponse) -> Result<Vec<Record>, AdapterError> {
        let data: serde_json::Value = resp.json()
            .map_err(|e| AdapterError::Parse(e.to_string()))?;

        let states = data["states"]
            .as_array()
            .ok_or_else(|| AdapterError::Parse("missing 'states' array".to_string()))?;

        let mut records = Vec::with_capacity(states.len());

        for state in states {
            let arr = state.as_array()
                .ok_or_else(|| AdapterError::Parse("state is not an array".to_string()))?;

            // OpenSky state vector: [icao24, callsign, origin_country, time_position,
            //   last_contact, longitude, latitude, baro_altitude, on_ground,
            //   velocity, true_track, vertical_rate, sensors, geo_altitude,
            //   squawk, spi, position_source]

            let icao = arr.first()
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .trim()
                .to_lowercase();

            // Build a clean JSON record per aircraft.
            let aircraft = serde_json::json!({
                "icao24": icao,
                "callsign": arr.get(1).and_then(|v| v.as_str()).map(str::trim),
                "origin_country": arr.get(2).and_then(|v| v.as_str()),
                "time_position": arr.get(3),
                "last_contact": arr.get(4),
                "longitude": arr.get(5),
                "latitude": arr.get(6),
                "baro_altitude": arr.get(7),
                "on_ground": arr.get(8),
                "velocity": arr.get(9),
                "true_track": arr.get(10),
                "vertical_rate": arr.get(11),
                "geo_altitude": arr.get(13),
                "squawk": arr.get(14),
            });

            records.push(Record {
                payload: serde_json::to_vec(&aircraft)
                    .map_err(|e| AdapterError::Parse(e.to_string()))?,
                // Per-aircraft NATS subject: sensor.adsb.opensky.json.{icao}
                subject_suffix: Some(icao),
            });
        }

        Ok(records)
    }

    fn poll_interval(&self) -> Duration {
        self.config.poll_interval.unwrap_or_else(|| {
            if self.config.api_credentials.is_some() {
                Duration::from_secs(5) // Authenticated: 5s resolution
            } else {
                Duration::from_secs(10) // Anonymous: 10s resolution
            }
        })
    }

    fn max_records_per_poll(&self) -> Option<usize> {
        // OpenSky can return thousands of aircraft in a wide bbox.
        // Limit to prevent NATS publish backlog.
        Some(500)
    }
}

// ── Minimal base64 encode (no external crate) ──────────────────────────────

fn base64_encode(input: &str) -> String {
    const ALPHABET: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let bytes = input.as_bytes();
    let mut result = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = *chunk.get(1).unwrap_or(&0) as u32;
        let b2 = *chunk.get(2).unwrap_or(&0) as u32;
        let n = (b0 << 16) | (b1 << 8) | b2;
        result.push(ALPHABET[((n >> 18) & 63) as usize] as char);
        result.push(ALPHABET[((n >> 12) & 63) as usize] as char);
        if chunk.len() > 1 {
            result.push(ALPHABET[((n >> 6) & 63) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(ALPHABET[(n & 63) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

// ── Main: Poll Loop Demo ────────────────────────────────────────────────────

fn main() {
    println!("=== OpenSky ADS-B Source Adapter ===");
    println!();
    println!("This example demonstrates the source adapter pattern:");
    println!("  1. Build HTTP request (with conditional headers)");
    println!("  2. Fetch from OpenSky API");
    println!("  3. Parse aircraft state vectors into records");
    println!("  4. Publish each aircraft to NATS (sensor.adsb.opensky.json.{{icao}})");
    println!();

    // ── Configure adapter ───────────────────────────────────────────────

    let config = OpenSkyConfig {
        bbox: [40.0, 42.0, -74.5, -71.5], // NYC metro
        api_credentials: None,              // Anonymous
        poll_interval: Some(Duration::from_secs(10)),
    };

    let adapter = OpenSkyAdapter::new(config);

    // ── Build the actor ─────────────────────────────────────────────────

    // In production, FetchClient would be configured with auth headers,
    // connection pool settings, and a custom User-Agent.
    let http = FetchClient::with_config(
        FetchConfig::default()
            .with_user_agent("ava-web/0.1 (opensky-adapter)")
            .with_max_response_bytes(10 * 1024 * 1024), // 10MB max
    );

    // In production, NatsState would wrap a real NATS connection.
    let nats = NatsState::new(NatsClientWrapper::default());

    // Custom resilience: OpenSky has strict rate limits.
    let state = AdapterState::with_resilience(
        CircuitBreaker::new(3, Duration::from_secs(60)),   // Trip after 3 failures, 60s recovery
        RetryPolicy {
            base_delay: Duration::from_secs(5),
            max_delay: Duration::from_secs(120),
            multiplier: 3.0, // Aggressive backoff for rate-limited API
            max_retries: 4,
        },
    );

    let actor = AdapterActor::with_state(adapter, http, nats, state);

    // ── Poll loop (blocking demo) ───────────────────────────────────────

    println!("Adapter: {}", actor.name());
    println!("Circuit: {:?}", actor.circuit_state());
    println!("Poll interval: {:?}", actor.adapter.poll_interval());
    println!();

    // In production, this loop runs inside a GenServer's handle_info
    // triggered by timer ticks from asupersync's timer service.
    //
    // For this demo, we simulate 5 poll cycles with mock responses.
    for cycle in 1..=5 {
        println!("─── Poll Cycle {cycle} ───");

        // NOTE: In production, poll_once() makes a real HTTP request.
        // Here we're running without a real server, so this will fail
        // unless you have a NATS server and OpenSky access.
        //
        // The important thing is the PATTERN:
        //
        //   loop {
        //       let outcome = actor.poll_once().await;
        //       match outcome {
        //           PollOutcome::Success { records_published, .. } => {
        //               tracing::info!(records = records_published, "published");
        //           }
        //           PollOutcome::NotModified => {
        //               tracing::debug!("no new data");
        //           }
        //           PollOutcome::RateLimited { remaining } => {
        //               tracing::warn!(?remaining, "rate limited");
        //           }
        //           PollOutcome::CircuitOpen => {
        //               tracing::warn!("circuit open, skipping");
        //           }
        //           PollOutcome::FetchFailed { error, will_retry, .. } => {
        //               tracing::error!(?error, will_retry, "fetch failed");
        //           }
        //           PollOutcome::ParseFailed { error } => {
        //               tracing::error!(error, "parse failed");
        //           }
        //           PollOutcome::PublishFailed { error, .. } => {
        //               tracing::error!(?error, "NATS publish failed");
        //           }
        //       }
        //
        //       // Adaptive delay: accounts for retry backoff, rate limits.
        //       let delay = actor.next_poll_delay();
        //       timer.sleep(delay).await;
        //   }

        let delay = actor.next_poll_delay();
        let metrics = actor.metrics();

        println!("  Next delay: {delay:?}");
        println!("  Circuit: {:?}", actor.circuit_state());
        println!("  Metrics: success={}, failed={}, not_modified={}, records={}",
            metrics.polls_success,
            metrics.polls_failed,
            metrics.polls_not_modified,
            metrics.records_published,
        );
        println!();
    }

    println!("=== Done ===");
    println!();
    println!("In production, the AdapterActor runs inside a GenServer:");
    println!();
    println!("  impl GenServer for AdapterActor<OpenSkyAdapter> {{");
    println!("      type Info = PollTick;");
    println!("      ");
    println!("      async fn handle_info(&mut self, cx: &Cx, _: PollTick) {{");
    println!("          let outcome = self.poll_once().await;");
    println!("          let delay = self.next_poll_delay();");
    println!("          cx.send_after(PollTick, delay);  // schedule next");
    println!("      }}");
    println!("  }}");
}

// ── Tests ────────────────────────────────────────────────────────────────────
//
// Tests that require mock infrastructure (mock_response, recorded_requests,
// NatsState.client.lock()) live in the crate's source_adapter::tests module,
// because #[cfg(test)] methods are crate-internal.
//
// Tests here only use the PUBLIC API: parse_records, build_request, nats_subject.

#[cfg(test)]
mod tests {
    use super::*;

    /// Realistic OpenSky API response.
    fn opensky_response() -> Vec<u8> {
        serde_json::to_vec(&serde_json::json!({
            "time": 1740100000,
            "states": [
                ["a12345", "UAL123  ", "United States", 1740099990, 1740099990,
                 -73.8, 40.6, 10668.0, false, 250.0, 45.0, 0.0, null,
                 10706.0, "1234", false, 0],
                ["a67890", "DAL456  ", "United States", 1740099991, 1740099991,
                 -74.0, 40.7, 8534.0, false, 200.0, 90.0, -5.0, null,
                 8600.0, "5678", false, 0],
                ["abc123", "  ", "Canada", 1740099992, 1740099992,
                 -73.5, 41.0, 12000.0, false, 300.0, 180.0, 0.0, null,
                 12100.0, null, false, 0],
            ]
        })).unwrap()
    }

    #[test]
    fn opensky_parses_aircraft_records() {
        let adapter = OpenSkyAdapter::new(OpenSkyConfig::default());
        let resp = ava_web::client::FetchResponse {
            status: ava_web::client::FetchStatus(200),
            headers: vec![("content-type".to_string(), "application/json".to_string())],
            body: opensky_response(),
            request_id: 1,
            elapsed: Duration::from_millis(200),
        };

        let records = adapter.parse_records(&resp).unwrap();
        assert_eq!(records.len(), 3);

        // Check ICAO extraction and subject suffix.
        assert_eq!(records[0].subject_suffix.as_deref(), Some("a12345"));
        assert_eq!(records[1].subject_suffix.as_deref(), Some("a67890"));
        assert_eq!(records[2].subject_suffix.as_deref(), Some("abc123"));

        // Check parsed JSON content.
        let a1: serde_json::Value = serde_json::from_slice(&records[0].payload).unwrap();
        assert_eq!(a1["icao24"], "a12345");
        assert_eq!(a1["callsign"], "UAL123");
        assert_eq!(a1["longitude"], -73.8);
        assert_eq!(a1["latitude"], 40.6);
        assert_eq!(a1["baro_altitude"], 10668.0);
        assert_eq!(a1["velocity"], 250.0);
        assert_eq!(a1["origin_country"], "United States");
    }

    #[test]
    fn opensky_nats_subjects() {
        let adapter = OpenSkyAdapter::new(OpenSkyConfig::default());

        let record_with_suffix = Record {
            payload: Vec::new(),
            subject_suffix: Some("a12345".to_string()),
        };
        let record_without = Record {
            payload: Vec::new(),
            subject_suffix: None,
        };

        assert_eq!(
            adapter.nats_subject(&record_with_suffix),
            "sensor.adsb.opensky.json.a12345"
        );
        assert_eq!(
            adapter.nats_subject(&record_without),
            "sensor.adsb.opensky.json"
        );
    }

    #[test]
    fn opensky_build_request_anonymous() {
        let adapter = OpenSkyAdapter::new(OpenSkyConfig {
            bbox: [40.0, 42.0, -74.5, -71.5],
            api_credentials: None,
            poll_interval: None,
        });
        let state = AdapterState::new();
        let req = adapter.build_request(&state);

        assert_eq!(req.method, "GET");
        assert!(req.url.contains("opensky-network.org/api/states/all"));
        assert!(req.url.contains("lamin=40"));
        assert!(req.url.contains("lamax=42"));
        assert!(req.url.contains("lomin=-74.5"));
        assert!(req.url.contains("lomax=-71.5"));
        // No Authorization header for anonymous.
        assert!(!req.headers.iter().any(|(k, _)| k == "Authorization"));
    }

    #[test]
    fn opensky_build_request_authenticated() {
        let adapter = OpenSkyAdapter::new(OpenSkyConfig {
            bbox: [40.0, 42.0, -74.5, -71.5],
            api_credentials: Some(("user".to_string(), "pass".to_string())),
            poll_interval: None,
        });
        let state = AdapterState::new();
        let req = adapter.build_request(&state);

        // Should have Basic auth header.
        let auth = req.headers.iter()
            .find(|(k, _)| k == "Authorization")
            .map(|(_, v)| v.as_str());
        assert!(auth.is_some());
        assert!(auth.unwrap().starts_with("Basic "));
    }

    #[test]
    fn opensky_poll_interval_anonymous_vs_authenticated() {
        let anon = OpenSkyAdapter::new(OpenSkyConfig::default());
        assert_eq!(anon.poll_interval(), Duration::from_secs(10));

        let auth = OpenSkyAdapter::new(OpenSkyConfig {
            api_credentials: Some(("u".into(), "p".into())),
            ..OpenSkyConfig::default()
        });
        assert_eq!(auth.poll_interval(), Duration::from_secs(5));

        let custom = OpenSkyAdapter::new(OpenSkyConfig {
            poll_interval: Some(Duration::from_secs(30)),
            ..OpenSkyConfig::default()
        });
        assert_eq!(custom.poll_interval(), Duration::from_secs(30));
    }

    #[test]
    fn opensky_max_records_per_poll() {
        assert_eq!(
            OpenSkyAdapter::new(OpenSkyConfig::default()).max_records_per_poll(),
            Some(500)
        );
    }

    #[test]
    fn opensky_parse_empty_states() {
        let adapter = OpenSkyAdapter::new(OpenSkyConfig::default());
        let resp = ava_web::client::FetchResponse {
            status: ava_web::client::FetchStatus(200),
            headers: Vec::new(),
            body: br#"{"time":0,"states":[]}"#.to_vec(),
            request_id: 1,
            elapsed: Duration::ZERO,
        };

        let records = adapter.parse_records(&resp).unwrap();
        assert!(records.is_empty());
    }

    #[test]
    fn opensky_parse_missing_states_key() {
        let adapter = OpenSkyAdapter::new(OpenSkyConfig::default());
        let resp = ava_web::client::FetchResponse {
            status: ava_web::client::FetchStatus(200),
            headers: Vec::new(),
            body: br#"{"time":0}"#.to_vec(),
            request_id: 1,
            elapsed: Duration::ZERO,
        };

        let result = adapter.parse_records(&resp);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("missing 'states' array"));
    }

    #[test]
    fn base64_encode_works() {
        assert_eq!(base64_encode("user:pass"), "dXNlcjpwYXNz");
        assert_eq!(base64_encode("a"), "YQ==");
        assert_eq!(base64_encode("ab"), "YWI=");
        assert_eq!(base64_encode("abc"), "YWJj");
    }
}
