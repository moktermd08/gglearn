import { available, LABEL, type Provider } from "@/lib/social";

const Mark = ({ p }: { p: Provider }) => p === "google"
  ? <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.3 5.7c4.3-4 6.8-9.9 6.8-17.1z" /><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.9 2.3-8.6 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" /></svg>
  : <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden><path fill="#F25022" d="M1 1h10v10H1z" /><path fill="#7FBA00" d="M12 1h10v10H12z" /><path fill="#00A4EF" d="M1 12h10v10H1z" /><path fill="#FFB900" d="M12 12h10v10H12z" /></svg>;

/** "Continue with Google / Microsoft", for the providers the platform owner has set up. Renders nothing otherwise. A plain link: it works without JavaScript. */
export function SocialButtons({ next = "", refCode = "", tried = "", verb = "Continue" }: { next?: string; refCode?: string; tried?: string; verb?: string }) {
  const list = available();
  if (!list.length) return null;
  return (
    <div className="space-y-2" aria-label="Sign in with another account">
      {list.map((p) => {
        const q = new URLSearchParams();
        if (next) q.set("next", next);
        if (refCode) q.set("ref", refCode);
        if (tried) q.set("try", tried);
        return <a key={p} href={`/auth/${p}${q.size ? `?${q}` : ""}`} className="btn btn-ghost flex w-full items-center justify-center gap-2 !py-2"><Mark p={p} />{verb} with {LABEL[p]}</a>;
      })}
      <div className="flex items-center gap-2 text-xs text-slate-400"><span className="h-px flex-1 bg-black/10" />or<span className="h-px flex-1 bg-black/10" /></div>
    </div>
  );
}
