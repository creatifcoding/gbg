---
title: "ISA-95 Equipment Hierarchy Reference"
date: 2026-01-26
status: Active
source: thoughts/shared/research/2026-01-26-isa95-standards.md
---

# ISA-95 Equipment Hierarchy Reference

**Standard:** ANSI/ISA-95 (US) / IEC 62264 (International)
**Purpose:** Enterprise-Control System Integration

## Functional Hierarchy (Levels)

ISA-95 defines a 5-level functional hierarchy separating enterprise and control systems:

```
Level 4: Business Planning & Logistics
         ERP, Supply Chain, Business Systems
              |
Level 3: Manufacturing Operations Management (MOM)
         MES, Scheduling, Dispatching, Quality
              |
Level 2: Monitoring, Supervisory Control
         SCADA, HMI, Batch Control
              |
Level 1: Sensing & Manipulation
         PLCs, Sensors, Actuators
              |
Level 0: Physical Process
         Actual production process
```

**Key boundary:** ISA-95 primarily addresses the Level 3-4 interface (MES to ERP).

## Equipment Hierarchy

### Standard Hierarchy

```
Enterprise                    (L4 - Business Planning)
  +-- Site                    (L3 - Geographic location)
       +-- Area               (L2 - Supervisory Control)
       |    +-- Plant         (L3 - Functional manufacturing unit)
       |         +-- Line     (L1 - Production line / Work Center)
       |              +-- WorkCell   (L1 - Work Unit)
       |              +-- Machine    (L1 - Equipment)
       |                   +-- Sensor   (L0 - Read / Control Module)
       |                   +-- Device   (L0 - Write / Actuator)
```

### TMNL Entity Mapping

| ISA-95 Level | ISA-95 Term | TMNL Entity | ID Prefix | Automation Level |
|:---:|-------------|-------------|:---------:|:---:|
| L4 | Enterprise | Enterprise | ENT- | 4 |
| L3 | Site | Site | SIT- | 3 |
| L2 | Area | Area | ARA- | 2 |
| L3 | Process Cell / Production Unit | Plant | PLT- | 3 |
| L1 | Production Line / Work Center | Line | LIN- | 1 |
| L1 | Work Unit / Work Cell | WorkCell | WCL- | 1 |
| L1 | Equipment | Machine | MCH- | 1 |
| L0 | Control Module (read) | Sensor | SNS- | 0 |
| L0 | Control Module (write) | Device | DEV- | 0 |

### Valid Parent-Child Relationships

```
                    Valid Parent -->
Child               ENT  SIT  ARA  PLT  LIN  WCL  MCH
------------------------------------------------------------
Enterprise           -    x    x    x    x    x    x
Site                 Y    -    x    x    x    x    x
Area                 x    Y    -    x    x    x    x
Plant                x    Y    Y    -    x    x    x
Line                 x    x    x    Y    -    x    x
WorkCell             x    x    x    x    Y    -    x
Machine              x    x    x    x    Y    Y    -
Sensor               x    x    x    x    x    x    Y
Device               x    x    x    x    x    x    Y

Y = valid parent, x = invalid, - = self
```

## Automation Level Descriptions

| Level | Name | Systems | TMNL Scope |
|:---:|------|---------|------------|
| 4 | Business Planning | ERP, BI | Future integration |
| 3 | Manufacturing Ops | MES, MOM | AMS v3 |
| 2 | Supervisory Control | SCADA, HMI | IIoT Services |
| 1 | Automation Control | PLC, DCS | Control Module schemas |
| 0 | Physical Process | Sensors, Actuators | `sensor_readings` hypertable |

## Status Definitions

### Asset Status (all entity types)

| Status | Description |
|--------|-------------|
| `planned` | Created but not yet commissioned |
| `active` | Operational and producing |
| `inactive` | Temporarily offline |
| `maintenance` | Under scheduled maintenance |
| `decommissioned` | Permanently retired (terminal state) |

### Equipment State (ISA-88 / OEE)

| State | Description | OEE Category |
|-------|-------------|:---:|
| `running` | Active production | Availability: up |
| `idle` | Available but not producing | Availability: up |
| `stopped` | Controlled stop | Availability: down |
| `changeover` | Product/tool change | Availability: down |
| `planned_downtime` | Scheduled stop | Availability: excluded |
| `unplanned_downtime` | Breakdown | Availability: down |
| `maintenance` | Active maintenance | Availability: excluded |
| `faulted` | Error condition | Availability: down |

## Information Categories (Part 1)

ISA-95 defines four resource categories exchanged between Level 3 and Level 4:

| Category | Description | TMNL Implementation |
|----------|-------------|---------------------|
| **Personnel** | Human resources and skills | Future (work order assignees) |
| **Equipment** | Physical equipment for production | Entity system (9 ISA-95 types) |
| **Material** | Raw materials, intermediates, products | Future |
| **Process Segment** | Resource grouping for process steps | Future |

## Key Distinction: Equipment vs Physical Asset

| Concept | Meaning | Example |
|---------|---------|---------|
| **Equipment** | Role-based (what it does) | "Mixer Station 3" |
| **Physical Asset** | Identity-based (what it is) | "Acme Mixer Model X, Serial #12345" |

A physical asset can implement different equipment roles over time.

## Operations Types (Part 3)

| Type | Description | TMNL Domain |
|------|-------------|-------------|
| Production | Transform materials | Equipment state tracking, OEE |
| Maintenance | Maintain equipment | Work orders |
| Quality | Verify quality | Alarm management (ISA-18.2) |
| Inventory | Manage materials | Future |

## External References

| Resource | URL |
|----------|-----|
| B2MML GitHub | `https://github.com/MESAInternational/B2MML-BatchML` |
| OPC UA ISA-95 NodeSet | `https://github.com/OPCFoundation/UA-Nodeset/tree/latest/ISA-95` |
| ISA Website | `https://www.isa.org` |
| MESA International | `https://mesa.org` |

## Related Documents

- [Entity System Specification](../specifications/entity-system.md)
- [ADR-004: Entity System Architecture](../decisions/adr-004-entity-system-architecture.md)
- Source: `thoughts/shared/research/2026-01-26-isa95-standards.md`
