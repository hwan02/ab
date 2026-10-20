# 포포톡 백로그 (2026-10-20)

브랜치 `feat/airbnb-mail-ingest` 를 버그·보안·운영·품질·UX 다섯 관점으로 감사해 83개 후보에서 추린 52개. P0 = 출시 전 필수, P1 = 첫 주, P2 = 나중.

1차(2026-10-21) 완료: P0 1·2·3·4·5·6·7·8·14·15 + P1 6(발송 경쟁 조건). 새 마이그레이션 3개는 supabase/apply/2026-10-21_p0_batch1.sql.

상태 표기: `[요청됨]` 사용자가 이미 요청, `[병렬]` 다른 항목과 파일이 겹치지 않음, `[완료]` 이미 처리됨.

## P0 — 출시 전 필수

1. `[요청됨]` `[완료 2026-10-21]` **(요청됨) 호스트 화면(/host 이하)에서 언어 전환(🇰🇷🇺🇸🇯🇵🇨🇳) 숨기기** (S, 요청됨)
   - 사용자 요청이며 Header.tsx:77/126 과 HomeHeader.tsx:90/139 가 LOCALES.map 으로 스위처를 무조건 렌더하므로 usePathname 이 /host 로 시작하면 렌더하지 않고 호스트 화면은 ko 로 고정한다.
   - 파일: src/components/layout/Header.tsx, src/components/layout/HomeHeader.tsx
2. `[요청됨]` `[완료 2026-10-21]` **(요청됨) 규칙 저장 시 영·중·일 답변 Google 번역 자동 채움 + 게스트 원문 언어별 발송** (L, 요청됨)
   - 사용자 요청이며 현재 규칙은 answer/answer_en 두 칸뿐이고 rules.ts pickAnswer 가 '한글 아니면 영어' 2분법이라 answer_ja/answer_zh 마이그레이션, detectLanguage(ko/en/ja/zh), saveRule 에서 /api/translate 호출(변수 토큰 {게스트이름} 은 placeholder 로 보호, 호스트가 고친 번역은 덮어쓰지 않음), 테스트 박스·sync 에 동일 분기 적용이 필요하다(선행: /api/translate 인증·translations RLS 잠금).
   - 파일: supabase/migrations/20261023_reply_rules_i18n.sql (신규), src/lib/airbnb/rules.ts, src/lib/airbnb/rules.test.ts, src/app/host/property/[id]/rules/page.tsx, src/app/api/translate/route.ts, src/app/api/airbnb/inbox/sync/route.ts, src/types/database.ts
3. `[병렬]` `[완료 2026-10-21]` **와이파이 비밀번호 공개 노출 차단: properties 공개 SELECT 분리 + 게스트 공개 페이지에서 제거** (M, 보안)
   - initial_schema.sql:157 `properties_select USING (true)` 라 anon 키로도 wifi_password·주소 전 컬럼이 조회되고 src/app/property/[id]/page.tsx 는 로그인 없이 select("*") 후 PropertyInfo 에서 비밀번호를 텍스트+QR 로 그대로 그린다.
   - 파일: supabase/migrations/20261023_properties_public_view.sql (신규), src/app/property/[id]/page.tsx, src/components/property/PropertyInfo.tsx
4. `[병렬]` `[완료 2026-10-21]` **/api/places/save-photo·migrate-photos 무인증 + 서비스 롤 제거 (SSRF·익명 업로드)** (M, 보안)
   - save-photo 는 인증 없이 body.url 을 서버에서 fetch 해 서비스 롤로 공개 버킷에 올리고 migrate-photos 는 임의 property_id 의 데이터를 서비스 롤로 수정하며 Places API 비용을 쓴다.
   - 파일: src/app/api/places/save-photo/route.ts, src/app/api/places/migrate-photos/route.ts, src/lib/supabase/admin.ts
5. `[완료 2026-10-21]` **/api/translate·/api/notify/slack 인증 + translations 캐시 RLS 잠그기** (S, 보안)
   - 두 라우트 모두 무인증이라 Google 번역 비용 소진·Slack 스팸이 가능하고 translations_insert WITH CHECK (true) 로 익명이 오염된 번역을 미리 넣으면 요청 작업(2)에서 그 번역이 게스트에게 발송되므로 (2)보다 먼저 세션/CRON_SECRET 요구와 길이 제한, INSERT 를 서버 전용으로 바꾼다.
   - 파일: src/app/api/translate/route.ts, src/app/api/notify/slack/route.ts, supabase/migrations/20261023_translations_rls.sql (신규), src/lib/airbnb/authz.ts
