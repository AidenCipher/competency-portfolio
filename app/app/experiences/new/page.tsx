import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ExperienceForm } from "./ExperienceForm";

export const metadata: Metadata = { title: "Add experience" };

export default async function NewExperiencePage({ searchParams }: { searchParams: Promise<{ capability?: string }> }) {
  const { supabase } = await requireUser();
  const sp = await searchParams;
  const { data: caps } = await supabase.from("capabilities").select("id, name").order("name");
  const preselect = caps?.find((c) => c.id === sp.capability)?.id;
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="micro">Add experience &amp; evidence</p>
        <h1 className="text-3xl font-semibold">What did you do, and what can you now do?</h1>
      </header>
      <ExperienceForm capabilities={caps ?? []} preselect={preselect} />
    </div>
  );
}
