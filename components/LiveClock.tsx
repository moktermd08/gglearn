"use client";
import { useEffect, useState } from "react";
import { clock } from "@/lib/competitions-shared";

/** A ticking stopwatch. `elapsed` is what the server measured at render time; the browser carries on from there so a skewed device clock cannot change it. */
export function LiveClock({ elapsed, className = "" }: { elapsed: number; className?: string }) {
  const [sec, setSec] = useState(elapsed);
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setSec(elapsed + (Date.now() - t0) / 1000), 1000);
    return () => clearInterval(id);
  }, [elapsed]);
  return <span className={`tabular-nums ${className}`} suppressHydrationWarning>{clock(sec)}</span>;
}
