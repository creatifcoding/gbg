# ISA-95 / IEC 62264 Standards Reference

**Generated:** 2026-01-26
**Standard:** ANSI/ISA-95 (US) / IEC 62264 (International)
**Purpose:** Enterprise-Control System Integration

---

## Overview

ISA-95 (ANSI/ISA-95) is an international standard from the International Society of Automation (ISA) for developing automated interfaces between enterprise and control systems. The standard is known internationally as IEC 62264.

### Key Characteristics
- Developed for global manufacturers
- Applies to all industries
- Supports batch, continuous, and repetitive processes
- Defines models, terminology, and data exchanges between business and manufacturing systems

### Standard Organization

| Part | Title | Focus |
|------|-------|-------|
| Part 1 | Models and Terminology | Equipment hierarchy, functional hierarchy |
| Part 2 | Object Model Attributes | Attributes for objects defined in Part 1 |
| Part 3 | Activity Models of MOM | Manufacturing Operations Management activities |
| Part 4 | Object Models for MOM | Object models and attributes for MOM |
| Part 5 | B2M Transactions | Business-to-manufacturing transactions |
| Part 6 | Messaging Service Model | Service-oriented messaging |
| Part 7 | Alias Service Model | Alias mapping services |
| Part 8 | Information Exchange | Integration with STEP |

---

## Part 1: Models and Terminology

### Functional Hierarchy (Levels)

ISA-95 defines a functional hierarchy that separates enterprise and control system functions:

```
Level 4: Business Planning & Logistics
         └── ERP, Supply Chain, Business Systems
              │
              ▼
Level 3: Manufacturing Operations Management (MOM)
         └── MES, Scheduling, Dispatching, Quality
              │
              ▼
Level 2: Monitoring, Supervisory Control
         └── SCADA, HMI, Batch Control
              │
              ▼
Level 1: Sensing & Manipulation
         └── PLCs, Sensors, Actuators
              │
              ▼
Level 0: Physical Process
         └── Actual production process
```

**Key Boundary:** ISA-95 primarily addresses the Level 3-4 interface (MES to ERP).

### Role-Based Equipment Hierarchy

The equipment hierarchy defines organizational levels for manufacturing resources:

```
Enterprise
    └── Site
         └── Area
              └── Work Center (Process Cell / Production Unit / Production Line)
                   └── Work Unit (Unit / Work Cell / Storage Zone)
```

#### Hierarchy Levels (from B2MML EquipmentLevelType)

| Level | Description | Example |
|-------|-------------|---------|
| **Enterprise** | Top-level business entity | Acme Corporation |
| **Site** | Physical location | Chicago Plant |
| **Area** | Functional section of site | Assembly Area |
| **Work Center** | Process Cell (batch), Production Unit (continuous), Production Line (discrete) | Mixing Station |
| **Work Unit** | Unit (batch), Storage Zone, Work Cell | Reactor 1 |

#### B2MML HierarchyScope Type
```xml
<HierarchyScopeType>
  <EquipmentID>reactor-001</EquipmentID>
  <EquipmentLevel>Work Unit</EquipmentLevel>
  <HierarchyScopeChild>...</HierarchyScopeChild>
</HierarchyScopeType>
```

### Information Categories

ISA-95 defines four main resource categories exchanged between Level 3 and Level 4:

| Category | Description | Examples |
|----------|-------------|----------|
| **Personnel** | Human resources and skills | Operators, qualifications |
| **Equipment** | Physical equipment for production | Machines, tools, sensors |
| **Material** | Raw materials, intermediates, products | Inventory, lots, sublots |
| **Process Segment** | Logical grouping of resources for a process step | Recipe segments |

---

## Part 2: Object Model Attributes

### Personnel Model

#### PersonnelClass
A grouping of persons with similar characteristics for scheduling, capability, and performance.

```
PersonnelClass
  ├── ID: Identifier
  ├── Description: Text[]
  ├── PersonnelClassProperty[]: Class-level properties
  ├── PersonnelClassChild[]: Nested classes
  └── TestSpecificationID[]: Associated qualifications
```

