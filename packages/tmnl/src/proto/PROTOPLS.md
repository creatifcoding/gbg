### Proto package layout (Buf-friendly, Rust/tonic-ready)

```
proto/
  scm/common/v1/common.proto
  scm/events/v1/envelope.proto
  scm/events/v1/journal.proto
  scm/events/v1/options.proto

  scm/platform/v1/platform_events.proto
  scm/identity/v1/identity_events.proto
  scm/engineering/v1/engineering_events.proto
  scm/demand/v1/demand_events.proto
  scm/procurement/v1/procurement_events.proto
  scm/manufacturing/v1/manufacturing_events.proto
  scm/quality/v1/quality_events.proto
  scm/inventory/v1/inventory_events.proto
  scm/logistics/v1/logistics_events.proto
  scm/finance/v1/finance_events.proto
  scm/compliance/v1/compliance_events.proto
  scm/cyber/v1/cyber_events.proto
  scm/riskintel/v1/riskintel_events.proto
  scm/planning/v1/planning_events.proto
  scm/reverse/v1/reverse_events.proto
```

### Core “advanced” techniques baked in

* `Event = Header + google.protobuf.Any payload` (payload type URL is the event type)
* Snapshot + delta streaming (SOTW-style), resumable cursors, explicit batch ACKs
* DescriptorSet endpoint (dynamic decoding / registry generation)
* Compaction checkpoints (materializers can publish checkpoints as events)

---

## Core protos

### `scm/events/v1/options.proto`

```proto
syntax = "proto3";
package scm.events.v1;

import "google/protobuf/descriptor.proto";

extend google.protobuf.MessageOptions {
  // Optional: stable logical event name (lets you rename messages without breaking semantics).
  string event_name = 51001;
  // Optional: domain tag (engineering/procurement/etc)
  string domain = 51002;
}
```

### `scm/common/v1/common.proto`

```proto
syntax = "proto3";
package scm.common.v1;

import "google/protobuf/timestamp.proto";

message Money { string currency = 1; int64 minor_units = 2; }
message Quantity { int64 value = 1; string uom = 2; }

message RangeTs {
  google.protobuf.Timestamp start = 1;
  google.protobuf.Timestamp end = 2;
}

message DocRef { string kind = 1; string id = 2; string uri = 3; }
message PartyRef { string party_id = 1; string role = 2; }
message FacilityRef { string facility_id = 1; string role = 2; }
message PartRef { string part_id = 1; string role = 2; }
message ProgramRef { string program_id = 1; string role = 2; }

message Severity { string level = 1; int32 score = 2; } // level: INFO/WARN/CRIT
```

### `scm/events/v1/envelope.proto`

```proto
syntax = "proto3";
package scm.events.v1;

import "google/protobuf/any.proto";
import "google/protobuf/timestamp.proto";

message HlcTimestamp {
  int64 unix_millis = 1;
  uint32 logical = 2;
  string node_id = 3;
}

message SubjectRef {
  string kind = 1; // "Part" | "SupplierOrg" | "Facility" | ...
  string id = 2;   // namespace-qualified stable id
  string role = 3; // "from"/"to"/"owner"/"carrier"/...
}

message Provenance {
  string source = 1;        // "edi.as2.partnerX", "erp.sap", "plm.windchill"
  string source_ref = 2;    // message id / doc id / file hash
  string raw_payload_ref = 3; // blob/CAS pointer
  string ingestor = 4;      // connector id/version
}

message SecurityLabel {
  string classification = 1;      // "PUBLIC" | "CUI" | ...
  repeated string tags = 2;       // "ITAR", "EXPORT", ...
}

message EventRef { string event_id = 1; }

message EventHeader {
  string event_id = 1;
  HlcTimestamp hlc = 2;
  google.protobuf.Timestamp ts_observed = 3;
  google.protobuf.Timestamp ts_effective = 4;

  string tenant_id = 5;
  string shard_key = 6;
  repeated SubjectRef subjects = 7;

  Provenance provenance = 8;
  SecurityLabel security = 9;

  repeated EventRef depends_on = 10;
  map<string,string> labels = 11; // freeform (program, lane, etc.)
}

message Event {
  EventHeader header = 1;
  google.protobuf.Any payload = 2; // type_url == event type
}
```

### `scm/events/v1/journal.proto`