6. `[완료 2026-10-21]` **숙소 매핑 안전화: 다른 호스트 메일·답변 교차 방지 + 매핑 실패 행 재매핑·호스트에 노출** (L, 보안)
   - matchProperty 가 DB 전체 기준 `properties.length === 1` 이면 무조건 매핑하고 포함 매칭(ORDER 없음)을 써 호스트가 늘면 남의 게스트에게 와이파이 비밀번호가 담긴 답이 자동 발송될 수 있으며, 푸터 없는 스레드 메일은 listingName=null 로 property_id null 이 되어 RLS 때문에 호스트는 보지도 못하고 제목을 고쳐도 ignoreDuplicates 로 재매핑되지 않는다.
   - 파일: src/app/api/airbnb/inbox/sync/route.ts, src/lib/airbnb/mail/parse.ts, src/lib/airbnb/authz.ts, src/components/host/AirbnbInbox.tsx, src/components/property/PropertyForm.tsx, src/lib/validations.ts
7. `[완료 2026-10-21]` **게스트 메시지 본문이 END_MARKER 에 걸려 잘리거나 통째로 사라짐** (M, 버그)
   - parse.ts END_MARKERS 의 `^(체크인|체크아웃|게스트|…)`·날짜·`^Reply` 패턴이 게스트 문장 자체에 걸려 "체크인 시간이 몇시인가요?" 류 가장 흔한 질문이 messageText=null 이 되어 자동응답이 전혀 안 나간다(픽스처로 재현).
   - 파일: src/lib/airbnb/mail/parse.ts, src/lib/airbnb/mail/parse.test.ts
8. `[완료 2026-10-21]` **키워드 매칭 오탐 수정: 단어 경계·한글 2글자 이상·번역 라벨 줄 제외** (M, 버그)
   - normalizeForMatch 가 공백을 지운 뒤 includes 만 쓰므로 '아침'→'짐', 'checking'→'check in', '원문에서 자동 번역된 메시지:' 라벨의 '메시지' 등이 매칭돼 auto 모드에서 틀린 답이 게스트에게 그대로 나간다.
   - 파일: src/lib/airbnb/rules.ts, src/lib/airbnb/rules.test.ts, scripts/airbnb-seed-rules.ts, src/app/host/property/[id]/rules/page.tsx
9. **크론 주기 결정·구현: Vercel Hobby 는 */5 불가 → Pro 전환 또는 GitHub Actions 에서 5분마다 POST sync** (M, 운영)
   - vercel.json 의 */5 크론은 Hobby 에서 거부되거나 일 1회로 줄어 Reply-To 유효기간 안에 발송이 불가능하고, imap.ts 기본 since=24h·limit=50 도 백로그가 쌓이면 오래된 메일이 영구 누락되므로 마지막 성공 시각을 since 로 쓰도록 함께 손본다.
   - 파일: vercel.json, .github/workflows/airbnb-sync.yml (신규), src/lib/airbnb/mail/imap.ts, src/app/api/airbnb/inbox/sync/route.ts
10. `[병렬]` **Vercel 환경변수 목록 확정: .env.example 과 코드 사용처 대조·`vercel env ls` 로 검증** (S, 운영)
   - NEXT_PUBLIC_APP_URL·NEXT_PUBLIC_AIRBNB_AI_DRAFT·NEXT_PUBLIC_SITE_URL 이 .env.example 에 없고 CRON_SECRET·KAKAO_IMAP_*·SUPABASE_SERVICE_ROLE_KEY 가 없으면 sync 가 항상 401/throw 하므로 배포 전에 필수/선택 표를 확정해야 한다.
   - 파일: .env.example, .vercel/project.json
11. `[병렬]` `[완료]` **프로덕션 Supabase 마이그레이션 적용(airbnb 3종) + supabase/apply 복제 SQL 정리** (S, 운영)
   - 코드가 auto_reply_mode·matched_rule_id·reply_to 컬럼을 select 하므로 20261020→21→22 순 적용 없이는 sync 가 매번 실패하고, supabase/apply 번들은 migrations 의 사본이라 소스가 둘로 갈라져 있어 삭제하거나 README 에 생성 규칙을 명시해야 한다.
   - 파일: supabase/migrations/20261020_airbnb_inbound_mails.sql, supabase/migrations/20261021_airbnb_inbound_reply_to.sql, supabase/migrations/20261022_airbnb_reply_rules.sql, supabase/apply/2026-10-20_airbnb_keyword_reply.sql, supabase/migrations/README.md
