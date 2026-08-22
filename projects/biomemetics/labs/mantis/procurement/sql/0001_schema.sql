-- Mantis procurement book. Own PGlite cluster. Not the specimendb catalog.
-- Event names follow packages/tmnl/proto/scm/procurement/v1/procurement_events.proto.
-- A balloon line is a design identity, not a buy.

CREATE TABLE IF NOT EXISTS part (
  balloon_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  qty_text TEXT NOT NULL,
  class TEXT,
  notes TEXT NOT NULL DEFAULT '',
  CONSTRAINT part_balloon_id CHECK (balloon_id ~ '^B[0-9]{2}$'),
  CONSTRAINT part_class_allowed CHECK (
    class IS NULL
    OR class IN ('REF', 'UNVERIFIED', 'LOCK', 'DRAFT', 'orderable')
  )
);

CREATE TABLE IF NOT EXISTS manufacturer_sku (
  id TEXT PRIMARY KEY,
  part_id TEXT NOT NULL REFERENCES part (balloon_id),
  manufacturer TEXT NOT NULL,
  mpn TEXT NOT NULL,
  revision TEXT
);

CREATE TABLE IF NOT EXISTS supplier_party (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alternate (
  id TEXT PRIMARY KEY,
  part_id TEXT NOT NULL REFERENCES part (balloon_id),
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  manufacturer TEXT,
  mpn TEXT,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS quote (
  quote_id TEXT PRIMARY KEY,
  supplier_party_id TEXT REFERENCES supplier_party (id),
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS quote_revised (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quote (quote_id),
  patch JSONB NOT NULL DEFAULT '{}'::jsonb,
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS purchase_order (
  po_id TEXT PRIMARY KEY,
  buyer_party_id TEXT,
  supplier_party_id TEXT REFERENCES supplier_party (id),
  quote_id TEXT REFERENCES quote (quote_id),
  status TEXT NOT NULL DEFAULT 'draft',
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS purchase_order_line (
  line_id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL REFERENCES purchase_order (po_id),
  part_id TEXT NOT NULL REFERENCES part (balloon_id),
  sku_id TEXT REFERENCES manufacturer_sku (id),
  qty BIGINT NOT NULL,
  need_by TIMESTAMPTZ,
  unit_price_amount NUMERIC,
  unit_price_currency TEXT,
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS purchase_order_acknowledged (
  po_id TEXT PRIMARY KEY REFERENCES purchase_order (po_id),
  ack_code TEXT NOT NULL,
  committed_date TIMESTAMPTZ,
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS purchase_order_changed (
  id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL REFERENCES purchase_order (po_id),
  patch JSONB NOT NULL DEFAULT '{}'::jsonb,
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS purchase_order_cancelled (
  po_id TEXT PRIMARY KEY REFERENCES purchase_order (po_id),
  reason TEXT NOT NULL,
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS contract (
  contract_id TEXT PRIMARY KEY,
  supplier_party_id TEXT REFERENCES supplier_party (id),
  term_start TIMESTAMPTZ,
  term_end TIMESTAMPTZ,
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS contract_amended (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES contract (contract_id),
  patch JSONB NOT NULL DEFAULT '{}'::jsonb,
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS sourcing_event (
  sourcing_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  part_ids TEXT[] NOT NULL DEFAULT '{}',
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS supplier_selected (
  id TEXT PRIMARY KEY,
  sourcing_id TEXT NOT NULL REFERENCES sourcing_event (sourcing_id),
  supplier_party_id TEXT NOT NULL REFERENCES supplier_party (id),
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS supplier_capacity (
  id TEXT PRIMARY KEY,
  supplier_party_id TEXT NOT NULL REFERENCES supplier_party (id),
  facility_id TEXT,
  resource_kind TEXT,
  capacity_per_week BIGINT,
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS allocation_notice (
  id TEXT PRIMARY KEY,
  supplier_party_id TEXT NOT NULL REFERENCES supplier_party (id),
  part_ids TEXT[] NOT NULL DEFAULT '{}',
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS expedite (
  id TEXT PRIMARY KEY,
  ref_id TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  new_date TIMESTAMPTZ,
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT expedite_status CHECK (
    status IN ('requested', 'accepted', 'rejected')
  )
);

CREATE TABLE IF NOT EXISTS receipt (
  receipt_id TEXT PRIMARY KEY,
  po_id TEXT REFERENCES purchase_order (po_id),
  received_at TIMESTAMPTZ,
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS lot (
  lot_id TEXT PRIMARY KEY,
  receipt_id TEXT REFERENCES receipt (receipt_id),
  part_id TEXT NOT NULL REFERENCES part (balloon_id),
  qty BIGINT,
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS cost_history (
  id TEXT PRIMARY KEY,
  part_id TEXT NOT NULL REFERENCES part (balloon_id),
  sku_id TEXT REFERENCES manufacturer_sku (id),
  amount NUMERIC,
  currency TEXT,
  observed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS lead_time (
  id TEXT PRIMARY KEY,
  part_id TEXT NOT NULL REFERENCES part (balloon_id),
  sku_id TEXT REFERENCES manufacturer_sku (id),
  supplier_party_id TEXT REFERENCES supplier_party (id),
  days INTEGER,
  observed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS where_used (
  parent_id TEXT NOT NULL REFERENCES part (balloon_id),
  child_id TEXT NOT NULL REFERENCES part (balloon_id),
  relation TEXT NOT NULL,
  PRIMARY KEY (parent_id, child_id, relation)
);

CREATE TABLE IF NOT EXISTS kit (
  kit_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS kit_line (
  kit_id TEXT NOT NULL REFERENCES kit (kit_id),
  part_id TEXT NOT NULL REFERENCES part (balloon_id),
  qty_text TEXT NOT NULL,
  PRIMARY KEY (kit_id, part_id)
);

CREATE OR REPLACE FUNCTION purchase_order_line_gate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_class TEXT;
  v_po_vendor TEXT;
  v_po_quote TEXT;
BEGIN
  SELECT class INTO v_class FROM part WHERE balloon_id = NEW.part_id;

  IF v_class IS NULL THEN
    RAISE EXCEPTION 'class_null';
  END IF;
  IF v_class = 'UNVERIFIED' THEN
    RAISE EXCEPTION 'class_unverified';
  END IF;
  IF v_class = 'DRAFT' THEN
    RAISE EXCEPTION 'class_draft';
  END IF;
  IF v_class <> 'orderable' THEN
    RAISE EXCEPTION 'class_not_orderable';
  END IF;
  IF NEW.sku_id IS NULL THEN
    RAISE EXCEPTION 'missing_sku';
  END IF;

  SELECT supplier_party_id, quote_id
    INTO v_po_vendor, v_po_quote
    FROM purchase_order
    WHERE po_id = NEW.po_id;

  IF v_po_vendor IS NULL THEN
    RAISE EXCEPTION 'missing_vendor';
  END IF;
  IF v_po_quote IS NULL THEN
    RAISE EXCEPTION 'missing_quote';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS purchase_order_line_gate_trg ON purchase_order_line;
CREATE TRIGGER purchase_order_line_gate_trg
  BEFORE INSERT OR UPDATE ON purchase_order_line
  FOR EACH ROW
  EXECUTE FUNCTION purchase_order_line_gate();
