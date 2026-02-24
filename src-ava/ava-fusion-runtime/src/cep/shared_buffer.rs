//! Arena-backed event storage for the CEP engine.
//!
//! Events are stored once in a contiguous buffer. Partial NFA matches
//! hold lightweight `EventRef` copies (index + generation) instead of
//! cloning full event data. This is Flink's SharedBuffer insight:
//!
//!   Memory = N events × sizeof(EventData)
//!          + M partial matches × ~16 bytes (EventRef only)
//!
//! Eviction is time-based: `evict_before(cutoff)` removes all events
//! with `timestamp < cutoff` and invalidates their generation.

// ---------------------------------------------------------------------------
// EventData — the canonical event stored once
// ---------------------------------------------------------------------------

/// Raw event data stored in the SharedBuffer.
#[derive(Debug, Clone)]
pub struct EventData {
    /// Source signal kind (e.g. "ais", "adsb", "lifecycle_transition").
    pub signal_kind: String,
    /// Entity identifier this event belongs to.
    pub entity_id: String,
    /// Timestamp (epoch ms).
    pub timestamp: u64,
    /// Payload fields as key-value pairs.
    pub fields: Vec<(String, f64)>,
}

impl EventData {
    /// Look up a field by name.
    pub fn field(&self, name: &str) -> Option<f64> {
        self.fields.iter().find(|(k, _)| k == name).map(|(_, v)| *v)
    }
}

// ---------------------------------------------------------------------------
// EventRef — lightweight reference into the buffer
// ---------------------------------------------------------------------------

/// Lightweight reference into the SharedBuffer.
///
/// 16 bytes: 4 (index) + 4 (generation) + 8 (timestamp cache).
/// Clone/Copy is trivial — partial matches hold vectors of these.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct EventRef {
    /// Slot index in the buffer.
    pub(crate) index: u32,
    /// Generation counter — detects stale references after eviction.
    pub(crate) generation: u32,
    /// Cached timestamp for fast window checks without buffer lookup.
    pub timestamp: u64,
}

// ---------------------------------------------------------------------------
// Slot — arena slot with generation
// ---------------------------------------------------------------------------

#[derive(Debug)]
struct Slot {
    data: Option<EventData>,
    generation: u32,
}

// ---------------------------------------------------------------------------
// SharedBuffer
// ---------------------------------------------------------------------------

/// Arena-backed event storage.
///
/// Insert returns an `EventRef`. Eviction invalidates slots by bumping
/// generation, making stale `EventRef`s return `None` on lookup.
#[derive(Debug)]
pub struct SharedBuffer {
    slots: Vec<Slot>,
    free_list: Vec<u32>,
    len: usize,
}

impl SharedBuffer {
    /// Create an empty buffer.
    pub fn new() -> Self {
        Self {
            slots: Vec::new(),
            free_list: Vec::new(),
            len: 0,
        }
    }

    /// Create a buffer with pre-allocated capacity.
    pub fn with_capacity(cap: usize) -> Self {
        Self {
            slots: Vec::with_capacity(cap),
            free_list: Vec::new(),
            len: 0,
        }
    }

    /// Number of live events in the buffer.
    pub fn len(&self) -> usize {
        self.len
    }

    /// Whether the buffer is empty.
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    /// Insert an event, returning a lightweight reference.
    pub fn insert(&mut self, data: EventData) -> EventRef {
        let timestamp = data.timestamp;

        if let Some(idx) = self.free_list.pop() {
            let slot = &mut self.slots[idx as usize];
            slot.generation += 1;
            let generation = slot.generation;
            slot.data = Some(data);
            self.len += 1;
            EventRef {
                index: idx,
                generation,
                timestamp,
            }
        } else {
            let index = self.slots.len() as u32;
            self.slots.push(Slot {
                data: Some(data),
                generation: 0,
            });
            self.len += 1;
            EventRef {
                index,
                generation: 0,
                timestamp,
            }
        }
    }

    /// Look up an event by reference. Returns `None` if evicted or stale.
    pub fn get(&self, r: &EventRef) -> Option<&EventData> {
        let slot = self.slots.get(r.index as usize)?;
        if slot.generation == r.generation {
            slot.data.as_ref()
        } else {
            None
        }
    }

    /// Evict all events with `timestamp < cutoff`.
    ///
    /// Returns the number of events evicted.
    pub fn evict_before(&mut self, cutoff: u64) -> usize {
        let mut evicted = 0;
        for (i, slot) in self.slots.iter_mut().enumerate() {
            if let Some(ref data) = slot.data {
                if data.timestamp < cutoff {
                    slot.data = None;
                    slot.generation += 1; // Invalidate outstanding refs.
                    self.free_list.push(i as u32);
                    evicted += 1;
                }
            }
        }
        self.len -= evicted;
        evicted
    }

