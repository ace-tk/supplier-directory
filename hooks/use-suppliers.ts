"use client";

import { useState, useEffect, useCallback } from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for module consistency
import { toast } from "sonner";
import { type Supplier } from "@/types/supplier";
import { type SupplierFormValues } from "@/lib/validations/supplier";

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/suppliers")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json() as Promise<Supplier[]>;
      })
      .then((data) => {
        if (!cancelled) setSuppliers(data);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load suppliers");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const createSupplier = useCallback(
    async (values: SupplierFormValues): Promise<Supplier | null> => {
      try {
        const res = await fetch("/api/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Create failed");
        }
        const created: Supplier = await res.json();
        setSuppliers((prev) => [created, ...prev]);
        toast.success(`${created.companyName} added to directory`);
        return created;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create supplier");
        return null;
      }
    },
    []
  );

  const updateSupplier = useCallback(
    async (id: string, values: SupplierFormValues): Promise<Supplier | null> => {
      try {
        const res = await fetch(`/api/suppliers/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Update failed");
        }
        const updated: Supplier = await res.json();
        setSuppliers((prev) => prev.map((s) => (s.id === id ? updated : s)));
        toast.success(`${updated.companyName} updated`);
        return updated;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update supplier");
        return null;
      }
    },
    []
  );

  const deleteSupplier = useCallback(async (id: string): Promise<boolean> => {
    const target = suppliers.find((s) => s.id === id);
    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      toast.success(`${target?.companyName ?? "Supplier"} removed from directory`);
      return true;
    } catch {
      toast.error("Failed to delete supplier");
      return false;
    }
  }, [suppliers]);

  return { suppliers, loading, createSupplier, updateSupplier, deleteSupplier };
}
