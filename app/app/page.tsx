import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import { requireUser } from "@/lib/auth";
import { loadPortfolio } from "@/lib/data";
import { CountUp, Stagger, StaggerItem } from "@/components/Motion";
import { LevelBadge, ValidationChip } from "@/components/LevelBadge";
import { GoalPicker } from "@/components/GoalPicker";
import { TargetBar } from "@/components/TargetBar";

export const metadata: Metadata = { title: "Dashboard" };

function Tile({ label, value, suffix, note }: { label: string; value: number; suffix?: string; note?: string }) {
  return (
    <StaggerItem className="card flex flex-col gap-1 p-5">
      <p className="micro">{label}</p>
      <p className="text-4xl font-semibold tracking-tight">
        <CountUp value={value} />
        {suffix && <span className="text-ink-3">{suffix}</span>}
      </p>
      {note && <p className="text-xs text-ink-3">{note}</p>}
    </StaggerItem>
  );
}

export default async function Dashboard() {
  const { supabase, user } = await requireUser();
  const d = await loadPortfolio(supabase, user.id);

  if (!d.roleId) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <p className="micro">Welcome</p>
          <h1 className="text-3xl font-semibold">Hi {d.displayName}. Let&apos;s set a goal.</h1>
        </header>
        <GoalPicker roles={d.roles} />
      </div>
    );
  }

  const { stats, next } = d;
  const total = stats.experiences;
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="micro">Career goal · {d.roleName}</p>
          <h1 className="text-4xl font-semibold leading-tight">What {d.displayName} can do</h1>
        </div>
        <Link href="/app/experiences/new" className="rounded-full bg-accent px-5 py-3 font-medium text-accent-ink">Add experience</Link>
      </header>

      <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Experiences logged" value={stats.experiences} />
        <Tile label="Evidence artefacts" value={stats.artefacts} />
        <Tile label="Third-party validated" value={stats.validated} suffix={`/${total}`} />
        <Tile label="Actions > certs" value={stats.actions} suffix={` : ${stats.certs}`} note="Hands-on experiences vs certificates" />
      </Stagger>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="card flex flex-col gap-5 p-6" aria-labelledby="caps-h">
          <h2 id="caps-h" className="text-xl font-semibold">Capability progress</h2>
          <Stagger as="ul" className="flex flex-col gap-6">
            {d.capabilities.map((c) => (
              <StaggerItem as="li" key={c.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{c.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-sm text-ink-2">{c.score} / {c.target}</span>
                    <LevelBadge level={c.level} />
                  </span>
                </div>
                <TargetBar name={c.name} score={c.score} target={c.target} />
                <p className="text-sm text-ink-2">{c.statement}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-dark-card p-6 text-dark-card-ink" aria-labelledby="next-h">
            <p className="micro" style={{ color: "inherit", opacity: 0.7 }}>Next capability to build</p>
            {next ? (
              <>
                <h2 id="next-h" className="text-2xl font-semibold">{next.name}</h2>
                <p className="text-sm opacity-80">
                  {next.score} now, target {next.target}. Biggest gap on your path to {d.roleName}.
                </p>
                <p className="text-sm opacity-80">Try: {next.suggestedExperience}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <Link href={`/app/experiences/new?capability=${next.id}`} className="rounded-full bg-white px-5 py-2.5 font-medium text-black">
                    Log this experience
                  </Link>
                  <Link href="/app/next" className="text-sm underline opacity-90">Why this one?</Link>
                </div>
              </>
            ) : d.recommendation.status === "all_met" ? (
              <>
                <h2 id="next-h" className="text-xl font-semibold">All targets met</h2>
                <p className="text-sm opacity-80">Nothing is urgent. Keep adding validated evidence to stay strong.</p>
              </>
            ) : (
              <h2 id="next-h" className="text-xl font-semibold">Choose a career goal to get a recommendation</h2>
            )}
          </section>

          <section className="card flex flex-col gap-3 p-6" aria-labelledby="recent-h">
            <h2 id="recent-h" className="text-lg font-semibold">Recent experiences</h2>
            {d.experiences.length === 0 ? (
              <p className="text-sm text-ink-2">Nothing logged yet. Add your first experience.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {d.experiences.slice(0, 5).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3">
                    <ViewTransition name={`exp-${e.id}`} share="morph" default="none">
                      <Link href={`/app/experiences/${e.id}`} className="truncate text-sm font-medium hover:underline">{e.title}</Link>
                    </ViewTransition>
                    <ValidationChip state={e.validation} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="card p-6" aria-labelledby="engine-h">
        <h2 id="engine-h" className="text-lg font-semibold">Capability engine</h2>
        <p className="mt-2 max-w-3xl text-sm text-ink-2">
          Each experience adds a little to the capabilities you tag. It counts for more with files attached, a
          reflection of 40+ words, and a third party endorsing it. Returns diminish, so one strong, validated
          experience beats several thin ones. Levels: Strong 70+, Proficient 55–69, Developing below 55. These
          weights are working assumptions the team is validating with faculty.
        </p>
      </section>
    </div>
  );
}
