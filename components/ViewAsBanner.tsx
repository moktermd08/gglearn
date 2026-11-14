import { viewAsState } from "@/lib/auth";
import { stopViewAsAction } from "@/app/super-actions";

/**
 * Shown at the top of every page while a super admin is using the app as someone else, so it is never possible to forget. One slim line: who they are
 * viewing as, who is really signed in, when it ends by itself, and the one way out. Plain styles, so it looks the same on the learner site and in
 * the admin. Everything done through a view is logged under the super admin.
 */
export async function ViewAsBanner() {
  const s = await viewAsState();
  if (!s) return null;
  return (
    <div role="status" aria-label="Viewing as someone else" style={{ position: "sticky", top: 0, zIndex: 1000, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "3px 12px", background: "#b91c1c", color: "#fff", fontSize: 12, lineHeight: 1.4 }}>
      <span style={{ flex: 1, minWidth: 200 }}>
        Viewing as <b>{s.target.name}</b> · you are {s.actor.name} · everything you do is logged under your name · ends in about {s.minutesLeft} min
      </span>
      <form action={stopViewAsAction}>
        <button style={{ background: "#fff", color: "#b91c1c", border: 0, borderRadius: 4, padding: "1px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Exit view</button>
      </form>
    </div>
  );
}
