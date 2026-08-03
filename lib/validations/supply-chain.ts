import { z } from "zod";

export const createSupplyChainSchema = z.object({
  name: z.string().min(2, "Give this supply chain a name"),
  orderName: z.string().min(2, "Enter the order name"),
  orderNumber: z.string().min(1, "Enter an order number"),
  buyerName: z.string().min(1, "Enter the buyer"),
  supplierName: z.string().min(1, "Enter the supplier"),
  expectedDelivery: z.string().min(1, "Pick an expected delivery date"),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]),
  description: z.string().optional(),
});

export type CreateSupplyChainFormValues = z.infer<typeof createSupplyChainSchema>;
