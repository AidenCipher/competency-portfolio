"use client";

import Link from "next/link";

// Error boundary inside the signed-in app: keeps the header/navigation and explains calmly.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card flex max-w-xl flex-col gap-3 p-6" role="alert">
      <h1 className="text-2xl font-semibold">We couldn&apos;t load this page</h1>
      <p className="text-ink-2">Your saved work is safe. Please try again.</p>
      {error.digest && <p className="font-mono text-xs text-ink-2">Reference: {error.digest}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="rounded-full bg-accent px-5 py-2.5 font-medium text-accent-ink">Try again</button>
        <Link href="/app" className="rounded-full border border-line px-5 py-2.5 font-medium">Dashboard</Link>
      </div>
    </div>
  );
}
