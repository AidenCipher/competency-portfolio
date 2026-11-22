import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { loadPortfolio } from "@/lib/data";
import { GoalPicker } from "@/components/GoalPicker";
import { PortfolioView } from "./PortfolioView";

export const metadata: Metadata = { title: "Capability portfolio" };

export default async function PortfolioPage() {
  const { supabase, user } = await requireUser();
  const d = await loadPortfolio(supabase, user.id);
  if (!d.roleId || !d.roleName) return <GoalPicker roles={d.roles} />;
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="micro">Capability portfolio · {d.roleName}</p>
        <h1 className="text-4xl font-semibold leading-tight">Show what you can do</h1>
      </header>
      <PortfolioView capabilities={d.capabilities} experiences={d.experiences} roleName={d.roleName} />
    </div>
  );
}
