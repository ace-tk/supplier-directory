"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Factory, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { manufactureThisWishAction } from "@/services/wishes";

export function ManufactureThisWishButton({ wishId }: { wishId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      const result = await manufactureThisWishAction(wishId);
      if (!result.success) return toast.error(result.error);
      router.push(`/buyer/product/${result.data.rowId}/manufacture`);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button onClick={handleClick} disabled={pending} className="gap-1.5">
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Factory className="h-3.5 w-3.5" />}
      Manufacture This Wish
    </Button>
  );
}
