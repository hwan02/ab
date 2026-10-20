import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 에어비앤비 수신함 API 권한.
 *  - Authorization: Bearer $CRON_SECRET → 서버 간 호출, 전부 허용
 *  - 로그인 사용자 → 자기 숙소에 매핑된 메일만. 관리자 이메일은 전부.
 */
export interface Actor {
  kind: "cron" | "admin" | "host";
  userId?: string;
}

export async function identify(req: NextRequest): Promise<Actor | null> {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (secret && header === `Bearer ${secret}`) return { kind: "cron" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = !!process.env.NEXT_PUBLIC_ADMIN_EMAIL && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  return { kind: admin ? "admin" : "host", userId: user.id };
}

/** 메일 id 들이 모두 이 사용자의 숙소에 매핑돼 있는지. cron/admin 은 항상 true. */
export async function canAccessMails(actor: Actor, mailIds: string[]): Promise<boolean> {
  if (actor.kind !== "host") return true;
  if (mailIds.length === 0) return false;
  const supabase = createAdminClient();
  const { data: mails } = await supabase.from("airbnb_inbound_mails").select("id, property_id").in("id", mailIds);
  if (!mails || mails.length !== mailIds.length) return false;
  const propertyIds = [...new Set(mails.map((m) => m.property_id).filter((p): p is string => !!p))];
  if (propertyIds.length === 0 || mails.some((m) => !m.property_id)) return false;
  const { data: owned } = await supabase.from("properties").select("id").in("id", propertyIds).eq("host_id", actor.userId!);
  return (owned?.length ?? 0) === propertyIds.length;
}
