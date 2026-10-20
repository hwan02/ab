-- 자동응답 규칙 다국어 답변: 중국어·일본어 칸 추가
--
-- 게스트 원문 언어(ko/en/zh/ja)를 감지해 answer_{lang} 을 보낸다. 없으면 answer_en, 그것도 없으면 answer(한국어).
-- 규칙 화면에서 저장할 때 비어 있는 언어 칸은 /api/translate 로 한국어 답변을 번역해 채운다.
--
-- 배포 순서: 이 마이그레이션을 먼저 적용한 뒤 앱을 배포할 것. 규칙 화면(src/app/host/property/[id]/rules/page.tsx)이
-- 저장 payload 에 answer_zh/answer_ja 를 넣으므로, 컬럼이 없는 DB 에서는 규칙 추가·수정이 PGRST204 로 실패한다.
-- (화면은 그 오류를 받으면 두 컬럼을 빼고 한 번 더 저장을 시도하지만, 그때는 중국어·일본어 답변이 저장되지 않는다.)
-- 수신함 동기화(sync)는 select('*') 라 마이그레이션 전후 모두 동작한다.
ALTER TABLE airbnb_reply_rules
  ADD COLUMN IF NOT EXISTS answer_zh TEXT,
  ADD COLUMN IF NOT EXISTS answer_ja TEXT;

COMMENT ON COLUMN airbnb_reply_rules.answer_en IS '영어 답변. 원문이 영어이거나, 원문 언어의 답변이 없을 때 쓴다.';
COMMENT ON COLUMN airbnb_reply_rules.answer_zh IS '중국어 답변. 원문에 가나 없이 한자만 있으면 쓴다.';
COMMENT ON COLUMN airbnb_reply_rules.answer_ja IS '일본어 답변. 원문에 히라가나·가타카나가 있으면 쓴다.';
