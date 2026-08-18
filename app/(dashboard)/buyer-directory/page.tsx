import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { db } from "@/lib/db";
import { BuyerDirectoryView } from "@/components/buyer-directory/BuyerDirectoryView";
import type { BuyerDirectoryEntry } from "@/components/buyer-directory/BuyerDirectoryView";

export default async function BuyerDirectoryPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer-directory");

  const rows = await db.user.findMany({
    where: { role: "BUYER" },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      buyer: { select: { companyName: true, city: true, country: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const buyers: BuyerDirectoryEntry[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    companyName: r.buyer?.companyName ?? null,
    city: r.buyer?.city ?? null,
    country: r.buyer?.country ?? null,
    joinedAt: r.createdAt.toISOString(),
  }));

  return <BuyerDirectoryView buyers={buyers} />;
}
