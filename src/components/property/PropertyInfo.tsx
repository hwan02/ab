"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/ui/Card";
import type { Property } from "@/types/database";

interface PropertyInfoProps {
  property: Property;
}

export default function PropertyInfo({ property }: PropertyInfoProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      {/* Address */}
      {property.address && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
              <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900">{t("property.address")}</h3>
          </div>
          <WifiField label={t("property.address")} value={property.address} copyLabel={t("property.copyLabel")} copiedLabel={t("property.copied")} />
        </Card>
      )}

      {/* WiFi Info */}
      {(property.wifi_ssid || property.wifi_password) && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-blue-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A1 1 0 01.808 6.808c5.076-5.077 13.308-5.077 18.384 0a1 1 0 01-1.414 1.414zM14.95 11.05a7 7 0 00-9.9 0 1 1 0 01-1.414-1.414 9 9 0 0112.728 0 1 1 0 01-1.414 1.414zM12.12 13.88a3 3 0 00-4.242 0 1 1 0 01-1.415-1.415 5 5 0 017.072 0 1 1 0 01-1.415 1.415zM9 16a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900">WiFi</h3>
          </div>
          <div className="space-y-2">
            {property.wifi_ssid && (
              <WifiField label={t("property.wifiNetwork")} value={property.wifi_ssid} copyLabel={t("property.copyLabel")} copiedLabel={t("property.copied")} />
            )}
            {property.wifi_password && (
              <WifiField label={t("property.wifiPassword")} value={property.wifi_password} copyLabel={t("property.copyLabel")} copiedLabel={t("property.copied")} />
            )}
          </div>
        </Card>
      )}

      {/* Check-in Guide */}
      {property.checkin_guide && (
        <InfoCard
          title={t("property.checkinGuide")}
          content={property.checkin_guide}
          iconBgColor="bg-green-50"
          iconColor="text-green-500"
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
            />
          }
        />
      )}

      {/* Check-out Guide */}
      {property.checkout_guide && (
        <InfoCard
          title={t("property.checkoutGuide")}
          content={property.checkout_guide}
          iconBgColor="bg-orange-50"
          iconColor="text-orange-500"
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
            />
          }
        />
      )}

      {/* House Rules */}
      {property.house_rules && (
        <InfoCard
          title={t("property.houseRules")}
          content={property.house_rules}
          iconBgColor="bg-rose-50"
          iconColor="text-rose-500"
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
            />
          }
        />
      )}
    </div>
  );
}

function WifiField({ label, value, copyLabel, copiedLabel }: { label: string; value: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-mono text-sm font-medium text-gray-900">{value}</p>
      </div>
      <button
        onClick={handleCopy}
        className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-200"
        aria-label={`${label} ${copyLabel}`}
      >
        {copied ? (
          <span className="text-green-600">{copiedLabel}</span>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

function InfoCard({
  title,
  content,
  iconBgColor,
  iconColor,
  icon,
}: {
  title: string;
  content: string;
  iconBgColor: string;
  iconColor: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBgColor}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-5 w-5 ${iconColor}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            {icon}
          </svg>
        </div>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
        {content}
      </div>
    </Card>
  );
}
