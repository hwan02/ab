-- Allow 'location' as a kind for cleaning_guides (storage spots for supplies)
ALTER TABLE cleaning_guides DROP CONSTRAINT IF EXISTS cleaning_guides_kind_check;
ALTER TABLE cleaning_guides
  ADD CONSTRAINT cleaning_guides_kind_check
  CHECK (kind IN ('step', 'supply', 'location'));
