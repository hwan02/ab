-- Cleaning Guides (for cleaning helpers — accessed by direct link only)
CREATE TABLE cleaning_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  photo_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  youtube_url TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX cleaning_guides_property_id_idx ON cleaning_guides(property_id);

-- RLS
ALTER TABLE cleaning_guides ENABLE ROW LEVEL SECURITY;

-- Anyone with the property link can read (same security model as the public property page)
CREATE POLICY "cg_select" ON cleaning_guides FOR SELECT USING (true);

-- Only the host of the property can write
CREATE POLICY "cg_insert" ON cleaning_guides FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()));
CREATE POLICY "cg_update" ON cleaning_guides FOR UPDATE
  USING (EXISTS (SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()));
CREATE POLICY "cg_delete" ON cleaning_guides FOR DELETE
  USING (EXISTS (SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()));
