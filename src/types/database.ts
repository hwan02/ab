export interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  role: "host" | "guest";
  created_at: string;
}

export interface Property {
  id: string;
  host_id: string;
  name: string;
  description: string | null;
  address: string | null;
  photos: string[] | null;
  wifi_ssid: string | null;
  wifi_password: string | null;
  checkin_guide: string | null;
  checkout_guide: string | null;
  house_rules: string | null;
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
  message_type: "text" | "image" | "file" | "item_request" | "reservation_request";
  created_at: string;
}

export interface Announcement {
  id: string;
  property_id: string;
  title: string;
  content: string;
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
