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

function Dot({ lit, index, reduce }: { lit: boolean; index: number; reduce: boolean }) {
  return (
    <span className="relative inline-flex h-3 w-3 shrink-0" aria-hidden>
      {/* Ring pulse when a dot lights. Mounts only while lit; transform + opacity only. */}
      {lit && !reduce && (
        <motion.span
          className="absolute inset-0 rounded-full border border-accent"
          initial={{ scale: 1, opacity: 0.7 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: index * 0.06 }}
        />
      )}
      <motion.span
        className={`h-3 w-3 rounded-full border ${lit ? "border-accent bg-accent" : "border-ink-3 bg-transparent"}`}
        initial={reduce ? false : { scale: 0.5, opacity: 0 }}
        animate={reduce ? undefined : { scale: lit ? 1 : 0.8, opacity: lit ? 1 : 0.55 }}
        transition={{ type: "spring", stiffness: 380, damping: 22, delay: reduce ? 0 : index * 0.06 }}
      />
    </span>
  );
}

/**
 * Evidence-strength meter. Presentational only: which dots are lit comes from lib/scoring.ts.
 * Animates transform and opacity only, and not at all under prefers-reduced-motion.
 */
export function EvidenceMeter({ strength, compact = false }: { strength: EvidenceStrength; compact?: boolean }) {
  const reduce = !!useReducedMotion();
  return (
    <div role="group" aria-label={`Evidence strength: ${strength.dots} of 5`}>
      <ul className={`flex ${compact ? "items-center gap-1.5" : "flex-col gap-2"}`}>
        {DOTS.map((d, i) => {
          const lit = strength[d.key];
          return (
            <li key={d.key} className="flex items-center gap-2" title={compact ? `${d.label}: ${d.hint}` : undefined}>
              <Dot lit={lit} index={i} reduce={reduce} />
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
                  <span className="text-xs text-ink-2">{d.hint}</span>
                </span>
              )}
            </li>
          );
        })}
        {compact && <li aria-hidden className="ml-1 font-mono text-xs text-ink-2">{strength.dots}/5</li>}
      </ul>
      {!compact && (
        <p className="mt-3 font-mono text-xs text-ink-2" role="status" aria-live="polite">
          {strength.dots} of 5 lit
        </p>
      )}
    </div>
  );
}
