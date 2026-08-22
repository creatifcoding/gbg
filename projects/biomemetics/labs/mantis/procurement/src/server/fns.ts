import { createServerFn } from '@tanstack/react-start';
import { MANTIS_PROCUREMENT_PCT_CONTRACT } from '../wire';
import {
  loadBuy,
  loadFooter,
  loadNeed,
  loadReceive,
  loadRegister,
  loadVendors,
  tryIssue,
  type BuyPayload,
  type FooterPayload,
  type NeedPayload,
  type ReceivePayload,
  type RegisterPayload,
  type VendorsPayload,
} from '../store/book';

void MANTIS_PROCUREMENT_PCT_CONTRACT;

export const getRegister = createServerFn({ method: 'GET' }).handler(
  async (): Promise<RegisterPayload> => loadRegister(),
);

export const getBuy = createServerFn({ method: 'GET' }).handler(
  async (): Promise<BuyPayload> => loadBuy(),
);

export const getReceive = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ReceivePayload> => loadReceive(),
);

export const getNeed = createServerFn({ method: 'GET' }).handler(
  async (): Promise<NeedPayload> => loadNeed(),
);

export const getVendors = createServerFn({ method: 'GET' }).handler(
  async (): Promise<VendorsPayload> => loadVendors(),
);

export const getFooter = createServerFn({ method: 'GET' }).handler(
  async (): Promise<FooterPayload> => loadFooter(),
);

export const tryIssuePo = createServerFn({ method: 'POST' })
  .validator((data: { partId: string }) => data)
  .handler(({ data }) => tryIssue(data.partId));
