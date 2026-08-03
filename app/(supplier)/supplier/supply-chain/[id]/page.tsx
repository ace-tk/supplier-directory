import { notFound } from "next/navigation";
import { getSupplyChainById } from "@/lib/supply-chain-store";
import { SupplyChainWorkspace } from "@/components/supply-chain/SupplyChainWorkspace";

export default async function SupplierSupplyChainWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chain = getSupplyChainById(id);
  if (!chain) notFound();

  return <SupplyChainWorkspace chain={chain} basePath="/supplier/supply-chain" />;
}
