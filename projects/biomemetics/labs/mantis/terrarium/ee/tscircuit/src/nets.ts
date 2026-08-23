export type RailPin =
  | 'P01'
  | 'P02'
  | 'P03'
  | 'P04'
  | 'P05'
  | 'P06'
  | 'P07'
  | 'P08'
  | 'P09'
  | 'P10'
  | 'P11'
  | 'P12';

export type BinderPin =
  | 'C01'
  | 'C02'
  | 'C03'
  | 'C04'
  | 'C05'
  | 'C06'
  | 'C07'
  | 'C08'
  | 'C09'
  | 'C10'
  | 'C11'
  | 'C12';

export type RailNet =
  | 'VIN-A'
  | 'VIN-B'
  | 'GND-A'
  | 'GND-B'
  | 'SDA'
  | 'SCL'
  | 'UID'
  | 'FAULT_N/IRQ'
  | 'HSGND'
  | 'GMSL+'
  | 'GMSL-';

export type RailContact = {
  readonly pin: RailPin;
  readonly net: RailNet;
  readonly geometry: 'continuous' | 'discrete-dock';
};

export type BinderContact = {
  readonly pin: BinderPin;
  readonly net: RailNet;
  readonly mirrors: RailPin;
};

export const RAIL_CONTACTS: readonly RailContact[] = [
  { pin: 'P01', net: 'VIN-A', geometry: 'continuous' },
  { pin: 'P02', net: 'VIN-B', geometry: 'continuous' },
  { pin: 'P03', net: 'GND-A', geometry: 'continuous' },
  { pin: 'P04', net: 'GND-B', geometry: 'continuous' },
  { pin: 'P05', net: 'SDA', geometry: 'continuous' },
  { pin: 'P06', net: 'SCL', geometry: 'continuous' },
  { pin: 'P07', net: 'UID', geometry: 'continuous' },
  { pin: 'P08', net: 'FAULT_N/IRQ', geometry: 'continuous' },
  { pin: 'P09', net: 'HSGND', geometry: 'discrete-dock' },
  { pin: 'P10', net: 'GMSL+', geometry: 'discrete-dock' },
  { pin: 'P11', net: 'GMSL-', geometry: 'discrete-dock' },
  { pin: 'P12', net: 'HSGND', geometry: 'discrete-dock' },
];

export type TscircuitNetToken =
  | 'VIN_A'
  | 'VIN_B'
  | 'GND_A'
  | 'GND_B'
  | 'SDA'
  | 'SCL'
  | 'UID'
  | 'FAULT_N_IRQ'
  | 'HSGND'
  | 'GMSL_P'
  | 'GMSL_N';

export type BusNetAlias = {
  readonly net: RailNet;
  readonly tscircuitToken: TscircuitNetToken;
};

// @tscircuit/core rejects +, -, and / in net identifiers, so tokens stand in for bus.json names.
export const BUS_NET_ALIASES: readonly BusNetAlias[] = [
  { net: 'VIN-A', tscircuitToken: 'VIN_A' },
  { net: 'VIN-B', tscircuitToken: 'VIN_B' },
  { net: 'GND-A', tscircuitToken: 'GND_A' },
  { net: 'GND-B', tscircuitToken: 'GND_B' },
  { net: 'SDA', tscircuitToken: 'SDA' },
  { net: 'SCL', tscircuitToken: 'SCL' },
  { net: 'UID', tscircuitToken: 'UID' },
  { net: 'FAULT_N/IRQ', tscircuitToken: 'FAULT_N_IRQ' },
  { net: 'HSGND', tscircuitToken: 'HSGND' },
  { net: 'GMSL+', tscircuitToken: 'GMSL_P' },
  { net: 'GMSL-', tscircuitToken: 'GMSL_N' },
];

const TOKEN_BY_NET: { readonly [Net in RailNet]: TscircuitNetToken } = {
  'VIN-A': 'VIN_A',
  'VIN-B': 'VIN_B',
  'GND-A': 'GND_A',
  'GND-B': 'GND_B',
  SDA: 'SDA',
  SCL: 'SCL',
  UID: 'UID',
  'FAULT_N/IRQ': 'FAULT_N_IRQ',
  HSGND: 'HSGND',
  'GMSL+': 'GMSL_P',
  'GMSL-': 'GMSL_N',
};

export const tscircuitTokenFor = (net: RailNet): TscircuitNetToken => TOKEN_BY_NET[net];

export const BINDER_CONTACTS: readonly BinderContact[] = [
  { pin: 'C01', net: 'VIN-A', mirrors: 'P01' },
  { pin: 'C02', net: 'VIN-B', mirrors: 'P02' },
  { pin: 'C03', net: 'GND-A', mirrors: 'P03' },
  { pin: 'C04', net: 'GND-B', mirrors: 'P04' },
  { pin: 'C05', net: 'SDA', mirrors: 'P05' },
  { pin: 'C06', net: 'SCL', mirrors: 'P06' },
  { pin: 'C07', net: 'UID', mirrors: 'P07' },
  { pin: 'C08', net: 'FAULT_N/IRQ', mirrors: 'P08' },
  { pin: 'C09', net: 'HSGND', mirrors: 'P09' },
  { pin: 'C10', net: 'GMSL+', mirrors: 'P10' },
  { pin: 'C11', net: 'GMSL-', mirrors: 'P11' },
  { pin: 'C12', net: 'HSGND', mirrors: 'P12' },
];

export const headerPinLabels = (
  contacts: readonly (RailContact | BinderContact)[],
): Record<string, string> => {
  const labels: Record<string, string> = {};
  for (const [index, contact] of contacts.entries()) {
    labels[`pin${index + 1}`] = contact.pin;
  }
  return labels;
};

export const headerConnections = (
  contacts: readonly (RailContact | BinderContact)[],
): Record<string, string> => {
  const connections: Record<string, string> = {};
  for (const [index, contact] of contacts.entries()) {
    connections[`pin${index + 1}`] = `net.${tscircuitTokenFor(contact.net)}`;
  }
  return connections;
};

export const BRANCH_ENABLE = {
  kind: 's1-and-s2',
  expression: 'S1 AND S2',
  s1: 'normally-open carriage-mate',
  s2: 'normally-open binder-mate',
  q1: 'per-carriage load switch after P01-P02',
  p08SafetyAuthority: false,
} as const;
