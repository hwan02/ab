-- 자동응답 규칙 다국어 답변: 중국어·일본어 칸 추가
--
-- 게스트 원문 언어(ko/en/zh/ja)를 감지해 answer_{lang} 을 보낸다. 없으면 answer_en, 그것도 없으면 answer(한국어).
-- 규칙 화면에서 저장할 때 비어 있는 언어 칸은 /api/translate 로 한국어 답변을 번역해 채운다.
ALTER TABLE airbnb_reply_rules
  ADD COLUMN IF NOT EXISTS answer_zh TEXT,
  ADD COLUMN IF NOT EXISTS answer_ja TEXT;

COMMENT ON COLUMN airbnb_reply_rules.answer_en IS '영어 답변. 원문이 영어이거나, 원문 언어의 답변이 없을 때 쓴다.';
COMMENT ON COLUMN airbnb_reply_rules.answer_zh IS '중국어 답변. 원문에 가나 없이 한자만 있으면 쓴다.';
COMMENT ON COLUMN airbnb_reply_rules.answer_ja IS '일본어 답변. 원문에 히라가나·가타카나가 있으면 쓴다.';
