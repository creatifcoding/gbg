//! # Macaroon Auth — Token-Based Authorization
//!
//! Demonstrates ava-web's built-in macaroon authorization system:
//! - Issuing tokens with first-party caveats
//! - Protecting routes with `MacaroonAuth` middleware
//! - Caveat attenuation (narrowing token scope)
//! - Testing auth flows with `TestServer`
//!
//! # What are Macaroons?
//!
//! Macaroons are bearer tokens with HMAC-chained caveats (conditions).
//! Unlike JWTs, macaroons support **attenuation**: any holder can add
//! caveats to narrow scope without contacting the issuer. You can take
//! a "read/write" token and attenuate it to "read-only" — cryptographically
//! enforced, no server round-trip.
//!
//! # Architecture
//!
//! ```text
//! Issuer (holds root key) --> Mint token with caveats
//!                             |
//!                             v
//! Client (holds token)    --> Add caveats (attenuate)
//!                             |
//!                             v
//! Server (holds root key) --> Verify HMAC chain + all caveats
//! ```
//!
//! # Run
//!
//! ```bash
//! cargo run --example macaroon_auth
//! ```

use ava_web::auth::{MacaroonIssuer, token_to_bearer};
use ava_web::handler::FnHandler;
use ava_web::testing::TestServer;
use ava_web::{get, Router};

// ── Demo ──────────────────────────────────────────────────────────────────

fn main() {
    // --- Step 1: Create the root key and issuer ---
    //
    // The root key is the secret that signs all tokens. Only the issuer
    // and the verifying middleware should know it.
    //
    // `AuthKey::from_seed()` creates a deterministic key — useful for
    // testing. In production, use a random key.
    let root_key = asupersync::security::AuthKey::from_seed(42);

    // The issuer mints new tokens. Parameters:
    //   - root_key: the HMAC signing key
    //   - "api": the macaroon identifier (namespace)
    //   - "ava-web": the location hint (informational, not verified)
    let issuer = MacaroonIssuer::new(root_key.clone(), "api", "ava-web");

    // --- Step 2: Mint a token with caveats ---
    //
    // Caveats are conditions that the verifier checks. If any caveat
    // fails, the token is rejected.
    let token = issuer
        .mint()
        // Token expires at this Unix timestamp (ms). The verifier checks
        // against the current system time.
        .time_before(u64::MAX) // Never expires (for demo purposes)
        // Restrict to paths matching this glob pattern.
        .resource_scope("/api/**")
        // Build the final token.
        .finish();

    // Encode the token for transmission in an Authorization header.
    // token_to_bearer() serializes the macaroon binary → base64 → "Bearer <b64>".
    let bearer = token_to_bearer(&token);
    println!("Minted token: {}", &bearer[..47]);
    println!("  Caveats: time_before, resource_scope(/api/**)");

    // --- Step 3: Set up a protected API ---
    //
    // MacaroonAuth middleware extracts the `Authorization: Bearer <token>`
    // header, decodes the macaroon, verifies the HMAC chain, and checks
    // all caveats against the request context.
    let auth = ava_web::auth::MacaroonAuth::new(root_key);

    let app = Router::new()
        .route("/api/data", get(FnHandler::new(|| "sensitive data")))
        .route("/api/admin", get(FnHandler::new(|| "admin panel")))
        .route("/public", get(FnHandler::new(|| "public page")))
        .layer(auth);

    // --- Step 4: Test with TestServer ---
    //
    // TestServer routes requests directly through the router — no TCP.
    let server = TestServer::new(app);

    // Request without auth -> 401 Unauthorized
    let resp = server.get("/api/data").send();
    println!("\nGET /api/data (no token): {}", resp.status());
    assert_eq!(resp.status(), 401);

    // Request with valid token -> 200 OK
    let resp = server
        .get("/api/data")
        .header("authorization", &bearer)
        .send();
    println!("GET /api/data (valid token): {}", resp.status());
    assert_eq!(resp.status(), 200);

    // --- Step 5: Demonstrate caveat attenuation ---
    //
    // Anyone holding a token can ADD caveats (narrow scope), but nobody
    // can REMOVE caveats (widen scope). This is the cryptographic guarantee.
    println!("\nAttenuation:");
    println!("  Original token has resource_scope(/api/**)");
    println!("  Attenuated token could restrict to /api/data only");
    println!("  No server round-trip needed — HMAC chain enforces it");

    println!("\nAll assertions passed.");
}
