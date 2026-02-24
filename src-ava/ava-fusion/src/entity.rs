//! Entity classification types for the fusion ontology.
//!
//! Defines [`EntityClass`] (10 variants from TSGC-001 §2),
//! [`IdentifierNamespace`] (primary ID systems per class), and
//! [`EntityClassDef`] (the declaration record used in the ontology config).

use serde::{Deserialize, Serialize};

use crate::signal::SignalKind;

// ---------------------------------------------------------------------------
// EntityClass — 10 variants from TSGC-001 §2
// ---------------------------------------------------------------------------

/// The kinds of things that exist in the operational world.
///
/// Each entity class has a primary identifier namespace and a set of
/// signal kinds that can observe it (the "Observable By" column in
/// TSGC-001 §2).
#[typeshare::typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EntityClass {
    /// Fixed-wing or rotary-wing aircraft. Primary ID: ICAO hex.
    Aircraft,
    /// Maritime vessel. Primary ID: MMSI.
    Vessel,
    /// Land-based vehicle. Primary ID: license plate.
    GroundVehicle,
    /// Radio-frequency emitter characterised by freq + location.
    RfEmitter,
    /// Network-connected host. Primary ID: IP address.
    NetworkHost,
    /// DNS domain / FQDN. Primary ID: fully-qualified domain name.
    Domain,
    /// Human individual. Primary ID: name or social handle.
    Person,
    /// Corporate or institutional entity. Primary ID: name or LEI.
    Organization,
    /// Adversary campaign (STIX). Primary ID: STIX ID.
    Campaign,
    /// Physical installation. Primary ID: geo + name.
    Facility,
}

impl EntityClass {
    /// All variants in declaration order.
    pub const ALL: [EntityClass; 10] = [
        EntityClass::Aircraft,
        EntityClass::Vessel,
        EntityClass::GroundVehicle,
        EntityClass::RfEmitter,
        EntityClass::NetworkHost,
        EntityClass::Domain,
        EntityClass::Person,
        EntityClass::Organization,
        EntityClass::Campaign,
        EntityClass::Facility,
    ];
}

impl std::fmt::Display for EntityClass {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EntityClass::Aircraft => f.write_str("Aircraft"),
            EntityClass::Vessel => f.write_str("Vessel"),
            EntityClass::GroundVehicle => f.write_str("Ground Vehicle"),
            EntityClass::RfEmitter => f.write_str("RF Emitter"),
            EntityClass::NetworkHost => f.write_str("Network Host"),
            EntityClass::Domain => f.write_str("Domain"),
            EntityClass::Person => f.write_str("Person"),
            EntityClass::Organization => f.write_str("Organization"),
            EntityClass::Campaign => f.write_str("Campaign"),
            EntityClass::Facility => f.write_str("Facility"),
        }
    }
}

// ---------------------------------------------------------------------------
// IdentifierNamespace
// ---------------------------------------------------------------------------

/// Primary identifier namespace used to key entities within a class.
///
/// Each entity class maps to one or more namespaces. Tier 1 (hard key)
/// joins operate within a single namespace; cross-namespace joins
/// require Tier 2 (soft key) or identity resolution.
#[typeshare::typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum IdentifierNamespace {
    /// ICAO 24-bit hex address (Aircraft).
    IcaoHex,
    /// Maritime Mobile Service Identity (Vessel).
    Mmsi,
    /// Vehicle license/registration plate (Ground Vehicle).
    LicensePlate,
    /// IEEE MAC address (Network Host, RF Emitter).
    MacAddress,
    /// IPv4 or IPv6 address (Network Host).
    IpAddress,
    /// Fully-qualified domain name (Domain).
    DomainName,
    /// International Mobile Subscriber Identity (Person, Device).
    Imsi,
    /// International Mobile Equipment Identity (Device).
    Imei,
    /// Social media handle / username (Person).
    SocialHandle,
    /// Operator-defined custom namespace.
    Custom,
}

impl IdentifierNamespace {
    /// All variants in declaration order.
    pub const ALL: [IdentifierNamespace; 10] = [
        IdentifierNamespace::IcaoHex,
        IdentifierNamespace::Mmsi,
        IdentifierNamespace::LicensePlate,
        IdentifierNamespace::MacAddress,
        IdentifierNamespace::IpAddress,
        IdentifierNamespace::DomainName,
        IdentifierNamespace::Imsi,
        IdentifierNamespace::Imei,
        IdentifierNamespace::SocialHandle,
        IdentifierNamespace::Custom,
    ];
}

impl std::fmt::Display for IdentifierNamespace {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            IdentifierNamespace::IcaoHex => f.write_str("ICAO Hex"),
            IdentifierNamespace::Mmsi => f.write_str("MMSI"),
            IdentifierNamespace::LicensePlate => f.write_str("License Plate"),
            IdentifierNamespace::MacAddress => f.write_str("MAC Address"),
            IdentifierNamespace::IpAddress => f.write_str("IP Address"),
            IdentifierNamespace::DomainName => f.write_str("Domain Name"),
            IdentifierNamespace::Imsi => f.write_str("IMSI"),
            IdentifierNamespace::Imei => f.write_str("IMEI"),
            IdentifierNamespace::SocialHandle => f.write_str("Social Handle"),
            IdentifierNamespace::Custom => f.write_str("Custom"),
        }
    }
}

