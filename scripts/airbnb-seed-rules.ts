/**
 * 포포스테이 홍대점용 자동응답 규칙 세트를 넣는다.
 *
 *   node --env-file=.env.local scripts/airbnb-seed-rules.ts [property_id]
 *
 * - property_id 를 안 주면 첫 번째 숙소에 넣는다.
 * - 같은 이름의 규칙이 이미 있으면 건너뛴다(여러 번 돌려도 중복 안 생김).
 * - 숙소의 airbnb_listing_title 이 비어 있으면 에어비앤비 알림 메일에 쓰인 제목으로 채운다.
 *
 * 답변은 숙소 소개글·체크인/아웃 안내·이용규칙·가이드에 적힌 사실만 썼다.
 * 확인이 필요한 규칙(보일러)은 꺼진 상태로 넣었으니 내용을 확인하고 켜면 된다.
 */

import { createClient } from "@supabase/supabase-js";

const LISTING_TITLE = "#홍대입구역 #최대6인 #짐보관서비스 #연희•연남동 #공항철도 #인천공항 1시간 #홈씨어터";

interface SeedRule {
  name: string;
  keywords: string[];
  answer: string;
  answer_en?: string;
  priority?: number;
  enabled?: boolean;
}

export const RULES: SeedRule[] = [
  {
    name: "와이파이 안내",
    keywords: ["와이파이", "wifi", "wi-fi", "인터넷", "비밀번호", "password", "internet"],
    priority: 10,
    answer:
      "{게스트이름}님 안녕하세요 :)\n와이파이 이름은 {와이파이이름}, 비밀번호는 {와이파이비밀번호} 입니다.\n연결이 잘 안 되면 언제든 말씀해 주세요!",
    answer_en:
      "Hi {게스트이름} :)\nWi-Fi name: {와이파이이름}\nPassword: {와이파이비밀번호}\nLet me know anytime if it doesn't connect!",
  },
  {
    name: "체크인 시간·이른 체크인",
    keywords: ["체크인", "입실", "몇 시에", "몇시에", "일찍", "check in", "check-in", "checkin", "early", "arrive", "도착"],
    priority: 8,
    answer:
      "체크인은 오후 3시부터 가능합니다 :)\n이른 체크인은 당일 청소 일정에 따라 가능할 수도 있으니 도착 예정 시간을 알려주시면 확인해 드릴게요.\n숙소 위치의 마지막 1~2분 상세 길안내는 체크인 전에 보내드립니다. 2층으로 올라오는 계단이 있으니 조심해서 올라와 주세요!",
    answer_en:
      "Check-in starts at 3:00 PM :)\nEarly check-in may be possible depending on the cleaning schedule that day. Let me know your arrival time and I'll confirm.\nI'll send detailed directions for the last 1–2 minutes before check-in. Please mind the stairs up to the 2nd floor!",
  },
  {
    name: "체크아웃 시간·늦은 체크아웃",
    keywords: ["체크아웃", "퇴실", "check out", "check-out", "checkout", "늦게", "late check"],
    priority: 8,
    answer:
      "체크아웃은 오전 10시입니다.\n리뷰를 남겨주시면 11시까지 1시간 연장해 드려요 🤩\n내려가실 때 난간을 꼭 잡고 천천히 내려가 주세요!",
    answer_en:
      "Check-out is at 10:00 AM.\nIf you leave a review, I'll extend it to 11:00 AM 🤩\nPlease hold the handrail when going down the stairs!",
  },
  {
    name: "짐 보관",
    keywords: ["짐 보관", "짐을", "짐 맡", "짐도", "캐리어", "가방", "보관", "맡길", "맡겨", "luggage", "baggage", "suitcase", "keep my"],
    priority: 9,
    answer:
      "네, 체크인 전이나 체크아웃 후 짐 보관 가능합니다 :)\n도착 예정 시간이나 맡기실 시간을 알려주시면 안내해 드릴게요.",
    answer_en:
      "Yes, luggage storage is available before check-in and after check-out :)\nLet me know what time you'd like to drop it off and I'll guide you.",
  },
  {
    name: "주소·위치·오시는 길",
    keywords: ["주소", "위치", "어디", "어디에", "찾아가", "가는 법", "오는 길", "길 안내", "address", "location", "where", "directions", "how to get"],
    priority: 6,
    answer:
      "숙소는 서울 서대문구 연희동 조용한 주택가 골목 안쪽에 있어요.\n홍대입구역(2호선·공항철도)에서 도보 약 16분, 신촌역에서 18분입니다.\n골목 안 마지막 1~2분 상세 길안내는 체크인 전에 따로 보내드릴게요 :)",
    answer_en:
      "The house is in a quiet residential alley in Yeonhui-dong, Seodaemun-gu, Seoul.\nAbout a 16-minute walk from Hongik Univ. Station (Line 2 / Airport Railroad) and 18 minutes from Sinchon Station.\nI'll send detailed directions for the last 1–2 minutes before check-in :)",
  },
  {
    name: "공항에서 오는 법",
    keywords: ["공항", "인천", "김포", "공항철도", "공항버스", "airport", "incheon", "gimpo", "taxi", "택시"],
    priority: 7,
    answer:
      "인천공항에서는 공항철도로 홍대입구역까지 약 53분이에요.\n홍대입구역 4번 출구에서 택시로 약 6분(GS25 연희진성점 하차) 또는 도보 18분입니다.\n공항버스 6011번(연희104고지앞·궁동근린공원 하차, 약 44분)으로 오셔도 편해요. 총 50분~1시간 10분 정도 보시면 됩니다 :)",
    answer_en:
      "From Incheon Airport, take the Airport Railroad to Hongik Univ. Station (about 53 min).\nFrom Exit 4, it's a 6-minute taxi ride (get off at GS25 Yeonhui Jinseong) or an 18-minute walk.\nAirport bus 6011 (get off at Yeonhui 104-goji / Gungdong Park, about 44 min) also works. Plan on about 50–70 minutes total :)",
  },
  {
    name: "지하철역·홍대 거리",
    keywords: ["지하철", "홍대입구", "홍대", "연남", "신촌", "역까지", "걸어서", "도보", "subway", "station", "hongdae", "walk", "far from"],
    priority: 5,
    answer:
      "홍대입구역까지 도보 약 16분, 신촌역은 약 18분이에요.\n연남동·홍대 상권은 걸어서 10~15분, 편의점은 2~3분 거리입니다 :)",
    answer_en:
      "It's about a 16-minute walk to Hongik Univ. Station and 18 minutes to Sinchon Station.\nYeonnam-dong and the Hongdae area are a 10–15 minute walk, and a convenience store is 2–3 minutes away :)",
  },
  {
    name: "주차·차량",
    keywords: ["주차", "차 대", "차량", "밴", "van", "parking", "park the", "drop off", "내려줄"],
    priority: 7,
    answer:
      "건물 내 주차는 어려워요 🚫 인근 유료주차장을 이용하셔야 합니다.\n숙소 앞 골목에서 짐만 잠시 내리는 건 가능하니 차량으로 오시면 미리 알려주세요.",
    answer_en:
      "There's no parking at the building 🚫 — please use a nearby paid parking lot.\nA quick drop-off in the alley in front of the house is fine, so let me know if you're coming by car.",
  },
  {
    name: "몇 층·계단·엘리베이터",
    keywords: ["몇 층", "몇층", "층인", "계단", "엘리베이터", "floor", "stairs", "elevator", "lift"],
    priority: 6,
    answer:
      "숙소는 2층 전체를 단독으로 사용하시고, 외부 계단으로 올라옵니다(엘리베이터는 없어요).\n계단에는 미끄럼 방지 패드와 난간, 야간 조명을 설치해 두었습니다. 큰 짐이 있으시면 미리 말씀해 주세요!",
    answer_en:
      "You'll have the entire 2nd floor to yourselves, reached by an outdoor staircase (no elevator).\nThe stairs have anti-slip pads, a handrail and night lighting. Let me know if you have heavy luggage!",
  },
  {
    name: "욕실·화장실",
    keywords: ["욕실", "화장실", "샤워", "비데", "bathroom", "toilet", "shower", "restroom"],
    priority: 6,
    answer:
      "욕실은 2개 있어요. 침실 안에 딸린 구조는 아니지만 2층 전체를 저희 게스트만 쓰시기 때문에 다른 팀과 공유하지 않습니다 :)\n비데는 메인 욕실에 있고 샴푸·컨디셔너·바디워시·수건을 준비해 두었습니다.",
    answer_en:
      "There are 2 bathrooms. They're not inside the bedrooms, but the whole 2nd floor is only for your group, so you won't share them with anyone :)\nThe main bathroom has a bidet, and shampoo, conditioner, body wash and towels are provided.",
  },
  {
    name: "인원·침대",
    keywords: ["인원", "몇 명", "몇명", "명까지", "침대", "bed", "people", "guests", "최대", "capacity", "어른", "아이들", "children", "kids"],
    priority: 5,
    answer:
      "최대 6인까지 가능해요.\n침실 2개에 각각 퀸 침대 1개 + 슈퍼싱글 침대 1개가 있고, 거실에는 80인치 빔프로젝터와 6인 식탁이 있습니다 :)",
    answer_en:
      "Up to 6 guests.\nEach of the 2 bedrooms has a queen bed and a super-single bed, and the living room has an 80-inch projector and a 6-seat dining table :)",
  },
  {
    name: "흡연·파티·반려동물",
    keywords: ["흡연", "담배", "전자담배", "파티", "반려", "강아지", "고양이", "애완", "smoke", "smoking", "party", "pets", "dog", "puppy", "animal"],
    priority: 6,
    answer:
      "실내 흡연(전자담배 포함)과 파티는 어려워요. 반려동물 동반도 불가합니다 🙏\n주택가라 밤 9시 이후에는 소음에 조금만 신경 써 주세요.",
    answer_en:
      "Smoking indoors (including e-cigarettes), parties and pets aren't allowed 🙏\nIt's a residential area, so please keep noise down after 9 PM.",
  },
  {
    name: "빔프로젝터",
    keywords: ["빔프로", "프로젝터", "projector", "리모컨", "remote", "넷플릭스", "netflix", "유튜브"],
    priority: 6,
    answer:
      "빔프로젝터는 리모컨으로 켜시면 됩니다 :)\n펌웨어 업데이트 화면이 뜨면 15~30분 정도 걸릴 수 있으니 중간에 전원을 뽑거나 강제 종료하지 말고 기다려 주세요. 안 되면 바로 말씀해 주세요!",
    answer_en:
      "Turn on the projector with the remote :)\nIf a firmware update appears, it can take 15–30 minutes — please don't unplug it or force it off. Message me if it doesn't work!",
  },
  {
    name: "보일러·난방·온수 (확인 필요)",
    keywords: ["보일러", "난방", "온수", "따뜻", "추워", "heater", "heating", "hot water", "cold"],
    priority: 6,
    enabled: false,
    answer: "난방과 온수는 거실 보일러 패널에서 조절하실 수 있어요. 안 되면 바로 말씀해 주세요!",
    answer_en: "You can adjust heating and hot water on the boiler panel in the living room. Message me if it doesn't work!",
  },
  {
    name: "예약 가능 여부 (확인 후 답변)",
    keywords: ["예약 가능", "가능 여부", "가능한가요", "가능할까요", "빈 방", "남아 있", "available", "availability", "vacancy"],
    priority: -1,
    answer: "문의 감사합니다 :) 해당 날짜 예약 가능 여부를 확인하고 바로 답변드릴게요!",
    answer_en: "Thanks for asking :) I'll check availability for those dates and get back to you shortly!",
  },
  {
    name: "가격·할인·취소·환불 (확인 후 답변)",
    keywords: ["할인", "가격", "비용", "요금", "취소", "환불", "discount", "price", "cheaper", "cancel", "refund"],
    priority: -1,
    answer: "말씀 감사합니다 :) 가격·예약 관련 내용은 확인 후 바로 답변드릴게요!",
    answer_en: "Thanks for your message :) I'll check and get back to you shortly about pricing/booking.",
  },
  {
    name: "감사 인사",
    keywords: ["감사합니다", "감사해요", "고마워", "thank", "thanks", "thx", "okay", "okok", "알겠습니다", "알겠어요", "즐거운 여행"],
    priority: -4,
    answer: "저도 감사합니다 :) 편안하고 즐거운 여행 되시길 바랄게요!",
    answer_en: "Thank you too :) Hope you have a relaxing and wonderful trip!",
  },
  {
    name: "인사만 온 경우",
    keywords: ["안녕하세요", "안녕하십니까", "hello", "你好", "こんにちは"],
    priority: -5,
    answer: "안녕하세요 {게스트이름}님! 포포스테이 홍대점 호스트입니다 :)\n궁금한 점이 있으시면 편하게 물어봐 주세요.",
    answer_en: "Hello {게스트이름}! This is the host of POPO Stay Hongdae :)\nFeel free to ask me anything.",
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let propertyId = process.argv[2];
  if (!propertyId) {
    const { data } = await supabase.from("properties").select("id, name").order("created_at").limit(1).single();
    if (!data) throw new Error("숙소가 없습니다");
    propertyId = data.id as string;
    console.log(`숙소: ${data.name} (${propertyId})`);
  }

  const { data: prop, error: propErr } = await supabase
    .from("properties")
    .select("airbnb_listing_title, checkin_time, checkout_time")
    .eq("id", propertyId)
    .single();
  if (propErr) throw new Error(`숙소 조회 실패(마이그레이션 적용 여부 확인): ${propErr.message}`);

  const patch: Record<string, string> = {};
  if (!prop.airbnb_listing_title) patch.airbnb_listing_title = LISTING_TITLE;
  if (!prop.checkin_time) patch.checkin_time = "오후 3:00";
  if (!prop.checkout_time) patch.checkout_time = "오전 10:00";
  if (Object.keys(patch).length) {
    const { error } = await supabase.from("properties").update(patch).eq("id", propertyId);
    if (error) throw new Error(`숙소 업데이트 실패: ${error.message}`);
    console.log("숙소 필드 채움:", Object.keys(patch).join(", "));
  }

  const { data: existing, error: exErr } = await supabase.from("airbnb_reply_rules").select("name").eq("property_id", propertyId);
  if (exErr) throw new Error(`규칙 조회 실패(마이그레이션 적용 여부 확인): ${exErr.message}`);
  const have = new Set((existing ?? []).map((r) => r.name as string));

  const rows = RULES.filter((r) => !have.has(r.name)).map((r) => ({
    property_id: propertyId,
    name: r.name,
    keywords: r.keywords,
    answer: r.answer,
    answer_en: r.answer_en ?? null,
    priority: r.priority ?? 0,
    enabled: r.enabled ?? true,
  }));
  if (rows.length === 0) {
    console.log("추가할 규칙 없음 (이미 전부 있음)");
    return;
  }
  const { error } = await supabase.from("airbnb_reply_rules").insert(rows);
  if (error) throw new Error(`규칙 삽입 실패: ${error.message}`);
  console.log(`규칙 ${rows.length}개 추가:`);
  for (const r of rows) console.log(`  - ${r.name}${r.enabled ? "" : " (꺼짐)"}`);
}

if (process.argv[1] && /airbnb-seed-rules\.ts$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
