-- 포포마켓 구매 내역
CREATE TABLE market_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  guest_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  items JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'delivered')),
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE market_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mo_select" ON market_orders FOR SELECT USING (
  guest_id = auth.uid() OR EXISTS (
    SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid()
  )
);
CREATE POLICY "mo_insert" ON market_orders FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid())
);
CREATE POLICY "mo_update" ON market_orders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM properties WHERE id = property_id AND host_id = auth.uid())
);