#### Person
A specifically identified individual.

```
Person
  ├── ID: Identifier
  ├── PersonName: Structured name
  ├── Description: Text[]
  ├── PersonProperty[]: Instance properties
  ├── PersonnelClassID[]: Class memberships
  ├── OperationalLocation: Current location
  ├── SpatialDefinition: Geographic data
  └── TestSpecificationID[]: Qualifications
```

### Equipment Model

#### EquipmentClass
A grouping of equipment with similar characteristics.

```
EquipmentClass
  ├── ID: Identifier
  ├── EquipmentLevel: Enterprise|Site|Area|WorkCenter|WorkUnit
  ├── Description: Text[]
  ├── EquipmentClassProperty[]: Class-level properties
  ├── EquipmentClassChild[]: Nested classes
  ├── EquipmentClassBaseID[]: Parent classes (inheritance)
  └── TestSpecificationID[]: Associated tests
```

#### Equipment
A specific piece of equipment.

```
Equipment
  ├── ID: Identifier
  ├── EquipmentLevel: Hierarchy level
  ├── Description: Text[]
  ├── EquipmentProperty[]: Instance properties
  ├── EquipmentChild[]: Contained equipment
  ├── EquipmentClassID[]: Class memberships
  ├── PhysicalAssetID: Link to physical asset
  ├── OperationalLocation: Current location
  ├── SpatialDefinition: Geographic data
  └── EquipmentAssetMapping[]: Asset mappings
```

### Material Model

#### Material Hierarchy

```
MaterialClass
    └── MaterialDefinition (product definition)
         └── MaterialLot (specific batch/lot)
              └── MaterialSubLot (portion of lot)
```

#### MaterialClass
```
MaterialClass
  ├── ID: Identifier
  ├── MaterialClassProperty[]: Properties
  ├── MaterialClassBaseID[]: Parent classes
  ├── AssemblyClass[]: Component classes (BOM)
  └── TestSpecificationID[]: Quality tests
```

#### MaterialDefinition
```
MaterialDefinition
  ├── ID: Identifier (SKU, part number)
  ├── MaterialClassID[]: Class memberships
  ├── MaterialDefinitionProperty[]: Properties
  ├── AssemblyDefinition[]: BOM components
  └── TestSpecificationID[]: Quality specs
```

#### MaterialLot
```
MaterialLot
  ├── ID: Identifier (lot/batch number)
  ├── MaterialDefinitionID: Product reference
  ├── Status: Lot status
  ├── Quantity: Amount with UoM
  ├── StorageLocation: Where stored
  ├── MaterialLotProperty[]: Properties
  └── MaterialSubLot[]: Sublots
```

### Physical Asset Model

Physical assets represent the actual physical items (distinct from role-based equipment).

```
PhysicalAsset
  ├── ID: Asset tag/serial number
  ├── PhysicalAssetClassID[]: Asset classifications
  ├── PhysicalAssetProperty[]: Properties
  ├── PhysicalAssetChild[]: Contained assets
  ├── EquipmentID: Equipment role mapping
  └── SpatialDefinition: Location data
```

**Key Distinction:**
- **Equipment** = Role-based (what it does)
- **Physical Asset** = Identity-based (what it is)

A physical asset can implement different equipment roles over time.

---

## Part 3: Activity Models of Manufacturing Operations Management

### Operations Types

ISA-95 defines four categories of manufacturing operations:

| Operations Type | Description |
|-----------------|-------------|
| **Production** | Activities that transform materials |
| **Maintenance** | Activities that maintain equipment capability |
| **Quality** | Activities that verify quality |
| **Inventory** | Activities that manage materials |

### Generic Activity Model

Each operations type follows a common pattern:

