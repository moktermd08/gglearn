"use client";
import { useState, useSyncExternalStore } from "react";
import { Check, Copy, Download, Mail, MessageCircle, Send, Share2 } from "lucide-react";

type Props = { url: string; text: string; imageUrl?: string; imageName?: string };

/**
 * One row of ways to send a link: the phone's own share sheet when there is one, then copy, WhatsApp, Telegram, Facebook, LinkedIn, X and
 * email. Each one is a plain link or a button, so nothing here needs an account with the service and nothing is sent until the person taps.
 */
export function ShareBar({ url, text, imageUrl, imageName = "gglearn.png" }: Props) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent(url), msg = encodeURIComponent(`${text} ${url}`), t = encodeURIComponent(text);
  // false on the server and during hydration, then the browser's real answer
  const canNative = useSyncExternalStore(() => () => {}, () => typeof navigator.share === "function", () => false);
  const chip = "btn btn-ghost !px-3 !py-1.5 text-sm";
  const targets = [
    { label: "WhatsApp", href: `https://wa.me/?text=${msg}`, Icon: MessageCircle },
    { label: "Telegram", href: `https://t.me/share/url?url=${enc}&text=${t}`, Icon: Send },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc}`, Icon: Share2 },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc}`, Icon: Share2 },
    { label: "X", href: `https://twitter.com/intent/tweet?text=${t}&url=${enc}`, Icon: Share2 },
    { label: "Email", href: `mailto:?subject=${t}&body=${msg}`, Icon: Mail },
  ];
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Share">
      {canNative && (
        <button type="button" className="btn !px-4 !py-1.5 text-sm" onClick={() => { navigator.share({ title: text, text, url }).catch(() => { /* closed without sharing */ }); }}>
          <Share2 size={15} />Share
        </button>
      )}
      <button type="button" className={chip} onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the link is also shown in the field */ } }}>
        {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}{copied ? "Copied" : "Copy link"}
      </button>
      {targets.map(({ label, href, Icon }) => (
        <a key={label} className={chip} href={href} target={href.startsWith("mailto:") ? undefined : "_blank"} rel="noopener noreferrer"><Icon size={15} />{label}</a>
      ))}
      {imageUrl && <a className={chip} href={imageUrl} download={imageName}><Download size={15} />Image</a>}
    </div>
  );
}