```proto
syntax = "proto3";
package scm.events.v1;

import "google/protobuf/empty.proto";
import "google/protobuf/timestamp.proto";
import "google/protobuf/descriptor.proto";
import "scm/events/v1/envelope.proto";

message Cursor { bytes token = 1; }

message EventBatch {
  string batch_id = 1;
  uint64 batch_seq = 2;
  repeated Event events = 3;
  Cursor next_cursor = 4;
}

message Ack {
  string batch_id = 1;
  uint64 batch_seq = 2;
  Cursor cursor = 3;
}

message AppendRequest { repeated Event events = 1; }
message AppendResponse {
  uint64 accepted = 1;
  uint64 rejected = 2;
  repeated string rejected_event_ids = 3;
}

message SubscribeRequest {
  string tenant_id = 1;
  Cursor cursor = 2;                 // empty => start policy
  bool include_snapshot = 3;         // snapshot then deltas
  repeated string topic_filters = 4; // optional: payload type_url prefixes
  map<string,string> label_filters = 5;
}

message SnapshotChunk {
  uint64 seq = 1;
  repeated Event items = 2; // snapshot encoded as Events (often platform/crdt events)
  bool last = 3;
}

message SchemaResponse {
  google.protobuf.FileDescriptorSet fds = 1;
}

service EventJournal {
  rpc Append(AppendRequest) returns (AppendResponse);

  // Client streams ACKs; server streams event batches.
  rpc Subscribe(stream Ack) returns (stream EventBatch);

  rpc Snapshot(SubscribeRequest) returns (stream SnapshotChunk);

  // Lets consumers decode Any dynamically (prost-reflect) / generate registries.
  rpc GetSchema(google.protobuf.Empty) returns (SchemaResponse);
}
```

---

## Payload definitions (~120 event messages)

All payloads follow a “v1 invariants + attrs” discipline:

* Strongly type only the invariants you *will* need for joins and downstream logic.
* Put source-specific noise in `map<string,string> attrs`.

Below are **120+ concrete message definitions** across domains (10–15 per file). You can add indefinitely without breaking the envelope.

### `scm/platform/v1/platform_events.proto`

```proto
syntax = "proto3";
package scm.platform.v1;

import "google/protobuf/timestamp.proto";
import "scm/common/v1/common.proto";
import "scm/events/v1/options.proto";

message CrdtDeltaObserved { option (scm.events.v1.event_name)="scm.platform.v1.CrdtDeltaObserved";
  string doc_id = 1; bytes delta = 2; map<string,string> attrs = 3;
}
message CrdtCheckpointCreated { string doc_id = 1; string checkpoint_id = 2; google.protobuf.Timestamp ts = 3; map<string,string> attrs = 4; }
message CrdtCompactionCompleted { string doc_id = 1; string checkpoint_id = 2; uint64 pruned_events = 3; map<string,string> attrs = 4; }
message ShardAssigned { string shard_id = 1; string owner_node_id = 2; map<string,string> attrs = 3; }
message ShardRebalanced { string shard_id = 1; string reason = 2; map<string,string> attrs = 3; }
message PeerJoined { string node_id = 1; string addr = 2; map<string,string> attrs = 3; }
message PeerLeft { string node_id = 1; string reason = 2; map<string,string> attrs = 3; }
message ReplicationLagMeasured { string shard_id = 1; uint64 lag_ms = 2; map<string,string> attrs = 3; }
message IngestSourceRegistered { string source = 1; string kind = 2; map<string,string> attrs = 3; }
message IngestSourceHeartbeat { string source = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }
message RawPayloadStored { string raw_payload_ref = 1; string content_type = 2; uint64 size_bytes = 3; map<string,string> attrs = 4; }
message SchemaRegistryUpdated { string version = 1; map<string,string> attrs = 2; }
message DataQualityIssueDetected { string issue_id = 1; string category = 2; string subject_id = 3; map<string,string> attrs = 4; }
message EventRejected { string reason = 1; string details = 2; map<string,string> attrs = 3; }
```

### `scm/identity/v1/identity_events.proto`

