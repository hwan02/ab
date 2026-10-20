-- 번역 캐시(translations) 쓰기 잠금
--
-- 전에는 INSERT 정책이 WITH CHECK (true) 라 익명(anon 키)으로도 아무 행이나 넣을 수 있었다.
-- 이제 INSERT/UPDATE 는 로그인 사용자(authenticated) 만. 서비스 롤은 RLS 를 거치지 않으므로
-- /api/translate 가 서버에서 서비스 롤로 캐시를 채운다(익명 게스트 페이지 번역 포함).
-- SELECT(캐시 읽기)는 그대로 공개.
DROP POLICY IF EXISTS "translations_insert" ON translations;

CREATE POLICY "translations_insert_authenticated" ON translations
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- upsert(ON CONFLICT DO UPDATE)가 되도록 UPDATE 도 로그인 사용자에게 허용
DROP POLICY IF EXISTS "translations_update_authenticated" ON translations;
CREATE POLICY "translations_update_authenticated" ON translations
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
