import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";

/** Mirrors lib/milestone-activity.ts. Only real lifecycle mutations log here — never reads or UI clicks. */
export async function logInvoiceActivity(
  invoiceId: string,
  type: string,
  description: string,
  actorId?: string | null,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? db;
  await client.invoiceActivity.create({ data: { invoiceId, type, description, actorId: actorId ?? null } });
}
