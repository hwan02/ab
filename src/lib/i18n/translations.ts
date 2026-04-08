export type Locale = "ko" | "en" | "ja" | "zh";

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
];

const translations = {
  // Login
  "login.title": {
    ko: "Guest Concierge",
    en: "Guest Concierge",
    ja: "Guest Concierge",
    zh: "Guest Concierge",
  },
  "login.subtitle": {
    ko: "숙소 게스트를 위한 컨시어지 서비스",
    en: "Concierge service for accommodation guests",
    ja: "宿泊ゲストのためのコンシェルジュサービス",
    zh: "住宿客人的礼宾服务",
  },
  "login.google": {
    ko: "Google로 로그인",
    en: "Sign in with Google",
    ja: "Googleでログイン",
    zh: "使用Google登录",
  },
  "login.loading": {
    ko: "로그인 중...",
    en: "Signing in...",
    ja: "ログイン中...",
    zh: "登录中...",
  },
  "login.language": {
    ko: "언어 선택",
    en: "Select language",
    ja: "言語を選択",
    zh: "选择语言",
  },

  // Home
  "home.myProperties": {
    ko: "내 숙소",
    en: "My Properties",
    ja: "マイ宿泊先",
    zh: "我的住宿",
  },
  "home.browse": {
    ko: "둘러보기",
    en: "Browse",
    ja: "探す",
    zh: "浏览",
  },
  "home.noProperties": {
    ko: "등록된 숙소가 없습니다",
    en: "No properties registered",
    ja: "登録された宿泊先がありません",
    zh: "没有注册的住宿",
  },
  "home.noPropertiesDesc": {
    ko: "호스트로부터 초대를 받으면 여기에 숙소가 표시됩니다.",
    en: "Properties will appear here when you receive an invitation from a host.",
    ja: "ホストから招待を受けると、ここに宿泊先が表示されます。",
    zh: "收到房东邀请后，住宿将显示在此处。",
  },
  "home.hostMode": {
    ko: "호스트 모드",
    en: "Host Mode",
    ja: "ホストモード",
    zh: "房东模式",
  },
  "home.hostModeDesc": {
    ko: "숙소를 관리하려면 여기를 누르세요",
    en: "Tap here to manage your properties",
    ja: "宿泊先を管理するにはここをタップ",
    zh: "点击这里管理您的住宿",
  },

  // Navigation
  "nav.propertyInfo": {
    ko: "숙소 정보",
    en: "Property Info",
    ja: "宿泊情報",
    zh: "住宿信息",
  },
  "nav.nearby": {
    ko: "주변 탐색",
    en: "Nearby",
    ja: "周辺スポット",
    zh: "周边探索",
  },
  "nav.concierge": {
    ko: "컨시어지",
    en: "Concierge",
    ja: "コンシェルジュ",
    zh: "礼宾服务",
  },
  "nav.chat": {
    ko: "채팅",
    en: "Chat",
    ja: "チャット",
    zh: "聊天",
  },
  "nav.more": {
    ko: "더보기",
    en: "More",
    ja: "もっと",
    zh: "更多",
  },
  "nav.announcements": {
    ko: "공지사항",
    en: "Announcements",
    ja: "お知らせ",
    zh: "公告",
  },
  "nav.emergency": {
    ko: "긴급연락처",
    en: "Emergency",
    ja: "緊急連絡先",
    zh: "紧急联系",
  },

  // Chat
  "chat.hostChat": {
    ko: "호스트와 대화",
    en: "Chat with Host",
    ja: "ホストとチャット",
    zh: "与房东聊天",
  },
  "chat.noMessages": {
    ko: "메시지가 없습니다. 대화를 시작해보세요!",
    en: "No messages yet. Start a conversation!",
    ja: "メッセージがありません。会話を始めましょう！",
    zh: "暂无消息。开始对话吧！",
  },
  "chat.placeholder": {
    ko: "메시지를 입력하세요...",
    en: "Type a message...",
    ja: "メッセージを入力...",
    zh: "输入消息...",
  },
  "chat.send": {
    ko: "전송",
    en: "Send",
    ja: "送信",
    zh: "发送",
  },
  "chat.itemRequest": {
    ko: "물품 요청",
    en: "Item Request",
    ja: "物品リクエスト",
    zh: "物品请求",
  },
  "chat.reservationRequest": {
    ko: "예약 요청",
    en: "Reservation",
    ja: "予約リクエスト",
    zh: "预订请求",
  },

  // Concierge
  "concierge.title": {
    ko: "컨시어지 서비스",
    en: "Concierge Service",
    ja: "コンシェルジュサービス",
    zh: "礼宾服务",
  },
  "concierge.selectService": {
    ko: "필요한 서비스를 선택해 주세요. 호스트가 빠르게 도와드립니다.",
    en: "Select a service you need. Your host will assist you promptly.",
    ja: "必要なサービスを選択してください。ホストが迅速にサポートします。",
    zh: "请选择您需要的服务。房东将尽快为您提供帮助。",
  },
  "concierge.itemTitle": {
    ko: "물품 요청",
    en: "Item Request",
    ja: "物品リクエスト",
    zh: "物品请求",
  },
  "concierge.itemDesc": {
    ko: "필요한 물품을 호스트에게 요청하세요",
    en: "Request items from your host",
    ja: "必要な物品をホストにリクエスト",
    zh: "向房东请求物品",
  },
  "concierge.reservationTitle": {
    ko: "식당 예약",
    en: "Restaurant Reservation",
    ja: "レストラン予約",
    zh: "餐厅预订",
  },
  "concierge.reservationDesc": {
    ko: "맛집 예약을 호스트에게 요청하세요",
    en: "Ask your host to book a restaurant",
    ja: "おすすめレストランの予約をリクエスト",
    zh: "请房东帮忙预订餐厅",
  },
  "concierge.transportTitle": {
    ko: "교통/픽업 문의",
    en: "Transport / Pickup",
    ja: "交通/ピックアップ",
    zh: "交通/接送",
  },
  "concierge.transportDesc": {
    ko: "교통편이나 픽업 서비스를 문의하세요",
    en: "Ask about transportation or pickup services",
    ja: "交通手段やピックアップサービスについて問い合わせ",
    zh: "咨询交通或接送服务",
  },
  "concierge.requestSent": {
    ko: "요청이 전송되었습니다!",
    en: "Request sent!",
    ja: "リクエストが送信されました！",
    zh: "请求已发送！",
  },

  // Common
  "common.logout": {
    ko: "로그아웃",
    en: "Log out",
    ja: "ログアウト",
    zh: "退出登录",
  },
  "common.back": {
    ko: "뒤로 가기",
    en: "Go back",
    ja: "戻る",
    zh: "返回",
  },
  "common.close": {
    ko: "닫기",
    en: "Close",
    ja: "閉じる",
    zh: "关闭",
  },
  "common.loading": {
    ko: "로딩 중...",
    en: "Loading...",
    ja: "読み込み中...",
    zh: "加载中...",
  },

  // Host
  "host.manageProperties": {
    ko: "내 숙소 관리",
    en: "Manage Properties",
    ja: "宿泊先管理",
    zh: "管理住宿",
  },
  "host.manageDesc": {
    ko: "등록한 숙소를 관리하고 새로운 숙소를 등록하세요.",
    en: "Manage your properties and register new ones.",
    ja: "宿泊先を管理し、新しい宿泊先を登録してください。",
    zh: "管理您的住宿并注册新的住宿。",
  },
  "host.registerProperty": {
    ko: "숙소 등록",
    en: "Add Property",
    ja: "宿泊先を登録",
    zh: "注册住宿",
  },
  "host.noProperties": {
    ko: "등록된 숙소가 없습니다",
    en: "No properties registered",
    ja: "登録された宿泊先がありません",
    zh: "没有注册的住宿",
  },
  "host.noPropertiesDesc": {
    ko: "첫 번째 숙소를 등록하고 게스트를 초대해보세요.",
    en: "Register your first property and invite guests.",
    ja: "最初の宿泊先を登録してゲストを招待しましょう。",
    zh: "注册您的第一个住宿并邀请客人。",
  },
  "host.registerFirst": {
    ko: "숙소 등록하기",
    en: "Register Property",
    ja: "宿泊先を登録する",
    zh: "注册住宿",
  },

  // Property info
  "property.guide": {
    ko: "숙소 안내",
    en: "Property Guide",
    ja: "宿泊ガイド",
    zh: "住宿指南",
  },
  "property.announcements": {
    ko: "공지사항",
    en: "Announcements",
    ja: "お知らせ",
    zh: "公告",
  },
  "property.nearby": {
    ko: "주변 탐색",
    en: "Nearby Places",
    ja: "周辺スポット",
    zh: "周边探索",
  },
  "property.emergency": {
    ko: "긴급 연락처",
    en: "Emergency Contacts",
    ja: "緊急連絡先",
    zh: "紧急联系方式",
  },
} as const;

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, locale: Locale): string {
  return translations[key]?.[locale] ?? translations[key]?.["ko"] ?? key;
}

export default translations;
