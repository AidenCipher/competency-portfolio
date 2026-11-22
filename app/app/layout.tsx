import Link from "next/link";
import { ViewTransition } from "react";
import { requireUser } from "@/lib/auth";

const NAV = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/portfolio", label: "Portfolio" },
  { href: "/app/next", label: "What next?" },
  { href: "/app/experiences/new", label: "Add experience" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("display_name, is_demo").eq("id", user.id).single();
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-5 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
          <Link href="/app" className="mr-3 font-semibold tracking-tight">Capability Portfolio</Link>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-full px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          {profile?.is_demo && <span className="rounded-full bg-warn-soft px-3 py-1 font-mono text-xs uppercase text-warn">Demo data</span>}
          <span className="text-ink-2">{profile?.display_name}</span>
          <form action="/auth/signout" method="post">
            <button type="submit" className="rounded-full border border-line px-3 py-1.5">Sign out</button>
          </form>
        </div>
      </header>
      <main id="main" className="flex-1">
        <ViewTransition>{children}</ViewTransition>
      </main>
      <footer className="border-t border-line pt-4 text-xs text-ink-3">
        Your files are private: visible only to you, the validators you choose, and anyone you give a share link to.{" "}
        <Link href="/privacy" className="underline">Privacy</Link>
      </footer>
    </div>
  );
}