12. `[병렬]` **공동호스트 전용 카카오 계정 전환 + 에어비앤비 메시지 이메일 알림 ON 체크리스트 실행** (M, 운영)
   - SMTP 발신 주소는 수집 계정과 같아야 하고 그 계정이 에어비앤비 공동호스트로 등록돼 메시지를 절대 앱에서 읽지 않아야 알림 메일(express@)이 오므로 계정 생성→IMAP/SMTP 켜기→공동호스트 초대→알림 설정→Vercel 변수 교체→dryrun·send-test 검증까지 절차대로 끝내야 한다.
   - 파일: src/lib/airbnb/mail/smtp.ts, scripts/airbnb-imap-dryrun.ts, scripts/airbnb-send-test.ts
13. `[병렬]` **PR 생성 및 main 병합 전 체크리스트(.gitignore 정리, lint/build, Preview 확인, 롤백 방법 기재)** (S, 운영)
   - PR 이 아직 없고 origin/main 대비 10 커밋·65 파일 차이이며 .idea/·ab.iml 이 untracked 로 떠 있어 .gitignore 추가와 settings.local.json 미커밋, PR 본문에 운영 결정사항(AI 초안 비활성·자동화 금지)과 롤백(auto_reply_mode=off) 을 적어야 한다.
   - 파일: .gitignore, .claude/settings.local.json
14. `[완료 2026-10-21]` **신규 호스트가 Google 로그인 후 /host 로 갈 수 있는 진입점 추가** (S, UX)
   - auth/callback 이 '/' 로 보내고 page.tsx·HomeHeader 는 NEXT_PUBLIC_ADMIN_EMAIL 일 때만 호스트 모드 링크를 보여 제품 대상인 일반 호스트가 게스트 홈에 갇힌다.
   - 파일: src/app/auth/callback/route.ts, src/app/page.tsx, src/components/layout/HomeHeader.tsx, src/app/host/page.tsx
15. `[병렬]` `[완료 2026-10-21]` **숙소 메뉴에서 게스트·주변·긴급·가이드·청소·채팅 숨기기 (모바일 하단 탭 8개 → 2~3개)** (S, UX)
   - HIDDEN_SEGMENTS 가 announcements·podong 만 숨겨 8개 탭이 375px 에서 겹치는데 포포톡에 필요한 건 숙소 정보와 자동응답뿐이다.
   - 파일: src/app/host/property/[id]/layout.tsx, src/components/layout/HostLayoutShell.tsx

## P1 — 첫 주 안에

1. **위조 메일 방어: 발신자·스레드 링크 도메인 정규식 앵커 + From 검증** (M, 보안)
   - AIRBNB_SENDER_RE 가 `@airbnb.com.evil.net` 을 통과시키고 THREAD_URL_RE 가 `airbnb.evil.com` 을 스레드 링크로 인정해 수신함·Slack 의 '에어비앤비에서 답장' 버튼이 피싱 URL 이 될 수 있다.
   - 파일: src/lib/airbnb/mail/parse.ts, src/lib/airbnb/mail/imap.ts, src/components/host/AirbnbInbox.tsx
2. **Slack 알림에서 와이파이 비밀번호·주소·게스트 본문 마스킹** (S, 보안)
   - notifySlack 이 renderAnswer 로 치환된 답변 600자(와이파이 비밀번호·주소 포함)와 게스트 본문을 웹훅으로 보내 Slack 채널에 평문으로 쌓인다.
   - 파일: src/app/api/airbnb/inbox/sync/route.ts
3. **faqs 테넌트 분리(property_id + RLS) 및 대시보드 'FAQ 관리'·importFaqs 정리** (M, 보안)
   - faqs 는 property_id 가 없고 update/delete USING (true) 라 로그인한 누구나 남의 FAQ 를 수정·삭제하고 importFaqs 가 전체 FAQ 를 내 규칙으로 가져온다.
   - 파일: supabase/migrations/20261023_faqs_property.sql (신규), src/app/host/property/[id]/rules/page.tsx, src/app/host/faq/page.tsx, src/components/host/HostDashboardContent.tsx, src/lib/airbnb/draft.ts