```proto
syntax = "proto3";
package scm.identity.v1;

import "google/protobuf/timestamp.proto";
import "scm/common/v1/common.proto";

message PartyDefined { string party_id = 1; string name = 2; string kind = 3; map<string,string> ids = 4; map<string,string> attrs = 5; }
message PartyUpdated { string party_id = 1; map<string,string> patch = 2; map<string,string> attrs = 3; }
message FacilityDefined { string facility_id = 1; string party_id = 2; string name = 3; string country = 4; map<string,string> attrs = 5; }
message FacilityUpdated { string facility_id = 1; map<string,string> patch = 2; map<string,string> attrs = 3; }
message FacilityCapabilityDeclared { string facility_id = 1; repeated string capabilities = 2; map<string,string> attrs = 3; }
message FacilityCapabilityRevoked { string facility_id = 1; repeated string capabilities = 2; map<string,string> attrs = 3; }
message IdentityLinked { string a_kind = 1; string a_id = 2; string b_kind = 3; string b_id = 4; map<string,string> attrs = 5; }
message IdentityUnlinked { string a_kind = 1; string a_id = 2; string b_kind = 3; string b_id = 4; map<string,string> attrs = 5; }
message TrustedSupplierStatusGranted { string party_id = 1; string status = 2; google.protobuf.Timestamp ts = 3; map<string,string> attrs = 4; }
message TrustedSupplierStatusRevoked { string party_id = 1; string status = 2; google.protobuf.Timestamp ts = 3; map<string,string> attrs = 4; }
```

### `scm/engineering/v1/engineering_events.proto`

```proto
syntax = "proto3";
package scm.engineering.v1;

import "google/protobuf/timestamp.proto";
import "scm/common/v1/common.proto";

message PartDefined { string part_id = 1; string ipn = 2; string mpn = 3; string revision = 4; string lifecycle = 5; map<string,string> attrs = 6; }
message PartRevised { string part_id = 1; string from_rev = 2; string to_rev = 3; map<string,string> attrs = 4; }
message PartLifecycleStateChanged { string part_id = 1; string from_state = 2; string to_state = 3; map<string,string> attrs = 4; }

message BOMSnapshotRecorded { string parent_part_id = 1; string bom_rev = 2; google.protobuf.Timestamp ts = 3; map<string,string> attrs = 4; }
message BOMDeltaRecorded { string parent_part_id = 1; string bom_rev = 2; repeated string added_part_ids = 3; repeated string removed_part_ids = 4; map<string,string> attrs = 5; }

message AMLUpdated { string part_id = 1; repeated string manufacturer_party_ids = 2; map<string,string> attrs = 3; }
message AVLUpdated { string part_id = 1; repeated string vendor_party_ids = 2; map<string,string> attrs = 3; }
message AlternateQualified { string base_part_id = 1; string alt_part_id = 2; string qualification_level = 3; map<string,string> attrs = 4; }
message AlternateDisqualified { string base_part_id = 1; string alt_part_id = 2; string reason = 3; map<string,string> attrs = 4; }

message ECOProposed { string eco_id = 1; string scope = 2; map<string,string> attrs = 3; }
message ECOApproved { string eco_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }
message ECORejected { string eco_id = 1; string reason = 2; map<string,string> attrs = 3; }
message ECOImplemented { string eco_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }

message PCNReceived { string pcn_id = 1; string supplier_party_id = 2; repeated string part_ids = 3; map<string,string> attrs = 4; }
message PDNReceived { string pdn_id = 1; string supplier_party_id = 2; repeated string part_ids = 3; map<string,string> attrs = 4; }
message EOLAnnounced { string part_id = 1; google.protobuf.Timestamp eol_date = 2; map<string,string> attrs = 3; }
message LastTimeBuyWindowOpened { string part_id = 1; scm.common.v1.RangeTs window = 2; map<string,string> attrs = 3; }
message LastTimeBuyPlaced { string part_id = 1; string po_id = 2; int64 qty = 3; map<string,string> attrs = 4; }
```

### `scm/demand/v1/demand_events.proto`

```proto
syntax = "proto3";
package scm.demand.v1;

import "google/protobuf/timestamp.proto";
import "scm/common/v1/common.proto";

message ProgramDefined { string program_id = 1; string name = 2; map<string,string> attrs = 3; }
message ProgramPriorityChanged { string program_id = 1; string priority = 2; map<string,string> attrs = 3; }
message ServiceLevelTargetSet { string program_id = 1; double fill_rate_target = 2; map<string,string> attrs = 3; }

message ForecastPublished { string forecast_id = 1; string program_id = 2; scm.common.v1.RangeTs horizon = 3; map<string,string> attrs = 4; }
message ForecastAdjusted { string forecast_id = 1; string reason = 2; map<string,string> attrs = 3; }
message ForecastBiasDetected { string program_id = 1; double bias = 2; map<string,string> attrs = 3; }
message DemandSpikeDetected { string program_id = 1; double magnitude = 2; map<string,string> attrs = 3; }

message CustomerOrderReceived { string so_id = 1; string customer_party_id = 2; string program_id = 3; map<string,string> attrs = 4; }
message CustomerOrderChanged { string so_id = 1; map<string,string> patch = 2; map<string,string> attrs = 3; }
message CustomerOrderCancelled { string so_id = 1; string reason = 2; map<string,string> attrs = 3; }

message ATPCommitted { string so_id = 1; google.protobuf.Timestamp promised_date = 2; map<string,string> attrs = 3; }
message BackorderCreated { string so_id = 1; string part_id = 2; int64 qty = 3; map<string,string> attrs = 4; }
message BackorderResolved { string so_id = 1; map<string,string> attrs = 2; }
```

