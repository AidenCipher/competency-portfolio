import type { Metadata } from "next";
import { safeNext } from "@/lib/safe-redirect";
import { LoginForm } from "./login-form";
import { signInWithGoogle } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const errorText =
    sp.error === "rate"
      ? "Too many attempts. Please wait a few minutes."
      : sp.error
        ? "Sign-in didn't complete. Please try again."
        : null;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-16">
      <p className="micro">Capability Portfolio</p>
      <h1 className="text-4xl font-semibold leading-tight">Sign in or create your portfolio</h1>
      <p className="text-ink-2">
        We&apos;ll email you a link. No password needed. New here? The same link creates your account.
      </p>
      {errorText && (
        <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">
          {errorText}
        </p>
      )}
      <div className="card flex flex-col gap-4 p-6">
        <LoginForm next={next} />
        <div className="micro text-center">or</div>
        <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={next} />
          <button
            type="submit"
            className="w-full rounded-full border border-line bg-surface px-5 py-3 font-medium text-ink"
          >
            Continue with Google
          </button>
        </form>
      </div>
      <p className="text-xs text-ink-3">
        Your files are private: visible only to you, the validators you choose, and anyone you give a share link to.
      </p>
    </main>
  );
}