```
                    ┌─────────────────────────────┐
                    │    Operations Definition    │
                    │   (What CAN be done)        │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │   Operations Capability     │
                    │   (What CAN be done NOW)    │
                    └─────────────┬───────────────┘
                                  │
  ┌───────────────────────────────┼───────────────────────────────┐
  │                               │                               │
  ▼                               ▼                               ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Operations    │────▶│   Operations    │────▶│   Operations    │
│   Schedule      │     │   Request       │     │   Response      │
│ (What to do)    │     │ (What was asked)│     │ (What was done) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                  │                       │
                                  └───────────────────────┘
                                              │
                                  ┌───────────▼───────────┐
                                  │ Operations Performance│
                                  │ (Actual results)      │
                                  └───────────────────────┘
```

### Key Activity Model Elements

#### Operations Definition
Defines what manufacturing operations can be performed.

#### Operations Capability
What can be done now, considering:
- Available personnel
- Available equipment
- Available materials
- Committed capacity

```
OperationsCapability
  ├── CapabilityType: Committed|Available|Unattainable
  ├── PersonnelCapability[]
  ├── EquipmentCapability[]
  ├── MaterialCapability[]
  ├── ProcessSegmentCapability[]
  └── ConfidenceFactor: Reliability of capability
```

#### Operations Schedule / Request
What is requested to be done.

```
OperationsSchedule
  ├── ScheduleState: Released|Waiting|Ready|Running|...
  └── OperationsRequest[]
       ├── Priority
       ├── RequestState
       ├── StartTime / EndTime
       └── SegmentRequirement[]
```

#### Operations Performance / Response
What was actually done.

```
OperationsPerformance
  ├── PerformanceState
  └── OperationsResponse[]
       ├── ResponseState
       ├── ActualStartTime / ActualEndTime
       └── SegmentResponse[]
```

### Process Segment

A process segment defines a logical grouping of resources needed for a step:

```
ProcessSegment
  ├── ID: Identifier
  ├── OperationsType: Production|Maintenance|Quality|Inventory
  ├── DefinitionType: Pattern|Instance
  ├── PersonnelSegmentSpecification[]
  ├── EquipmentSegmentSpecification[]
  ├── PhysicalAssetSegmentSpecification[]
  ├── MaterialSegmentSpecification[]
  ├── ProcessSegmentParameter[]
  ├── SegmentDependency[]
  └── ProcessSegmentChild[]
```

**Pattern vs Instance:**
- **Pattern**: Template for creating instances
- **Instance**: Actual executable segment

---

## Part 4: Object Models for MOM

Part 4 extends Part 2 with detailed object models for Manufacturing Operations Management.

### Work Definition Model

```
WorkMaster (Recipe/Routing)
  └── WorkDirective (Step instructions)
       ├── PersonnelSpecification
       ├── EquipmentSpecification
       ├── PhysicalAssetSpecification
       └── MaterialSpecification
```

### Operations Definition Model

```
OperationsDefinition
  └── OperationsSegment
       ├── SegmentParameter
       ├── PersonnelSegmentSpecification
       ├── EquipmentSegmentSpecification
       ├── PhysicalAssetSegmentSpecification
       └── MaterialSegmentSpecification
```

---

## Part 5: Business-to-Manufacturing Transactions

### Transaction Patterns

ISA-95 Part 5 defines standard transaction verbs:

| Verb | Direction | Purpose |
|------|-----------|---------|
| **Get** | Requester → Provider | Request information |
| **Show** | Provider → Requester | Provide information |
| **Process** | Requester → Provider | Submit for processing |
| **Acknowledge** | Provider → Requester | Confirm receipt |
| **Change** | Requester → Provider | Modify existing data |
| **Respond** | Provider → Requester | Response to change |
| **Cancel** | Requester → Provider | Cancel request |
| **Sync** | Either | Synchronize data |

### Transaction Example: Equipment Information

