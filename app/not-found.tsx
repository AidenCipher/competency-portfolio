import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-5 py-16">
      <p className="micro">404</p>
      <h1 className="text-4xl font-semibold leading-tight">We couldn&apos;t find that page</h1>
      <p className="text-ink-2">The link may be wrong, or the page may have been removed. Nothing is wrong with your account.</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className="rounded-full bg-accent px-5 py-3 font-medium text-accent-ink">Go to the home page</Link>
        <Link href="/app" className="rounded-full border border-line px-5 py-3 font-medium">Open my dashboard</Link>
      </div>
    </main>
  );
}
