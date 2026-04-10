"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function TopLoader() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // When pathname changes, the navigation completed
    setLoading(false);
    setProgress(0);
  }, [pathname]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (loading) {
      setProgress(20);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + (90 - prev) * 0.1;
        });
      }, 200);
    }
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("tel:") || href.startsWith("mailto:")) return;
      if (anchor.target === "_blank") return;
      if (href === pathname) return;
      setLoading(true);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname]);

  if (!loading && progress === 0) return null;

  return (
    <div className="fixed left-0 right-0 top-0 z-[200] h-1">
      <div
        className="h-full bg-rose-500 shadow-sm shadow-rose-200 transition-all duration-200 ease-out"
        style={{
          width: `${loading ? progress : 100}%`,
          opacity: loading ? 1 : 0,
          transition: loading
            ? "width 200ms ease-out"
            : "width 200ms ease-out, opacity 400ms ease-in 200ms",
        }}
      />
    </div>
  );
}