```xml
<!-- Request equipment information -->
<GetEquipmentInformation>
  <ApplicationArea>...</ApplicationArea>
  <DataArea>
    <Get>
      <Expression>EquipmentLevel = 'WorkCenter'</Expression>
    </Get>
    <EquipmentInformation>
      <ID>query-001</ID>
    </EquipmentInformation>
  </DataArea>
</GetEquipmentInformation>

<!-- Response with equipment data -->
<ShowEquipmentInformation>
  <ApplicationArea>...</ApplicationArea>
  <DataArea>
    <Show>
      <ResponseCriteria>...</ResponseCriteria>
    </Show>
    <EquipmentInformation>
      <Equipment>
        <ID>mixer-001</ID>
        <EquipmentLevel>WorkCenter</EquipmentLevel>
        <EquipmentProperty>
          <ID>capacity</ID>
          <Value>500</Value>
        </EquipmentProperty>
      </Equipment>
    </EquipmentInformation>
  </DataArea>
</ShowEquipmentInformation>
```

---

## Implementation: B2MML

### What is B2MML?

**B2MML** (Business To Manufacturing Markup Language) is the XML Schema implementation of ISA-95. Maintained by MESA International.

- **Repository:** https://github.com/MESAInternational/B2MML-BatchML
- **License:** Open (with attribution)

### B2MML Schema Files

| Schema | Content |
|--------|---------|
| `B2MML-Common.xsd` | Common types, identifiers, hierarchy scope |
| `B2MML-Personnel.xsd` | PersonnelClass, Person |
| `B2MML-Equipment.xsd` | EquipmentClass, Equipment |
| `B2MML-Material.xsd` | MaterialClass, MaterialDefinition, MaterialLot |
| `B2MML-PhysicalAsset.xsd` | PhysicalAssetClass, PhysicalAsset |
| `B2MML-ProcessSegment.xsd` | ProcessSegment definitions |
| `B2MML-OperationsSchedule.xsd` | Operations scheduling |
| `B2MML-OperationsPerformance.xsd` | Operations responses |
| `B2MML-OperationsCapability.xsd` | Capability models |
| `B2MML-OperationsDefinition.xsd` | Operations definitions |
| `B2MML-WorkDefinition.xsd` | Work masters and directives |

### JSON Schema

B2MML also provides JSON Schema definitions generated from XSD:
- `AllSchemas.json` - Combined JSON Schema

---

## Implementation: OPC UA ISA-95

### OPC UA Information Model

The OPC Foundation provides an OPC UA companion specification for ISA-95:
- **NodeSet:** `Opc.ISA95.NodeSet2.xml`
- **Repository:** https://github.com/OPCFoundation/UA-Nodeset/tree/latest/ISA-95

### Key OPC UA Object Types

| Type | Purpose |
|------|---------|
| `ISA95ObjectType` | Base type for ISA-95 objects |
| `ISA95ClassType` | Base type for ISA-95 classes |
| `PersonnelClassType` | Personnel class nodes |
| `PersonType` | Individual person nodes |
| `EquipmentClassType` | Equipment class nodes |
| `EquipmentType` | Equipment instance nodes |
| `MaterialClassType` | Material class nodes |
| `MaterialDefinitionType` | Material definition nodes |
| `MaterialLotType` | Material lot nodes |
| `MaterialSublotType` | Material sublot nodes |
| `PhysicalAssetClassType` | Physical asset class nodes |
| `PhysicalAssetType` | Physical asset instance nodes |

### Key Reference Types

| Reference | Purpose |
|-----------|---------|
| `MadeUpOf` | Shared aggregation (equipment contains equipment) |
| `HasISA95Property` | Property ownership |
| `HasISA95ClassProperty` | Class property ownership |
| `DefinedBy*Class` | Instance to class relationship |
| `TestedBy*Test` | Test specification relationship |
| `ImplementedBy` | Equipment to Physical Asset relationship |
| `AssembledFrom*` | Material assembly relationships |

### OPC UA Data Types

| Data Type | Purpose |
|-----------|---------|
| `CDTIdentifier` | Identifier with scheme metadata |
| `CDTDateTime` | DateTime with timezone |
| `CDTMeasure*` | Measure with unit of measure |
| `CDTCode` | Code with list metadata |
| `CurrencyCode` | ISO currency code |

