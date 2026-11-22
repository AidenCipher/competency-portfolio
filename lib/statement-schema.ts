import { z } from "zod";

export const STATEMENT_MAX = 300;

/** A capability statement is one short paragraph in the learner's voice. Plain text only (React escapes it on render). */
export const statementSchema = z.object({
  capabilityId: z.string().uuid(),
  text: z
    .string()
    .transform((t) => t.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, "Write a sentence about what you can do.").max(STATEMENT_MAX, `Keep it to ${STATEMENT_MAX} characters or fewer.`)),
});