4. **AI 초안 라우트 서버측 비활성 게이트 + 프롬프트에서 비밀번호 제외 + .env.example 에 '기본 off' 명시** (S, 보안)
   - 결정은 AI 초안 미사용인데 UI 는 NEXT_PUBLIC_AIRBNB_AI_DRAFT 로 버튼만 숨기고 draft 라우트는 호스트 세션이면 여전히 generateText 를 실행해 비용이 나며 draft.ts 가 wifi_password 를 외부 LLM 에 보낸다.
   - 파일: src/app/api/airbnb/inbox/draft/route.ts, src/lib/airbnb/draft.ts, src/components/host/AirbnbInbox.tsx, .env.example
5. **thread_id 없는 express 메일의 쌍 병합·중복 방지 대체 키 도입** (M, 버그)
   - 실제 express@ 메일은 threadId=null 이라 twinKey 가 null 을 돌려 문의 1건당 automated/express 행이 둘 생기고 Slack 2통·'회신 주소 없음' 영구 할 일이 남으며 1시간 중복 발송 방지도 실제 발송 행에 적용되지 않는다.
   - 파일: src/app/api/airbnb/inbox/sync/route.ts
6. `[완료 2026-10-21]` **발송 경쟁 조건 방지(조건부 status 선점) + send 라우트 입력 검증·sent_by 기록 + hit_count RPC** (M, 버그)
   - applyRules 와 send 라우트 모두 상태 읽기→SMTP→갱신 사이에 잠금이 없어 cron/POST 겹침이나 더블 클릭에 같은 답장이 두 번 나가고, send 는 text 길이 제한·상태 검사·발송자 기록이 없으며 hit_count read-modify-write 는 유실된다.
   - 파일: src/app/api/airbnb/inbox/sync/route.ts, src/app/api/airbnb/inbox/send/route.ts, supabase/migrations/20261023_inbound_sent_by_hit_rpc.sql (신규)
7. **회신 실패 처리 개선: 올바른 행 되돌리기, reply_to 비우기·사유 저장, 수신함에 실패 배지와 경과 시간 경고** (M, 버그)
   - handleReplyFailure 가 2시간 창의 최신 1건만 되돌려 엉뚱한 답장이 되돌아가고 reply_to 를 남겨 만료 주소로 재발송 루프가 생기며 호스트 화면에는 사유가 전혀 안 보인다.
   - 파일: src/app/api/airbnb/inbox/sync/route.ts, src/lib/airbnb/mail/imap.ts, src/components/host/AirbnbInbox.tsx, supabase/migrations/20261023_inbound_last_error.sql (신규), src/types/database.ts
8. **우선순위 동률 규칙 비결정·비활성 규칙 발송 수정 + rules.ts 테스트 보강** (S, 버그)
   - 규칙 조회에 ORDER BY 가 없고 matchRule 이 index 를 쓰지 않아 동률이면 실행마다 답이 바뀌며 matched_rule_id 재사용 시 enabled 를 보지 않아 호스트가 끈 규칙 답이 나간다.
   - 파일: src/lib/airbnb/rules.ts, src/lib/airbnb/rules.test.ts, src/app/api/airbnb/inbox/sync/route.ts
9. **빈 변수({와이파이비밀번호} 등) 경고 및 auto 모드 발송 차단** (S, 버그)
   - renderAnswer 가 값 없으면 '' 로 치환해 '비밀번호는  입니다' 같은 답이 auto 로 나가므로 규칙 화면에 숙소 정보 수정 링크 경고를 띄우고 sync 는 ready 로 남긴다.
   - 파일: src/lib/airbnb/rules.ts, src/app/host/property/[id]/rules/page.tsx, src/app/api/airbnb/inbox/sync/route.ts
10. **자동 발송 실패 재시도 sweep (drafted + auto + reply_to 있음 행 재처리)** (M, 운영)
   - run() 은 이미 본 메일을 reply_to 보강 때만 다시 applyRules 하므로 SMTP 일시 장애 한 번이면 auto 모드가 사실상 confirm 모드가 된다.
   - 파일: src/app/api/airbnb/inbox/sync/route.ts
