import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { buildPortfolio, type PortfolioRows } from "@/lib/portfolio";
import type { PortfolioData } from "@/lib/types";

/**
 * The public demo portfolio (fictional learner "Jo"). Uses the ANON key and one narrow database function,
 * `demo_portfolio()`, which can only ever return the single profile flagged `is_demo`. No service role, no cookies.
 * Returns null when no demo learner exists (e.g. a fresh production database): the page shows an empty state.
 */
export async function loadDemoPortfolio(): Promise<PortfolioData | null> {
  const env = publicEnv();
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.rpc("demo_portfolio");
  if (error || !data) return null;
  return buildPortfolio(data as PortfolioRows);
}
