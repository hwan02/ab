"use client";

import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useI18n } from "@/lib/i18n/context";
import { lp, hasDbTranslation } from "@/lib/i18n/localize";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import AutoTranslate from "@/components/i18n/AutoTranslate";
import type { Property } from "@/types/database";

interface PropertyInfoProps {
  property: Property;
  /**
   * 비공개 정보(와이파이·상세 주소)를 볼 수 있는 사용자인지(호스트 본인 또는 등록된 게스트).
   * false 면 주소 카드는 숨기고 와이파이 카드는 안내문만 보여 준다. 기본값 true(기존 호출부 호환).
   */
  canViewPrivate?: boolean;
  /** 안내문 분기용: 비로그인이면 로그인 안내, 로그인했지만 미등록이면 승인 안내. */
  isLoggedIn?: boolean;
}

export default function PropertyInfo({
  property,
  canViewPrivate = true,
  isLoggedIn = true,
}: PropertyInfoProps) {
  const { t, locale } = useI18n();
  const [showWifiQR, setShowWifiQR] = useState(false);
  const qrRef = useRef<SVGSVGElement>(null);
  const address = canViewPrivate ? lp(property, "address", locale) : "";
  const checkinGuide = lp(property, "checkin_guide", locale);
  const checkoutGuide = lp(property, "checkout_guide", locale);
  const houseRules = lp(property, "house_rules", locale);

  return (
    <div className="space-y-4">
      {/* WiFi / Address locked (not host, not a registered guest) */}
      {!canViewPrivate && (
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
              <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-gray-900">
                WiFi · {t("property.address")}
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                {isLoggedIn ? t("access.restrictedDesc") : t("common.loginRequired")}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Address */}
      {address && (
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
          <WifiField label={t("property.address")} value={address} copyLabel={t("property.copyLabel")} copiedLabel={t("property.copied")} />
        </Card>
      )}

      {/* WiFi Info (only for host / registered guest; public rows carry no wifi columns) */}
      {canViewPrivate && (property.wifi_ssid || property.wifi_password) && (
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
            {property.wifi_ssid && property.wifi_password && (
              <button
                onClick={() => setShowWifiQR(true)}
                className="ml-auto rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100"
              >
                QR
              </button>
            )}
          </div>
          <div className="space-y-2">
            {property.wifi_ssid && (
              <WifiField label={t("property.wifiNetwork")} value={property.wifi_ssid} copyLabel={t("property.copyLabel")} copiedLabel={t("property.copied")} />
            )}
            {property.wifi_password && (
              <WifiField label={t("property.wifiPassword")} value={property.wifi_password} copyLabel={t("property.copyLabel")} copiedLabel={t("property.copied")} />
            )}
          </div>
          {property.wifi_ssid && property.wifi_password && (
            <Modal open={showWifiQR} onClose={() => setShowWifiQR(false)} title={`WiFi ${t("property.wifiQR")}`}>
              <div className="flex flex-col items-center gap-4 py-2">
                <QRCodeSVG
                  ref={qrRef}
                  value={`WIFI:T:WPA;S:${property.wifi_ssid};P:${property.wifi_password};;`}
                  size={200}
                  level="M"
                />
                <p className="text-sm text-gray-500">{property.wifi_ssid}</p>
                <button
                  onClick={() => {
                    const svg = qrRef.current;
                    if (!svg) return;
                    const svgData = new XMLSerializer().serializeToString(svg);
                    const canvas = document.createElement("canvas");
                    const scale = 3;
                    canvas.width = 200 * scale;
                    canvas.height = 200 * scale;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return;
                    const img = new Image();
                    img.onload = () => {
                      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                      canvas.toBlob((blob) => {
                        if (!blob) return;
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `WiFi-QR-${property.wifi_ssid}.png`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }, "image/png");
                    };
                    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
                  }}
                  className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  {t("common.save")}
                </button>
              </div>
            </Modal>
          )}
        </Card>
      )}

      {/* Check-in Guide */}
      {checkinGuide && (
        <InfoCard
          title={t("property.checkinGuide")}
          content={checkinGuide}
          autoTranslate={!hasDbTranslation(property, "checkin_guide", locale)}
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
      {checkoutGuide && (
        <InfoCard
          title={t("property.checkoutGuide")}
          content={checkoutGuide}
          autoTranslate={!hasDbTranslation(property, "checkout_guide", locale)}
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
      {houseRules && (
        <InfoCard
          title={t("property.houseRules")}
          content={houseRules}
          autoTranslate={!hasDbTranslation(property, "house_rules", locale)}
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
    <div className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="break-all font-mono text-sm font-medium text-gray-900">{value}</p>
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
  autoTranslate,
  iconBgColor,
  iconColor,
  icon,
}: {
  title: string;
  content: string;
  autoTranslate?: boolean;
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
        {autoTranslate ? <AutoTranslate text={content} /> : content}
      </div>
    </Card>
  );
}
