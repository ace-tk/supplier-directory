"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Plus, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { saveDraftAction } from "@/services/portfolio";
import type { PortfolioViewModel, PortfolioProcessStep, PortfolioTestimonial, PortfolioClient } from "@/types/portfolio";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ContentForm({ data, onChange }: { data: PortfolioViewModel; onChange: (d: PortfolioViewModel) => void }) {
  const [headline, setHeadline] = useState(data.hero.headline ?? "");
  const [tagline, setTagline] = useState(data.hero.tagline ?? "");
  const [aboutLong, setAboutLong] = useState(data.about.long ?? "");
  const [servicesText, setServicesText] = useState(data.services.join(", "));
  const [website, setWebsite] = useState(data.socials.website ?? "");
  const [experienceYears, setExperienceYears] = useState(data.stats.experienceYears?.toString() ?? "");
  const [process, setProcess] = useState<PortfolioProcessStep[]>(data.process);
  const [testimonials, setTestimonials] = useState<PortfolioTestimonial[]>(data.testimonials);
  const [clients, setClients] = useState<PortfolioClient[]>(data.clients);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await saveDraftAction({
      headline,
      tagline,
      aboutLong,
      services: servicesText.split(",").map((s) => s.trim()).filter(Boolean),
      website,
      experienceYears: experienceYears.trim() ? Number(experienceYears) : null,
      processSteps: process.map((p, i) => ({ ...p, order: i + 1 })),
      testimonials,
      clients,
    });
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    onChange(result.data);
    toast.success("Draft saved");
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Hero</h3>
        <p className="text-xs text-muted-foreground -mt-2">
          Name, avatar, role, location, and availability come from your{" "}
          <Link href="/freelancer/profile/edit" className="text-primary hover:underline">
            profile
          </Link>{" "}
          and stay in sync automatically.
        </p>
        <Field label="Headline" hint="The big statement at the top of your portfolio.">
          <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Product designer crafting calm, usable interfaces." />
        </Field>
        <Field label="Tagline" hint="A short label shown above the headline.">
          <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Freelance Product Designer" />
        </Field>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">About</h3>
        <p className="text-xs text-muted-foreground -mt-2">
          Your short bio (shown under the hero) is managed in your{" "}
          <Link href="/freelancer/profile/edit" className="text-primary hover:underline">
            profile
          </Link>
          . Add a longer introduction for the About section here.
        </p>
        <Field label="Longer introduction">
          <Textarea rows={5} value={aboutLong} onChange={(e) => setAboutLong(e.target.value)} placeholder="Write a fuller professional introduction for your About section." />
        </Field>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Services &amp; Experience</h3>
        <Field label="Services (comma-separated)" hint="Distinct from your skills — the offerings clients hire you for.">
          <Input value={servicesText} onChange={(e) => setServicesText(e.target.value)} placeholder="UI/UX Design, Branding, Frontend Development" />
        </Field>
        <Field label="Years of experience" hint="Leave blank to hide this stat.">
          <Input type="number" min={0} value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} className="max-w-[140px]" />
        </Field>
      </section>

      <ProcessEditor process={process} setProcess={setProcess} />
      <TestimonialsEditor testimonials={testimonials} setTestimonials={setTestimonials} />
      <ClientsEditor clients={clients} setClients={setClients} />

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Website</h3>
        <Field label="Website URL" hint="Optional — shown alongside your contact details.">
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourname.com" />
        </Field>
      </section>

      <Button onClick={handleSave} disabled={saving} className="gap-1.5">
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save Draft
      </Button>
    </div>
  );
}

function ProcessEditor({
  process,
  setProcess,
}: {
  process: PortfolioProcessStep[];
  setProcess: (p: PortfolioProcessStep[]) => void;
}) {
  function add() {
    setProcess([...process, { order: process.length + 1, title: "", description: "" }]);
  }
  function update(i: number, patch: Partial<PortfolioProcessStep>) {
    setProcess(process.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function remove(i: number) {
    setProcess(process.filter((_, idx) => idx !== i));
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">My Process</h3>
          <p className="text-xs text-muted-foreground">Optional — hidden entirely if you don&apos;t add any steps.</p>
        </div>
        <Button variant="outline" size="sm" onClick={add} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Step
        </Button>
      </div>
      {process.map((step, i) => (
        <div key={i} className="rounded-lg border border-border p-3 flex gap-3">
          <span className="text-lg font-bold text-muted-foreground tabular-nums pt-1">{String(i + 1).padStart(2, "0")}</span>
          <div className="flex-1 space-y-2">
            <Input placeholder="Step title" value={step.title} onChange={(e) => update(i, { title: e.target.value })} />
            <Textarea placeholder="Short description" rows={2} value={step.description} onChange={(e) => update(i, { description: e.target.value })} />
          </div>
          <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive shrink-0" aria-label="Remove step">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </section>
  );
}

function TestimonialsEditor({
  testimonials,
  setTestimonials,
}: {
  testimonials: PortfolioTestimonial[];
  setTestimonials: (t: PortfolioTestimonial[]) => void;
}) {
  function add() {
    setTestimonials([...testimonials, { name: "", company: "", quote: "" }]);
  }
  function update(i: number, patch: Partial<PortfolioTestimonial>) {
    setTestimonials(testimonials.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function remove(i: number) {
    setTestimonials(testimonials.filter((_, idx) => idx !== i));
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Testimonials</h3>
          <p className="text-xs text-muted-foreground">Optional — only add real client feedback.</p>
        </div>
        <Button variant="outline" size="sm" onClick={add} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Testimonial
        </Button>
      </div>
      {testimonials.map((t, i) => (
        <div key={i} className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1 grid sm:grid-cols-2 gap-2">
              <Input placeholder="Client name" value={t.name} onChange={(e) => update(i, { name: e.target.value })} />
              <Input placeholder="Company (optional)" value={t.company ?? ""} onChange={(e) => update(i, { company: e.target.value })} />
            </div>
            <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive shrink-0 mt-2" aria-label="Remove testimonial">
              <X className="h-4 w-4" />
            </button>
          </div>
          <Textarea placeholder="Quote" rows={2} value={t.quote} onChange={(e) => update(i, { quote: e.target.value })} />
        </div>
      ))}
    </section>
  );
}

function ClientsEditor({ clients, setClients }: { clients: PortfolioClient[]; setClients: (c: PortfolioClient[]) => void }) {
  function add() {
    setClients([...clients, { name: "" }]);
  }
  function update(i: number, patch: Partial<PortfolioClient>) {
    setClients(clients.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function remove(i: number) {
    setClients(clients.filter((_, idx) => idx !== i));
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Trusted By</h3>
          <p className="text-xs text-muted-foreground">Optional — only list clients you have permission to name.</p>
        </div>
        <Button variant="outline" size="sm" onClick={add} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Client
        </Button>
      </div>
      {clients.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {clients.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Badge variant="outline" className="font-normal gap-1.5 pr-1">
                <Input
                  value={c.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="Client name"
                  className="h-6 w-32 border-0 shadow-none px-1 text-xs focus-visible:ring-0"
                />
                <button type="button" onClick={() => remove(i)} aria-label="Remove client">
                  <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
              </Badge>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function ContentFormFooterHint() {
  return (
    <p className="text-xs text-muted-foreground flex items-center gap-1">
      Continue to Projects <ArrowRight className="h-3 w-3" />
    </p>
  );
}
