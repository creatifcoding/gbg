export type SearchStop = {
  readonly balloon: 'B19' | 'B27' | 'B44' | 'B48' | 'B50';
  readonly query: string;
  readonly source: 'jlcpcb' | 'tscircuit' | 'kicad';
  readonly admittedSeries: false;
  readonly manufacturerPartNumber: '';
  readonly status: 'unverified';
  readonly stop: string;
};

export const TSCI_SEARCH: readonly SearchStop[] = [
  {
    balloon: 'B27',
    query: '12 position spring contact',
    source: 'jlcpcb',
    admittedSeries: false,
    manufacturerPartNumber: '',
    status: 'unverified',
    stop: 'hits were terminal blocks, not a 12-position rail spring array',
  },
  {
    balloon: 'B27',
    query: 'pogo pin 2.54',
    source: 'jlcpcb',
    admittedSeries: false,
    manufacturerPartNumber: '',
    status: 'unverified',
    stop: 'hits were single probes, not B27',
  },
  {
    balloon: 'B27',
    query: 'pogo',
    source: 'tscircuit',
    admittedSeries: false,
    manufacturerPartNumber: '',
    status: 'unverified',
    stop: 'registry hit is a Pico pogo board, not the rail array',
  },
  {
    balloon: 'B50',
    query: 'keyed 12 pin connector',
    source: 'jlcpcb',
    admittedSeries: false,
    manufacturerPartNumber: '',
    status: 'unverified',
    stop: 'empty result',
  },
  {
    balloon: 'B44',
    query: '2A fuse 0603',
    source: 'jlcpcb',
    admittedSeries: false,
    manufacturerPartNumber: '',
    status: 'unverified',
    stop: 'search returned resettable fuses; BOM does not select one',
  },
  {
    balloon: 'B48',
    query: 'normally open switch',
    source: 'jlcpcb',
    admittedSeries: false,
    manufacturerPartNumber: '',
    status: 'unverified',
    stop: 'hits were relays and analog muxes, not S1/S2 mate switches',
  },
  {
    balloon: 'B48',
    query: 'N-channel MOSFET SOT-23',
    source: 'jlcpcb',
    admittedSeries: false,
    manufacturerPartNumber: '',
    status: 'unverified',
    stop: 'generic MOSFETs exist; BOM does not select Q1',
  },
  {
    balloon: 'B19',
    query: 'pinrow 12',
    source: 'kicad',
    admittedSeries: false,
    manufacturerPartNumber: '',
    status: 'unverified',
    stop: 'empty result; V-dock pads stay omitted',
  },
];
