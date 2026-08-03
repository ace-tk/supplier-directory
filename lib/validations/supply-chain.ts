import { z } from "zod";

export const createSupplyChainSchema = z.object({
  name: z.string().min(2, "Give this supply chain a name"),
  orderName: z.string().min(2, "Enter the order name"),
  orderNumber: z.string().min(1, "Enter an order number"),
  buyerUserId: z.string().min(1, "Select a buyer"),
  supplierUserId: z.string().min(1, "Select a supplier"),
  expectedDelivery: z.string().min(1, "Pick an expected delivery date"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  description: z.string().optional(),
});

export type CreateSupplyChainFormValues = z.infer<typeof createSupplyChainSchema>;
