"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Product } from "@/types/product";
import { getProductVideoUrl } from "@/lib/product-engagement";

export function ProductVideoModal({
  product,
  open,
  onOpenChange,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>Product walkthrough — multiple angles</DialogDescription>
        </DialogHeader>
        <video
          key={product.id}
          src={getProductVideoUrl(product)}
          controls
          autoPlay
          className="w-full aspect-video rounded-lg bg-black"
        />
      </DialogContent>
    </Dialog>
  );
}
