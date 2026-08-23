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
  readonly band: Quantity;
  readonly stock: Quantity;
  readonly clear: {
    readonly width: Quantity;
    readonly depth: Quantity;
    readonly height: Quantity;
  };
  readonly metalAllowed: { readonly value: false; readonly status: 'locked' };
};

const mm = (value: number, status: Status): Quantity => ({
  value,
  unit: 'mm',
  status,
});

export const ENCLOSURE_PARAMS: EnclosureParams = {
  exterior: {
    width: mm(250, 'locked'),
    depth: mm(250, 'locked'),
    height: mm(500, 'locked'),
  },
  band: mm(24, 'ref'),
  stock: mm(3, 'locked'),
  clear: {
    width: mm(202, 'calculated'),
    depth: mm(202, 'calculated'),
    height: mm(427, 'calculated'),
  },
  metalAllowed: { value: false, status: 'locked' },
};
