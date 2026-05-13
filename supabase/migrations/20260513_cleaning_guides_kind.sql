-- Separate cleaning "steps" (ordered instructions) from "supplies" (product list)
ALTER TABLE cleaning_guides
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'step'
  CHECK (kind IN ('step', 'supply'));

CREATE INDEX IF NOT EXISTS cleaning_guides_property_kind_idx
  ON cleaning_guides(property_id, kind, display_order);
