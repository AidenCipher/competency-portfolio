import type { Metadata } from "next";
import { loadValidation } from "@/lib/validation-load";
import { rateLimit } from "@/lib/rate-limit";
import { DecisionForm } from "./DecisionForm";

export const metadata: Metadata = {
  title: "Validate an experience",
  robots: { index: false, follow: false },
};

function InvalidLink() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-3 px-6 py-16">
      <h1 className="text-3xl font-semibold">This link isn&apos;t valid</h1>
      <p className="text-ink-2">
        It may have expired or already been used. Please ask the learner to send you a new one.
      </p>
    </main>
  );
}

export default async function ValidatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Same page for rate-limited, malformed, unknown, used and expired.
  if (!(await rateLimit("validate:view", 60, 10 * 60_000))) return <InvalidLink />;
  const v = await loadValidation(token);
  if (!v) return <InvalidLink />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-6 py-12">
      {v.isDemo && (
        <p className="rounded-xl bg-warn-soft px-4 py-2 text-sm font-medium text-warn">DEMO DATA: fictional learner and content.</p>
      )}
      <header>
        <p className="micro">Validation request · {v.validatorKind}</p>
        <h1 className="text-3xl font-semibold">{v.experience.title}</h1>
        <p className="mt-1 text-ink-2">
          {v.learnerName} asked {v.validatorName} to review this. {v.experience.role_title} · {v.experience.duration_label}
        </p>
      </header>

      <section className="card flex flex-col gap-4 p-6">
        <div>
          <h2 className="micro mb-1">What they did</h2>
          {/* Plain text only: user content is never rendered as HTML. */}
          <p className="whitespace-pre-wrap">{v.experience.description}</p>
        </div>
        <div>
          <h2 className="micro mb-1">Their reflection</h2>
          <p className="whitespace-pre-wrap">{v.experience.reflection || "No reflection written."}</p>
        </div>
        <div>
          <h2 className="micro mb-1">Capabilities claimed</h2>
          <ul className="flex flex-wrap gap-2">
            {v.capabilities.map((c) => (
              <li key={c} className="rounded-full bg-info-soft px-3 py-1 text-sm text-info">{c}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="micro mb-1">Evidence</h2>
          {v.evidence.length === 0 ? (
            <p className="text-ink-2">No files attached.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {v.evidence.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{e.filename} <span className="text-ink-3">({e.kind})</span></span>
                  {e.url ? (
                    <a href={e.url} rel="noopener noreferrer" className="shrink-0 font-medium text-accent underline">Download</a>
                  ) : (
                    <span className="shrink-0 text-ink-3">Not available</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <DecisionForm token={token} />
    </main>
  );
}
