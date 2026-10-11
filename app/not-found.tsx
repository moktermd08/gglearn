import Link from "next/link";
import { Compass, Home, Search } from "lucide-react";
import { EmptyState } from "@/components/charts";

export const metadata = { title: "Page not found — gglearn" };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-8">
      <EmptyState Icon={Compass} tone="violet" title="This page is off the map">
        The link may be old, or the page may belong to someone else. Head back to your path or browse what you can learn.
      </EmptyState>
      <div className="flex justify-center gap-3">
        <Link href="/dashboard" className="btn"><Home size={16} />My quest</Link>
        <Link href="/#subjects" className="btn btn-ghost"><Search size={16} />Browse subjects</Link>
      </div>
    </div>
  );
}
