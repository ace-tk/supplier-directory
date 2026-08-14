import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { getOwnPortfolioViewModel } from "@/lib/portfolio-queries";
import { PortfolioBuilder } from "@/components/portfolio/builder/portfolio-builder";

export default async function FreelancerPortfolioPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/portfolio");

  const portfolio = await getOwnPortfolioViewModel(user.id);
  if (!portfolio) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Freelancer profile not found.</p>
      </div>
    );
  }

  return <PortfolioBuilder initialData={portfolio} userId={user.id} />;
}
