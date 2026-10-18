"use client";
import { usePathname } from "next/navigation";
import { BookMarked, LogOut } from "lucide-react";
import { logoutEverywhere } from "@/app/actions";

/**
 * The two sign-out buttons, inside a form whose action is `logout`. On an exam page, signing out asks first: an exam in progress is easy to
 * lose by a stray click on the menu.
 */
export function SignOutButtons({ size = 15, className = "", everywhereClass = "" }: { size?: number; className?: string; everywhereClass?: string }) {
  const path = usePathname();
  const inExam = /^\/(run|role-exam)\//.test(path);
  const guard = (e: React.MouseEvent) => {
    if (inExam && !window.confirm("You are in the middle of an exam. If you sign out now, answers you have not submitted may be lost. Sign out anyway?")) e.preventDefault();
  };
  return (
    <>
      <button onClick={guard} className={className}><LogOut size={size} />Sign out</button>
      <button onClick={guard} formAction={logoutEverywhere} title="Ends your session on every device" className={everywhereClass}><BookMarked size={size} />Sign out everywhere</button>
    </>
  );
}