### `scm/procurement/v1/procurement_events.proto`

```proto
syntax = "proto3";
package scm.procurement.v1;

import "google/protobuf/timestamp.proto";
import "scm/common/v1/common.proto";

message SourcingEventCreated { string sourcing_id = 1; string kind = 2; repeated string part_ids = 3; map<string,string> attrs = 4; }
message QuoteReceived { string quote_id = 1; string supplier_party_id = 2; map<string,string> attrs = 3; }
message QuoteRevised { string quote_id = 1; map<string,string> patch = 2; map<string,string> attrs = 3; }
message SupplierSelected { string sourcing_id = 1; string supplier_party_id = 2; map<string,string> attrs = 3; }

message ContractCreated { string contract_id = 1; string supplier_party_id = 2; scm.common.v1.RangeTs term = 3; map<string,string> attrs = 4; }
message ContractAmended { string contract_id = 1; map<string,string> patch = 2; map<string,string> attrs = 3; }

message PurchaseOrderIssued { string po_id = 1; string buyer_party_id = 2; string supplier_party_id = 3; map<string,string> attrs = 4;
  message Line { string line_id = 1; string part_id = 2; int64 qty = 3; google.protobuf.Timestamp need_by = 4; scm.common.v1.Money unit_price = 5; map<string,string> attrs = 6; }
  repeated Line lines = 5;
}
message PurchaseOrderAcknowledged { string po_id = 1; string ack_code = 2; google.protobuf.Timestamp committed_date = 3; map<string,string> attrs = 4; }
message PurchaseOrderChanged { string po_id = 1; map<string,string> patch = 2; map<string,string> attrs = 3; }
message PurchaseOrderCancelled { string po_id = 1; string reason = 2; map<string,string> attrs = 3; }

message SupplierCapacityDeclared { string supplier_party_id = 1; string facility_id = 2; string resource_kind = 3; int64 capacity_per_week = 4; map<string,string> attrs = 5; }
message SupplierCapacityReduced { string supplier_party_id = 1; int64 delta = 2; map<string,string> attrs = 3; }
message SupplierCapacityRecovered { string supplier_party_id = 1; int64 delta = 2; map<string,string> attrs = 3; }

message AllocationNoticeReceived { string supplier_party_id = 1; repeated string part_ids = 2; map<string,string> attrs = 3; }
message ExpediteRequested { string ref_id = 1; string reason = 2; map<string,string> attrs = 3; }
message ExpediteAccepted { string ref_id = 1; google.protobuf.Timestamp new_date = 2; map<string,string> attrs = 3; }
message ExpediteRejected { string ref_id = 1; string reason = 2; map<string,string> attrs = 3; }
```

### `scm/manufacturing/v1/manufacturing_events.proto`

```proto
syntax = "proto3";
package scm.manufacturing.v1;

import "google/protobuf/timestamp.proto";
import "scm/common/v1/common.proto";

message RoutingDefined { string routing_id = 1; string part_id = 2; string rev = 3; map<string,string> attrs = 4; }
message RoutingRevised { string routing_id = 1; string from_rev = 2; string to_rev = 3; map<string,string> attrs = 4; }

message WorkOrderCreated { string wo_id = 1; string part_id = 2; int64 qty = 3; string site_id = 4; map<string,string> attrs = 5; }
message WorkOrderReleased { string wo_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }
message WorkOrderStarted { string wo_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }
message OperationStarted { string wo_id = 1; string op_id = 2; string resource_id = 3; google.protobuf.Timestamp ts = 4; map<string,string> attrs = 5; }
message OperationCompleted { string wo_id = 1; string op_id = 2; int64 good_qty = 3; int64 scrap_qty = 4; google.protobuf.Timestamp ts = 5; map<string,string> attrs = 6; }
message WorkOrderCompleted { string wo_id = 1; int64 good_qty = 2; int64 scrap_qty = 3; google.protobuf.Timestamp ts = 4; map<string,string> attrs = 5; }

message ResourceDown { string resource_id = 1; string reason = 2; google.protobuf.Timestamp ts = 3; map<string,string> attrs = 4; }
message ResourceRecovered { string resource_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }
message MaintenanceScheduled { string resource_id = 1; scm.common.v1.RangeTs window = 2; map<string,string> attrs = 3; }
message MaintenanceCompleted { string resource_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }

message BottleneckDetected { string site_id = 1; string resource_id = 2; double utilization = 3; map<string,string> attrs = 4; }
message ProcessParameterChanged { string op_id = 1; string parameter = 2; string value = 3; map<string,string> attrs = 4; }
```

