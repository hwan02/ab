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
  created_at: string;
}

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
