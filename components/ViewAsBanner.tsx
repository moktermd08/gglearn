import { viewAsState } from "@/lib/auth";
import { stopViewAsAction } from "@/app/super-actions";

/**
 * Shown at the top of every page while a super admin is viewing as someone else, so it is never possible to forget. It says who is really
 * signed in, who they are viewing as, when it ends by itself, and has the one way out. Plain styles, so it looks the same on the learner
 * site and in the admin.
 */
export async function ViewAsBanner() {
  const s = await viewAsState();
  if (!s) return null;
  return (
    <div role="alert" style={{ position: "sticky", top: 0, zIndex: 1000, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "8px 16px", background: "#b91c1c", color: "#fff", fontSize: 14 }}>
      <span style={{ flex: 1, minWidth: 220 }}>
        <b>Viewing as {s.target.name}</b> ({s.target.email}). You are {s.actor.name}. Everything you do here is done as them. Ends by itself in about {s.minutesLeft} min.
      </span>
      <form action={stopViewAsAction}>
        <button style={{ background: "#fff", color: "#b91c1c", border: 0, borderRadius: 6, padding: "6px 14px", fontWeight: 700, cursor: "pointer" }}>Exit view</button>
      </form>
    </div>
  );
}
