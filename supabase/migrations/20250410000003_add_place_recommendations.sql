-- 게스트 장소 추천
CREATE TABLE place_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  guest_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('attraction', 'restaurant', 'convenience', 'experience')),
  description TEXT,
  address TEXT,
  map_url TEXT,
  show_recommender BOOLEAN DEFAULT false,
  recommender_name TEXT,
  recommender_avatar TEXT,
  recommender_country TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE place_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pr_select" ON place_recommendations FOR SELECT USING (true);
CREATE POLICY "pr_insert" ON place_recommendations FOR INSERT WITH CHECK (auth.uid() = guest_id);
CREATE POLICY "pr_update" ON place_recommendations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid())
);
CREATE POLICY "pr_delete" ON place_recommendations FOR DELETE USING (
  auth.uid() = guest_id OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid())
);
