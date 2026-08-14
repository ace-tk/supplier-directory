import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, Phone, MapPin, FileText, Download, ArrowRight } from "lucide-react";
import { getUser } from "@/lib/session";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/portal/status-badge";
import { Badge } from "@/components/ui/badge";
import { getFreelancerProfile } from "@/lib/freelancer-queries";
import { AVAILABILITY_LABELS } from "@/lib/freelancer-ui";
import { ROLE_LABELS } from "@/lib/roles";
import { AvatarUploader } from "@/components/freelancer/avatar-uploader";

export default async function FreelancerProfilePage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/profile");
  const profile = await getFreelancerProfile(user.id);

  if (!profile) {
    return (
      <div className="space-y-6">
        <PageHeader title="Profile" />
        <p className="text-sm text-muted-foreground">Freelancer profile not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Profile" description="Your public identity across SupplyBase." />

      <div className="rounded-xl border border-border bg-card p-6 flex flex-col sm:flex-row items-start gap-5">
        <AvatarUploader name={profile.name} avatar={profile.avatar} />
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">{profile.name}</h2>
            <Badge variant="secondary" className="font-normal">{ROLE_LABELS.FREELANCER}</Badge>
            <StatusBadge status={AVAILABILITY_LABELS[profile.availability]} />
          </div>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> {profile.email}
            </div>
            {profile.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> {profile.phone}
              </div>
            )}
            {profile.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {profile.location}
              </div>
            )}
          </div>
        </div>
        <Link
          href="/freelancer/profile/edit"
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0"
        >
          Edit details <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <section className="space-y-3">
        <SectionHeader title="Bio" />
        <p className="text-sm text-foreground whitespace-pre-wrap">
          {profile.bio || <span className="text-muted-foreground">No bio added yet.</span>}
        </p>
      </section>

      {profile.skills.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title="Skills" />
          <div className="flex flex-wrap gap-1.5">
            {profile.skills.map((s) => (
              <Badge key={s} variant="secondary" className="font-normal">
                {s}
              </Badge>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <SectionHeader
          title="Resume"
          actions={
            profile.resumeDataUrl && (
              <a href={profile.resumeDataUrl} download={profile.resumeFileName ?? "resume"}>
                <span className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  <Download className="h-3 w-3" /> Download
                </span>
              </a>
            )
          }
        />
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted shrink-0">
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-foreground">{profile.resumeFileName ?? "No resume uploaded yet."}</p>
        </div>
      </section>

      {profile.experience.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title="Experience" />
          <div className="space-y-3">
            {profile.experience.map((exp) => (
              <div key={exp.id} className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-medium text-foreground">{exp.role}</p>
                <p className="text-xs text-muted-foreground">{exp.company}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {profile.portfolioItems.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            title="Gallery"
            actions={
              <Link href="/freelancer/profile/edit" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {profile.portfolioItems.slice(0, 6).map((item) => (
              <div key={item.id} className="aspect-square rounded-lg overflow-hidden bg-muted">
                <img src={item.dataUrl} alt={item.caption ?? "Portfolio item"} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
