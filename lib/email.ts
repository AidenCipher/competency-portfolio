import "server-only";
import { serverEnv } from "@/lib/env.server";

/** Sends the validation email via Resend if configured. Returns false if not configured or on failure. */
export async function sendValidationEmail(args: {
  to: string;
  validatorName: string;
  learnerName: string;
  experienceTitle: string;
  link: string;
}): Promise<boolean> {
  const { RESEND_API_KEY, RESEND_FROM } = serverEnv();
  if (!RESEND_API_KEY || !RESEND_FROM) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [args.to],
        subject: `${args.learnerName} asked you to validate an experience`,
        text:
          `Hello ${args.validatorName},\n\n` +
          `${args.learnerName} has asked you to review and validate this experience: "${args.experienceTitle}".\n` +
          `It takes a couple of minutes. You can endorse it, request changes, or decline, with a short comment.\n\n` +
          `${args.link}\n\n` +
          `This link works once and expires in 14 days. If you weren't expecting this, you can ignore the email.`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
