import Link from "next/link";

// Sprint 1 placeholder. The full landing page (animated hero) is Sprint 2.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="micro">Capability Portfolio</p>
      <h1 className="text-5xl font-semibold leading-[1.05]">
        Don&apos;t just show what you completed. Show what you can do.
      </h1>
      <p className="max-w-xl text-lg text-ink-2">
        Career goal → Capability → Experience → Evidence → Reflection → Validation → Progression.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-full bg-accent px-5 py-3 font-medium text-accent-ink"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
