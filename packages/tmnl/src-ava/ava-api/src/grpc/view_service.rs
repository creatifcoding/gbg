//! ViewService gRPC implementation
//!
//! Implements the ViewService defined in `proto/ava.proto`.
//! Full implementation in I45 after proto compilation (I44).

use std::sync::Arc;
use tokio::sync::RwLock;
use ava_runtime::AvaRuntimeV2;

/// ViewService gRPC server
pub struct ViewServiceServer {
    runtime: Arc<RwLock<AvaRuntimeV2>>,
}

impl ViewServiceServer {
    /// Create a new ViewServiceServer with the given runtime
    pub fn new(runtime: AvaRuntimeV2) -> Self {
        Self {
            runtime: Arc::new(RwLock::new(runtime)),
        }
    }

    /// Get shared runtime access
    pub fn runtime(&self) -> Arc<RwLock<AvaRuntimeV2>> {
        self.runtime.clone()
    }
}

// gRPC trait implementations will be added after proto compilation (I44)
// Example signature:
//
// #[tonic::async_trait]
// impl proto::view_service_server::ViewService for ViewServiceServer {
//     async fn subscribe(
//         &self,
//         request: tonic::Request<proto::SubscribeRequest>,
//     ) -> Result<tonic::Response<Self::SubscribeStream>, tonic::Status> {
//         // Implementation
//     }
// }

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_server_creation() {
        let runtime = AvaRuntimeV2::default();
        let _server = ViewServiceServer::new(runtime);
    }
}
