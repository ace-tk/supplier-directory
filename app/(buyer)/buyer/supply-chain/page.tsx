import { getAllSupplyChains, getSupplyChainAnalytics } from "@/lib/supply-chain-store";
import { SupplyChainDashboard } from "@/components/supply-chain/SupplyChainDashboard";

export default function BuyerSupplyChainPage() {
  const chains = getAllSupplyChains();
  const analytics = getSupplyChainAnalytics();
  return <SupplyChainDashboard chains={chains} analytics={analytics} basePath="/buyer/supply-chain" />;
}
