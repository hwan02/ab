-- ============================================
-- Airbnb Guest Concierge Platform - DB Schema
-- ============================================

-- 프로필 테이블
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'guest' CHECK (role IN ('host', 'guest')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 숙소 테이블
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  photos TEXT[],
  wifi_ssid TEXT,
  wifi_password TEXT,
  checkin_guide TEXT,
  checkout_guide TEXT,
  house_rules TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 게스트-숙소 연결 (예약)
CREATE TABLE property_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  guest_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  check_in DATE,
  check_out DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, guest_id)
);

-- 주변 장소
CREATE TABLE nearby_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('attraction', 'restaurant', 'convenience', 'experience')),
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  photo_url TEXT,
  map_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 채팅방
CREATE TABLE chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  guest_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, guest_id)
);

-- 메시지
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'item_request', 'reservation_request')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 공지사항
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 긴급 연락처
CREATE TABLE emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('hospital', 'police', 'fire', 'host', 'other')),
  phone TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 프로필 자동 생성 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Realtime 활성화 (채팅용)
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ============================================
-- Storage 버킷 (숙소 사진)
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-photos',
  'property-photos',
  true,
  52428800,  -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- Storage RLS 정책
CREATE POLICY "Anyone can view photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'property-photos');

CREATE POLICY "Authenticated users can upload photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'property-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'property-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================
-- RLS (Row Level Security)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE nearby_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- properties
CREATE POLICY "properties_select" ON properties FOR SELECT USING (true);
CREATE POLICY "properties_insert" ON properties FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "properties_update" ON properties FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "properties_delete" ON properties FOR DELETE USING (auth.uid() = host_id);

-- property_guests
CREATE POLICY "pg_select" ON property_guests FOR SELECT
  USING (guest_id = auth.uid() OR EXISTS (
    SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()
  ));
CREATE POLICY "pg_insert" ON property_guests FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()
  ));
CREATE POLICY "pg_delete" ON property_guests FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()
  ));

-- nearby_places
CREATE POLICY "np_select" ON nearby_places FOR SELECT USING (true);
CREATE POLICY "np_insert" ON nearby_places FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()));
CREATE POLICY "np_update" ON nearby_places FOR UPDATE
  USING (EXISTS (SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()));
CREATE POLICY "np_delete" ON nearby_places FOR DELETE
  USING (EXISTS (SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()));

-- chat_rooms
CREATE POLICY "cr_select" ON chat_rooms FOR SELECT
  USING (guest_id = auth.uid() OR EXISTS (
    SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()
  ));
CREATE POLICY "cr_insert" ON chat_rooms FOR INSERT
  WITH CHECK (guest_id = auth.uid());

-- messages
CREATE POLICY "msg_select" ON messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM chat_rooms WHERE id = chat_room_id
    AND (guest_id = auth.uid() OR EXISTS (
      SELECT 1 FROM properties WHERE id = chat_rooms.property_id AND host_id = auth.uid()
    ))
  ));
CREATE POLICY "msg_insert" ON messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- announcements
CREATE POLICY "ann_select" ON announcements FOR SELECT USING (true);
CREATE POLICY "ann_insert" ON announcements FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()));
CREATE POLICY "ann_update" ON announcements FOR UPDATE
  USING (EXISTS (SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()));
CREATE POLICY "ann_delete" ON announcements FOR DELETE
  USING (EXISTS (SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()));

-- emergency_contacts
CREATE POLICY "ec_select" ON emergency_contacts FOR SELECT USING (true);
CREATE POLICY "ec_insert" ON emergency_contacts FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()));
CREATE POLICY "ec_update" ON emergency_contacts FOR UPDATE
  USING (EXISTS (SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()));
CREATE POLICY "ec_delete" ON emergency_contacts FOR DELETE
  USING (EXISTS (SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()));
