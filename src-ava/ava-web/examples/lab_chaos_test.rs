//! # Lab Chaos Test — Deterministic Testing Harness
//!
//! Demonstrates ava-web's built-in chaos engineering and testing tools:
//! - `ChaosMiddleware` — fault injection with deterministic seeded RNG
//! - `LabTestServer` — extended test server with chaos + virtual time
//! - `fuzz_router()` — seed-driven request fuzzing
//! - `VirtualTimeController` — test timeouts without wall-clock delays
//! - `ScenarioTestRunner` — JSON-driven test scenarios
//!
//! **No other Rust web framework has built-in chaos engineering.**
//!
//! # Feature Gate
//!
//! Requires the `lab` feature:
//!
//! ```bash
//! cargo run --example lab_chaos_test --features lab
//! ```

#[cfg(feature = "lab")]
fn main() {
    use ava_web::handler::FnHandler;
    use ava_web::lab::{
        ChaosMiddleware, ChaosPreset, HttpFuzzConfig, LabTestServer, ScenarioTestRunner,
        VirtualTimeController, fuzz_router,
    };
    use ava_web::testing::TestServer;
    use ava_web::{get, Router};

    println!("=== ava-web Lab Testing Harness ===\n");

    // Helper: build a fresh router (Router is not Clone due to trait objects).
    fn make_router() -> Router {
        Router::new()
            .route("/health", get(FnHandler::new(|| "ok")))
            .route("/users", get(FnHandler::new(|| "[\"alice\",\"bob\"]")))
            .route("/fail", get(FnHandler::new(|| {
                ava_web::response::StatusCode::INTERNAL_SERVER_ERROR
            })))
    }

    // ── 1. Chaos Middleware ───────────────────────────────────────────────

    println!("1. ChaosMiddleware — Deterministic Fault Injection");
    println!("   Presets: Off (0%), Light (CI: 1/5/2%), Heavy (stress: 10/20/15%)");

    // Same seed = same injection decisions = reproducible tests.
    let mw_100pct = ChaosMiddleware::new(42, ChaosPreset::Off)
        .with_error_probability(1.0);

    let router = make_router().layer(mw_100pct);
    let server = TestServer::new(router);
    let resp = server.get("/health").send();
    println!("   100% error rate: /health -> {}", resp.status());
    assert_eq!(resp.status(), 500);
    println!("   Header x-chaos-injected: {:?}", resp.header("x-chaos-injected"));

    // Off preset — no injection, but tags response.
    let router = make_router().layer(ChaosMiddleware::new(42, ChaosPreset::Off));
    let server = TestServer::new(router);
    let resp = server.get("/health").send();
    println!("   Off preset: /health -> {} (x-chaos-active: {:?})", resp.status(), resp.header("x-chaos-active"));
    assert_eq!(resp.status(), 200);

    println!();

    // ── 2. Lab Test Server ───────────────────────────────────────────────

    println!("2. LabTestServer — Extended Test Server with Chaos + Virtual Time");

    let mut lab_server = LabTestServer::new(make_router());

    // Send some requests and track stats.
    lab_server.get("/health");
    lab_server.get("/users");
    lab_server.get("/fail");

    let stats = lab_server.chaos_stats();
    println!("   Stats: {}", stats.summary());
    assert_eq!(stats.total_requests, 3);

    // Virtual time — no wall-clock sleep.
    lab_server.advance_time_ms(5000);
    println!("   Virtual time: {}ms", lab_server.virtual_time_ms());
    assert_eq!(lab_server.virtual_time_ms(), 5000);

    println!();

    // ── 3. Fuzz Harness ──────────────────────────────────────────────────

    println!("3. fuzz_router() — Seed-Driven Request Fuzzing");

    let report = fuzz_router(make_router(), HttpFuzzConfig::quick(42));
    report.assert_no_panics();

    println!("   Iterations: {}", report.iterations);
    println!("   Panics: {} (should be 0)", report.panics);
    println!("   Status code distribution:");
    let mut codes: Vec<_> = report.status_codes.iter().collect();
    codes.sort_by_key(|(code, _)| *code);
    for (code, count) in &codes {
        println!("     {} -> {} requests", code, count);
    }

    // Determinism: same seed = same results.
    let report2 = fuzz_router(make_router(), HttpFuzzConfig::quick(42));
    assert_eq!(report.status_codes, report2.status_codes);
    println!("   Determinism verified: same seed = same distribution");

    println!();

    // ── 4. Virtual Time Controller ───────────────────────────────────────

    println!("4. VirtualTimeController — Deterministic Timeout Testing");

    let mut vtc = VirtualTimeController::new();
    println!("   Now: {}ms, pending: {}", vtc.now_ms(), vtc.pending_count());

    vtc.set_timeout_ms(1000);
    vtc.set_timeout_ms(5000);
    vtc.set_timeout_ms(10_000);
    println!("   Set 3 timers: 1s, 5s, 10s");
    println!("   Next deadline: {:?}ms", vtc.next_deadline_ms());

    let fired = vtc.advance_ms(999);
    println!("   Advance 999ms: {} fired", fired);
    assert_eq!(fired, 0);

    let fired = vtc.advance_ms(2);
    println!("   Advance 2ms:   {} fired (1s timer)", fired);
    assert_eq!(fired, 1);

    let fired = vtc.advance_to_next();
    println!("   Advance to next: {} fired (5s timer)", fired);
    assert_eq!(fired, 1);

    let fired = vtc.advance_ms(100_000);
    println!("   Advance 100s:  {} fired (10s timer)", fired);
    assert_eq!(fired, 1);
    assert!(vtc.is_idle());
    println!("   All timers consumed. Idle: {}", vtc.is_idle());

    println!();

    // ── 5. Scenario Runner ───────────────────────────────────────────────

    println!("5. ScenarioTestRunner — JSON-Driven Test Scenarios");

    let scenario_json = r#"{
        "id": "smoke-test",
        "description": "Verify basic routes under light chaos",
        "lab": {"seed": 42},
        "chaos": {"preset": "light"},
        "participants": [
            {"name": "client-a", "role": "health"},
            {"name": "client-b", "role": "users"}
        ]
    }"#;

    let runner = ScenarioTestRunner::from_json(make_router(), scenario_json).unwrap();
    let report = runner.run();

    println!("   Scenario: {}", report.scenario_id);
    println!("   Chaos active: {}", report.chaos_active);
    println!("   All responded: {}", report.all_responded());
    for result in &report.results {
        println!("     {} -> /{} -> {}", result.participant, result.path, result.status);
    }
    assert!(report.all_responded());

    println!("\n=== All lab tests passed. ===");
}

#[cfg(not(feature = "lab"))]
fn main() {
    eprintln!("This example requires the `lab` feature:");
    eprintln!("  cargo run --example lab_chaos_test --features lab");
    std::process::exit(1);
}
