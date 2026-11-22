"use client";

import { useActionState, useState } from "react";
import { requestValidationAction, type RequestState } from "@/app/app/actions";
import { VALIDATOR_KINDS } from "@/lib/experience-schema";

const initial: RequestState = { status: "idle" };

export function RequestValidation({ experienceId }: { experienceId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(requestValidationAction.bind(null, experienceId), initial);
  if (state.status === "done") {
    return (
      <div role="status" className="flex flex-col gap-1 text-xs">
        {state.emailed ? <span className="text-ok">Link emailed.</span> : (
          <>
            <span className="text-ink-2">Send this one-time link yourself:</span>
            <input readOnly aria-label="Validation link" value={state.link ?? ""} onFocus={(e) => e.currentTarget.select()} className="w-56 rounded-lg border border-line bg-surface px-2 py-1 font-mono" />
          </>
        )}
      </div>
    );
  }
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-accent underline">Request validation</button>;
  }
  return (
    <form action={action} className="flex flex-col gap-2 text-sm">
      <select name="validatorKind" aria-label="Validator type" defaultValue="faculty" className="rounded-lg border border-line bg-surface px-2 py-1">
        {VALIDATOR_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
      </select>
      <input name="validatorName" aria-label="Validator name" placeholder="Name" required maxLength={120} className="rounded-lg border border-line bg-surface px-2 py-1" />
      <input name="validatorEmail" aria-label="Validator email" type="email" placeholder="Email" required maxLength={254} className="rounded-lg border border-line bg-surface px-2 py-1" />
      {state.status === "error" && <p role="alert" className="text-bad">{state.message}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded-full bg-accent px-3 py-1 text-accent-ink disabled:opacity-60">{pending ? "Sending…" : "Send"}</button>
        <button type="button" onClick={() => setOpen(false)} className="text-ink-3 underline">Cancel</button>
      </div>
    </form>
  );
}
