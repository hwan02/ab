-- 장소 대표 사진: 수집 때 새로 들어온 곳만 Google Places 사진 1장을 받아 스토리지에 저장한다.
ALTER TABLE food_places ADD COLUMN IF NOT EXISTS photo_url TEXT;
