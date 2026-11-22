"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(sendMagicLink, initial);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className="micro">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="you@university.edu"
        className="rounded-xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-ink-3"
        aria-describedby="login-status"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-5 py-3 font-medium text-accent-ink disabled:opacity-60"
      >
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
      <p
        id="login-status"
        role="status"
        aria-live="polite"
        className={`min-h-6 text-sm ${state.status === "error" ? "text-bad" : "text-ok"}`}
      >
        {state.message}
      </p>
    </form>
  );
}
