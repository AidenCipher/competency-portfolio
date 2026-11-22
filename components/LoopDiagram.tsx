const STEPS = [
  { n: "01", title: "Learn", body: "Take a course, join a project or find a role that stretches you." },
  { n: "02", title: "Apply", body: "Do real work and write what you actually did and learned." },
  { n: "03", title: "Evidence", body: "Attach the report, slides or feedback that proves it." },
  { n: "04", title: "Validate", body: "A faculty member, mentor or supervisor endorses it." },
] as const;

/**
 * The Continuous Capability Loop. A server component with no client JS: the "light travelling round the loop" is a
 * CSS opacity animation (see .loop-glow in globals.css), disabled under prefers-reduced-motion.
 */
export function LoopDiagram({ heading = "h3" }: { heading?: "h2" | "h3" }) {
  const H = heading;
  return (
    <div>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.n} className="card relative flex flex-col gap-1 p-4" style={{ "--i": i } as React.CSSProperties}>
            <span aria-hidden className="loop-glow pointer-events-none absolute inset-0 rounded-[var(--radius-card)] border-2 border-accent" />
            <span className="micro">{s.n}</span>
            <H className="text-lg font-semibold">{s.title}</H>
            <p className="text-sm text-ink-2">{s.body}</p>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-ink-2">
        Then the loop repeats: each validated experience shows what you can now do, and what to build next.
      </p>
    </div>
  );
}
