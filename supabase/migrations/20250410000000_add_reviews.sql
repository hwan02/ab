-- 후기/팁 테이블
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- 누구나 조회 가능
CREATE POLICY "reviews_select" ON reviews FOR SELECT USING (true);
-- 로그인 사용자만 작성
CREATE POLICY "reviews_insert" ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
-- 본인 글만 삭제
CREATE POLICY "reviews_delete" ON reviews FOR DELETE USING (auth.uid() = user_id);
