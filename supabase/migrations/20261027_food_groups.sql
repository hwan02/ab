-- 장소 그룹: 호스트가 수집된 장소를 드래그로 묶어 만든 목록(예: 비 오는 날, 데이트, 야식).
-- 그룹마다 키워드와 문구가 있고, 저장하면 그 그룹용 자동응답 규칙(airbnb_reply_rules.food_group_id)이 함께 관리된다.

ALTER TABLE food_places ADD COLUMN IF NOT EXISTS photo_url TEXT;

CREATE TABLE IF NOT EXISTS food_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  intro TEXT,                          -- 목록 앞에 붙는 문구
  keywords TEXT[] NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS food_group_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES food_groups(id) ON DELETE CASCADE,
  food_place_id UUID NOT NULL REFERENCES food_places(id) ON DELETE CASCADE,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (group_id, food_place_id)
);

ALTER TABLE airbnb_reply_rules ADD COLUMN IF NOT EXISTS food_group_id UUID REFERENCES food_groups(id) ON DELETE CASCADE;

ALTER TABLE food_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_group_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "food_groups_owner" ON food_groups FOR ALL
  USING (EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id AND p.host_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id AND p.host_id = auth.uid()));

CREATE POLICY "food_group_items_owner" ON food_group_items FOR ALL
  USING (EXISTS (SELECT 1 FROM food_groups g JOIN properties p ON p.id = g.property_id WHERE g.id = group_id AND p.host_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM food_groups g JOIN properties p ON p.id = g.property_id WHERE g.id = group_id AND p.host_id = auth.uid()));