    /// Remove a specific event by reference. Returns `true` if removed.
    pub fn remove(&mut self, r: &EventRef) -> bool {
        if let Some(slot) = self.slots.get_mut(r.index as usize) {
            if slot.generation == r.generation && slot.data.is_some() {
                slot.data = None;
                slot.generation += 1;
                self.free_list.push(r.index);
                self.len -= 1;
                return true;
            }
        }
        false
    }
}

impl Default for SharedBuffer {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_event(kind: &str, entity: &str, ts: u64) -> EventData {
        EventData {
            signal_kind: kind.into(),
            entity_id: entity.into(),
            timestamp: ts,
            fields: vec![],
        }
    }

    fn make_event_with_fields(kind: &str, ts: u64, fields: Vec<(&str, f64)>) -> EventData {
        EventData {
            signal_kind: kind.into(),
            entity_id: "e1".into(),
            timestamp: ts,
            fields: fields.into_iter().map(|(k, v)| (k.into(), v)).collect(),
        }
    }

    #[test]
    fn insert_and_get() {
        let mut buf = SharedBuffer::new();
        let r = buf.insert(make_event("ais", "vessel-1", 1000));
        assert_eq!(buf.len(), 1);
        let data = buf.get(&r).unwrap();
        assert_eq!(data.signal_kind, "ais");
        assert_eq!(data.entity_id, "vessel-1");
        assert_eq!(data.timestamp, 1000);
    }

    #[test]
    fn get_returns_none_after_eviction() {
        let mut buf = SharedBuffer::new();
        let r1 = buf.insert(make_event("ais", "v1", 100));
        let r2 = buf.insert(make_event("ais", "v2", 200));
        buf.evict_before(150);
        assert!(buf.get(&r1).is_none(), "Evicted event should return None");
        assert!(buf.get(&r2).is_some(), "Non-evicted event should be alive");
        assert_eq!(buf.len(), 1);
    }

    #[test]
    fn slot_reuse_after_eviction() {
        let mut buf = SharedBuffer::new();
        let r1 = buf.insert(make_event("ais", "v1", 100));
        assert_eq!(r1.index, 0);
        buf.evict_before(200);
        assert_eq!(buf.len(), 0);

        // Insert reuses slot 0 with bumped generation.
        let r2 = buf.insert(make_event("adsb", "a1", 300));
        assert_eq!(r2.index, 0);
        assert!(r2.generation > r1.generation);
        assert_eq!(buf.len(), 1);

        // Old ref is stale.
        assert!(buf.get(&r1).is_none());
        assert_eq!(buf.get(&r2).unwrap().signal_kind, "adsb");
    }

    #[test]
    fn evict_returns_count() {
        let mut buf = SharedBuffer::new();
        for i in 0..10 {
            buf.insert(make_event("ais", "v", i * 100));
        }
        let evicted = buf.evict_before(500);
        assert_eq!(evicted, 5); // timestamps 0, 100, 200, 300, 400
        assert_eq!(buf.len(), 5);
    }

    #[test]
    fn remove_specific_event() {
        let mut buf = SharedBuffer::new();
        let r1 = buf.insert(make_event("ais", "v1", 100));
        let r2 = buf.insert(make_event("ais", "v2", 200));
        assert!(buf.remove(&r1));
        assert!(buf.get(&r1).is_none());
        assert!(buf.get(&r2).is_some());
        assert_eq!(buf.len(), 1);

        // Double remove returns false.
        assert!(!buf.remove(&r1));
    }

    #[test]
    fn event_ref_is_copy_and_small() {
        assert_eq!(std::mem::size_of::<EventRef>(), 16);
        let r = EventRef {
            index: 0,
            generation: 0,
            timestamp: 0,
        };
        let r2 = r; // Copy
        assert_eq!(r, r2);
    }

    #[test]
    fn with_capacity_preallocates() {
        let buf = SharedBuffer::with_capacity(1000);
        assert_eq!(buf.len(), 0);
        assert!(buf.is_empty());
    }

    #[test]
    fn event_data_field_lookup() {
        let e = make_event_with_fields("ais", 1000, vec![("speed", 12.5), ("heading", 270.0)]);
        assert_eq!(e.field("speed"), Some(12.5));
        assert_eq!(e.field("heading"), Some(270.0));
        assert_eq!(e.field("missing"), None);
    }

    #[test]
    fn large_buffer_stress() {
        let mut buf = SharedBuffer::with_capacity(10_000);
        let mut refs = Vec::new();
        for i in 0..10_000u64 {
            refs.push(buf.insert(make_event("ais", "v1", i)));
        }
        assert_eq!(buf.len(), 10_000);

        // Evict first half.
        let evicted = buf.evict_before(5_000);
        assert_eq!(evicted, 5_000);
        assert_eq!(buf.len(), 5_000);

        // First half stale, second half alive.
        assert!(buf.get(&refs[0]).is_none());
        assert!(buf.get(&refs[4999]).is_none());
        assert!(buf.get(&refs[5000]).is_some());
        assert!(buf.get(&refs[9999]).is_some());
    }
}