---

## Common Patterns

### Class/Instance Pattern

All ISA-95 resources follow a Class → Instance pattern:

```
[Resource]Class (defines properties, characteristics)
    │
    └──▶ [Resource] (specific instance with values)
```

Benefits:
- Inheritance of properties
- Classification/grouping
- Reusable definitions

### Property Pattern

Properties follow a consistent structure:

```
[Resource]Property
  ├── ID: Property identifier
  ├── Description: Human-readable description
  ├── Value[]: One or more values
  │    ├── ValueString / DataValue
  │    └── UnitOfMeasure
  └── [Resource]PropertyChild[]: Nested properties
```

### Test Specification Pattern

Quality and capability testing follows:

```
TestSpecification
  ├── ID
  ├── Description
  ├── TestResultPattern
  └── Associated[Resource]Class/[Resource]
```

---

## Best Practices

### 1. Start with Equipment Hierarchy
Define your equipment hierarchy first - it provides scope for all other models.

### 2. Use Classes for Reusability
Define classes for common patterns, then create instances.

### 3. Separate Equipment and Physical Assets
- Equipment = Role (what it does in the process)
- Physical Asset = Identity (the actual thing)

### 4. Use HierarchyScope Consistently
Always specify hierarchy scope to indicate relevance of data.

### 5. Version Your Definitions
Use Version and PublishedDate for change tracking.

### 6. Map to Your Domain
ISA-95 is generic - map to your industry terminology while maintaining standard structure.

---

## Sources

### Official Standards (Paywalled)
- ANSI/ISA-95.00.01: Models and Terminology
- ANSI/ISA-95.00.02: Object Model Attributes
- ANSI/ISA-95.00.03: Activity Models of MOM
- ANSI/ISA-95.00.04: Objects and Attributes for MOM
- ANSI/ISA-95.00.05: B2M Transactions

### Open Resources
- **B2MML GitHub:** https://github.com/MESAInternational/B2MML-BatchML
- **OPC UA ISA-95:** https://github.com/OPCFoundation/UA-Nodeset/tree/latest/ISA-95
- **Wikipedia:** https://en.wikipedia.org/wiki/ANSI/ISA-95
- **MESA International:** https://mesa.org

### Related Standards
- ISA-88 (Batch Control) - implemented in BatchML
- IEC 61512 (International batch standard)
- OPC UA (Industrial interoperability)

---

## Appendix A: Equipment Level Enumeration

From B2MML `EquipmentLevelType`:

```xml
<xsd:enumeration value="Enterprise"/>
<xsd:enumeration value="Site"/>
<xsd:enumeration value="Area"/>
<xsd:enumeration value="ProcessCell"/>      <!-- Batch -->
<xsd:enumeration value="Unit"/>             <!-- Batch -->
<xsd:enumeration value="ProductionLine"/>   <!-- Discrete -->
<xsd:enumeration value="WorkCell"/>         <!-- Discrete -->
<xsd:enumeration value="ProductionUnit"/>   <!-- Continuous -->
<xsd:enumeration value="StorageZone"/>      <!-- Inventory -->
<xsd:enumeration value="StorageUnit"/>      <!-- Inventory -->
<xsd:enumeration value="WorkCenter"/>       <!-- Generic -->
<xsd:enumeration value="WorkUnit"/>         <!-- Generic -->
```

## Appendix B: Operations Types

From B2MML `OperationsTypeType`:

| Value | Description |
|-------|-------------|
| Production | Transform materials into products |
| Maintenance | Maintain equipment capability |
| Quality | Verify quality of products/processes |
| Inventory | Manage material storage/movement |
| Mixed | Combination of above |

## Appendix C: Request/Response States

### RequestState (Scheduling)
```
Forecast → Released → Waiting → Ready → Running → 
  → Completed | Aborted | Held
```

### ResponseState (Performance)
```
Running → Completed | Aborted | Held
```
