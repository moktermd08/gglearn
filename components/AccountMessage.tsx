import { currentUser } from "@/lib/auth";
import { messageFor } from "@/lib/accountControl";
import { dismissMessageAction } from "@/app/account-actions";

/**
 * A message the administrators left for this person, on every page until they press OK. Plain inline styles so it looks the same on the learner
 * site and in the admin. Text only: it is never rendered as HTML.
 */
export async function AccountMessage() {
  const me = await currentUser();
  const m = me ? messageFor(me.id) : null;
  if (!m) return null;
  const bg = m.tone === "warning" ? "#92400e" : "#1e40af";
  return (
    <div role="status" aria-label="Message from the administrators" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "8px 16px", background: bg, color: "#fff", fontSize: 14 }}>
      <span style={{ flex: 1, minWidth: 220, whiteSpace: "pre-wrap" }}><b>{m.tone === "warning" ? "Important: " : "Message from the administrators: "}</b>{m.text}</span>
      <form action={dismissMessageAction}>
        <button style={{ background: "#fff", color: bg, border: 0, borderRadius: 6, padding: "4px 14px", fontWeight: 700, cursor: "pointer" }}>OK</button>
      </form>
    </div>
  );
}
