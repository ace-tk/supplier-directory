import { getUser } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { SupplierCard } from "@/components/suppliers/supplier-card";
import { getSavedSuppliers } from "@/lib/mock-data";

export default async function SavedSuppliersPage() {
  const user = await getUser();
  const suppliers = getSavedSuppliers(user?.id ?? "guest");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saved Suppliers"
        description="Suppliers you've bookmarked for quick access later."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.map((supplier, i) => (
          <SupplierCard key={supplier.id} supplier={supplier} delay={Math.min(i * 0.04, 0.3)} />
        ))}
      </div>
    </div>
  );
}
