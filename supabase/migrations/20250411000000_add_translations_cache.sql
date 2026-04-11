-- 번역 캐시 테이블
CREATE TABLE translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_text TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_text, target_lang)
);

ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "translations_select" ON translations FOR SELECT USING (true);
CREATE POLICY "translations_insert" ON translations FOR INSERT WITH CHECK (true);
