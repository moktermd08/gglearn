"use client";
import { RotateCw, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/charts";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md space-y-4 py-8">
      <EmptyState Icon={TriangleAlert} tone="rose" title="Something went wrong">
        That page hit a problem. Nothing you did was lost. Try again, and if it keeps happening tell your manager.
      </EmptyState>
      <div className="flex justify-center"><button onClick={reset} className="btn"><RotateCw size={16} />Try again</button></div>
    </div>
  );
}
