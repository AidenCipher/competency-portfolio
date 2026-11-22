"use client";

import { useActionState } from "react";
import { setCareerGoal, type GoalState } from "@/app/app/actions";

const initial: GoalState = { status: "idle" };

export function GoalPicker({ roles }: { roles: { id: string; name: string; isMapped: boolean }[] }) {
  const [state, action, pending] = useActionState(setCareerGoal, initial);
  return (
    <form action={action} className="card flex max-w-xl flex-col gap-4 p-6">
      <h2 className="text-2xl font-semibold">Choose your career goal</h2>
      <p className="text-ink-2">Your capabilities are measured against the role you&apos;re aiming for.</p>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Career goal</legend>
        {roles.map((r) => (
          <label key={r.id} className={`flex items-center gap-3 rounded-xl border border-line p-3 ${r.isMapped ? "cursor-pointer has-[:checked]:border-accent has-[:checked]:bg-accent-soft" : "opacity-60"}`}>
            <input type="radio" name="roleId" value={r.id} disabled={!r.isMapped} required={r.isMapped} defaultChecked={r.isMapped} />
            <span>{r.name}</span>
            {!r.isMapped && <span className="ml-auto font-mono text-xs uppercase text-ink-3">Coming soon</span>}
          </label>
        ))}
      </fieldset>
      {state.status === "error" && <p role="alert" className="text-sm text-bad">{state.message}</p>}
      <button type="submit" disabled={pending} className="w-fit rounded-full bg-accent px-6 py-3 font-medium text-accent-ink disabled:opacity-60">
        {pending ? "Saving…" : "Set goal"}
      </button>
    </form>
  );
}
