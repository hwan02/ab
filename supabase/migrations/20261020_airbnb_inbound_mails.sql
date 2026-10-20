-- 에어비앤비 알림 메일 수집 테이블
-- 공동호스트 계정(카카오메일)으로 들어온 에어비앤비 알림을 IMAP 으로 가져와 저장한다.
-- 같은 메일이 두 번 들어와도 message_id unique 로 거른다.

CREATE TABLE IF NOT EXISTS airbnb_inbound_mails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL UNIQUE,
  received_at TIMESTAMPTZ,
  subject TEXT NOT NULL DEFAULT '',
  sender TEXT NOT NULL DEFAULT '',

  kind TEXT NOT NULL DEFAULT 'other'
    CHECK (kind IN ('message', 'reservation_request', 'reservation_confirmed', 'reservation_cancelled', 'review', 'other')),
  guest_name TEXT,
  listing_name TEXT,
  thread_url TEXT,
  thread_id TEXT,
  reservation_code TEXT,
  message_text TEXT,
  check_in DATE,
  check_out DATE,
  snippet TEXT,

  -- 숙소 매핑 (listing_name 으로 properties.name 을 찾아 채움, 못 찾으면 NULL)
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,

  -- 처리 상태: new → drafted(초안 생성) → replied(호스트가 답장) / ignored
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'drafted', 'replied', 'ignored')),
  draft_reply TEXT,
  replied_at TIMESTAMPTZ,

  raw_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS airbnb_inbound_mails_received_idx ON airbnb_inbound_mails (received_at DESC);
CREATE INDEX IF NOT EXISTS airbnb_inbound_mails_status_idx ON airbnb_inbound_mails (status);
CREATE INDEX IF NOT EXISTS airbnb_inbound_mails_thread_idx ON airbnb_inbound_mails (thread_id);

ALTER TABLE airbnb_inbound_mails ENABLE ROW LEVEL SECURITY;

-- 호스트만 조회/수정. 삽입은 서비스 롤(크론 라우트)이 한다.
CREATE POLICY "airbnb_inbound_select_host" ON airbnb_inbound_mails FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'host')
);
CREATE POLICY "airbnb_inbound_update_host" ON airbnb_inbound_mails FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'host')
);
