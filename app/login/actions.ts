"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { safeNext } from "@/lib/safe-redirect";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

const emailSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse({ email: form.get("email") });
  if (!parsed.success) return { status: "error", message: "Enter a valid email address." };

  // 5 attempts / 10 min per IP. Same generic message either way to avoid probing.
  if (!(await rateLimit("auth:magic", 5, 10 * 60_000))) {
    return { status: "error", message: "Too many attempts. Please wait a few minutes and try again." };
  }

  const next = safeNext(String(form.get("next") ?? ""));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { status: "error", message: "We couldn't send the link. Please try again." };
  return { status: "sent", message: "Check your email for a sign-in link." };
}

export async function signInWithGoogle(form: FormData) {
  if (!(await rateLimit("auth:google", 10, 10 * 60_000))) redirect("/login?error=rate");
  const next = safeNext(String(form.get("next") ?? ""));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}
