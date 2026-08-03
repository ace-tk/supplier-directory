import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { getAccessibleSupplyChains, getSupplyChainAnalyticsForUser } from "@/lib/supply-chain-queries";
import { SupplyChainDashboard } from "@/components/supply-chain/SupplyChainDashboard";

export default async function BuyerSupplyChainPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/supply-chain");

  const [chains, analytics] = await Promise.all([
    getAccessibleSupplyChains(user.id, user.role),
    getSupplyChainAnalyticsForUser(user.id, user.role),
  ]);

  return <SupplyChainDashboard chains={chains} analytics={analytics} basePath="/buyer/supply-chain" />;
}
