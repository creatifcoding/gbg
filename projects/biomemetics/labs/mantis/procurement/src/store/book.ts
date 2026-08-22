import { canIssuePurchaseOrder, parsePartClass, type GateResult } from './gate';
import { openStore } from './open';
import {
  issuePurchaseOrder,
  listAlternates,
  listLots,
  listNeed,
  listParts,
  listPurchaseOrders,
  listQuotes,
  listReceipts,
  listSkuWells,
  listSuppliers,
  listWhereUsed,
} from './queries';

let storePromise: ReturnType<typeof openStore> | undefined;

export const getStore = () => {
  if (!storePromise) {
    const memory = process.env.MANTIS_PROCUREMENT_MEMORY === '1';
    storePromise = openStore({ memory });
  }
  return storePromise;
};

export type RegisterPayload = {
  parts: Awaited<ReturnType<typeof listParts>>;
  skus: Awaited<ReturnType<typeof listSkuWells>>;
  alternates: Awaited<ReturnType<typeof listAlternates>>;
  whereUsed: Awaited<ReturnType<typeof listWhereUsed>>;
};

export type BuyPayload = {
  parts: Awaited<ReturnType<typeof listParts>>;
  skus: Awaited<ReturnType<typeof listSkuWells>>;
  suppliers: Awaited<ReturnType<typeof listSuppliers>>;
  quotes: Awaited<ReturnType<typeof listQuotes>>;
  orders: Awaited<ReturnType<typeof listPurchaseOrders>>;
  gates: { balloon_id: string; gate: ReturnType<typeof canIssuePurchaseOrder> }[];
};

export type ReceivePayload = {
  receipts: Awaited<ReturnType<typeof listReceipts>>;
  lots: Awaited<ReturnType<typeof listLots>>;
};

export type NeedPayload = {
  lines: Awaited<ReturnType<typeof listNeed>>;
};

export type VendorsPayload = {
  suppliers: Awaited<ReturnType<typeof listSuppliers>>;
};

export const loadRegister = async (): Promise<RegisterPayload> => {
  const db = await getStore();
  const [parts, skus, alternates, whereUsed] = await Promise.all([
    listParts(db),
    listSkuWells(db),
    listAlternates(db),
    listWhereUsed(db),
  ]);
  return { parts, skus, alternates, whereUsed };
};

export const loadBuy = async (): Promise<BuyPayload> => {
  const db = await getStore();
  const [parts, skus, suppliers, quotes, orders] = await Promise.all([
    listParts(db),
    listSkuWells(db),
    listSuppliers(db),
    listQuotes(db),
    listPurchaseOrders(db),
  ]);
  const gates = parts.map((part) => {
    const sku = skus.find((row) => row.balloon_id === part.balloon_id);
    return {
      balloon_id: part.balloon_id,
      gate: canIssuePurchaseOrder({
        class: parsePartClass(part.class),
        skuId: sku?.sku_id ?? null,
        vendorId: suppliers[0]?.id ?? null,
        quoteId: quotes[0]?.quote_id ?? null,
      }),
    };
  });
  return { parts, skus, suppliers, quotes, orders, gates };
};

export const loadReceive = async (): Promise<ReceivePayload> => {
  const db = await getStore();
  const [receipts, lots] = await Promise.all([listReceipts(db), listLots(db)]);
  return { receipts, lots };
};

export const loadNeed = async (): Promise<NeedPayload> => {
  const db = await getStore();
  return { lines: await listNeed(db) };
};

export const loadVendors = async (): Promise<VendorsPayload> => {
  const db = await getStore();
  return { suppliers: await listSuppliers(db) };
};

export const tryIssue = async (partId: string): Promise<GateResult> => {
  const db = await getStore();
  return issuePurchaseOrder(db, {
    poId: `try-${partId}`,
    lineId: `try-${partId}-1`,
    partId,
    qty: 1,
    skuId: null,
    vendorId: null,
    quoteId: null,
  });
};
