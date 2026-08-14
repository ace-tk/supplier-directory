import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { getFreelancerProfile } from "@/lib/freelancer-queries";
import { PortfolioEditor } from "@/components/freelancer/portfolio-editor";

export default async function FreelancerProfileEditPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/profile/edit");
  const profile = await getFreelancerProfile(user.id);

  if (!profile) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Profile" description="Links, bio, skills, resume, and gallery." />
        <p className="text-sm text-muted-foreground">Freelancer profile not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Profile" description="Links, bio, skills, resume, and gallery." />
      <PortfolioEditor initialProfile={profile} />
    </div>
  );
}
