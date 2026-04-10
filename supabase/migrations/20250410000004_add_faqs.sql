-- FAQ 테이블 (호스트 관리)
CREATE TABLE faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faqs_select" ON faqs FOR SELECT USING (true);
CREATE POLICY "faqs_insert" ON faqs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'host')
  OR auth.uid()::text = current_setting('app.admin_id', true)
);
CREATE POLICY "faqs_update" ON faqs FOR UPDATE USING (true);
CREATE POLICY "faqs_delete" ON faqs FOR DELETE USING (true);
