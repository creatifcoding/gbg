# Conceptual Alignment: work-order-workflow

Generated: 2026-01-30T01:32:37.052Z
Rounds: 4

## Current Aligned Model

| Dimension | Value |
|-----------|-------|
| Shape | "WorkOrderContext with hybrid snapshot+live refs, version-tracked updates" |
| Composition | "Activity.make() → RPC client → Effect.Service → Cluster Entity" |
| API | "Context.snapshot() for audit, Context.resolve() for live lookups" |
| Scope | "Assets, Resources, Alarms, Parent/child WorkOrders, External refs via L3 Context" |

*Confirmed in round 3 at 2026-01-30T01:32:37.047Z*

## Alignment History

### Round 3

- **Timestamp:** 2026-01-30T01:32:37.047Z
- **Session:** cap-1769736757020
- **Git:** `b2f0895e`
- **Confirmed:** Yes

**Dimensions:**
- Shape: "WorkOrderContext with hybrid snapshot+live refs, version-tracked updates"
- Composition: "Activity.make() → RPC client → Effect.Service → Cluster Entity"
- API: "Context.snapshot() for audit, Context.resolve() for live lookups"
- Scope: "Assets, Resources, Alarms, Parent/child WorkOrders, External refs via L3 Context"

---

### Round 3

- **Timestamp:** 2026-01-30T01:31:29.015Z
- **Session:** cap-1769736688985
- **Git:** `b2f0895e`
- **Confirmed:** No

**Dimensions:**
- Shape: "WorkOrderContext with hybrid snapshot+live refs, version-tracked updates"
- Composition: "Activity.make() → RPC client → Effect.Service → Cluster Entity"
- API: "Context.snapshot() for audit, Context.resolve() for live lookups"
- Scope: "Assets, Resources, Alarms, Parent/child WorkOrders, External refs via L3 Context"

---

### Round 2

- **Timestamp:** 2026-01-30T00:55:14.698Z
- **Session:** cap-1769734514669
- **Git:** `b2f0895e`
- **Confirmed:** Yes

**Dimensions:**
- Shape: "Dynamic Workflow DAG - WorkflowDefinition (template) + WorkOrder (instance)"
- Composition: "Nested workflows with reusable procedure templates, versioned"
- API: "WorkOrder references WorkflowDefinitionId, Workflow.make() for runtime"
- Scope: "L3 MES/MOM, event-sourced, resource/time-constrained, audit-logged"

---

### Round 2

- **Timestamp:** 2026-01-30T00:53:14.279Z
- **Session:** cap-1769734394250
- **Git:** `b2f0895e`
- **Confirmed:** No

**Dimensions:**
- Shape: "Dynamic Workflow DAG - WorkflowDefinition (template) + WorkOrder (instance)"
- Composition: "Nested workflows with reusable procedure templates, versioned"
- API: "WorkOrder references WorkflowDefinitionId, contains task instances with approval gates"
- Scope: "L3 MES/MOM, event-sourced, resource/time-constrained, audit-logged"

---
