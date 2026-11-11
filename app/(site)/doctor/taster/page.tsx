import Link from "next/link";
import { Stethoscope } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { EmptyState, PageHero } from "@/components/charts";
import { tasterFor, TASTE_SIZE } from "@/lib/careerTaster";
import Form from "./form";

export const metadata = { title: "Career taster — gglearn" };
// the questions are drawn fresh on every visit
export const dynamic = "force-dynamic";

export default async function Taster() {
  const me = await requireUser();
  const fields = tasterFor(me);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHero Icon={Stethoscope} tone="violet" title="Career taster" sub={`${fields.length} fields, ${TASTE_SIZE} questions each. Get a field all right and it counts as a starting level for the Career doctor. Miss, and nothing is held against you.`} />
      {fields.length ? <Form fields={fields} /> : (
        <EmptyState Icon={Stethoscope} title="Nothing left to taste" tone="violet">
          <p className="text-sm text-slate-600">You already have a result in every field that has questions.</p>
          <Link href="/doctor" className="mt-3 inline-block font-semibold text-indigo-700 hover:underline">Back to the Career doctor</Link>
        </EmptyState>
      )}
    </div>
  );
}
