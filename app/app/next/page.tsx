import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadPortfolio } from "@/lib/data";
import { GoalPicker } from "@/components/GoalPicker";
import { LoopDiagram } from "@/components/LoopDiagram";
import { TargetBar } from "@/components/TargetBar";
import { Stagger, StaggerItem } from "@/components/Motion";
import { LevelBadge } from "@/components/LevelBadge";

export const metadata: Metadata = { title: "What should I build next?" };

export default async function NextPage() {
  const { supabase, user } = await requireUser();
  const d = await loadPortfolio(supabase, user.id);
  if (!d.roleId || !d.roleName) return <GoalPicker roles={d.roles} />;
  const rec = d.recommendation;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="micro">Next step · {d.roleName}</p>
        <h1 className="text-4xl font-semibold leading-tight">What should I build next?</h1>
        <p className="mt-2 max-w-2xl text-ink-2">
          We compare your evidence with what {d.roleName} needs and point at the biggest gap. This is a simple rule,
          not a prediction: the biggest weighted gap between your score and the target comes first.
        </p>
      </header>

      {rec.status === "recommend" && (
        <>
          <section className="flex flex-col gap-5 rounded-[var(--radius-card)] bg-dark-card p-6 text-dark-card-ink sm:p-8" aria-labelledby="rec-h">
            <p className="micro" style={{ color: "inherit", opacity: 0.75 }}>Recommended capability</p>
            <h2 id="rec-h" className="text-4xl font-semibold">{rec.top.item.name}</h2>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between font-mono text-xs opacity-80">
                <span>Now {rec.top.item.score}</span>
                <span>Target {rec.top.item.target}</span>
              </div>
              <TargetBar name={rec.top.item.name} score={rec.top.item.score} target={rec.top.item.target} className="bg-white" />
            </div>
            <div>
              <h3 className="micro" style={{ color: "inherit", opacity: 0.75 }}>Why this one</h3>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm opacity-90">
                {rec.why.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </div>
            <div>
              <h3 className="micro" style={{ color: "inherit", opacity: 0.75 }}>A good next experience</h3>
              <p className="mt-2 text-lg">{rec.top.item.suggestedExperience}</p>
            </div>
            <Link href={`/app/experiences/new?capability=${rec.top.item.id}`} className="w-fit rounded-full bg-white px-6 py-3 font-medium text-black">
              Log this experience
            </Link>
          </section>

          {rec.others.length > 0 && (
            <section className="card flex flex-col gap-4 p-6" aria-labelledby="others-h">
              <h2 id="others-h" className="text-xl font-semibold">Then, in this order</h2>
              <Stagger as="ul" className="flex flex-col gap-5">
                {rec.others.map((o) => (
                  <StaggerItem as="li" key={o.item.id} className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{o.item.name}</span>
                      <span className="flex items-center gap-2 font-mono text-sm text-ink-2">
                        {o.item.score} / {o.item.target} · gap {o.gap}
                        <LevelBadge level={o.item.level} />
                      </span>
                    </div>
                    <TargetBar name={o.item.name} score={o.item.score} target={o.item.target} />
                    <Link href={`/app/experiences/new?capability=${o.item.id}`} className="w-fit text-sm font-medium text-accent underline">
                      Log an experience for {o.item.name}
                    </Link>
                  </StaggerItem>
                ))}
              </Stagger>
            </section>
          )}
        </>
      )}

      {rec.status === "all_met" && (
        <section className="card flex flex-col gap-4 p-6" aria-labelledby="met-h">
          <h2 id="met-h" className="text-2xl font-semibold">Every target for {d.roleName} is met</h2>
          <p className="max-w-2xl text-ink-2">
            You&apos;re at or above target in all {rec.met} capabilities. Nothing is urgent. To keep your portfolio
            strong, add validated evidence where you have only self-declared experience, or attach more files to your best work.
          </p>
          <ul className="flex flex-col gap-4">
            {d.capabilities.map((c) => (
              <li key={c.id} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm"><span className="font-medium">{c.name}</span><span className="font-mono text-ink-2">{c.score} / {c.target}</span></div>
                <TargetBar name={c.name} score={c.score} target={c.target} className="bg-ok" />
              </li>
            ))}
          </ul>
          <Link href="/app/portfolio" className="w-fit font-medium text-accent underline">Review your portfolio</Link>
        </section>
      )}

      {rec.status === "no_map" && (
        <section className="card p-6">
          <h2 className="text-xl font-semibold">No capability map for this goal yet</h2>
          <p className="mt-2 text-ink-2">We can only suggest a next step for roles with a capability map. Choose another goal.</p>
        </section>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="loop-h">
        <h2 id="loop-h" className="text-xl font-semibold">The Continuous Capability Loop</h2>
        <LoopDiagram />
      </section>
    </div>
  );
}