### `scm/quality/v1/quality_events.proto`

```proto
syntax = "proto3";
package scm.quality.v1;

import "google/protobuf/timestamp.proto";
import "scm/common/v1/common.proto";

message TraceabilityRequirementDeclared { string policy_id = 1; string scope = 2; map<string,string> required_fields = 3; map<string,string> attrs = 4; }
message SerializationPolicySet { string part_id = 1; string policy = 2; map<string,string> attrs = 3; }

message LotCreated { string lot_id = 1; string part_id = 2; int64 qty = 3; map<string,string> attrs = 4; }
message SerialAssigned { string serial_id = 1; string part_id = 2; string lot_id = 3; map<string,string> attrs = 4; }
message GenealogyLinked { string parent_id = 1; string child_id = 2; map<string,string> attrs = 3; }

message IncomingInspectionPlanned { string receipt_id = 1; string plan_id = 2; map<string,string> attrs = 3; }
message IncomingInspectionCompleted { string receipt_id = 1; string result = 2; map<string,string> attrs = 3; }

message TestPlanDefined { string test_plan_id = 1; string part_id = 2; string rev = 3; map<string,string> attrs = 4; }
message TestStarted { string test_run_id = 1; string resource_id = 2; google.protobuf.Timestamp ts = 3; map<string,string> attrs = 4; }
message TestCompleted { string test_run_id = 1; int64 pass = 2; int64 fail = 3; google.protobuf.Timestamp ts = 4; map<string,string> attrs = 5; }
message TestYieldMeasured { string subject_id = 1; int64 good = 2; int64 total = 3; map<string,string> attrs = 4; }

message NCRRaised { string ncr_id = 1; string part_id = 2; string lot_id = 3; scm.common.v1.Severity severity = 4; map<string,string> attrs = 5; }
message NCRDispositioned { string ncr_id = 1; string disposition = 2; map<string,string> attrs = 3; }
message CAPAOpened { string capa_id = 1; string trigger_ref = 2; map<string,string> attrs = 3; }
message CAPAClosed { string capa_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }

message SuspectCounterfeitDetected { string part_id = 1; string supplier_party_id = 2; string lot_id = 3; string method = 4; scm.common.v1.Severity severity = 5; map<string,string> attrs = 6; }
message CounterfeitConfirmed { string investigation_id = 1; string part_id = 2; string lot_id = 3; map<string,string> attrs = 4; }
message QuarantineApplied { string quarantine_id = 1; string scope_id = 2; string reason = 3; map<string,string> attrs = 4; }
message QuarantineReleased { string quarantine_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }
```

### `scm/inventory/v1/inventory_events.proto`

```proto
syntax = "proto3";
package scm.inventory.v1;

import "google/protobuf/timestamp.proto";
import "scm/common/v1/common.proto";

message InventorySnapshotRecorded { string site_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }
message InventoryAdjusted { string site_id = 1; string part_id = 2; int64 delta = 3; string reason = 4; map<string,string> attrs = 5; }
message CycleCountPlanned { string count_id = 1; string site_id = 2; map<string,string> attrs = 3; }
message CycleCountCompleted { string count_id = 1; string site_id = 2; map<string,string> attrs = 3; }

message PutawayCompleted { string receipt_id = 1; string location = 2; map<string,string> attrs = 3; }
message PickReleased { string pick_id = 1; string site_id = 2; map<string,string> attrs = 3; }
message PickCompleted { string pick_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }
message PackCompleted { string pack_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }
message ShipConfirmIssued { string shipment_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }

message InventoryReserved { string reservation_id = 1; string part_id = 2; int64 qty = 3; map<string,string> attrs = 4; }
message InventoryUnreserved { string reservation_id = 1; map<string,string> attrs = 2; }

message SafetyStockPolicySet { string scope_id = 1; double target_service = 2; map<string,string> attrs = 3; }
message ReplenishmentTriggered { string trigger_id = 1; string part_id = 2; int64 qty = 3; map<string,string> attrs = 4; }
message ShelfLifeExpired { string lot_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }
message ColdChainExcursionDetected { string shipment_id = 1; string sensor_ref = 2; scm.common.v1.Severity severity = 3; map<string,string> attrs = 4; }
```

