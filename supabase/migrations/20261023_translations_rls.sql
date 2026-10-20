-- 번역 캐시(translations) 쓰기 잠금: 서비스 롤만 쓴다
--
-- 전에는 INSERT 정책이 WITH CHECK (true) 라 익명(anon 키)으로도 아무 행이나 넣을 수 있었다.
-- 캐시는 비로그인 게스트 페이지(/property/[id] 설명·FAQ·주변 안내)에 그대로 표시되므로, 로그인 사용자라도
-- 기존 행을 덮어쓸 수 있으면(UPDATE) 번역문을 임의 문구로 바꾸는 캐시 오염이 가능하다.
-- 그래서 anon/authenticated 에게는 INSERT/UPDATE 정책을 아예 두지 않는다. /api/translate 가 서버에서
-- 서비스 롤(RLS 우회)로만 캐시를 채우고, 서비스 롤 키가 없는 환경에서는 캐시 저장을 건너뛴다.
-- SELECT(캐시 읽기)는 그대로 공개.
DROP POLICY IF EXISTS "translations_insert" ON translations;
DROP POLICY IF EXISTS "translations_insert_authenticated" ON translations;
DROP POLICY IF EXISTS "translations_update_authenticated" ON translations;
