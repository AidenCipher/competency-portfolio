"use client";

import { useActionState } from "react";
import { submitDecision, type DecisionState } from "./actions";

const initial: DecisionState = { status: "idle" };
const OPTIONS = [
  { value: "endorsed", label: "Endorse", hint: "This is accurate and shows the capabilities listed." },
  { value: "changes_requested", label: "Request changes", hint: "Something needs correcting first." },
  { value: "declined", label: "Decline", hint: "I can't validate this." },
] as const;

export function DecisionForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(submitDecision.bind(null, token), initial);

  if (state.status === "done") {
    return (
      <div role="status" className="card p-6">
        <h2 className="text-xl font-semibold">Thank you</h2>
        <p className="mt-2 text-ink-2">Your response was recorded. This link no longer works. You can close this page.</p>
      </div>
    );
  }
  return (
    <form action={action} className="card flex flex-col gap-4 p-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="micro mb-1">Your response</legend>
        {OPTIONS.map((o, i) => (
          <label key={o.value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
            <input type="radio" name="decision" value={o.value} required defaultChecked={i === 0} className="mt-1" />
            <span>
              <span className="block font-medium">{o.label}</span>
              <span className="block text-sm text-ink-2">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor="comment" className="micro">Short comment (required unless endorsing)</label>
        <textarea id="comment" name="comment" rows={3} maxLength={1000}
          className="mt-1 w-full rounded-xl border border-line bg-surface px-4 py-3" />
      </div>
      {state.status === "error" && (
        <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">{state.message}</p>
      )}
      <button type="submit" disabled={pending}
        className="w-fit rounded-full bg-accent px-6 py-3 font-medium text-accent-ink disabled:opacity-60">
        {pending ? "Submitting…" : "Submit response"}
      </button>
    </form>
  );
}
