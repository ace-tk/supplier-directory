import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { getAccessibleSupplyChains, getSupplyChainAnalyticsForUser } from "@/lib/supply-chain-queries";
import { SupplyChainDashboard } from "@/components/supply-chain/SupplyChainDashboard";

export default async function SupplierSupplyChainPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/supplier/supply-chain");

  const [chains, analytics] = await Promise.all([
    getAccessibleSupplyChains(user.id, user.role),
    getSupplyChainAnalyticsForUser(user.id, user.role),
  ]);

  return <SupplyChainDashboard chains={chains} analytics={analytics} basePath="/supplier/supply-chain" />;
}
