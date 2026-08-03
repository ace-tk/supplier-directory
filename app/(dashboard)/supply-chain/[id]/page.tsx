import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { getSupplyChainWithAccess } from "@/lib/supply-chain-queries";
import { SupplyChainWorkspace } from "@/components/supply-chain/SupplyChainWorkspace";

export default async function AdminSupplyChainWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect(`/login?from=/supply-chain/${id}`);

  const result = await getSupplyChainWithAccess(id, user.id, user.role);
  if (!result) notFound();

  return <SupplyChainWorkspace chain={result.chain} access={result.access} basePath="/dashboard" />;
}
