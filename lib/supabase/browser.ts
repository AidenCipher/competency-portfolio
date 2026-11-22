import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * Browser client used ONLY to PUT a file to a single-use signed upload URL minted by prepareUploads(). It carries the
 * public anon key and no session; the signed token is what authorises the one upload (into the user's own folder).
 */
export function signedUploadClient() {
  const env = publicEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
