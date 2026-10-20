-- 숙소 주변 맛집 리스트 (상황별). Google Places 로 자동 수집하고 호스트가 숨기기·메모·순서·직접 추가로 다듬는다.
-- 자동응답 답변의 {맛집:야식} 같은 변수로 게스트에게 보낸다.

CREATE TABLE IF NOT EXISTS food_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  situation TEXT NOT NULL,              -- best | korean | breakfast | latenight | cafe | bar
  google_place_id TEXT,                 -- 직접 추가한 곳은 NULL
  name TEXT NOT NULL,
  name_en TEXT,
  category TEXT,                        -- '한식당', '카페' 등 (Google primaryTypeDisplayName)
  walk_minutes INTEGER,
  rating NUMERIC(2,1),
  rating_count INTEGER,
  hours_note TEXT,                      -- '새벽 2시까지', '아침 7시 오픈', '24시간'
  hours_note_en TEXT,
  maps_url TEXT,
  note TEXT,                            -- 호스트 메모
  sort_order INTEGER NOT NULL DEFAULT 0,
  hidden BOOLEAN NOT NULL DEFAULT false,
  collected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS food_places_unique_google ON food_places (property_id, situation, google_place_id) WHERE google_place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS food_places_property_idx ON food_places (property_id, situation, hidden, sort_order);

ALTER TABLE food_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "food_select_owner" ON food_places FOR SELECT
  USING (EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id AND p.host_id = auth.uid()));
CREATE POLICY "food_insert_owner" ON food_places FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id AND p.host_id = auth.uid()));
CREATE POLICY "food_update_owner" ON food_places FOR UPDATE
  USING (EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id AND p.host_id = auth.uid()));
CREATE POLICY "food_delete_owner" ON food_places FOR DELETE
  USING (EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id AND p.host_id = auth.uid()));

-- 숙소 좌표(맛집 수집 기준점). 없으면 수집 때 주소로 찾아 채운다.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