11. **동기화 헬스체크: sync 실행 기록 테이블 + IMAP/SMTP/DB 오류 Slack 경고 + 수신함 진단 블록** (M, 운영)
   - IMAP 실패는 502 JSON 만 돌려 아무도 모르고 수신함 빈 상태도 한 문장뿐이라 비밀번호 만료·CRON 불일치 같은 '메일이 안 들어오는' 상태를 호스트도 운영자도 감지할 수 없다.
   - 파일: src/app/api/airbnb/inbox/sync/route.ts, supabase/migrations/20261023_airbnb_sync_runs.sql (신규), src/components/host/AirbnbInbox.tsx, src/app/host/airbnb/page.tsx
12. **로그 정비: 메일별 구조화 로그, update 오류 검사, 응답에 outcomes 포함, 에러 응답에서 detail 제거** (M, 운영)
   - console.error 가 2곳뿐이고 applyRules 의 supabase update 결과를 확인하지 않아 왜 needs_reply 인지 알 수 없으며 502 응답의 e.message 는 계정 정보를 노출할 수 있다.
   - 파일: src/app/api/airbnb/inbox/sync/route.ts, src/app/api/airbnb/inbox/send/route.ts
13. `[병렬]` **운영 문서 작성: README 교체 + docs/OPERATIONS.md (환경변수·크론·마이그레이션·계정 전환·스모크 테스트·장애 대응)** (M, 운영)
   - README 가 보일러플레이트이고 코드 주석에 흩어진 전제(공동호스트 계정, Reply-To 유효기간, 모드 의미, dryRun→confirm 1건→auto 전환 절차)를 한 곳에 모아야 운영이 가능하다.
   - 파일: README.md, docs/OPERATIONS.md (신규)
14. `[병렬]` **CI 추가(GitHub Actions: test·lint·tsc) + package.json type=module·test glob 확장** (S, 운영)
   - .github 가 없어 PR 에서 자동 검증이 전혀 없고 node --test 가 매 파일 MODULE_TYPELESS 경고를 내며 .test.tsx 를 못 돌린다.
   - 파일: .github/workflows/ci.yml (신규), package.json
15. **호스트 세션으로 '지금 메일 가져오기' 허용 + 수신함 새로고침 버튼** (M, UX)
   - sync 는 CRON_SECRET 전용이라 호스트가 수동으로 수집할 방법이 없는데 Reply-To 는 수신 직후 발송이 중요하다.
   - 파일: src/app/api/airbnb/inbox/sync/route.ts, src/lib/airbnb/authz.ts, src/components/host/AirbnbInbox.tsx
16. **호스트 전용 헤더(HostHeader) 도입: 수신함·FAQ 페이지에서 '내 숙소'로 돌아가기** (M, UX)
   - host/airbnb·host/faq 가 게스트용 Header 를 써서 /reviews·/faq 링크만 보이고 일반 호스트는 숙소 목록으로 갈 길이 없다.
   - 파일: src/components/layout/HostHeader.tsx (신규), src/app/host/airbnb/page.tsx, src/app/host/faq/page.tsx, src/components/layout/Header.tsx, src/components/layout/HomeHeader.tsx
17. **첫 사용자 온보딩 체크리스트 카드(숙소 등록→리스팅 제목→공동호스트 초대→규칙 켜기→테스트→모드 선택)** (M, UX)
   - 수집은 공동호스트 초대가 전제인데 호스트 화면 어디에도 안내가 없고 빈 상태 문구는 구 제품 문구('게스트를 초대해보세요')다.
   - 파일: src/components/host/HostDashboardContent.tsx, src/app/host/page.tsx, src/lib/i18n/translations.ts
18. **수신함 액션 정리: 발송 버튼 primary, '답장 완료' 이름 변경, 비메시지 kind 는 할 일에서 제외** (S, UX)
   - thread_url 링크가 primary 라 실제 발송 버튼이 묻히고 '답장 완료' 는 아무것도 보내지 않으며 예약 확정·후기 메일까지 status=new 로 저장돼 '답변 필요' 로 섞인다.
   - 파일: src/components/host/AirbnbInbox.tsx, src/app/api/airbnb/inbox/sync/route.ts
19. **sync 순수 로직(matchProperty·twinKey·decideOutcome) 을 src/lib/airbnb/sync.ts 로 추출하고 단위 테스트 추가** (L, 품질)
   - 핵심 판정 로직이 route.ts 핸들러와 같이 있어 테스트가 전혀 없고 route 의 비핸들러 export 는 Next 타입 검사에 걸릴 수 있다.
   - 파일: src/app/api/airbnb/inbox/sync/route.ts, src/lib/airbnb/sync.ts (신규), src/lib/airbnb/sync.test.ts (신규)
