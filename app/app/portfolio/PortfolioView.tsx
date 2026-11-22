"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import Link from "next/link";
import { useState, ViewTransition } from "react";
import { EvidenceMeter } from "@/components/EvidenceMeter";
import { LevelBadge, ValidationChip } from "@/components/LevelBadge";
import { FillBar } from "@/components/Motion";
import type { CapabilityView, ExperienceView } from "@/lib/types";
import { RequestValidation } from "./RequestValidation";
import { StatementEditor } from "./StatementEditor";

const STRENGTH_ROWS = [
  { key: "experience", label: "Experience" },
  { key: "application", label: "Application" },
  { key: "artefact", label: "Artefact" },
  { key: "validation", label: "Validation" },
] as const;

export function PortfolioView({ capabilities, experiences, roleName, readOnly = false }: { capabilities: CapabilityView[]; experiences: ExperienceView[]; roleName: string; readOnly?: boolean }) {
  const [selectedId, setSelectedId] = useState(capabilities[0]?.id);
  const reduce = usePrefersReducedMotion();
  const selected = capabilities.find((c) => c.id === selectedId) ?? capabilities[0];
  if (!selected) return <p className="text-ink-2">No capabilities to show yet.</p>;
  const rows = experiences.filter((e) => selected.experienceIds.includes(e.id));

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <LayoutGroup>
        <nav aria-label="Capabilities" className="flex flex-col gap-1">
          {capabilities.map((c) => {
            const active = c.id === selected.id;
            return (
              <button key={c.id} type="button" onClick={() => setSelectedId(c.id)} aria-pressed={active}
                className="relative flex items-center justify-between gap-2 rounded-xl px-4 py-3 text-left">
                {active && (
                  <motion.span layoutId="cap-active" aria-hidden className="absolute inset-0 rounded-xl bg-accent-soft"
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 34 }} />
                )}
                <span className="relative font-medium">{c.name}</span>
                <span className="relative"><LevelBadge level={c.level} /></span>
              </button>
            );
          })}
        </nav>
      </LayoutGroup>

      <AnimatePresence mode="wait">
        <motion.section key={`${selected.id}:${reduce}`} aria-labelledby="cap-h" className="flex flex-col gap-6"
          initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
          <div className="card flex flex-col gap-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="cap-h" className="text-3xl font-semibold">{selected.name}</h2>
              <LevelBadge level={selected.level} />
            </div>
            {readOnly ? (
              <p className="text-lg leading-snug">&ldquo;{selected.statement}&rdquo;</p>
            ) : (
              <StatementEditor key={`${selected.id}:${selected.statement}`} capabilityId={selected.id} statement={selected.statement} isCustom={selected.statementIsCustom} />
            )}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between font-mono text-xs text-ink-2"><span>Score {selected.score}</span><span>Target {selected.target}</span></div>
              <FillBar pct={selected.score} label={`${selected.name}: ${selected.score} of ${selected.target}`} />
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Career relevance">
              {selected.relevance.map((r) => (
                <span key={r.roleName} className="rounded-full bg-info-soft px-3 py-1 text-xs text-info">{r.roleName} · target {r.target}</span>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="micro mb-3">Evidence strength</h3>
            <ul className="grid gap-3 sm:grid-cols-4">
              {STRENGTH_ROWS.map((s) => {
                const lit = selected.strength[s.key];
                return (
                  <li key={s.key} className={`rounded-xl border p-3 text-sm ${lit ? "border-accent bg-accent-soft" : "border-line text-ink-3"}`}>
                    <span className="block font-medium">{s.label}</span>
                    <span>{lit ? "Present" : "Not yet"}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="card p-6">
            <h3 className="micro mb-3">Substantiating evidence for {roleName}</h3>
            {rows.length === 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-ink-2">No experience backs this capability yet.</p>
                {!readOnly && <Link href={`/app/experiences/new?capability=${selected.id}`} className="w-fit font-medium text-accent underline">Log an experience</Link>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead>
                    <tr className="micro">
                      <th scope="col" className="pb-2 pr-3 font-normal">Experience</th>
                      <th scope="col" className="pb-2 pr-3 font-normal">What I did</th>
                      <th scope="col" className="pb-2 pr-3 font-normal">Evidence</th>
                      <th scope="col" className="pb-2 pr-3 font-normal">Validated by</th>
                      <th scope="col" className="pb-2 font-normal">Strength</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e) => (
                      <tr key={e.id} className="border-t border-line align-top">
                        <th scope="row" className="py-3 pr-3 font-medium">
                          <ViewTransition name={`exp-${e.id}`} share="morph" default="none">
                            {readOnly ? <span>{e.title}</span> : <Link href={`/app/experiences/${e.id}`} className="hover:underline">{e.title}</Link>}
                          </ViewTransition>
                          {e.isDemo && <span className="ml-2 rounded bg-warn-soft px-1.5 py-0.5 font-mono text-[0.65rem] uppercase text-warn">Demo</span>}
                        </th>
                        <td className="max-w-xs py-3 pr-3 text-ink-2">{e.description}</td>
                        <td className="py-3 pr-3">
                          {e.evidence.length === 0 ? <span className="text-ink-3">None</span> : (
                            <ul className="flex flex-col gap-1">
                              {e.evidence.map((f) => (
                                <li key={f.id}>
                                  {f.hasFile ? (
                                    <a href={`/app/evidence/${f.id}`} className="text-accent underline" rel="noopener noreferrer">{f.filename}</a>
                                  ) : (
                                    <span className="text-ink-2" title="Demo file: nothing to download">{f.filename}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex flex-col items-start gap-1.5">
                            <ValidationChip state={e.validation} />
                            {e.validations.map((v) => (
                              <span key={v.id} className="text-xs text-ink-2">
                                {v.validatorName} · {v.validatorKind}
                                {v.comment ? <span className="block text-ink-3">&ldquo;{v.comment}&rdquo;</span> : null}
                              </span>
                            ))}
                            {!readOnly && e.validation !== "validated" && e.validation !== "pending" && <RequestValidation experienceId={e.id} />}
                          </div>
                        </td>
                        <td className="py-3"><EvidenceMeter strength={e.strength} compact /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.section>
      </AnimatePresence>
    </div>
  );
}