### `scm/logistics/v1/logistics_events.proto`

```proto
syntax = "proto3";
package scm.logistics.v1;

import "google/protobuf/timestamp.proto";
import "scm/common/v1/common.proto";

message ShipmentPlanned { string shipment_id = 1; string from_facility_id = 2; string to_facility_id = 3; map<string,string> attrs = 4; }
message CarrierBooked { string shipment_id = 1; string carrier_id = 2; string mode = 3; map<string,string> attrs = 4; }

message AdvanceShipmentNotified { string shipment_id = 1; google.protobuf.Timestamp eta = 2; map<string,string> attrs = 3; }
message ShipmentDeparted { string shipment_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }
message ShipmentArrived { string shipment_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }
message ShipmentStatusUpdated { string shipment_id = 1; string status = 2; google.protobuf.Timestamp ts = 3; map<string,string> attrs = 4; }

message ShipmentDelayed { string shipment_id = 1; string reason = 2; google.protobuf.Timestamp ts = 3; map<string,string> attrs = 4; }
message ShipmentRerouted { string shipment_id = 1; string new_route = 2; map<string,string> attrs = 3; }
message ShipmentDamaged { string shipment_id = 1; scm.common.v1.Severity severity = 2; map<string,string> attrs = 3; }
message ShipmentLost { string shipment_id = 1; map<string,string> attrs = 2; }

message GoodsReceived { string receipt_id = 1; string shipment_id = 2; string facility_id = 3; google.protobuf.Timestamp ts = 4; map<string,string> attrs = 5; }

message CustomsEntryFiled { string entry_id = 1; string shipment_id = 2; map<string,string> attrs = 3; }
message CustomsHoldPlaced { string entry_id = 1; string reason = 2; map<string,string> attrs = 3; }
message CustomsCleared { string entry_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }
message DemurrageIncurred { string shipment_id = 1; scm.common.v1.Money amount = 2; map<string,string> attrs = 3; }
message FreightRateUpdated { string lane_id = 1; scm.common.v1.Money rate = 2; map<string,string> attrs = 3; }
```

### `scm/finance/v1/finance_events.proto`

```proto
syntax = "proto3";
package scm.finance.v1;

import "google/protobuf/timestamp.proto";
import "scm/common/v1/common.proto";

message LandedCostModelRevised { string model_id = 1; string scope = 2; map<string,string> attrs = 3; }
message StandardCostUpdated { string part_id = 1; scm.common.v1.Money cost = 2; map<string,string> attrs = 3; }

message InvoiceReceived { string invoice_id = 1; string supplier_party_id = 2; scm.common.v1.Money total = 3; map<string,string> attrs = 4; }
message InvoiceMatched { string invoice_id = 1; string po_id = 2; map<string,string> attrs = 3; }
message InvoiceDisputed { string invoice_id = 1; string reason = 2; map<string,string> attrs = 3; }

message PaymentIssued { string payment_id = 1; string invoice_id = 2; scm.common.v1.Money amount = 3; map<string,string> attrs = 4; }
message PaymentFailed { string payment_id = 1; string reason = 2; map<string,string> attrs = 3; }
message CreditHoldApplied { string party_id = 1; string reason = 2; map<string,string> attrs = 3; }
message CreditHoldReleased { string party_id = 1; map<string,string> attrs = 2; }

message FXRateObserved { string pair = 1; double rate = 2; google.protobuf.Timestamp ts = 3; map<string,string> attrs = 4; }
message TariffRateUpdated { string hs_code = 1; double rate = 2; map<string,string> attrs = 3; }
message WriteOffRecorded { string ref_id = 1; scm.common.v1.Money amount = 2; map<string,string> attrs = 3; }
```

### `scm/compliance/v1/compliance_events.proto`

