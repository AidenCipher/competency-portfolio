"use client";

import { motion, useReducedMotion } from "motion/react";
import type { EvidenceStrength } from "@/lib/scoring";

const DOTS: { key: keyof Omit<EvidenceStrength, "dots">; label: string; hint: string }[] = [
  { key: "experience", label: "Experience", hint: "Title, role, duration, description" },
  { key: "application", label: "Application", hint: "Reflection of 40+ words" },
  { key: "artefact", label: "Artefact", hint: "At least one file" },
  { key: "validation", label: "Validation", hint: "A validator endorsed it" },
  { key: "strong", label: "Strong", hint: "2+ files and validated" },
];

/** Presentational only: the lit/unlit state comes from lib/scoring.ts. Animates transform/opacity only. */
export function EvidenceMeter({ strength, compact = false }: { strength: EvidenceStrength; compact?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div role="group" aria-label={`Evidence strength: ${strength.dots} of 5`}>
      <ul className={`flex ${compact ? "gap-1.5" : "flex-col gap-2"}`}>
        {DOTS.map((d) => {
          const lit = strength[d.key];
          return (
            <li key={d.key} className="flex items-center gap-2">
              <motion.span
                aria-hidden
                initial={false}
                animate={reduce ? undefined : { scale: lit ? 1 : 0.8, opacity: lit ? 1 : 0.5 }}
                transition={{ type: "spring", stiffness: 380, damping: 22 }}
                className={`inline-block h-3 w-3 rounded-full border ${lit ? "border-accent bg-accent" : "border-ink-3 bg-transparent"}`}
              />
              {compact ? (
                <span className="sr-only">
                  {d.label}: {lit ? "yes" : "not yet"}
                </span>
              ) : (
                <span className="flex flex-col leading-tight">
                  <span className={`text-sm ${lit ? "text-ink" : "text-ink-2"}`}>
                    {d.label}
                    <span className="sr-only">: {lit ? "yes" : "not yet"}</span>
                  </span>
                  <span className="text-xs text-ink-3">{d.hint}</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
