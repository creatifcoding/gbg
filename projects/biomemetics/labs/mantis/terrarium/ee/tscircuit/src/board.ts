import { Board, Circuit, Fuse, Group, Mosfet, PinHeader, Switch } from '@tscircuit/core';

import { BALLOONS, B19_PLACEMENT, STUDY_FOOTPRINT, type Balloon } from './balloons.ts';
import {
  BINDER_CONTACTS,
  BRANCH_ENABLE,
  BUS_NET_ALIASES,
  headerConnections,
  headerPinLabels,
  RAIL_CONTACTS,
  type BinderContact,
  type BusNetAlias,
  type RailContact,
} from './nets.ts';

export const COUPON_OUTLINE = {
  widthMm: 80,
  heightMm: 40,
  status: 'unverified',
  note: 'study coupon envelope, not a locked PCB size',
} as const;

export type IndexedCoupon = {
  readonly kind: 'indexed-coupon';
  readonly maturity: 'draft';
  readonly balloons: readonly Balloon[];
  readonly b19: typeof B19_PLACEMENT;
  readonly branchEnable: typeof BRANCH_ENABLE;
  readonly studyFootprint: typeof STUDY_FOOTPRINT;
  readonly outline: typeof COUPON_OUTLINE;
  readonly railContacts: readonly RailContact[];
  readonly binderContacts: readonly BinderContact[];
  readonly netAliases: readonly BusNetAlias[];
  readonly circuitJson: readonly unknown[];
};

export const compileIndexedCoupon = (): IndexedCoupon => {
  const circuit = new Circuit();
  const board = new Board({
    name: 'indexed-coupon',
    title: 'indexed coupon',
    width: `${COUPON_OUTLINE.widthMm}mm`,
    height: `${COUPON_OUTLINE.heightMm}mm`,
  });
  circuit.add(board);

  board.add(
    new PinHeader({
      name: 'B27',
      pinCount: 12,
      pitch: '2.54mm',
      footprint: STUDY_FOOTPRINT.pinHeader,
      pinLabels: headerPinLabels(RAIL_CONTACTS),
      connections: headerConnections(RAIL_CONTACTS),
      manufacturerPartNumber: '',
      pcbX: '-20mm',
      pcbY: '0mm',
    }),
  );

  board.add(
    new PinHeader({
      name: 'B50',
      pinCount: 12,
      pitch: '2.54mm',
      footprint: STUDY_FOOTPRINT.pinHeader,
      pinLabels: headerPinLabels(BINDER_CONTACTS),
      connections: headerConnections(BINDER_CONTACTS),
      manufacturerPartNumber: '',
      pcbX: '20mm',
      pcbY: '0mm',
    }),
  );

  board.add(
    new Fuse({
      name: 'B44',
      currentRating: '2A',
      footprint: STUDY_FOOTPRINT.fuse,
      connections: { pin1: 'net.VIN_A' },
      manufacturerPartNumber: '',
      pcbX: '0mm',
      pcbY: '12mm',
    }),
  );

  const b48 = new Group({ name: 'B48' });
  board.add(b48);

  b48.add(
    new Switch({
      name: 'S1',
      type: 'spst',
      isNormallyClosed: false,
      footprint: STUDY_FOOTPRINT.switch,
      manufacturerPartNumber: '',
      pcbX: '-10mm',
      pcbY: '-12mm',
    }),
  );

  b48.add(
    new Switch({
      name: 'S2',
      type: 'spst',
      isNormallyClosed: false,
      footprint: STUDY_FOOTPRINT.switch,
      manufacturerPartNumber: '',
      pcbX: '0mm',
      pcbY: '-12mm',
    }),
  );

  b48.add(
    new Mosfet({
      name: 'Q1',
      channelType: 'n',
      mosfetMode: 'enhancement',
      footprint: STUDY_FOOTPRINT.mosfet,
      manufacturerPartNumber: '',
      pcbX: '10mm',
      pcbY: '-12mm',
    }),
  );

  return {
    kind: 'indexed-coupon',
    maturity: 'draft',
    balloons: BALLOONS,
    b19: B19_PLACEMENT,
    branchEnable: BRANCH_ENABLE,
    studyFootprint: STUDY_FOOTPRINT,
    outline: COUPON_OUTLINE,
    railContacts: RAIL_CONTACTS,
    binderContacts: BINDER_CONTACTS,
    netAliases: BUS_NET_ALIASES,
    circuitJson: circuit.getCircuitJson(),
  };
};
