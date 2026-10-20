import { PRODUCT_NAME } from "@/lib/airbnb/brand";

type Size = "sm" | "lg";

const SIZES: Record<Size, { mark: string; word: string; gap: string }> = {
  sm: { mark: "h-8 w-8", word: "h-7", gap: "gap-2" },
  lg: { mark: "h-20 w-20", word: "h-16", gap: "gap-4" },
};

/** 포포톡 로고: 말풍선 마크(popotalk-mark.svg) + 직접 그린 워드마크(popotalk-wordmark.svg). */
export default function Logo({ size = "sm", className = "" }: { size?: Size; className?: string }) {
  const s = SIZES[size];
  return (
    <span className={`inline-flex items-center ${s.gap} ${className}`} aria-label={PRODUCT_NAME} role="img">
      <img src="/popotalk-mark.svg" alt="" aria-hidden className={`${s.mark} shrink-0`} />
      <img src="/popotalk-wordmark.svg" alt={PRODUCT_NAME} className={`${s.word} w-auto`} />
    </span>
  );
}
