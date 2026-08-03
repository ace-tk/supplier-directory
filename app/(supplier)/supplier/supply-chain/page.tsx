import { getAllSupplyChains, getSupplyChainAnalytics } from "@/lib/supply-chain-store";
import { SupplyChainDashboard } from "@/components/supply-chain/SupplyChainDashboard";

export default function SupplierSupplyChainPage() {
  const chains = getAllSupplyChains();
  const analytics = getSupplyChainAnalytics();
  return <SupplyChainDashboard chains={chains} analytics={analytics} basePath="/supplier/supply-chain" />;
}
