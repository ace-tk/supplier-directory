import { getAllBuyerLeads } from "@/lib/buyer-leads-store";
import { SUPPLIERS } from "@/data/suppliers";
import { BuyerLeadsView } from "@/components/admin/buyer-leads/buyer-leads-view";

export default function BuyerLeadsPage() {
  const leads = getAllBuyerLeads();
  return <BuyerLeadsView initialLeads={leads} suppliers={SUPPLIERS} />;
}
