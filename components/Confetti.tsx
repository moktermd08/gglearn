"use client";
import { useMemo } from "react";

/** One-shot CSS confetti burst for passes and level-ups. */
export function Confetti({ count = 60 }: { count?: number }) {
  const bits = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: (i * 37) % 100, delay: ((i * 13) % 20) / 10, dur: 2.2 + ((i * 7) % 15) / 10,
    hue: (i * 47) % 360, rot: (i * 53) % 360, w: 6 + (i % 5) * 2,
  })), [count]);
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {bits.map((b, i) => (
        <span key={i} className="confetti" style={{ left: `${b.left}%`, width: b.w, height: b.w * 1.6, background: `hsl(${b.hue} 90% 60%)`,
          animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, transform: `rotate(${b.rot}deg)` }} />
      ))}
    </div>
  );
}
