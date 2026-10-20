-- 키워드 자동응답 규칙 + 숙소별 자동응답 설정 + 호스트별 수신함 권한
--
-- 흐름: 게스트 메시지 메일 → 숙소 매핑 → 그 숙소의 규칙 중 키워드가 본문에 들어 있는 것 → 등록 답변을 그대로 회신.
-- AI 는 쓰지 않는다.

-- 1) 숙소: 메일 매칭용 에어비앤비 리스팅 제목, 체크인/아웃 시각, 자동응답 모드
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS airbnb_listing_title TEXT,
  ADD COLUMN IF NOT EXISTS checkin_time TEXT,
  ADD COLUMN IF NOT EXISTS checkout_time TEXT,
  ADD COLUMN IF NOT EXISTS auto_reply_mode TEXT NOT NULL DEFAULT 'confirm'
    CHECK (auto_reply_mode IN ('off', 'confirm', 'auto'));

COMMENT ON COLUMN properties.airbnb_listing_title IS '에어비앤비 리스팅 제목(해시태그 포함). 알림 메일의 숙소명과 맞춰 숙소를 찾는 데 쓴다.';
COMMENT ON COLUMN properties.auto_reply_mode IS 'off: 매칭만 기록 / confirm: 답변을 채워 두고 호스트가 보내기 / auto: 매칭되면 바로 발송';

-- 2) 규칙
CREATE TABLE IF NOT EXISTS airbnb_reply_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  answer TEXT NOT NULL,
  answer_en TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  hit_count INTEGER NOT NULL DEFAULT 0,
  last_hit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS airbnb_reply_rules_property_idx ON airbnb_reply_rules (property_id, enabled, priority DESC);

ALTER TABLE airbnb_reply_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rules_select_owner" ON airbnb_reply_rules FOR SELECT
  USING (EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id AND p.host_id = auth.uid()));
CREATE POLICY "rules_insert_owner" ON airbnb_reply_rules FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id AND p.host_id = auth.uid()));
CREATE POLICY "rules_update_owner" ON airbnb_reply_rules FOR UPDATE
  USING (EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id AND p.host_id = auth.uid()));
CREATE POLICY "rules_delete_owner" ON airbnb_reply_rules FOR DELETE
  USING (EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id AND p.host_id = auth.uid()));

-- 3) 수신 메일: 매칭 결과
ALTER TABLE airbnb_inbound_mails
  ADD COLUMN IF NOT EXISTS matched_rule_id UUID REFERENCES airbnb_reply_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_sent BOOLEAN NOT NULL DEFAULT false;

-- 4) 수신 메일 권한: 자기 숙소에 매핑된 메일만. (매핑 안 된 메일은 서비스 롤로만 접근)
DROP POLICY IF EXISTS "airbnb_inbound_select_host" ON airbnb_inbound_mails;
DROP POLICY IF EXISTS "airbnb_inbound_update_host" ON airbnb_inbound_mails;

CREATE POLICY "airbnb_inbound_select_owner" ON airbnb_inbound_mails FOR SELECT
  USING (EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id AND p.host_id = auth.uid()));
CREATE POLICY "airbnb_inbound_update_owner" ON airbnb_inbound_mails FOR UPDATE
  USING (EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id AND p.host_id = auth.uid()));
