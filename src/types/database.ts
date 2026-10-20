export interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  role: "host" | "guest";
  email_notifications: boolean;
  created_at: string;
}

export interface Property {
  id: string;
  host_id: string;
  name: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  photos: string[] | null;
  wifi_ssid: string | null;
  wifi_password: string | null;
  checkin_guide: string | null;
  checkout_guide: string | null;
  house_rules: string | null;
  checkin_guide_en: string | null;
  checkin_guide_ja: string | null;
  checkin_guide_zh: string | null;
  checkout_guide_en: string | null;
  checkout_guide_ja: string | null;
  checkout_guide_zh: string | null;
  house_rules_en: string | null;
  house_rules_ja: string | null;
  house_rules_zh: string | null;
  name_en: string | null;
  name_ja: string | null;
  name_zh: string | null;
  description_en: string | null;
  description_ja: string | null;
  description_zh: string | null;
  address_en: string | null;
  address_ja: string | null;
  address_zh: string | null;
  airbnb_listing_title: string | null;
  checkin_time: string | null;
  checkout_time: string | null;
  auto_reply_mode: "off" | "confirm" | "auto";
  created_at: string;
}

/** properties_public 뷰에는 없는 비공개 컬럼. 호스트 본인·등록 게스트만 properties 테이블(RLS)에서 읽는다. */
export type PrivatePropertyKey =
  | "wifi_ssid"
  | "wifi_password"
  | "address"
  | "address_en"
  | "address_ja"
  | "address_zh"
  | "airbnb_listing_title"
  | "auto_reply_mode";

/**
 * properties_public 뷰 행(supabase/migrations/20261023_properties_public_columns.sql).
 * 비로그인도 읽을 수 있다. 좌표는 소수점 2자리(약 1km)로 뭉개져 있다.
 */
export type PropertyPublic = Omit<Property, PrivatePropertyKey>;

export interface PropertyGuest {
  id: string;
  property_id: string;
  guest_id: string;
  check_in: string | null;
  check_out: string | null;
  created_at: string;
}

export interface NearbyPlace {
  id: string;
  property_id: string;
  category: "attraction" | "restaurant" | "convenience" | "experience";
  name: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string | null;
  photo_url: string | null;
  map_url: string | null;
  phone: string | null;
  created_at: string;
}

export interface ChatRoom {
  id: string;
  property_id: string;
  guest_id: string;
  host_last_read_at: string | null;
  guest_last_read_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  chat_room_id: string;
  sender_id: string;
  content: string;
  message_type: "text" | "image" | "file" | "item_request" | "reservation_request" | "place_inquiry";
  created_at: string;
}

export interface Announcement {
  id: string;
  property_id: string;
  title: string;
  content: string;
  created_at: string;
}

export interface GuestRequest {
  id: string;
  property_id: string;
  guest_id: string;
  check_in: string | null;
  check_out: string | null;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface EmergencyContact {
  id: string;
  property_id: string;
  name: string;
  category: "hospital" | "police" | "fire" | "host" | "other";
  phone: string;
  address: string | null;
  created_at: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  created_at: string;
}

export interface PlaceRecommendation {
  id: string;
  property_id: string;
  guest_id: string;
  name: string;
  category: "attraction" | "restaurant" | "convenience" | "experience";
  description: string | null;
  address: string | null;
  map_url: string | null;
  photo_url: string | null;
  show_recommender: boolean;
  recommender_name: string | null;
  recommender_avatar: string | null;
  recommender_country: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface MarketOrder {
  id: string;
  property_id: string;
  guest_id: string;
  items: { itemName: string; quantity: string }[];
  status: "pending" | "ordered" | "delivered";
  image_url: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  rating: number;
  created_at: string;
  profiles?: Pick<Profile, "name" | "avatar_url">;
}

export interface PodongPhoto {
  id: string;
  property_id: string;
  photo_url: string;
  caption: string | null;
  display_order: number;
  created_at: string;
}

export interface PodongComment {
  id: string;
  photo_id: string;
  user_id: string;
  user_name: string | null;
  user_avatar: string | null;
  content: string;
  created_at: string;
}

export interface PropertyGuide {
  id: string;
  property_id: string;
  title: string;
  content: string | null;
  video_url: string | null;
  media_url: string | null;
  media_type: "image" | "video" | null;
  media_url_en: string | null;
  media_url_ja: string | null;
  media_url_zh: string | null;
  media_type_en: "image" | "video" | null;
  media_type_ja: "image" | "video" | null;
  media_type_zh: "image" | "video" | null;
  category: "appliance" | "directions" | "facility" | "other";
  display_order: number;
  created_at: string;
}

export interface CleaningGuide {
  id: string;
  property_id: string;
  title: string;
  description: string | null;
  photo_urls: string[];
  youtube_url: string | null;
  kind: "step" | "supply" | "location";
  display_order: number;
  created_at: string;
}

export type AirbnbMailKind =
  | "message"
  | "reservation_request"
  | "reservation_confirmed"
  | "reservation_cancelled"
  | "review"
  | "other";

export type AirbnbInboundStatus = "new" | "drafted" | "replied" | "ignored";

export interface AirbnbInboundMail {
  id: string;
  message_id: string;
  received_at: string | null;
  subject: string;
  sender: string;
  kind: AirbnbMailKind;
  guest_name: string | null;
  listing_name: string | null;
  thread_url: string | null;
  thread_id: string | null;
  reservation_code: string | null;
  message_text: string | null;
  check_in: string | null;
  check_out: string | null;
  snippet: string | null;
  property_id: string | null;
  status: AirbnbInboundStatus;
  draft_reply: string | null;
  replied_at: string | null;
  reply_to: string | null;
  sent_reply: string | null;
  sent_at: string | null;
  matched_rule_id: string | null;
  auto_sent: boolean;
  raw_text: string | null;
  created_at: string;
}

export interface AirbnbReplyRule {
  id: string;
  property_id: string;
  name: string;
  keywords: string[];
  answer: string;
  answer_en: string | null;
  answer_zh: string | null;
  answer_ja: string | null;
  priority: number;
  enabled: boolean;
  hit_count: number;
  last_hit_at: string | null;
  created_at: string;
  updated_at: string;
}
