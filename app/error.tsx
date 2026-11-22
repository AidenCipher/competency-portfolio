"use client";

import Link from "next/link";

// Shown when something unexpected fails while rendering a page. Never shows the error text itself (it could carry
// internal detail); the digest is a short reference that matches the server log.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-5 py-16">
      <p className="micro">Something went wrong</p>
      <h1 className="text-4xl font-semibold leading-tight">That didn&apos;t work</h1>
      <p className="text-ink-2">
        Something failed on our side. Your saved work is safe. Please try again, and if it keeps happening, come back in a few minutes.
      </p>
      {error.digest && <p className="font-mono text-xs text-ink-2">Reference: {error.digest}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="rounded-full bg-accent px-5 py-3 font-medium text-accent-ink">Try again</button>
        <Link href="/" className="rounded-full border border-line px-5 py-3 font-medium">Home</Link>
      </div>
    </main>
  );
}
