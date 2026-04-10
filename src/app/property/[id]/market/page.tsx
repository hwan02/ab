import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MarketOrdersContent from "@/components/market/MarketOrdersContent";
import type { MarketOrder } from "@/types/database";

interface MarketPageProps {
  params: Promise<{ id: string }>;
}

export default async function MarketPage({ params }: MarketPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: orders } = await supabase
    .from("market_orders")
    .select("*")
    .eq("property_id", id)
    .eq("guest_id", user.id)
    .order("created_at", { ascending: false });

  return <MarketOrdersContent orders={(orders as MarketOrder[]) ?? []} />;
}
