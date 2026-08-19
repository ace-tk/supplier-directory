"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ListToolbar } from "@/components/admin/list-toolbar";
import { Button } from "@/components/ui/button";
import { WishCard } from "@/components/wishes/WishCard";
import { useSearchFilter } from "@/hooks/use-search-filter";
import { getMyWishesAction } from "@/services/wishes";
import type { ProductWishRecord } from "@/types/wishes";

export default function MyWishesPage() {
  const [wishes, setWishes] = useState<ProductWishRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyWishesAction().then((result) => {
      if (result.success) setWishes(result.data);
      setLoading(false);
    });
  }, []);

  const { search, setSearch, filterValue, setFilterValue, filtered } = useSearchFilter(
    wishes,
    (w, q) => w.name.toLowerCase().includes(q) || w.category.toLowerCase().includes(q),
    (w) => w.status
  );

  return (
    <div>
      <PageHeader
        title="My Wishes"
        description="Products you've asked SupplyBase to help source or manufacture."
        actions={
          <Button render={<Link href="/buyer/wishes/new" />} nativeButton={false} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Your Wish
          </Button>
        }
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by wish or category..."
        filterValue={filterValue}
        onFilterChange={setFilterValue}
        filterLabel="All"
        filterOptions={[
          { value: "DRAFT", label: "Draft" },
          { value: "SUBMITTED", label: "Submitted" },
          { value: "IN_PROGRESS", label: "In Progress" },
          { value: "COMPLETED", label: "Completed" },
        ]}
      />

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">Loading wishes...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-rose-500/10 text-rose-500">
            <Sparkles className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {wishes.length === 0 ? "No wishes yet" : "No wishes match your search"}
          </p>
          {wishes.length === 0 && (
            <p className="text-xs text-muted-foreground max-w-xs">
              Describe a product you&apos;d like sourced or manufactured and we&apos;ll help turn it into a real request.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
          {filtered.map((wish) => (
            <WishCard
              key={wish.id}
              wish={wish}
              href={wish.status === "DRAFT" ? `/buyer/wishes/${wish.id}/edit` : `/buyer/wishes/${wish.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
