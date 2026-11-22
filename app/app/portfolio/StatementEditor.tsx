"use client";

import { useActionState, useId, useState } from "react";
import { STATEMENT_MAX } from "@/lib/statement-schema";
import { saveStatement, type StatementState } from "./statement-actions";

const idle: StatementState = { status: "idle" };

/** The learner's capability statement: shown as a quote, editable in place, resettable to the suggested template. */
export function StatementEditor({ capabilityId, statement, isCustom }: { capabilityId: string; statement: string; isCustom: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(statement);
  const fieldId = useId();
  const [state, action, pending] = useActionState(
    async (prev: StatementState, form: FormData) => {
      const result = await saveStatement(capabilityId, prev, form);
      if (result.status === "saved" || result.status === "reset") setEditing(false);
      return result;
    },
    idle,
  );

  if (!editing) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-lg leading-snug">&ldquo;{statement}&rdquo;</p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" onClick={() => { setDraft(statement); setEditing(true); }} className="rounded-full border border-line px-3 py-1.5 font-medium">
            {isCustom ? "Edit statement" : "Write it in your own words"}
          </button>
          {!isCustom && <span className="text-xs text-ink-2">Suggested wording.</span>}
          <span role="status" aria-live="polite" className="text-xs text-ink-2">
            {state.status === "saved" ? "Statement saved." : state.status === "reset" ? "Back to the suggested wording." : ""}
          </span>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="text-sm font-medium">Your statement, in your own voice</label>
      <textarea
        id={fieldId}
        name="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        maxLength={STATEMENT_MAX + 50}
        required
        aria-describedby={`${fieldId}-hint`}
        className="w-full rounded-xl border border-line bg-surface p-3"
        autoFocus
      />
      <p id={`${fieldId}-hint`} className="text-xs text-ink-2">
        <span className={draft.length > STATEMENT_MAX ? "text-bad" : ""}>{draft.length}</span> / {STATEMENT_MAX}. Start with &ldquo;I can…&rdquo; and say what you can do, not what you completed.
      </p>
      {state.status === "error" && <p role="alert" className="text-sm text-bad">{state.message}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="rounded-full bg-accent px-5 py-2 font-medium text-accent-ink disabled:opacity-60">
          {pending ? "Saving…" : "Save statement"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="rounded-full border border-line px-5 py-2">Cancel</button>
        {isCustom && (
          <button type="submit" name="intent" value="reset" formNoValidate disabled={pending} className="rounded-full px-3 py-2 text-sm text-ink-2 underline">
            Use suggested wording
          </button>
        )}
      </div>
    </form>
  );
}