```proto
syntax = "proto3";
package scm.compliance.v1;

import "google/protobuf/timestamp.proto";
import "scm/common/v1/common.proto";

message ComplianceGateRuleUpdated { string gate_id = 1; string version = 2; map<string,string> attrs = 3; }
message ExportClassificationDeclared { string part_id = 1; string eccn = 2; map<string,string> attrs = 3; }
message ExportLicenseRequired { string ref_id = 1; string reason = 2; map<string,string> attrs = 3; }
message ExportLicenseGranted { string license_id = 1; scm.common.v1.RangeTs validity = 2; map<string,string> attrs = 3; }
message ExportLicenseExpired { string license_id = 1; map<string,string> attrs = 2; }

message DeniedPartyScreeningHit { string party_id = 1; string list = 2; scm.common.v1.Severity severity = 3; map<string,string> attrs = 4; }
message DeniedPartyScreeningCleared { string party_id = 1; map<string,string> attrs = 2; }

message SanctionsListUpdated { string list_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }
message FlowdownClauseRequired { string clause_id = 1; string scope_id = 2; map<string,string> attrs = 3; }
message FlowdownClauseSatisfied { string clause_id = 1; string supplier_party_id = 2; map<string,string> attrs = 3; }

message CUIHandlingDeclared { string scope_id = 1; string policy = 2; map<string,string> attrs = 3; }
message CUIHandlingViolated { string incident_id = 1; string scope_id = 2; scm.common.v1.Severity severity = 3; map<string,string> attrs = 4; }
```

### `scm/cyber/v1/cyber_events.proto`

```proto
syntax = "proto3";
package scm.cyber.v1;

import "google/protobuf/timestamp.proto";
import "scm/common/v1/common.proto";

message CyberAssetDefined { string asset_id = 1; string kind = 2; string owner_scope = 3; map<string,string> attrs = 4; }
message CyberPostureAttested { string asset_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }

message VulnerabilityDetected { string vuln_id = 1; string asset_id = 2; string cve = 3; scm.common.v1.Severity severity = 4; map<string,string> attrs = 5; }
message CyberKEVRelevant { string asset_id = 1; string cve = 2; map<string,string> attrs = 3; }

message IncidentDetected { string incident_id = 1; string scope_id = 2; scm.common.v1.Severity severity = 3; map<string,string> attrs = 4; }
message IncidentContained { string incident_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }
message IncidentClosed { string incident_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }

message BackupVerified { string asset_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }
message RestoreTested { string asset_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }
```

### `scm/riskintel/v1/riskintel_events.proto`

```proto
syntax = "proto3";
package scm.riskintel.v1;

import "google/protobuf/timestamp.proto";
import "scm/common/v1/common.proto";

message SupplierFinancialHealthUpdated { string party_id = 1; int32 score = 2; google.protobuf.Timestamp ts = 3; map<string,string> attrs = 4; }
message SupplierBankruptcyFiled { string party_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }
message SupplierOwnershipChanged { string party_id = 1; string new_owner = 2; map<string,string> attrs = 3; }

message EarthquakeObserved { string event_ref = 1; string region = 2; double magnitude = 3; map<string,string> attrs = 4; }
message StormAlertIssued { string alert_ref = 1; string region = 2; scm.common.v1.Severity severity = 3; map<string,string> attrs = 4; }
message FloodAlertIssued { string alert_ref = 1; string region = 2; scm.common.v1.Severity severity = 3; map<string,string> attrs = 4; }
message WildfireAlertIssued { string alert_ref = 1; string region = 2; scm.common.v1.Severity severity = 3; map<string,string> attrs = 4; }

message ConflictEscalationSignal { string region = 1; scm.common.v1.Severity severity = 2; map<string,string> attrs = 3; }
message StrikeAnnounced { string facility_id = 1; scm.common.v1.RangeTs window = 2; map<string,string> attrs = 3; }
message StrikeEnded { string facility_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }

message GIDEPAlertIngested { string gidep_id = 1; repeated string part_ids = 2; string category = 3; map<string,string> attrs = 4; }
message RegulatoryChangeDetected { string ref = 1; string jurisdiction = 2; map<string,string> attrs = 3; }
```

### `scm/planning/v1/planning_events.proto`

