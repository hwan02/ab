-- 숙소 비공개 정보(와이파이·상세 주소) 공개 노출 차단
--
-- 문제: properties 의 SELECT 정책이 USING (true) 라 anon 키만 있으면 wifi_password 를 포함한
--       전 컬럼을 누구나 읽을 수 있었다. RLS 는 행 단위라 컬럼은 못 가린다.
-- 설계:
--   1) 공개 컬럼만 담은 뷰 properties_public (뷰 소유자 권한으로 실행 → 기반 테이블 RLS 를 넘어
--      누구나 읽을 수 있다). 비로그인 게스트 페이지는 이 뷰를 읽는다.
--   2) properties 테이블의 SELECT 는 호스트 본인 또는 property_guests 에 등록돼 체류 기간 안인
--      게스트만. 와이파이·주소는 이 경로로만 읽힌다.
--
-- 이 마이그레이션과 같은 커밋에서 properties 를 직접 읽던 공개 경로가 모두 properties_public 으로 바뀌었다:
--   src/app/property/[id]/page.tsx, src/app/property/[id]/layout.tsx, src/app/page.tsx(숙소 목록),
--   src/app/cleaning/[id]/page.tsx, src/app/property/[id]/nearby/page.tsx, src/app/browse/[id]/page.tsx,
--   src/components/dev/DevToolbar.tsx.
-- properties 테이블을 그대로 읽는 곳은 호스트 전용(/host/*, host_id 조건) 또는 서비스 롤 경로뿐이다.
--
-- 제품 결정 필요(이 마이그레이션은 손대지 않음): checkin_guide/checkout_guide/house_rules 는 기존처럼 공개 뷰에
-- 포함된다. 체크인 가이드에 도어락 비밀번호를 적는 운영이라면 와이파이와 같은 급이므로 뷰에서 빼야 한다.

-- 0) 좌표 컬럼: 저장소 마이그레이션에는 없고 대시보드에서 추가된 것으로 보여, 빈 DB(db reset)에서도
--    뷰가 만들어지도록 보장한다. 이미 있으면(타입이 numeric 이어도) 아무것도 하지 않는다.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 1) 게스트 등록 여부 (SECURITY DEFINER: property_guests 정책이 properties 를 참조하므로
--    properties 정책에서 property_guests 를 그대로 참조하면 정책 재귀가 난다)
CREATE OR REPLACE FUNCTION public.is_property_guest(p_property_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.property_guests pg
    WHERE pg.property_id = p_property_id
      AND pg.guest_id = auth.uid()
      AND (pg.check_in IS NULL OR pg.check_in <= CURRENT_DATE)
      AND (pg.check_out IS NULL OR pg.check_out >= CURRENT_DATE)
  );
$$;

REVOKE ALL ON FUNCTION public.is_property_guest(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_property_guest(UUID) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.is_property_guest(UUID) IS
  '현재 사용자가 이 숙소의 property_guests 에 등록돼 있고 체류 기간(없으면 무제한) 안인지. properties RLS 에서 쓴다.';

-- 2) 공개 뷰: 비밀번호·주소(원문/번역)·호스트 내부 설정은 빼고, 좌표는 소수점 2자리(약 1km)로 뭉갠다.
--    security_invoker 를 켜지 않는다(소유자 권한으로 실행돼야 RLS 를 넘어 공개 읽기가 된다).
DROP VIEW IF EXISTS public.properties_public;
CREATE VIEW public.properties_public AS
SELECT
  p.id,
  p.host_id,
  p.name,
  p.name_en,
  p.name_ja,
  p.name_zh,
  p.description,
  p.description_en,
  p.description_ja,
  p.description_zh,
  ROUND(p.latitude::numeric, 2)::double precision AS latitude,
  ROUND(p.longitude::numeric, 2)::double precision AS longitude,
  p.photos,
  p.checkin_guide,
  p.checkin_guide_en,
  p.checkin_guide_ja,
  p.checkin_guide_zh,
  p.checkout_guide,
  p.checkout_guide_en,
  p.checkout_guide_ja,
  p.checkout_guide_zh,
  p.house_rules,
  p.house_rules_en,
  p.house_rules_ja,
  p.house_rules_zh,
  p.checkin_time,
  p.checkout_time,
  p.created_at
FROM public.properties p;

ALTER VIEW public.properties_public OWNER TO postgres;
REVOKE ALL ON public.properties_public FROM PUBLIC;
GRANT SELECT ON public.properties_public TO anon, authenticated, service_role;

COMMENT ON VIEW public.properties_public IS
  '숙소 공개 정보. wifi_ssid/wifi_password/address* 는 없다. 비로그인 게스트 페이지는 이 뷰를 읽고, 비공개 정보는 properties 테이블(RLS: 호스트·등록 게스트만)에서 읽는다.';

-- 3) properties SELECT: 호스트 본인 또는 등록된 게스트만
DROP POLICY IF EXISTS "properties_select" ON public.properties;
CREATE POLICY "properties_select" ON public.properties FOR SELECT
  USING (host_id = auth.uid() OR public.is_property_guest(id));
