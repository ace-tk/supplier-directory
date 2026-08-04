import { getUser } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { getFreelancerProfile } from "@/lib/freelancer-queries";
import { PortfolioEditor } from "@/components/freelancer/portfolio-editor";

export default async function FreelancerPortfolioPage() {
  const user = await getUser();
  const profile = await getFreelancerProfile(user!.id);

  if (!profile) {
    return (
      <div className="space-y-6">
        <PageHeader title="Portfolio" description="Showcase your work, links, and experience." />
        <p className="text-sm text-muted-foreground">Freelancer profile not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Portfolio" description="Showcase your work, links, and experience." />
      <PortfolioEditor initialProfile={profile} />
    </div>
  );
}
