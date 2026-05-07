-- Podong Photos
CREATE TABLE podong_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  photo_url TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Podong Comments
CREATE TABLE podong_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID REFERENCES podong_photos(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT,
  user_avatar TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Property Guides
CREATE TABLE property_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video')),
  category TEXT NOT NULL CHECK (category IN ('appliance', 'directions', 'facility', 'other')),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: podong_photos
ALTER TABLE podong_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pp_select" ON podong_photos FOR SELECT USING (true);
CREATE POLICY "pp_insert" ON podong_photos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()));
CREATE POLICY "pp_update" ON podong_photos FOR UPDATE
  USING (EXISTS (SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()));
CREATE POLICY "pp_delete" ON podong_photos FOR DELETE
  USING (EXISTS (SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()));

-- RLS: podong_comments
ALTER TABLE podong_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pc_select" ON podong_comments FOR SELECT USING (true);
CREATE POLICY "pc_insert" ON podong_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pc_delete" ON podong_comments FOR DELETE
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM podong_photos pp JOIN properties p ON p.id = pp.property_id
    WHERE pp.id = photo_id AND p.host_id = auth.uid()
  ));

-- RLS: property_guides
ALTER TABLE property_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pg_select" ON property_guides FOR SELECT USING (true);
CREATE POLICY "pg_insert" ON property_guides FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()));
CREATE POLICY "pg_update" ON property_guides FOR UPDATE
  USING (EXISTS (SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()));
CREATE POLICY "pg_delete" ON property_guides FOR DELETE
  USING (EXISTS (SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()));

-- Realtime for podong_comments
ALTER PUBLICATION supabase_realtime ADD TABLE podong_comments;

-- Update storage bucket to also allow video
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
WHERE id = 'property-photos';
