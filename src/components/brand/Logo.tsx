import { PRODUCT_NAME } from "@/lib/airbnb/brand";

type Size = "sm" | "lg";

const SIZES: Record<Size, { mark: string; text: string; gap: string }> = {
  sm: { mark: "h-8 w-8", text: "text-[22px]", gap: "gap-2" },
  lg: { mark: "h-16 w-16", text: "text-[52px]", gap: "gap-4" },
};

/** 포포톡 로고: 말풍선 마크 + 워드마크. 글꼴은 Noto Sans KR 900, 자간 좁게. */
export default function Logo({ size = "sm", className = "" }: { size?: Size; className?: string }) {
  const s = SIZES[size];
  return (
    <span className={`inline-flex items-center ${s.gap} ${className}`}>
      <img src="/popotalk-mark.svg" alt="" aria-hidden className={`${s.mark} shrink-0`} />
      <span
        className={`${s.text} font-black leading-none tracking-[-0.04em] text-gray-900`}
        style={{ fontFamily: "var(--font-noto-kr), sans-serif" }}
      >
        {PRODUCT_NAME}
      </span>
    </span>
  );
}
