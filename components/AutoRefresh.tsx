"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-reads the page's server data on a timer while a contest is live. Pauses when the tab is hidden. */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) router.refresh(); }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
