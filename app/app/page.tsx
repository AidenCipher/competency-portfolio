import { requireUser } from "@/lib/auth";

// Placeholder; replaced by the Dashboard in step 7.
export default async function AppHome() {
  const { user } = await requireUser();
  return <p className="micro">Signed in as {user.id.slice(0, 8)}…</p>;
}
