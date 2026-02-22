//! Niri compositor IPC client.
//!
//! Wraps niri-ipc for typed communication with the niri Wayland compositor.
//! Supports one-shot queries and continuous EventStream subscription.

use niri_ipc::{Request, Response, Reply};
use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::UnixStream;
use std::path::PathBuf;

/// Get the niri IPC socket path from the environment.
pub fn niri_socket_path() -> Option<PathBuf> {
    std::env::var("NIRI_SOCKET").ok().map(PathBuf::from)
}

/// A blocking niri IPC client.
///
/// For the bar, we use this in a tokio::task::spawn_blocking context
/// or in a dedicated thread for the EventStream.
pub struct NiriClient {
    stream: UnixStream,
    reader: BufReader<UnixStream>,
}

impl NiriClient {
    /// Connect to the niri IPC socket.
    pub fn connect() -> Result<Self, NiriError> {
        let path = niri_socket_path()
            .ok_or(NiriError::NoSocket)?;
        let stream = UnixStream::connect(&path)
            .map_err(|e| NiriError::Connect(e.to_string()))?;
        let reader = BufReader::new(stream.try_clone()
            .map_err(|e| NiriError::Connect(e.to_string()))?);
        Ok(Self { stream, reader })
    }

    /// Send a request and receive a reply.
    pub fn send(&mut self, request: Request) -> Result<Response, NiriError> {
        let json = serde_json::to_string(&request)
            .map_err(|e| NiriError::Serialize(e.to_string()))?;
        
        self.stream.write_all(json.as_bytes())
            .map_err(|e| NiriError::Io(e.to_string()))?;
        self.stream.write_all(b"\n")
            .map_err(|e| NiriError::Io(e.to_string()))?;
        self.stream.flush()
            .map_err(|e| NiriError::Io(e.to_string()))?;

        let mut line = String::new();
        self.reader.read_line(&mut line)
            .map_err(|e| NiriError::Io(e.to_string()))?;

        let reply: Reply = serde_json::from_str(line.trim())
            .map_err(|e| NiriError::Deserialize(e.to_string()))?;

        reply.map_err(|e| NiriError::Niri(e))
    }

    /// Get current workspace state.
    pub fn workspaces(&mut self) -> Result<Vec<niri_ipc::Workspace>, NiriError> {
        match self.send(Request::Workspaces)? {
            Response::Workspaces(ws) => Ok(ws),
            other => Err(NiriError::UnexpectedResponse(format!("{:?}", other))),
        }
    }

    /// Get current window state.
    pub fn windows(&mut self) -> Result<Vec<niri_ipc::Window>, NiriError> {
        match self.send(Request::Windows)? {
            Response::Windows(ws) => Ok(ws),
            other => Err(NiriError::UnexpectedResponse(format!("{:?}", other))),
        }
    }

    /// Start an EventStream subscription.
    /// Returns self for reading events line by line.
    pub fn subscribe_events(mut self) -> Result<NiriEventReader, NiriError> {
        match self.send(Request::EventStream)? {
            Response::Handled => Ok(NiriEventReader { reader: self.reader }),
            other => Err(NiriError::UnexpectedResponse(format!("{:?}", other))),
        }
    }
}

/// Reads niri events from an EventStream subscription.
pub struct NiriEventReader {
    reader: BufReader<UnixStream>,
}

impl NiriEventReader {
    /// Read the next event (blocking).
    pub fn next_event(&mut self) -> Result<niri_ipc::Event, NiriError> {
        let mut line = String::new();
        self.reader.read_line(&mut line)
            .map_err(|e| NiriError::Io(e.to_string()))?;
        
        if line.is_empty() {
            return Err(NiriError::Io("Connection closed".to_string()));
        }

        serde_json::from_str(line.trim())
            .map_err(|e| NiriError::Deserialize(e.to_string()))
    }
}

/// Niri IPC errors.
#[derive(Debug, Clone)]
pub enum NiriError {
    /// NIRI_SOCKET environment variable not set.
    NoSocket,
    /// Failed to connect to socket.
    Connect(String),
    /// Serialization error.
    Serialize(String),
    /// Deserialization error.
    Deserialize(String),
    /// IO error.
    Io(String),
    /// Niri returned an error.
    Niri(String),
    /// Unexpected response type.
    UnexpectedResponse(String),
}

impl std::fmt::Display for NiriError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            NiriError::NoSocket => write!(f, "NIRI_SOCKET not set"),
            NiriError::Connect(e) => write!(f, "connect: {}", e),
            NiriError::Serialize(e) => write!(f, "serialize: {}", e),
            NiriError::Deserialize(e) => write!(f, "deserialize: {}", e),
            NiriError::Io(e) => write!(f, "io: {}", e),
            NiriError::Niri(e) => write!(f, "niri: {}", e),
            NiriError::UnexpectedResponse(e) => write!(f, "unexpected response: {}", e),
        }
    }
}

impl std::error::Error for NiriError {}
