import { PRODUCT_NAME } from "@/lib/airbnb/brand";

type Size = "sm" | "lg";

const SIZES: Record<Size, string> = { sm: "h-7", lg: "h-16" };

/** 포포톡 로고: 직접 그린 워드마크(popotalk-wordmark.svg)만. */
export default function Logo({ size = "sm", className = "" }: { size?: Size; className?: string }) {
  return <img src="/popotalk-wordmark.svg" alt={PRODUCT_NAME} className={`${SIZES[size]} w-auto ${className}`} />;
}
