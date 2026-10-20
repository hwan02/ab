import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/layout/Header";
import { PRODUCT_NAME } from "@/lib/airbnb/brand";

export const dynamic = "force-dynamic";

/** 포포톡 호스트 가이드. 공동호스트 추가 절차는 에어비앤비 도움말(help/article/1534) 기준. */
export default async function HostGuidePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fhost%2Fguide");

  const cohostEmail = process.env.NEXT_PUBLIC_POPOTALK_COHOST_EMAIL || "seunghwansuh@kakao.com";

  return (
    <div className="min-h-dvh bg-gray-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900">가이드</h1>
        <p className="mt-1 text-sm text-gray-500">{PRODUCT_NAME} 시작하기. 아래 순서대로 하면 됩니다.</p>

        <ol className="mt-8 space-y-8">
          <Step n={1} title="숙소 등록">
            <p>
              <Link href="/host/property/new" className="text-rose-600 underline">숙소 등록</Link>에서 숙소 이름, 에어비앤비 리스팅 제목, 와이파이, 체크인·체크아웃 시간과 안내를 입력합니다.
            </p>
            <Tip>
              <b>에어비앤비 리스팅 제목</b>은 에어비앤비에 올린 숙소 제목을 그대로 복사해 넣으세요. 게스트 메시지가 어느 숙소 것인지 이 제목으로 찾습니다.
            </Tip>
          </Step>

          <Step n={2} title="자동응답 규칙 등록">
            <p>숙소 메뉴의 <b>자동응답</b>에서 자주 받는 질문의 키워드와 답변을 등록합니다. 처음에는 <b>기본 규칙 추가</b>로 와이파이·체크인·체크아웃 규칙을 넣고 답변만 고치면 됩니다.</p>
            <p>답변에 <code className="rounded bg-gray-100 px-1">{"{게스트이름}"}</code> <code className="rounded bg-gray-100 px-1">{"{와이파이비밀번호}"}</code> 같은 변수를 넣으면 보낼 때 숙소 정보로 채워집니다.</p>
            <p><b>테스트</b> 메뉴에서 게스트 메시지를 넣어 보면 어떤 답이 나가는지 미리 볼 수 있습니다.</p>
          </Step>

          <Step n={3} title="에어비앤비에 포포톡 공동호스트 추가">
            <p>게스트 메시지를 {PRODUCT_NAME}이 받으려면 에어비앤비 숙소에 {PRODUCT_NAME} 계정을 공동호스트로 추가해야 합니다.</p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>에어비앤비 호스트 모드 → <b>숙소</b> → 해당 숙소 선택</li>
              <li><b>숙소 편집</b> → <b>숙소 공간</b>(Your space) → <b>공동호스트</b></li>
              <li><b>공동호스트 초대</b> 클릭 → 국가/지역을 고르고 아래 이메일 입력</li>
              <li>
                권한은 <b>캘린더 및 메시지함 액세스</b>를 선택합니다. (게스트와 메시지를 주고받을 수 있는 권한. 가격·예약 변경 권한은 필요 없습니다.)
              </li>
              <li>초대 보내기. {PRODUCT_NAME} 쪽에서 수락하면 연결이 끝납니다.</li>
            </ol>
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm">
              <div className="text-xs text-rose-500">초대할 공동호스트 이메일</div>
              <div className="mt-0.5 font-mono text-base text-gray-900">{cohostEmail ?? "준비 중입니다. 관리자에게 문의하세요."}</div>
            </div>
            <Tip>
              초대는 숙소마다 따로 해야 합니다. 숙소가 여러 개면 각 숙소에서 같은 절차를 반복하세요. 에어비앤비 정책상 숙소 하나에 공동호스트는 최대 10명입니다.
            </Tip>
          </Step>

          <Step n={4} title="동작 방식과 모드">
            <p>게스트가 메시지를 보내면 에어비앤비가 공동호스트에게 알림 메일을 보내고, {PRODUCT_NAME}이 그 메일을 읽어 규칙과 맞춰 봅니다. 답은 에어비앤비 메시지 스레드에 호스트 답장으로 올라갑니다.</p>
            <p>자동응답 메뉴의 모드는 세 가지입니다.</p>
            <ul className="list-disc space-y-1 pl-5">
              <li><b>확인 후 발송</b>: 답변을 만들어 두고 수신함에서 호스트가 [답장 보내기]를 눌러야 나갑니다. 처음엔 이 모드로 며칠 지켜보세요.</li>
              <li><b>자동 발송</b>: 규칙에 맞으면 바로 보냅니다.</li>
              <li><b>끔</b>: 메시지만 모으고 답하지 않습니다.</li>
            </ul>
            <p>규칙에 맞지 않는 메시지는 수신함에 <b>답변 필요</b>로 남습니다. 거기서 직접 답하거나 <b>이 메시지로 규칙 만들기</b>로 바로 규칙을 추가할 수 있습니다.</p>
          </Step>

          <Step n={5} title="주의할 점">
            <ul className="list-disc space-y-1 pl-5">
              <li>에어비앤비 앱에서 메시지를 먼저 읽어 버리면 알림 메일이 오지 않아 자동응답이 빠질 수 있습니다. 자동응답을 쓰는 동안은 답이 나간 뒤에 확인하세요.</li>
              <li>가격 할인·환불·취소처럼 호스트 결정이 필요한 질문은 자동으로 확답하지 말고 “확인 후 답변” 정도로만 규칙을 두세요.</li>
              <li>답변은 게스트가 쓴 언어(한국어·영어·중국어·일본어)에 맞춰 나갑니다. 규칙 저장 시 번역이 자동으로 채워지니 한 번 읽어 보고 고치세요.</li>
            </ul>
          </Step>
        </ol>

        <p className="mt-10 text-xs text-gray-400">
          공동호스트 절차 출처: 에어비앤비 도움말{" "}
          <a href="https://www.airbnb.co.kr/help/article/1534" target="_blank" rel="noopener noreferrer" className="underline">
            공동호스트 추가하기
          </a>
          ,{" "}
          <a href="https://www.airbnb.co.kr/help/article/1244" target="_blank" rel="noopener noreferrer" className="underline">
            공동호스트 권한
          </a>
          . 에어비앤비 화면 문구는 업데이트에 따라 조금 다를 수 있습니다.
        </p>
      </main>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500 text-sm font-bold text-white">{n}</span>
      <div className="min-w-0 flex-1 space-y-2 text-sm leading-relaxed text-gray-700">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {children}
      </div>
    </li>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600">{children}</p>;
}
