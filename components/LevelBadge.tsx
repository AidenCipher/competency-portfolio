import type { Level } from "@/lib/scoring";

const CLS: Record<Level, string> = {
  Strong: "bg-ok-soft text-ok",
  Proficient: "bg-info-soft text-info",
  Developing: "bg-warn-soft text-warn",
};

export function LevelBadge({ level }: { level: Level }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 font-mono text-[0.7rem] uppercase tracking-wider ${CLS[level]}`}>{level}</span>;
}

const VCLS: Record<string, string> = {
  validated: "bg-ok-soft text-ok",
  pending: "bg-warn-soft text-warn",
  self_declared: "bg-surface-2 text-ink-2",
  changes_requested: "bg-info-soft text-info",
  declined: "bg-bad-soft text-bad",
};
const VLABEL: Record<string, string> = {
  validated: "Validated",
  pending: "Pending",
  self_declared: "Self-declared",
  changes_requested: "Changes requested",
  declined: "Declined",
};

export function ValidationChip({ state }: { state: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs ${VCLS[state] ?? VCLS.self_declared}`}>{VLABEL[state] ?? state}</span>;
}
