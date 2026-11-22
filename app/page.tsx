import type { Metadata } from "next";
import Link from "next/link";
import { CapabilityGraph } from "@/components/CapabilityGraph";
import { LoopDiagram } from "@/components/LoopDiagram";

export const metadata: Metadata = {
  title: { absolute: "Capability Portfolio: show what you can do" },
  description:
    "Turn experiences into capabilities backed by evidence and third-party validation, measured against the career you want.",
};

const POINTS = [
  { title: "Capabilities, not course lists", body: "Pick a career goal and see how your experience adds up to the capabilities that role needs." },
  { title: "Evidence you can show", body: "Attach the report, slides or feedback, and write what you actually did and learned." },
  { title: "Endorsed by someone who saw it", body: "A faculty member, mentor or supervisor confirms it through a private, single-use link. No account needed." },
] as const;

const btn = "rounded-full px-6 py-3 font-medium";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-16 px-5 py-6">
      <header className="flex items-center justify-between gap-3">
        <span className="font-semibold tracking-tight">Capability Portfolio</span>
        <nav aria-label="Main" className="flex items-center gap-2 text-sm">
          <Link href="/demo" className="rounded-full px-3 py-2 text-ink-2 hover:bg-surface-2 hover:text-ink">Demo</Link>
          <Link href="/login" className="rounded-full border border-line px-4 py-2 font-medium">Sign in</Link>
        </nav>
      </header>

      <main id="main" className="flex flex-col gap-20">
        <section className="hero-mesh grid items-center gap-10 rounded-[2rem] px-6 py-12 sm:px-10 lg:grid-cols-[1.1fr_0.9fr]" aria-labelledby="hero-h">
          <div className="flex flex-col gap-6">
            <p className="micro">Career goal → Capability → Evidence → Validation</p>
            <h1 id="hero-h" className="text-5xl font-semibold leading-[1.02] sm:text-6xl">
              Don&apos;t just show what you completed. Show what you can do.
            </h1>
            <p className="max-w-xl text-lg text-ink-2">
              Log what you&apos;ve done, back it with evidence and a reflection, get it validated by someone who saw it,
              and watch your capabilities grow towards the role you want.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/login" className={`${btn} bg-accent text-accent-ink`}>Start your portfolio</Link>
              <Link href="/demo" className={`${btn} border border-line bg-surface`}>View demo portfolio</Link>
            </div>
            <p className="text-sm text-ink-2">The demo uses a fictional learner.</p>
          </div>
          <div className="flex justify-center"><CapabilityGraph /></div>
        </section>

        <section className="flex flex-col gap-6" aria-labelledby="loop-h">
          <div className="flex flex-col gap-2">
            <p className="micro">How it works</p>
            <h2 id="loop-h" className="text-3xl font-semibold">A loop that keeps your profile honest</h2>
          </div>
          <LoopDiagram heading="h3" />
        </section>

        <section className="grid gap-4 md:grid-cols-3" aria-label="Why it works">
          {POINTS.map((p) => (
            <div key={p.title} className="card flex flex-col gap-2 p-6">
              <h2 className="text-xl font-semibold">{p.title}</h2>
              <p className="text-ink-2">{p.body}</p>
            </div>
          ))}
        </section>

        <section className="flex flex-col items-start gap-4 rounded-[var(--radius-card)] bg-dark-card p-8 text-dark-card-ink" aria-labelledby="cta-h">
          <h2 id="cta-h" className="text-3xl font-semibold">See what a portfolio looks like</h2>
          <p className="max-w-xl opacity-85">Explore a demo portfolio for a fictional learner, or start your own and choose a career goal.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/demo" className={`${btn} bg-white text-black`}>View demo portfolio</Link>
            <Link href="/login" className={`${btn} border border-white/40`}>Sign up</Link>
          </div>
        </section>
      </main>

      <footer className="flex flex-col gap-2 border-t border-line pt-4 text-sm text-ink-2">
        <p>
          <strong className="font-medium text-ink">Privacy.</strong> Your files are private: visible only to you, the validators you
          choose, and anyone you give a share link to. We use no analytics or advertising trackers.
        </p>
        <p>Scores use working assumptions the team is validating with faculty. They are a guide to your evidence, not a grade.</p>
      </footer>
    </div>
  );
}