20. **authz(identify·canAccessMails) 의존 주입 + 단위 테스트** (M, 품질)
   - send/draft 의 유일한 권한 경계인데 createClient 를 모듈 내부에서 호출해 테스트가 불가능하고 actor.userId! 단언이 남아 있다.
   - 파일: src/lib/airbnb/authz.ts, src/lib/airbnb/authz.test.ts (신규), src/app/api/airbnb/inbox/send/route.ts, src/app/api/airbnb/inbox/draft/route.ts

## P2 — 나중

1. **체크인/체크아웃 날짜 추출 범위 제한 및 {체크인} 'M월 D일' 포맷** (S, 버그)
   - extractDates 2단계가 본문 전체 날짜를 모아 가장 이른 둘을 쓰므로 게스트가 쓴 연도 포함 날짜가 check_in 이 되어 {체크인} 변수로 잘못 발송될 수 있다.
   - 파일: src/lib/airbnb/mail/parse.ts, src/lib/airbnb/rules.ts
2. **이모지 반응 판정을 applyRules 맨 앞으로 이동** (S, 버그)
   - REACTION_RE 검사가 숙소 매핑·모드 검사 뒤에 있어 미매핑 숙소의 ❤️ 반응 메시지도 '답변 필요' Slack 이 간다.
   - 파일: src/app/api/airbnb/inbox/sync/route.ts
3. **수신 시각 표시를 Asia/Seoul 고정 (SSR UTC 와 브라우저 KST 하이드레이션 불일치)** (S, 버그)
   - formatReceived 가 timeZone 없이 toLocaleString 을 호출해 서버 렌더 시간이 브라우저에서 바뀌며 hydration 경고가 난다.
   - 파일: src/components/host/AirbnbInbox.tsx
4. **인증 정리: CRON_SECRET 상수시간 비교 공통 헬퍼, 관리자 판별을 서버 전용 값/profiles 플래그로, /host 방문 시 role 자동 승격 제거** (S, 보안)
   - 세 라우트가 각각 문자열 비교를 복붙하고 NEXT_PUBLIC_ADMIN_EMAIL 이 클라이언트 번들에 노출되며 host/page.tsx 가 로그인한 누구에게나 role=host 를 부여해 role 기반 정책이 무의미하다.
   - 파일: src/lib/airbnb/authz.ts, src/app/api/airbnb/inbox/sync/route.ts, src/app/api/airbnb/inbox/send/route.ts, src/app/api/airbnb/inbox/draft/route.ts, src/app/host/page.tsx, src/app/host/airbnb/page.tsx
5. **수신함 페이지가 클라이언트로 내려보내는 컬럼 축소 (raw_text·message_id 서버 전용)** (S, 보안)
   - host/airbnb/page.tsx 가 select("*") 100건을 props 로 넘겨 메일 원문 전체가 매 요청 브라우저로 실려 간다.
   - 파일: src/app/host/airbnb/page.tsx, src/components/host/AirbnbInbox.tsx, src/types/database.ts
6. `[병렬]` **스토리지 업로드 정책 강화 (INSERT 에 본인 폴더 제한, 용량/MIME 축소)** (S, 보안)
   - authenticated 이면 버킷 내 아무 경로나 올릴 수 있고 200MB 동영상까지 허용돼 익명 호스팅 악용 비용이 크다.
   - 파일: supabase/migrations/20261023_storage_insert_policy.sql (신규), src/lib/propertyPhoto.ts
7. **숙소 카드에 자동응답 상태(모드·규칙 수·답변 대기·리스팅 제목 누락) 표시 + 모드 토글을 카드/수신함에서 바로** (M, UX)
   - 대시보드 카드는 이미지·이름·주소만 보여 주고 모드 변경은 규칙 페이지 셀렉트 하나뿐이라 매일 쓰는 정보와 액션이 3단계 깊다.
   - 파일: src/components/host/HostDashboardContent.tsx, src/app/host/page.tsx, src/components/host/AirbnbInbox.tsx, src/app/host/property/[id]/rules/page.tsx
