"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { EvidenceMeter } from "@/components/EvidenceMeter";
import { evidenceStrength, wordCount, REFLECTION_WORDS } from "@/lib/scoring";
import {
  EVIDENCE_KINDS,
  EXPERIENCE_TYPES,
  VALIDATOR_KINDS,
  type FormState,
} from "@/lib/experience-schema";
import { MAX_FILES, MIME_BY_TYPE, precheckUpload, REJECT_MESSAGES } from "@/lib/uploads";
import { signedUploadClient } from "@/lib/supabase/browser";
import { createExperience } from "./actions";
import { prepareUploads } from "./upload-actions";

type Cap = { id: string; name: string };
const initial: FormState = { status: "idle" };

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-ink-3";

function FieldError({ id, msg }: { id: string; msg?: string }) {
  return msg ? (
    <p id={id} className="mt-1 text-sm text-bad">
      {msg}
    </p>
  ) : null;
}

export function ExperienceForm({ capabilities, preselect }: { capabilities: Cap[]; preselect?: string }) {
  const [state, action, actionPending] = useActionState(createExperience, initial);
  const [, startTransition] = useTransition();
  // Upload step (before the action): files go straight to Storage via signed URLs, never through a server action.
  const [upload, setUpload] = useState<{ status: "idle" } | { status: "uploading"; done: number; total: number } | { status: "error"; message: string }>({ status: "idle" });
  const pending = actionPending || upload.status === "uploading";
  const [vals, setVals] = useState({ title: "", roleTitle: "", durationLabel: "", description: "", reflection: "" });
  const [rows, setRows] = useState<number[]>([0]);
  const [fileCount, setFileCount] = useState<Record<number, boolean>>({});
  const [nextRow, setNextRow] = useState(1);
  const set = (k: keyof typeof vals) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setVals((v) => ({ ...v, [k]: e.target.value }));

  const strength = useMemo(
    () =>
      evidenceStrength({
        title: vals.title,
        roleTitle: vals.roleTitle,
        durationLabel: vals.durationLabel,
        description: vals.description,
        reflection: vals.reflection,
        artefacts: Object.values(fileCount).filter(Boolean).length,
        validated: false, // lights up only after a validator endorses
      }),
    [vals, fileCount],
  );
  const words = wordCount(vals.reflection);
  const fe = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const rawFiles = fd.getAll("files");
    const kinds = fd.getAll("kinds").map(String);
    fd.delete("files");
    fd.delete("kinds");
    const picked = rawFiles
      .map((f, i) => ({ file: f, kind: kinds[i] ?? "other" }))
      .filter((p): p is { file: File; kind: string } => p.file instanceof File && p.file.size > 0);

    if (picked.length > 0) {
      for (const { file } of picked) {
        const pre = precheckUpload({ name: file.name, size: file.size });
        if (!pre.ok) { setUpload({ status: "error", message: `“${file.name.slice(0, 60)}”: ${REJECT_MESSAGES[pre.reason]}` }); return; }
      }
      setUpload({ status: "uploading", done: 0, total: picked.length });
      const prep = await prepareUploads({ files: picked.map((p) => ({ name: p.file.name, size: p.file.size })) });
      if (!prep.ok) { setUpload({ status: "error", message: prep.message }); return; }
      const storage = signedUploadClient().storage.from("evidence");
      for (let i = 0; i < picked.length; i++) {
        const type = precheckUpload({ name: picked[i].file.name, size: picked[i].file.size });
        const { error } = await storage.uploadToSignedUrl(prep.uploads[i].path, prep.uploads[i].token, picked[i].file, {
          contentType: type.ok ? MIME_BY_TYPE[type.type] : undefined,
        });
        if (error) { setUpload({ status: "error", message: `“${picked[i].file.name.slice(0, 60)}” couldn't be uploaded. Nothing was saved; please try again.` }); return; }
        setUpload({ status: "uploading", done: i + 1, total: picked.length });
      }
      fd.set("experienceId", prep.experienceId);
      fd.set("uploads", JSON.stringify(picked.map((p, i) => ({ path: prep.uploads[i].path, name: p.file.name, kind: p.kind, declaredMime: p.file.type }))));
    }
    setUpload({ status: "idle" });
    startTransition(() => action(fd));
  }

  if (state.status === "done") {
    return <Done state={state} />;
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[1fr_20rem]" noValidate>
      <div className="flex flex-col gap-6">
        {(upload.status === "error" || state.status === "error") && (
          <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">
            {upload.status === "error" ? upload.message : state.status === "error" ? state.message : ""}
          </p>
        )}

        <div>
          <label htmlFor="title" className="micro">Title</label>
          <input id="title" name="title" required maxLength={200} value={vals.title} onChange={set("title")}
            aria-invalid={!!fe.title} aria-describedby="title-err" className={inputCls} placeholder="e.g. Capstone: staff engagement survey" />
          <FieldError id="title-err" msg={fe.title} />
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <label htmlFor="type" className="micro">Type</label>
            <select id="type" name="type" required defaultValue="academic" className={inputCls}>
              {EXPERIENCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="roleTitle" className="micro">Your role</label>
            <input id="roleTitle" name="roleTitle" required maxLength={120} value={vals.roleTitle} onChange={set("roleTitle")}
              aria-invalid={!!fe.roleTitle} aria-describedby="role-err" className={inputCls} placeholder="Project lead" />
            <FieldError id="role-err" msg={fe.roleTitle} />
          </div>
          <div>
            <label htmlFor="durationLabel" className="micro">Duration</label>
            <input id="durationLabel" name="durationLabel" required maxLength={80} value={vals.durationLabel} onChange={set("durationLabel")}
              aria-invalid={!!fe.durationLabel} aria-describedby="dur-err" className={inputCls} placeholder="8 weeks" />
            <FieldError id="dur-err" msg={fe.durationLabel} />
          </div>
        </div>

        <div>
          <label htmlFor="description" className="micro">What I did</label>
          <textarea id="description" name="description" required rows={4} maxLength={5000} value={vals.description} onChange={set("description")}
            aria-invalid={!!fe.description} aria-describedby="desc-err" className={inputCls} />
          <FieldError id="desc-err" msg={fe.description} />
        </div>

        <fieldset aria-describedby="cap-err">
          <legend className="micro mb-2">Capabilities this shows</legend>
          <div className="flex flex-wrap gap-2">
            {capabilities.map((c) => (
              <label key={c.id} className="cursor-pointer">
                <input type="checkbox" name="capabilityIds" value={c.id} defaultChecked={c.id === preselect} className="peer sr-only" />
                <span className="inline-block rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink-2 peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ring)]">
                  {c.name}
                </span>
              </label>
            ))}
          </div>
          <FieldError id="cap-err" msg={fe.capabilityIds} />
        </fieldset>

        <div>
          <label htmlFor="reflection" className="micro">What did you actually learn or do?</label>
          <textarea id="reflection" name="reflection" rows={6} maxLength={5000} value={vals.reflection} onChange={set("reflection")}
            aria-describedby="refl-count" className={inputCls}
            placeholder="In your own words: what was hard, what you changed your mind about, what you'd do differently." />
          <p id="refl-count" className="mt-1 text-sm text-ink-3">
            {words} / {REFLECTION_WORDS} words{words >= REFLECTION_WORDS ? " — counts as application evidence" : ""}
          </p>
        </div>

        <fieldset>
          <legend className="micro mb-2">Evidence (PDF, PPTX, DOCX, PNG or JPG; 10 MB max; up to {MAX_FILES})</legend>
          <ul className="flex flex-col gap-3">
            {rows.map((id, idx) => (
              <li key={id} className="flex flex-wrap items-center gap-3">
                <label className="sr-only" htmlFor={`file-${id}`}>File {idx + 1}</label>
                <input id={`file-${id}`} type="file" name="files" accept=".pdf,.pptx,.docx,.png,.jpg,.jpeg"
                  onChange={(e) => setFileCount((c) => ({ ...c, [id]: !!e.target.files?.length }))}
                  className="max-w-full text-sm text-ink-2 file:mr-3 file:rounded-full file:border-0 file:bg-surface-2 file:px-4 file:py-2 file:text-ink" />
                <label className="sr-only" htmlFor={`kind-${id}`}>Kind of file {idx + 1}</label>
                <select id={`kind-${id}`} name="kinds" defaultValue="report" className="rounded-xl border border-line bg-surface px-3 py-2 text-sm">
                  {EVIDENCE_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
                {rows.length > 1 && (
                  <button type="button" className="text-sm text-ink-3 underline"
                    onClick={() => {
                      setRows((r) => r.filter((x) => x !== id));
                      setFileCount((c) => { const n = { ...c }; delete n[id]; return n; });
                    }}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          {rows.length < MAX_FILES && (
            <button type="button" className="mt-3 text-sm font-medium text-accent underline"
              onClick={() => { setRows((r) => [...r, nextRow]); setNextRow((n) => n + 1); }}>
              Add another file
            </button>
          )}
          <FieldError id="files-err" msg={fe.files} />
        </fieldset>

        <fieldset className="card flex flex-col gap-4 p-5">
          <legend className="micro px-1">Ask someone to validate it (optional)</legend>
          <p className="text-sm text-ink-2">
            They get a one-time link; no account needed. Without one, this experience counts as self-declared.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="validatorKind" className="micro">Who</label>
              <select id="validatorKind" name="validatorKind" defaultValue="faculty" className={inputCls}>
                {VALIDATOR_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="validatorName" className="micro">Their name</label>
              <input id="validatorName" name="validatorName" maxLength={120} autoComplete="off" className={inputCls} />
            </div>
            <div>
              <label htmlFor="validatorEmail" className="micro">Their email</label>
              <input id="validatorEmail" name="validatorEmail" type="email" maxLength={254} autoComplete="off" className={inputCls} />
            </div>
          </div>
        </fieldset>

        <div>
          <button type="submit" disabled={pending}
            className="rounded-full bg-accent px-6 py-3 font-medium text-accent-ink disabled:opacity-60">
            {upload.status === "uploading" ? `Uploading ${Math.min(upload.done + 1, upload.total)} of ${upload.total}…` : pending ? "Saving…" : "Save experience"}
          </button>
        </div>
      </div>

      <aside className="card h-fit p-5 lg:sticky lg:top-6" aria-label="Evidence strength">
        <p className="micro mb-3">Evidence strength</p>
        <EvidenceMeter strength={strength} />
        <p className="mt-4 text-xs text-ink-3">
          Validation lights up once your validator endorses. The score is calculated after saving.
        </p>
      </aside>
    </form>
  );
}

function Done({ state }: { state: Extract<FormState, { status: "done" }> }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card flex max-w-xl flex-col gap-4 p-6" role="status">
      <h2 className="text-2xl font-semibold">Experience saved</h2>
      {state.validationError && (
        <p role="alert" className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
          Saved, but the validation request didn&apos;t go through: {state.validationError}
        </p>
      )}
      {state.emailed && <p className="text-ink-2">We emailed your validator a one-time link. It expires in 14 days.</p>}
      {state.validationLink && (
        <div className="flex flex-col gap-2">
          <p className="text-ink-2">
            Email isn&apos;t set up here, so send this one-time link to your validator yourself. It expires in 14 days
            and only works once. Anyone with the link can respond, so share it only with them.
          </p>
          <input readOnly aria-label="Validation link" value={state.validationLink} className={inputCls + " font-mono text-xs"}
            onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="w-fit rounded-full border border-line px-4 py-2 text-sm"
            onClick={async () => {
              try { await navigator.clipboard.writeText(state.validationLink!); setCopied(true); } catch { /* user can select manually */ }
            }}>
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}
      <div className="flex gap-3">
        <Link href="/app/portfolio" className="rounded-full bg-accent px-5 py-3 font-medium text-accent-ink">View portfolio</Link>
        <Link href="/app/experiences/new" className="rounded-full border border-line px-5 py-3">Add another</Link>
      </div>
    </div>
  );
}