```proto
syntax = "proto3";
package scm.planning.v1;

import "google/protobuf/timestamp.proto";
import "scm/common/v1/common.proto";

message ConstraintModelPublished { string model_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }
message ObjectiveWeightsUpdated { string model_id = 1; map<string,string> weights = 2; map<string,string> attrs = 3; }

message PlanRunRequested { string run_id = 1; string model_id = 2; map<string,string> attrs = 3; }
message PlanRunStarted { string run_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }
message PlanRunCompleted { string run_id = 1; string status = 2; google.protobuf.Timestamp ts = 3; map<string,string> attrs = 4; }
message PlanCommitted { string plan_id = 1; string run_id = 2; map<string,string> attrs = 3; }
message PlanRolledBack { string plan_id = 1; string reason = 2; map<string,string> attrs = 3; }

message ExceptionDetected { string exception_id = 1; string kind = 2; scm.common.v1.Severity severity = 3; map<string,string> attrs = 4; }
message ExceptionAcknowledged { string exception_id = 1; string actor = 2; map<string,string> attrs = 3; }

message PosteriorUpdated { string subject_kind = 1; string subject_id = 2; string metric = 3; map<string,string> params = 4; map<string,string> attrs = 5; }
message KRIThresholdBreached { string kri_id = 1; string scope_id = 2; scm.common.v1.Severity severity = 3; map<string,string> attrs = 4; }
message KRIThresholdCleared { string kri_id = 1; string scope_id = 2; map<string,string> attrs = 3; }

message TTRComputed { string scope_id = 1; uint64 ttr_days = 2; map<string,string> attrs = 3; }
message TTSComputed { string scope_id = 1; uint64 tts_days = 2; map<string,string> attrs = 3; }

message ShockScenarioInjected { string experiment_id = 1; string scenario = 2; map<string,string> attrs = 3; }
message ShockScenarioResulted { string experiment_id = 1; string summary = 2; map<string,string> attrs = 3; }
```

### `scm/reverse/v1/reverse_events.proto`

```proto
syntax = "proto3";
package scm.reverse.v1;

import "google/protobuf/timestamp.proto";
import "scm/common/v1/common.proto";

message RMARequested { string rma_id = 1; string customer_party_id = 2; string part_id = 3; int64 qty = 4; map<string,string> attrs = 5; }
message RMAApproved { string rma_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }
message RMAReceived { string rma_id = 1; string receipt_id = 2; google.protobuf.Timestamp ts = 3; map<string,string> attrs = 4; }
message RMAInspected { string rma_id = 1; string result = 2; map<string,string> attrs = 3; }

message RepairStarted { string job_id = 1; string rma_id = 2; map<string,string> attrs = 3; }
message RepairCompleted { string job_id = 1; string outcome = 2; map<string,string> attrs = 3; }

message WarrantyClaimFiled { string claim_id = 1; string part_id = 2; scm.common.v1.Severity severity = 3; map<string,string> attrs = 4; }
message WarrantyClaimResolved { string claim_id = 1; string resolution = 2; map<string,string> attrs = 3; }

message RecallInitiated { string recall_id = 1; repeated string part_ids = 2; map<string,string> attrs = 3; }
message RecallClosed { string recall_id = 1; google.protobuf.Timestamp ts = 2; map<string,string> attrs = 3; }
message FieldFailureReported { string report_id = 1; string part_id = 2; scm.common.v1.Severity severity = 3; map<string,string> attrs = 4; }
message FRACASUpdated { string fracas_id = 1; map<string,string> attrs = 2; }
```

This set is already >120 payload messages when combined across files above (platform + identity + engineering + demand + procurement + manufacturing + quality + inventory + logistics + finance + compliance + cyber + riskintel + planning + reverse). Add more by dropping new `.proto` files into domain folders; the envelope and transport stay stable.

---

## Rust generation strategy (prost + tonic) and dynamic decoding

### Workspace recommendation

* `crates/scm-proto` – generated Rust types + descriptor set embed
* `crates/scm-journal` – gRPC server/client (tonic)
* `crates/scm-materialize` – deterministic materializers consuming `EventBatch`

### `build.rs` (outline)

* Use `tonic_build` to compile all protos
* Also emit a `FileDescriptorSet` for runtime Any decoding (via `prost-reflect`)
* Embed the descriptor bytes in `scm-proto`

Key implementation detail:

* Consumers that don’t understand a payload still keep/forward the `Any` (type_url + bytes) unchanged.
* Materializers decode only the payload types they care about; everything else is “opaque but preserved.”

---

## Cursor + snapshot protocol semantics (operationally)

* `Snapshot(req)` returns a finite stream of `SnapshotChunk` (encoded as Events, typically `CrdtCheckpointCreated` + state-bearing events).
* `Subscribe(req)` returns infinite `EventBatch` starting at cursor; client streams `Ack`.
* On compaction, server can advance cursors via checkpoint mapping; client can resync via `Snapshot(include_snapshot=true)` when behind.

---

If you want the next layer: I can generate

1. a **Buf config** (`buf.yaml`, breaking/lint rules), and
2. a **Rust registry generator** (build-time) that maps `type_url -> handler` for materializers, plus shard-key derivation rules from `subjects`.