8. **수신함 숙소 필터(?property=)·규칙 링크 상시 표시 + /host 상단·배지 행 모바일 폭 정리** (S, UX)
   - 규칙 링크가 숙소 1개일 때만 보이고 메일이 한 목록에 섞이며 375px 에서 헤더 버튼 3개와 배지 6개가 넘친다.
   - 파일: src/app/host/airbnb/page.tsx, src/components/host/AirbnbInbox.tsx, src/components/host/HostDashboardContent.tsx
9. **구 제품 문구·브랜드 잔재 정리 (포포스테이, 컨시어지 문구, manifest, 중복 auth/login)** (S, UX)
   - translations.ts·manifest.ts·login 문구가 구 제품(컨시어지) 기준이고 auth/login 은 쓰이지 않는 중복 페이지인데 콜백 실패 시 그리로 리다이렉트된다.
   - 파일: src/lib/i18n/translations.ts, src/app/manifest.ts, src/app/auth/login/page.tsx, src/app/auth/callback/route.ts, src/lib/airbnb/brand.ts
10. **규칙 0개 첫 진입에 '기본 규칙 넣고 시작하기' CTA 카드** (S, UX)
   - 숙소 등록 직후 /rules 로 오지만 빈 상태 한 줄과 하단 ghost 버튼뿐이라 확인 모드·규칙 0개가 무엇을 뜻하는지 알 수 없다.
   - 파일: src/app/host/property/[id]/rules/page.tsx, src/app/host/property/new/page.tsx
11. **Slack 웹훅 호출 3곳을 서버 공통 모듈로 통합하고 알림 문구 생성을 순수 함수로 테스트** (M, 품질)
   - fetch(SLACK_WEBHOOK_URL) 이 sync 두 곳과 notify/slack 에 복붙돼 있고 알림 문구 분기(auto_sent/ready/needs_reply) 테스트가 없다.
   - 파일: src/app/api/airbnb/inbox/sync/route.ts, src/app/api/notify/slack/route.ts, src/lib/notifySlack.ts, src/lib/slack/server.ts (신규), src/lib/slack/format.test.ts (신규)
12. **parse 테스트 보강: review 픽스처, 영문 제목 계열, extractDates 연도 경로, cleanLines/htmlToText 단위 테스트** (M, 품질)
   - 에어비앤비 포맷 변경에 가장 취약한 모듈인데 kind=review 픽스처와 영문 실제 메일·연도 있는 날짜 경로 테스트가 없다.
   - 파일: src/lib/airbnb/mail/parse.ts, src/lib/airbnb/mail/parse.test.ts, src/lib/airbnb/mail/__fixtures__/
13. **Supabase Database 타입 생성 후 createClient<Database> 적용으로 as 캐스팅 제거** (M, 품질)
   - sync·AirbnbInbox·host/airbnb·rules 페이지에 `as PropertyRow[]`·`as MailRow` 류 캐스팅이 10곳 넘게 흩어져 있어 컬럼 변경이 컴파일로 잡히지 않는다.
   - 파일: src/types/database.ts, src/lib/supabase/admin.ts, src/lib/supabase/server.ts, src/lib/supabase/client.ts, src/app/api/airbnb/inbox/sync/route.ts, src/components/host/AirbnbInbox.tsx, src/app/host/airbnb/page.tsx, src/app/host/property/[id]/rules/page.tsx
14. **규칙 페이지 중복 로직 정리 (parseKeywordInput·buildRuleFromForm, eslint-disable 제거)** (S, 품질)
   - 키워드 split 이 세 번 반복되고 draftRule 구성이 saveRule payload 와 중복이며 useEffect 에 exhaustive-deps 비활성이 남아 있다.
   - 파일: src/app/host/property/[id]/rules/page.tsx, src/lib/airbnb/rules.ts, src/lib/airbnb/rules.test.ts
15. **숙소 등록/수정 페이지 toPropertyRow 통합 및 렌더마다 createClient() 호출·setTimeout 누수 정리** (S, 품질)
   - new/edit 페이지에 동일한 11개 필드 매핑이 복붙돼 있고 컴포넌트 본문에서 createClient 를 매 렌더 호출하며 AirbnbInbox flash 타이머가 언마운트 시 정리되지 않는다.
   - 파일: src/app/host/property/new/page.tsx, src/app/host/property/[id]/edit/page.tsx, src/components/layout/Header.tsx, src/components/host/AirbnbInbox.tsx, src/lib/propertyPhoto.ts
