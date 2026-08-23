export type Status = 'locked' | 'ref' | 'calculated' | 'target' | 'unverified';

export type Quantity = {
  readonly value: number;
  readonly unit: 'mm';
  readonly status: Status;
};

export type EnclosureParams = {
  readonly exterior: {
    readonly width: Quantity;
    readonly depth: Quantity;
    readonly height: Quantity;
  };
  readonly pitch: Quantity;
  readonly firstSpan: Quantity;
  readonly band: Quantity;
  readonly stock: Quantity;
  readonly cassetteSeatOverStock: Quantity;
  readonly cassetteSeat: Quantity;
  readonly clear: {
    readonly width: Quantity;
    readonly depth: Quantity;
    readonly height: Quantity;
  };
  readonly screenApertureMax: Quantity;
  readonly metalAllowed: { readonly value: false; readonly status: 'locked' };
};

const mm = (value: number, status: Status): Quantity => ({
  value,
  unit: 'mm',
  status,
});

const stock = mm(3, 'locked');
const cassetteSeatOverStock = mm(0.2, 'target');

export const ENCLOSURE_PARAMS: EnclosureParams = {
  exterior: {
    width: mm(250, 'locked'),
    depth: mm(250, 'locked'),
    height: mm(500, 'locked'),
  },
  pitch: mm(250, 'locked'),
  firstSpan: mm(500, 'locked'),
  band: mm(24, 'ref'),
  stock,
  cassetteSeatOverStock,
  cassetteSeat: mm(stock.value + cassetteSeatOverStock.value, 'target'),
  clear: {
    width: mm(202, 'calculated'),
    depth: mm(202, 'calculated'),
    height: mm(427, 'calculated'),
  },
  screenApertureMax: mm(0.8, 'locked'),
  metalAllowed: { value: false, status: 'locked' },
};
