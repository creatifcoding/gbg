//! Integration tests for AVA derive macros

use ava_macros::AvaEvent;
use ava_domain::ids::ViewId;
use serde::{Serialize, Deserialize};

/// Custom event type using AvaEvent derive
#[derive(Debug, Clone, Serialize, Deserialize, AvaEvent)]
#[serde(tag = "event", content = "content")]
pub enum CustomEvent {
    TaskCreated {
        view_id: ViewId,
        task_name: String,
        timestamp_ms: f64,
    },
    TaskCompleted {
        view_id: ViewId,
        task_id: String,
        timestamp_ms: f64,
    },
    SystemNotice {
        message: String,
        timestamp_ms: f64,
    },
}

#[test]
fn test_ava_event_tag() {
    let event = CustomEvent::TaskCreated {
        view_id: ViewId::new("view-1"),
        task_name: "Build".into(),
        timestamp_ms: 1234567890.0,
    };
    assert_eq!(event.tag(), "TaskCreated");

    let event2 = CustomEvent::SystemNotice {
        message: "Hello".into(),
        timestamp_ms: 0.0,
    };
    assert_eq!(event2.tag(), "SystemNotice");
}

#[test]
fn test_ava_event_timestamp() {
    let event = CustomEvent::TaskCompleted {
        view_id: ViewId::new("view-1"),
        task_id: "task-1".into(),
        timestamp_ms: 9876543210.0,
    };
    assert_eq!(event.timestamp_ms(), 9876543210.0);
}

#[test]
fn test_ava_event_view_id() {
    let event = CustomEvent::TaskCreated {
        view_id: ViewId::new("view-42"),
        task_name: "Deploy".into(),
        timestamp_ms: 0.0,
    };
    assert_eq!(event.view_id().unwrap().as_str(), "view-42");

    // SystemNotice has no view_id
    let event2 = CustomEvent::SystemNotice {
        message: "No view".into(),
        timestamp_ms: 0.0,
    };
    assert!(event2.view_id().is_none());
}
