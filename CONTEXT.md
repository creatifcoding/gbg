# GBG Platform Context

This context captures the shared language for the GBG platform architecture. It is a glossary, not an implementation spec.

## Language

**DMN — Domain Module Network**:
A generic substrate for defining and composing reusable domain modules. IIoT, GEOINT, trading, and SDR/radio are examples of domains that can be expressed through DMN; none of them define DMN by themselves.
_Avoid_: Data/Message Network, Industrial DMN, IIoT DMN, broker, message bus

**Domain Module**:
A bounded, reusable domain surface in the DMN. A Domain Module composes Capability Modules to express a domain such as IIoT, GEOINT, trading, or SDR/radio.
_Avoid_: app folder, feature bucket, message namespace

**Capability Module**:
A reusable DMN building block that can be composed into one or more Domain Modules. Examples include schema packs, migration packs, repositories, state services, machines, entities, handler groups, projections, reaction policies, adapters, and view agents.
_Avoid_: utility, helper bag, domain

**Persistence Capability Module**:
A DMN Capability Module that defines durable authority ports and optional adapters for migrations, models, repositories, event journals, audit trails, checkpoints, claims, or retention stores. DMN may provide first-party SQL/EventJournal implementations, but Domain Modules choose which authority capabilities they require.
_Avoid_: mandatory SQL core, app-specific storage helper, hidden global database

**Reaction Policy**:
A DMN Capability Module for durable signal observation, eligibility classification, admission control, idempotent claims/checkpoints, and target-owned dispatch. The current IIoT Reactor is the concrete precedent, not the generic name.
_Avoid_: workflow engine, projection handler mutation, generic Reactor for every domain

**AVA — Asset View Agent**:
A view-agent modality for synthesizing, governing, and evolving real-time views over assets. AVA is an asset-specialized precedent for the broader EVA concept.
_Avoid_: domain, entity, screen, static read model

**EVA — Entity View Agent**:
A separate view-agent system idea to keep compatible with DMN, not a near-term DMN responsibility. EVA generalizes the AVA pattern by replacing asset-specific assumptions with entity-centered semantics.
_Avoid_: DMN core feature, AVA rename only, UI widget, projection table

## Example dialogue

Developer: “Should IIoT own the message framework?”
Domain expert: “No. IIoT is one Domain Module using the DMN. The DMN is the reusable Domain Module Network that other domains can use too.”

Developer: “So DMN is a broker?”
Domain expert: “No. The DMN defines how Domain Modules and Capability Modules are composed and connected. Transport is a separate concern.”

Developer: “Is EVA just AVA with a different name?”
Domain expert: “No. AVA is the asset-centered precedent. EVA generalizes the view-agent modality to entities so different domains can use the same concept without pretending every domain object is an asset.”
