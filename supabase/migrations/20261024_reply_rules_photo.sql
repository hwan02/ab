-- 자동응답 규칙에 사진 1장. 메일 회신은 첨부 사진이 스레드에 올라가지 않아(2026-10-21 확인)
-- 답장 끝에 짧은 링크(/r/<rule id>)를 붙이고, 그 링크가 이 사진으로 리디렉트한다.
ALTER TABLE airbnb_reply_rules ADD COLUMN IF NOT EXISTS photo_url TEXT;
