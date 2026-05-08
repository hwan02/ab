ALTER TABLE property_guides
  ADD COLUMN IF NOT EXISTS media_url_en TEXT,
  ADD COLUMN IF NOT EXISTS media_url_ja TEXT,
  ADD COLUMN IF NOT EXISTS media_url_zh TEXT,
  ADD COLUMN IF NOT EXISTS media_type_en TEXT CHECK (media_type_en IN ('image', 'video')),
  ADD COLUMN IF NOT EXISTS media_type_ja TEXT CHECK (media_type_ja IN ('image', 'video')),
  ADD COLUMN IF NOT EXISTS media_type_zh TEXT CHECK (media_type_zh IN ('image', 'video'));
