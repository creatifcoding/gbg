//! # REST API — CRUD with Extractors and Middleware
//!
//! Demonstrates a realistic REST API setup:
//! - Multiple routes with different HTTP methods
//! - `Path<String>`, `Query<HashMap>`, `Json<T>` extractors
//! - Middleware stack: CORS + SecurityHeaders + Logger
//! - Application state via `State<T>`
//! - JSON request/response bodies
//!
//! # Run
//!
//! ```bash
//! cargo run --example rest_api
//! ```

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use ava_web::extractor::{Json, Path, Query, State};
use ava_web::handler::FnHandler2;
use ava_web::middleware::{Cors, Logger, SecurityHeaders};
use ava_web::response;
use ava_web::response::StatusCode;
use ava_web::{get, Router};

// ── Domain Types ──────────────────────────────────────────────────────────

/// Application state shared across all handlers.
///
/// In a real application, this would hold database connection pools,
/// configuration, etc. ava-web injects it into request extensions via
/// `Router::with_state()`, making it available through the `State<T>` extractor.
#[derive(Debug, Clone)]
struct AppState {
    users: Arc<Mutex<Vec<User>>>,
}

/// A simple user record.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct User {
    id: u64,
    name: String,
    email: String,
}

// ── Handlers ──────────────────────────────────────────────────────────────

/// List all users, with optional `?limit=N` query parameter.
///
/// Demonstrates two extractors:
/// - `State<AppState>` — shared application state (FromRequestParts)
/// - `Query<HashMap>` — query string parameters (FromRequestParts)
///
/// When a handler takes 2+ extractors, all but the last must implement
/// `FromRequestParts` (non-consuming). The last may implement `FromRequest`
/// (consuming — e.g., `Json<T>` which reads the body).
fn list_users(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> response::Json<Vec<User>> {
    let users = state.users.lock().unwrap();
    let limit: usize = params
        .get("limit")
        .and_then(|v| v.parse().ok())
        .unwrap_or(100);

    response::Json(users.iter().take(limit).cloned().collect())
}

/// Get a single user by ID.
///
/// Demonstrates `Path<String>` extraction from URL parameters.
/// Route registered as `/users/{id}` — matchit extracts the `{id}` segment.
fn get_user(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<response::Json<User>, StatusCode> {
    let id: u64 = id.parse().map_err(|_| StatusCode::BAD_REQUEST)?;
    let users = state.users.lock().unwrap();
    users
        .iter()
        .find(|u| u.id == id)
        .cloned()
        .map(response::Json)
        .ok_or(StatusCode::NOT_FOUND)
}

/// Create a new user from a JSON body.
///
/// Demonstrates `Json<T>` extraction (consuming — reads the request body).
/// Since this handler takes 2 extractors, `State<AppState>` is first
/// (FromRequestParts) and `Json<CreateUser>` is last (FromRequest).
fn create_user(
    State(state): State<AppState>,
    Json(input): Json<CreateUserRequest>,
) -> (StatusCode, response::Json<User>) {
    let mut users = state.users.lock().unwrap();
    let user = User {
        id: users.len() as u64 + 1,
        name: input.name,
        email: input.email,
    };
    users.push(user.clone());
    (StatusCode::CREATED, response::Json(user))
}

#[derive(Debug, serde::Deserialize)]
struct CreateUserRequest {
    name: String,
    email: String,
}

// ── Main ──────────────────────────────────────────────────────────────────

fn main() {
    // Seed some initial data.
    let state = AppState {
        users: Arc::new(Mutex::new(vec![
            User { id: 1, name: "Alice".into(), email: "alice@example.com".into() },
            User { id: 2, name: "Bob".into(),   email: "bob@example.com".into() },
        ])),
    };

    // Build the router with extractors and middleware.
    //
    // Middleware is applied in LIFO order: the last `.layer()` call
    // is the outermost middleware (runs first on request, last on response).
    //
    // Request flow:  CORS -> SecurityHeaders -> Logger -> Handler
    // Response flow: Handler -> Logger -> SecurityHeaders -> CORS
    let app = Router::new()
        .route(
            "/users",
            get(FnHandler2::<_, State<AppState>, Query<HashMap<String, String>>>::new(
                list_users,
            ))
            .post(FnHandler2::<_, State<AppState>, Json<CreateUserRequest>>::new(
                create_user,
            )),
        )
        .route(
            "/users/{id}",
            get(FnHandler2::<_, State<AppState>, Path<String>>::new(get_user)),
        )
        .with_state(state)
        .layer(Logger)
        .layer(SecurityHeaders::default())
        .layer(Cors::default());

    println!("REST API on http://127.0.0.1:3001");
    println!("Try: curl http://127.0.0.1:3001/users");
    println!("Try: curl http://127.0.0.1:3001/users/1");
    println!("Try: curl -X POST http://127.0.0.1:3001/users -H 'Content-Type: application/json' -d '{{\"name\":\"Charlie\",\"email\":\"charlie@example.com\"}}'");

    let rt = asupersync::runtime::RuntimeBuilder::current_thread()
        .build()
        .expect("failed to build runtime");
    let server = rt.block_on(async {
        ava_web::HttpServer::bind("127.0.0.1:3001")
            .await
            .expect("failed to bind")
    });
    drop(rt);
    let _ = server.serve(app);
}