16. `[병렬]` **기존 호스트 페이지 lint 에러 74개 정리 + public/sw.js lint 제외** (L, 품질)
   - npm run lint 가 실패 상태(74 errors)라 CI 를 붙여도 의미가 없으며 에러는 전부 신규 에어비앤비 코드 밖의 기존 페이지(immutability·purity·set-state-in-effect·error-boundaries)다.
   - 파일: eslint.config.mjs, src/app/host/property/[id]/guests/page.tsx, src/app/host/property/[id]/nearby/page.tsx, src/app/host/property/[id]/podong/page.tsx, src/app/host/property/[id]/cleaning/page.tsx, src/app/host/property/[id]/emergency/page.tsx, src/app/host/property/[id]/guides/page.tsx, src/app/host/property/[id]/announcements/page.tsx, src/app/host/property/[id]/chat/page.tsx, src/components/chat/MessageBubble.tsx, src/components/chat/PlaceInquiryCard.tsx, src/lib/i18n/context.tsx, src/components/i18n/AutoTranslate.tsx, src/components/layout/TopLoader.tsx, src/components/maps/PlaceAutocomplete.tsx, src/components/reviews/ReviewsContent.tsx, src/components/podong/PodongCommentSection.tsx, public/sw.js
17. **scripts/airbnb-*.ts 정리: send-test 에 --yes 가드, 홍대점 시드 데이터 JSON 분리, npm script·README 등록** (M, 품질)
   - send-test 는 실제 게스트에게 메일을 보내는데 확인 가드가 없고 seed-rules 는 특정 숙소 데이터를 제품 저장소에 하드코딩하며 SAMPLE_RULES 와 중복된다.
   - 파일: scripts/airbnb-seed-rules.ts, scripts/airbnb-send-test.ts, scripts/airbnb-imap-dryrun.ts, scripts/parse-airbnb-mail.ts, package.json, src/app/host/property/[id]/rules/page.tsx

## 제외한 후보

- AI 초안 경로 완전 삭제(ai 패키지 의존성 제거) 옵션 — 결정사항이 '코드만 남기고 기본 비활성' 이므로 삭제 대신 서버측 게이트 항목으로만 유지
- 병합 시 In-Reply-To 에 automated 메일의 Message-ID 를 넣는 것이 에어비앤비 쪽에서 문제인지 — 추측이며 express 메일 직접 회신으로만 검증 가능해 별도 작업으로 두지 않고 '스레드 병합 키' 항목의 검증 메모로만 남김
- 실패 메일의 In-Reply-To/References 로 원래 발송 Message-ID 매칭 — 가능 여부가 추측(실패 메일에 헤더가 있는지 미확인)이라 독립 항목에서 빼고 '회신 실패 처리' 항목 안에서 시도 후 안 되면 창 안 후보 전부 나열로 대체
- 게스트 홈을 호스트 대시보드로 리다이렉트하고 게스트용 숙소 목록을 property_guests 기준으로 제한 — 게스트 공개 페이지의 제품 방향 결정이 필요한 사안이라 근거 부족, role 자동 승격 제거만 '인증 정리' 항목에 흡수
- no-img-element 경고의 next/image 전환 — 경고(warning)일 뿐이고 메인 이미지 1장 운영에 영향 없음
- Vercel Log Drain 연결 검토 — Hobby 플랜에서 비용·가용성 불확실, 구조화 로그 항목으로 충분
- sync 라우트 소소한 정리(REPLY_FAILED_RE 이중 필터, 매직 넘버 상수화, dryRun 응답 타입) — 독립 가치가 낮아 '로그 정비'·'크론 결정' 항목 진행 시 함께 처리
- IMAP/SMTP 자격증명 보호 운영 점검 — 독립 항목 대신 계정 전환 절차(앱 비밀번호·Sensitive 변수)와 로그 정비(에러 응답 detail 제거) 항목에 분산 흡수
- 배포 후 스모크 테스트 절차 고정 — 별도 작업이 아니라 PR 체크리스트와 운영 문서 항목의 한 절로 흡수
- 마이그레이션 파일명 규칙 통일(add_guide_i18n_columns.sql 등 날짜 없는 파일) — 이미 적용된 과거 파일이라 지금 이름을 바꾸면 supabase migration 히스토리와 어긋날 위험이 더 큼
