import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { loadPortfolio } from "@/lib/data";
import { EvidenceMeter } from "@/components/EvidenceMeter";
import { ValidationChip } from "@/components/LevelBadge";
import { RequestValidation } from "@/app/app/portfolio/RequestValidation";
import { EXPERIENCE_TYPES } from "@/lib/experience-schema";

export const metadata: Metadata = { title: "Experience" };

export default async function ExperiencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const { supabase, user } = await requireUser();
  const d = await loadPortfolio(supabase, user.id); // RLS + user_id filter: another learner's id simply isn't in the list
  const e = d.experiences.find((x) => x.id === id);
  if (!e) notFound();

  const { data: caps } = await supabase.from("capabilities").select("id, name").in("id", e.capabilityIds.length ? e.capabilityIds : ["00000000-0000-0000-0000-000000000000"]);
  const typeLabel = EXPERIENCE_TYPES.find((t) => t.value === e.type)?.label ?? e.type;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/app/portfolio" className="w-fit text-sm text-ink-2 underline">← Back to portfolio</Link>
      <header className="flex flex-col gap-2">
        <p className="micro">{typeLabel} · {e.durationLabel}</p>
        <ViewTransition name={`exp-${e.id}`} share="morph" default="none">
          <h1 className="w-fit text-4xl font-semibold leading-tight">{e.title}</h1>
        </ViewTransition>
        <p className="text-ink-2">
          {e.roleTitle}
          {e.isDemo && <span className="ml-2 rounded bg-warn-soft px-1.5 py-0.5 font-mono text-[0.65rem] uppercase text-warn">Demo</span>}
        </p>
        <div className="flex flex-wrap gap-2" aria-label="Capabilities">
          {(caps ?? []).map((c) => <span key={c.id} className="rounded-full bg-info-soft px-3 py-1 text-xs text-info">{c.name}</span>)}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <section className="card flex flex-col gap-2 p-6" aria-labelledby="did-h">
            <h2 id="did-h" className="micro">What I did</h2>
            <p className="whitespace-pre-wrap">{e.description}</p>
          </section>
          <section className="card flex flex-col gap-2 p-6" aria-labelledby="refl-h">
            <h2 id="refl-h" className="micro">What I actually learned or did</h2>
            <p className="whitespace-pre-wrap">{e.reflection || <span className="text-ink-2">No reflection yet.</span>}</p>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="card flex flex-col gap-3 p-6" aria-labelledby="meter-h">
            <h2 id="meter-h" className="micro">Evidence strength</h2>
            <EvidenceMeter strength={e.strength} />
          </section>
          <section className="card flex flex-col gap-3 p-6" aria-labelledby="files-h">
            <h2 id="files-h" className="micro">Evidence files</h2>
            {e.evidence.length === 0 ? <p className="text-sm text-ink-2">No files attached.</p> : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {e.evidence.map((f) => (
                  <li key={f.id}>
                    {f.hasFile ? <a href={`/app/evidence/${f.id}`} className="text-accent underline" rel="noopener noreferrer">{f.filename}</a> : <span className="text-ink-2">{f.filename}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card flex flex-col gap-3 p-6" aria-labelledby="val-h">
            <h2 id="val-h" className="micro">Validation</h2>
            <ValidationChip state={e.validation} />
            {e.validations.map((v) => (
              <p key={v.id} className="text-sm text-ink-2">
                {v.validatorName} · {v.validatorKind}
                {v.comment ? <span className="block text-ink-3">&ldquo;{v.comment}&rdquo;</span> : null}
              </p>
            ))}
            {e.validation !== "validated" && e.validation !== "pending" && <RequestValidation experienceId={e.id} />}
          </section>
        </div>
      </div>
    </div>
  );
}
