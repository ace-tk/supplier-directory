import { z } from "zod";

const PAYMENT_METHOD_VALUES = ["CASH", "BANK_TRANSFER", "UPI", "CARD", "CHEQUE", "OTHER"] as const;

export const recordPaymentSchema = z.object({
  amount: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, "Amount must be greater than zero."),
  paymentDate: z.string().trim().min(1, "Payment date is required."),
  method: z.enum(PAYMENT_METHOD_VALUES),
  referenceNumber: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type RecordPaymentValues = z.infer<typeof recordPaymentSchema>;