// ---------------------------------------------------------------------------
// EntityClassDef — ontology registration record
// ---------------------------------------------------------------------------

/// Declaration of an entity class within the fusion ontology configuration.
///
/// Maps a class to its primary signal kind and the full set of signal
/// kinds that can produce observations of that class. Used by the
/// join-path compiler to validate which collection pairs are structurally
/// valid for fusion.
#[typeshare::typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityClassDef {
    /// The entity class being declared.
    #[serde(rename = "class")]
    pub entity_class: EntityClass,
    /// Primary identifier namespace for this class.
    pub primary_namespace: IdentifierNamespace,
    /// The signal kind that is the canonical/primary source for this class.
    pub primary_signal: SignalKind,
    /// All signal kinds that can observe this entity class.
    pub supported_signals: Vec<SignalKind>,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // -----------------------------------------------------------------------
    // EntityClass
    // -----------------------------------------------------------------------

    #[test]
    fn entity_class_all_variants_roundtrip() {
        for class in EntityClass::ALL {
            let json = serde_json::to_string(&class).unwrap();
            let parsed: EntityClass = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, class, "roundtrip failed for {class:?}");
        }
    }

    #[test]
    fn entity_class_count() {
        assert_eq!(EntityClass::ALL.len(), 10);
    }

    #[test]
    fn entity_class_camel_case() {
        let json = serde_json::to_string(&EntityClass::GroundVehicle).unwrap();
        assert_eq!(json, "\"groundVehicle\"");
        let json = serde_json::to_string(&EntityClass::RfEmitter).unwrap();
        assert_eq!(json, "\"rfEmitter\"");
        let json = serde_json::to_string(&EntityClass::NetworkHost).unwrap();
        assert_eq!(json, "\"networkHost\"");
    }

    #[test]
    fn entity_class_copy() {
        let a = EntityClass::Aircraft;
        let b = a;
        assert_eq!(a, b);
    }

    // -----------------------------------------------------------------------
    // IdentifierNamespace
    // -----------------------------------------------------------------------

    #[test]
    fn identifier_namespace_all_variants_roundtrip() {
        for ns in IdentifierNamespace::ALL {
            let json = serde_json::to_string(&ns).unwrap();
            let parsed: IdentifierNamespace = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, ns, "roundtrip failed for {ns:?}");
        }
    }

    #[test]
    fn identifier_namespace_count() {
        assert_eq!(IdentifierNamespace::ALL.len(), 10);
    }

    #[test]
    fn identifier_namespace_camel_case() {
        let json = serde_json::to_string(&IdentifierNamespace::IcaoHex).unwrap();
        assert_eq!(json, "\"icaoHex\"");
        let json = serde_json::to_string(&IdentifierNamespace::MacAddress).unwrap();
        assert_eq!(json, "\"macAddress\"");
        let json = serde_json::to_string(&IdentifierNamespace::SocialHandle).unwrap();
        assert_eq!(json, "\"socialHandle\"");
    }

    // -----------------------------------------------------------------------
    // EntityClassDef
    // -----------------------------------------------------------------------

    #[test]
    fn entity_class_def_serde_roundtrip() {
        let def = EntityClassDef {
            entity_class: EntityClass::Aircraft,
            primary_namespace: IdentifierNamespace::IcaoHex,
            primary_signal: SignalKind::AdsB,
            supported_signals: vec![
                SignalKind::AdsB,
                SignalKind::RfBearing,
                SignalKind::Radar,
                SignalKind::Osint,
            ],
        };
        let json = serde_json::to_string(&def).unwrap();
        // Verify "class" rename
        assert!(json.contains("\"class\":"));
        assert!(!json.contains("\"entityClass\":"));
        assert!(json.contains("\"primaryNamespace\":"));
        assert!(json.contains("\"primarySignal\":"));
        assert!(json.contains("\"supportedSignals\":"));
        let parsed: EntityClassDef = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.entity_class, EntityClass::Aircraft);
        assert_eq!(parsed.primary_namespace, IdentifierNamespace::IcaoHex);
        assert_eq!(parsed.primary_signal, SignalKind::AdsB);
        assert_eq!(parsed.supported_signals.len(), 4);
    }

    #[test]
    fn entity_class_def_vessel() {
        let def = EntityClassDef {
            entity_class: EntityClass::Vessel,
            primary_namespace: IdentifierNamespace::Mmsi,
            primary_signal: SignalKind::Ais,
            supported_signals: vec![
                SignalKind::Ais,
                SignalKind::RfBearing,
                SignalKind::Radar,
                SignalKind::Osint,
            ],
        };
        let json = serde_json::to_string(&def).unwrap();
        let parsed: EntityClassDef = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.entity_class, EntityClass::Vessel);
        assert_eq!(parsed.primary_namespace, IdentifierNamespace::Mmsi);
    }

    #[test]
    fn entity_class_def_network_host() {
        let def = EntityClassDef {
            entity_class: EntityClass::NetworkHost,
            primary_namespace: IdentifierNamespace::IpAddress,
            primary_signal: SignalKind::Http,
            supported_signals: vec![
                SignalKind::Http,
                SignalKind::Dns,
                SignalKind::Cyber,
            ],
        };
        let json = serde_json::to_string(&def).unwrap();
        let parsed: EntityClassDef = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.entity_class, EntityClass::NetworkHost);
        assert_eq!(parsed.supported_signals.len(), 3);
    }
}
