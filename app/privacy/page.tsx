import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy", description: "What Capability Portfolio stores, who can see it, and what it does not do." };

const ITEMS: { h: string; body: string }[] = [
  { h: "What we store", body: "Your account email and display name, the career goal you choose, the experiences, reflections and capability statements you write, and the files you attach. When you ask someone to validate an experience we also store that person's name, email and their response." },
  { h: "Who can see your work", body: "Your files and portfolio are private. They are visible only to you, the validators you choose (through a private single-use link, for the experience you sent them), and anyone you give a share link to. Other learners cannot read your data, and this is enforced in the database, not only in the app." },
  { h: "Validators", body: "A validator does not need an account. They open a link that works once and expires after 14 days. We store only a one-way hash of the link, never the link itself." },
  { h: "What we do not do", body: "No analytics, no advertising trackers and no selling or sharing of your data. The only cookies are the ones needed to keep you signed in." },
  { h: "Demo data", body: "The demo portfolio belongs to a fictional learner. Everything in it is invented." },
  { h: "Scores", body: "Scores and levels are a guide to the evidence you have added, calculated with working assumptions the team is validating with faculty. They are not a grade or an assessment of you." },
  { h: "Your data", body: "Deleting your account and data is not yet self-service. Ask the programme team who gave you access and they will remove it." },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-5 py-8">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="font-semibold tracking-tight">Capability Portfolio</Link>
        <Link href="/login" className="rounded-full border border-line px-4 py-2 text-sm font-medium">Sign in</Link>
      </header>
      <main id="main" className="flex flex-col gap-6">
        <div>
          <p className="micro">Privacy</p>
          <h1 className="text-4xl font-semibold leading-tight">Your evidence stays yours</h1>
        </div>
        {ITEMS.map((i) => (
          <section key={i.h} className="card flex flex-col gap-1.5 p-6" aria-labelledby={`h-${i.h.replace(/\W+/g, "-")}`}>
            <h2 id={`h-${i.h.replace(/\W+/g, "-")}`} className="text-lg font-semibold">{i.h}</h2>
            <p className="text-ink-2">{i.body}</p>
          </section>
        ))}
      </main>
    </div>
  );
}
