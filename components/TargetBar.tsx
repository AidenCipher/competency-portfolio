import { FillBar } from "@/components/Motion";

/** Score bar with a marker at the target. Presentational: score and target come from lib/scoring via the loader. */
export function TargetBar({ name, score, target, className }: { name: string; score: number; target: number; className?: string }) {
  return (
    <div className="relative">
      <FillBar pct={score} className={className} label={`${name}: ${score} of target ${target}`} />
      <span aria-hidden className="absolute -top-1 h-4 w-0.5 bg-ink" style={{ left: `${target}%` }} title={`Target ${target}`} />
    </div>
  );
}
