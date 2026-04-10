"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { MarketOrder } from "@/types/database";
import type { TranslationKey } from "@/lib/i18n/translations";

interface MarketOrdersContentProps {
  orders: MarketOrder[];
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  ordered: "bg-blue-100 text-blue-700",
  delivered: "bg-green-100 text-green-700",
};

export default function MarketOrdersContent({ orders }: MarketOrdersContentProps) {
  const { t, locale } = useI18n();
  const loc = locale === "ja" ? "ja-JP" : locale === "zh" ? "zh-CN" : locale === "en" ? "en-US" : "ko-KR";

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(loc, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="px-4 py-6">
      <h2 className="mb-4 text-lg font-bold text-gray-900">{t("market.orderHistory")}</h2>

      {orders.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          }
          title={t("market.noOrders")}
          description={t("market.noOrdersDesc")}
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const statusKey = `market.${order.status}` as TranslationKey;
            return (
              <Card key={order.id} className="p-4">
                <div className="flex items-start gap-3">
                  {order.image_url && (
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      <Image
                        src={order.image_url}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[order.status]}`}>
                        {t(statusKey)}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(order.created_at)}</span>
                    </div>
                    <div className="mt-1.5 space-y-0.5">
                      {order.items.map((item, idx) => (
                        <p key={idx} className="text-sm text-gray-700">
                          {item.itemName} <span className="text-gray-400">x{item.quantity}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
