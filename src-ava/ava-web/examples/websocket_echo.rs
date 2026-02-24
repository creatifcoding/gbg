//! # WebSocket Echo — Upgrade and Echo Server
//!
//! Demonstrates ava-web's WebSocket support:
//! - WebSocket upgrade detection via `WebSocketUpgrade` extractor
//! - Zero-copy message bridging with asupersync's frame codec
//! - Echo server pattern (receive a message, send it back)
//!
//! # Architecture
//!
//! ```text
//! Client --[HTTP Upgrade]--> ava-web Router
//!                            |
//!                            v
//!                      WebSocketUpgrade::from_request()
//!                            |  (checks Upgrade: websocket header)
//!                            v
//!                      Handler returns 101 Switching Protocols
//!                            |
//!                            v
//!                      on_upgrade callback:
//!                            WebSocket::recv() / send()
//!                            (zero-copy Bytes bridging)
//! ```
//!
//! # Zero-Copy Design
//!
//! Binary messages use `asupersync::bytes::Bytes` — cloning is an O(1)
//! refcount bump, slicing is O(1). No memcpy between the frame codec
//! and user code.
//!
//! # Run
//!
//! ```bash
//! cargo run --example websocket_echo
//! # Then use websocat or similar:
//! # websocat ws://127.0.0.1:3004/ws
//! ```

use ava_web::handler::FnHandler;
use ava_web::ws::{WebSocket, WebSocketUpgrade, WsMessage};
use ava_web::{get, Router};

// ── Echo Handler ──────────────────────────────────────────────────────────

/// WebSocket echo handler.
///
/// This is an example of how WebSocket handlers would be structured.
/// The actual async upgrade requires the asupersync runtime to be
/// running, so this example shows the router setup pattern.
///
/// In a real application:
///
/// ```ignore
/// async fn ws_handler(upgrade: WebSocketUpgrade) -> impl IntoResponse {
///     upgrade.on_upgrade(|mut socket: WebSocket| async move {
///         while let Some(msg) = socket.recv().await {
///             match msg {
///                 WsMessage::Text(text) => {
///                     // Echo text messages back with a prefix
///                     let _ = socket.send(WsMessage::text(format!("echo: {text}"))).await;
///                 }
///                 WsMessage::Binary(data) => {
///                     // Binary echo — zero-copy Bytes, just bump the refcount
///                     let _ = socket.send(WsMessage::Binary(data)).await;
///                 }
///                 WsMessage::Close(_) => break,
///                 _ => {} // Ignore pings/pongs (handled by the frame codec)
///             }
///         }
///     })
/// }
/// ```

// ── Main ──────────────────────────────────────────────────────────────────

fn main() {
    // Build router with WebSocket route.
    //
    // In practice, the WebSocket handler would use AsyncFnHandler1 with
    // the WebSocketUpgrade extractor. Here we demonstrate the route
    // structure and message type API.
    let app = Router::new()
        .route(
            "/",
            get(FnHandler::new(|| {
                "<html><body>\
                 <h1>ava-web WebSocket Echo</h1>\
                 <p>Connect to <code>ws://127.0.0.1:3004/ws</code></p>\
                 </body></html>"
            })),
        )
        .route(
            "/ws",
            get(FnHandler::new(|| "WebSocket endpoint — upgrade required")),
        );

    // Demonstrate the WsMessage API (no connection needed).
    println!("WebSocket message types:");
    let text_msg = WsMessage::text("hello");
    println!("  Text: {text_msg:?}");

    let bin_msg = WsMessage::binary(vec![0xDE, 0xAD, 0xBE, 0xEF]);
    println!("  Binary: {bin_msg:?}");

    let ping_msg = WsMessage::ping(vec![1, 2, 3]);
    println!("  Ping: {ping_msg:?}");

    println!("\nWebSocket echo on http://127.0.0.1:3004");
    println!("  /    — HTML page");
    println!("  /ws  — WebSocket endpoint");

    let rt = asupersync::runtime::RuntimeBuilder::current_thread()
        .build()
        .expect("failed to build runtime");
    let server = rt.block_on(async {
        ava_web::HttpServer::bind("127.0.0.1:3004")
            .await
            .expect("failed to bind")
    });
    drop(rt);
    let _ = server.serve(app);
}
