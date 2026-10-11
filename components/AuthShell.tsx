import type { ReactNode } from "react";
import { Flame, GraduationCap, Mountain, Swords } from "lucide-react";
import { Avatar } from "@/components/Avatar";

const POINTS = [
  { Icon: Mountain, text: "Climb 20 levels from Novice to Titan" },
  { Icon: GraduationCap, text: "Earn certificates anyone can verify" },
  { Icon: Flame, text: "Keep a daily streak going" },
];

/** Two-panel layout for sign-in and invite pages: brand story on the left, the form on the right. */
export function AuthShell({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <div className="card pop mx-auto grid max-w-4xl overflow-hidden md:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between gap-8 overflow-hidden p-8 text-[#fff] md:flex" style={{ background: "linear-gradient(150deg,#4f46e5,#9333ea 70%,#db2777)" }} aria-hidden>
        <svg className="pointer-events-none absolute -bottom-16 -right-16 h-80 w-80 opacity-30" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="90" fill="none" stroke="#fff" /><circle cx="100" cy="100" r="62" fill="none" stroke="#fff" strokeDasharray="4 6" className="march" /><circle cx="100" cy="100" r="34" fill="#fff" fillOpacity=".15" />
        </svg>
        <div className="relative">
          <div className="flex items-center gap-2 text-xl font-extrabold"><Swords size={22} />gglearn</div>
          <h2 className="mt-6 text-3xl font-extrabold leading-tight">{title}</h2>
          <p className="mt-2 text-[#fff]/80">{lead}</p>
        </div>
        <ul className="relative space-y-3 text-sm">
          {POINTS.map(({ Icon, text }) => <li key={text} className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#fff]/15"><Icon size={16} /></span>{text}</li>)}
        </ul>
        <div className="relative flex items-end justify-center gap-4 rounded-2xl bg-[#fff]/10 p-4">
          <Avatar kind="human" level={8} size={64} className="bob" />
          <span className="mb-6 text-sm font-black text-[#fff]/70">VS</span>
          <Avatar kind="rival" level={9} hue={330} size={64} className="bob [animation-delay:.6s]" />
        </div>
      </aside>
      <div className="flex flex-col justify-center p-6 sm:p-8">{children}</div>
    </div>
  );
}
