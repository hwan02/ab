-- 에어비앤비 게스트 메시지 메일의 회신 주소와 메일 회신 발송 기록
-- express@airbnb.com 발신 메시지 메일에는 Reply-To: <코드>@reply.airbnb.com 이 있고,
-- 호스트 계정 이메일에서 여기로 회신하면 에어비앤비 스레드에 답장이 올라간다.

ALTER TABLE airbnb_inbound_mails
  ADD COLUMN IF NOT EXISTS reply_to TEXT,
  ADD COLUMN IF NOT EXISTS sent_reply TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
