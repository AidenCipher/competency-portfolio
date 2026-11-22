import type { Metadata } from "next";
import Link from "next/link";
import { loadDemoPortfolio } from "@/lib/demo";
import { PortfolioView } from "@/app/app/portfolio/PortfolioView";
import { TargetBar } from "@/components/TargetBar";
import { LevelBadge } from "@/components/LevelBadge";

export const metadata: Metadata = {
  title: "Demo portfolio",
  description: "A fictional learner's capability portfolio, to show how evidence and validation build a profile.",
  robots: { index: false, follow: false },
};

// Reads the database on every request; never prerendered at build time.
export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const d = await loadDemoPortfolio();
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-5 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="font-semibold tracking-tight">Capability Portfolio</Link>
        <Link href="/login" className="rounded-full bg-accent px-5 py-2.5 font-medium text-accent-ink">Start your own</Link>
      </header>

      <main id="main" className="flex flex-1 flex-col gap-8">
        <div role="note" className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
          <strong className="font-mono uppercase">Demo data.</strong> Jo is a fictional learner. Every experience, file name,
          validator and number below is invented to show how the portfolio works. Nothing here is a real result.
        </div>

        {!d || !d.roleName ? (
          <section className="card flex flex-col gap-2 p-6">
            <h1 className="text-2xl font-semibold">The demo portfolio isn&apos;t available right now</h1>
            <p className="text-ink-2">Please check back soon, or start your own portfolio.</p>
          </section>
        ) : (
          <>
            <header>
              <p className="micro">Demo portfolio · {d.roleName}</p>
              <h1 className="text-4xl font-semibold leading-tight">What {d.displayName} can do</h1>
            </header>

            <section className="card flex flex-col gap-5 p-6" aria-labelledby="demo-caps-h">
              <h2 id="demo-caps-h" className="text-xl font-semibold">Capability progress</h2>
              <ul className="flex flex-col gap-5">
                {d.capabilities.map((c) => (
                  <li key={c.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{c.name}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-sm text-ink-2">{c.score} / {c.target}</span>
                        <LevelBadge level={c.level} />
                      </span>
                    </div>
                    <TargetBar name={c.name} score={c.score} target={c.target} />
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-4" aria-labelledby="demo-port-h">
              <h2 id="demo-port-h" className="text-2xl font-semibold">Capability portfolio</h2>
              <PortfolioView capabilities={d.capabilities} experiences={d.experiences} roleName={d.roleName} readOnly />
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-line pt-4 text-xs text-ink-2">
        This is demo data. Real portfolios are private: files are visible only to their owner, the validators they choose, and anyone they give a share link to.
      </footer>
    </div>
  );
}
