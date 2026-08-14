"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, X, Mail, Phone, Globe, Link2, Camera, Code2 } from "lucide-react";
import { initials } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { PortfolioViewModel, PortfolioProjectVM } from "@/types/portfolio";

const NAV_LINKS = [
  { href: "#work", label: "Work" },
  { href: "#about", label: "About" },
  { href: "#services", label: "Services" },
  { href: "#boards", label: "Boards" },
  { href: "#contact", label: "Contact" },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold tracking-[0.25em] uppercase text-neutral-500">{children}</p>;
}

function Avatar({ src, name, className }: { src: string | null; name: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden bg-neutral-100 flex items-center justify-center shrink-0", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <span className="font-semibold text-neutral-400">{initials(name)}</span>
      )}
    </div>
  );
}

export function Editorial01Template({ data }: { data: PortfolioViewModel }) {
  const [activeProject, setActiveProject] = useState<PortfolioProjectVM | null>(null);
  const { hero, about, skills, services, stats, process, projects, testimonials, clients, boards, socials } = data;

  const featuredProjects = projects.filter((p) => p.featured);
  const workProjects = featuredProjects.length > 0 ? featuredProjects : projects;
  const hasStats = stats.experienceYears || stats.projectsCompleted > 0 || stats.clients;
  const socialLinks = [
    { url: socials.linkedinUrl, icon: Link2, label: "LinkedIn" },
    { url: socials.instagramUrl, icon: Camera, label: "Instagram" },
    { url: socials.githubUrl, icon: Code2, label: "GitHub" },
  ].filter((s) => s.url);

  return (
    <div className="bg-white text-neutral-900 min-h-screen [&_*]:border-neutral-200">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
          <a href="#top" className="text-sm font-bold tracking-tight">
            {hero.name || "Portfolio"}
          </a>
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-xs font-medium uppercase tracking-wider text-neutral-500 hover:text-neutral-900 transition-colors">
                {l.label}
              </a>
            ))}
          </nav>
          <a href="#contact" className="text-xs font-semibold uppercase tracking-wider border border-neutral-900 px-4 py-2 hover:bg-neutral-900 hover:text-white transition-colors">
            Contact
          </a>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="max-w-6xl mx-auto px-6 md:px-10 pt-16 md:pt-28 pb-16 md:pb-24">
        <div className="grid md:grid-cols-[1fr_auto] gap-10 md:gap-16 items-start">
          <div className="min-w-0">
            {hero.tagline && <SectionLabel>{hero.tagline}</SectionLabel>}
            <h1 className="mt-4 text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[0.95]">
              {hero.headline || hero.name}
            </h1>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-600">
              {hero.role && <span>{hero.role}</span>}
              {hero.location && (
                <span className="flex items-center gap-1">
                  {hero.role && <span className="text-neutral-300">/</span>}
                  {hero.location}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <span className={cn("w-1.5 h-1.5 rounded-full", hero.isAvailable ? "bg-emerald-500" : "bg-neutral-400")} />
                {hero.availabilityLabel}
              </span>
            </div>
            {about.short && <p className="mt-8 max-w-lg text-base text-neutral-600 leading-relaxed">{about.short}</p>}
          </div>
          <Avatar src={hero.avatar} name={hero.name} className="w-40 h-52 md:w-56 md:h-72 rounded-sm" />
        </div>
      </section>

      {/* Selected Work */}
      {workProjects.length > 0 && (
        <section id="work" className="border-t">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24">
            <div className="flex items-baseline justify-between mb-10">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Selected Work</h2>
              <SectionLabel>{String(workProjects.length).padStart(2, "0")} Projects</SectionLabel>
            </div>
            <div className="grid sm:grid-cols-2 gap-8 md:gap-10">
              {workProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setActiveProject(project)}
                  className="text-left group"
                >
                  <div className="aspect-[4/3] bg-neutral-100 overflow-hidden">
                    {project.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={project.coverImage}
                        alt={project.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-300 text-sm">No image</div>
                    )}
                  </div>
                  <div className="mt-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{project.title}</p>
                      <p className="text-sm text-neutral-500">
                        {[project.category, project.year].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 mt-1 text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* About / Expertise */}
      {(about.long || skills.length > 0) && (
        <section id="about" className="border-t">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24 grid md:grid-cols-[1fr_1fr] gap-10 md:gap-16">
            <div>
              <SectionLabel>About</SectionLabel>
              {about.long && <p className="mt-4 text-2xl md:text-3xl font-medium leading-snug tracking-tight">{about.long}</p>}
            </div>
            {skills.length > 0 && (
              <div>
                <SectionLabel>Expertise</SectionLabel>
                <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2">
                  {skills.map((s) => (
                    <span key={s} className="text-sm border px-3 py-1.5 rounded-full text-neutral-700">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Services */}
      {services.length > 0 && (
        <section id="services" className="border-t">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24">
            <SectionLabel>Services</SectionLabel>
            <div className="mt-6 divide-y border-t border-b">
              {services.map((service, i) => (
                <div key={service} className="flex items-center justify-between py-5 md:py-6 group">
                  <div className="flex items-center gap-6">
                    <span className="text-sm text-neutral-400 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-xl md:text-2xl font-medium tracking-tight">{service}</span>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-neutral-300 group-hover:text-neutral-900 transition-colors" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Process */}
      {process.length > 0 && (
        <section className="border-t bg-neutral-50">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24">
            <SectionLabel>My Process</SectionLabel>
            <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[...process]
                .sort((a, b) => a.order - b.order)
                .map((step) => (
                  <div key={step.order}>
                    <p className="text-3xl font-bold text-neutral-300 tabular-nums">{String(step.order).padStart(2, "0")}</p>
                    <p className="mt-3 font-semibold">{step.title}</p>
                    <p className="mt-1.5 text-sm text-neutral-600 leading-relaxed">{step.description}</p>
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* Stats */}
      {hasStats && (
        <section className="border-t">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-14 md:py-20 grid grid-cols-2 sm:grid-cols-3 gap-8">
            {stats.experienceYears != null && (
              <div>
                <p className="text-4xl md:text-5xl font-bold tabular-nums">{stats.experienceYears}+</p>
                <p className="mt-1 text-sm text-neutral-500">Years Experience</p>
              </div>
            )}
            {stats.projectsCompleted > 0 && (
              <div>
                <p className="text-4xl md:text-5xl font-bold tabular-nums">{stats.projectsCompleted}</p>
                <p className="mt-1 text-sm text-neutral-500">Projects</p>
              </div>
            )}
            {stats.clients != null && (
              <div>
                <p className="text-4xl md:text-5xl font-bold tabular-nums">{stats.clients}</p>
                <p className="mt-1 text-sm text-neutral-500">Clients</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <section className="border-t bg-neutral-50">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24">
            <SectionLabel>What People Say</SectionLabel>
            <div className="mt-8 grid md:grid-cols-2 gap-8">
              {testimonials.map((t, i) => (
                <div key={i} className="bg-white border p-6 md:p-8">
                  <p className="text-lg md:text-xl leading-relaxed font-medium">&ldquo;{t.quote}&rdquo;</p>
                  <div className="mt-5 flex items-center gap-3">
                    <Avatar src={t.avatar ?? null} name={t.name} className="w-10 h-10 rounded-full text-xs" />
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      {t.company && <p className="text-xs text-neutral-500">{t.company}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Trusted by / clients */}
      {clients.length > 0 && (
        <section className="border-t">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-12">
            <SectionLabel>Trusted By</SectionLabel>
            <div className="mt-6 flex flex-wrap items-center gap-x-10 gap-y-4">
              {clients.map((c, i) =>
                c.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={c.logo} alt={c.name} className="h-8 object-contain grayscale opacity-70" />
                ) : (
                  <span key={i} className="text-sm font-medium text-neutral-500">
                    {c.name}
                  </span>
                )
              )}
            </div>
          </div>
        </section>
      )}

      {/* Boards */}
      {boards.length > 0 && (
        <section id="boards" className="border-t">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24">
            <div className="flex items-baseline justify-between mb-10">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Visual Boards</h2>
              <SectionLabel>Inspiration &amp; Collections</SectionLabel>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {boards.map((board) => (
                <Link
                  key={board.id}
                  href={`/portfolio/${data.userId}/boards/${board.id}`}
                  target="_blank"
                  className="group block"
                >
                  <div className="aspect-square bg-neutral-100 overflow-hidden">
                    {board.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={board.coverImage}
                        alt={board.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-300 text-sm">No pins yet</div>
                    )}
                  </div>
                  <p className="mt-3 font-semibold">{board.title}</p>
                  <p className="text-sm text-neutral-500">{board.pins.length} pin{board.pins.length === 1 ? "" : "s"}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact */}
      <section id="contact" className="border-t bg-neutral-900 text-white">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-20 md:py-28">
          <SectionLabel>
            <span className="text-neutral-400">Get In Touch</span>
          </SectionLabel>
          <h2 className="mt-4 text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] max-w-2xl">
            Let&rsquo;s work together.
          </h2>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <a href={`mailto:${socials.email}`} className="flex items-center gap-2 text-sm md:text-base hover:text-neutral-300 transition-colors">
              <Mail className="h-4 w-4" /> {socials.email}
            </a>
            {socials.phone && (
              <a href={`tel:${socials.phone}`} className="flex items-center gap-2 text-sm md:text-base hover:text-neutral-300 transition-colors">
                <Phone className="h-4 w-4" /> {socials.phone}
              </a>
            )}
            {socials.website && (
              <a href={socials.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm md:text-base hover:text-neutral-300 transition-colors">
                <Globe className="h-4 w-4" /> Website
              </a>
            )}
          </div>
          {socialLinks.length > 0 && (
            <div className="mt-8 flex items-center gap-4">
              {socialLinks.map((s) => (
                <a
                  key={s.label}
                  href={s.url!}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                  className="w-9 h-9 rounded-full border border-neutral-700 flex items-center justify-center hover:border-white transition-colors"
                >
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-900 text-neutral-500 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-6 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span>{hero.name}</span>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
      </footer>

      {/* Project detail overlay */}
      {activeProject && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 md:p-10"
          onClick={() => setActiveProject(null)}
        >
          <div
            className="bg-white max-w-3xl w-full max-h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {activeProject.coverImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activeProject.coverImage} alt={activeProject.title} className="w-full aspect-video object-cover" />
            )}
            <div className="p-6 md:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">{activeProject.title}</h3>
                  <p className="text-sm text-neutral-500 mt-1">
                    {[activeProject.category, activeProject.clientName, activeProject.year].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button type="button" onClick={() => setActiveProject(null)} aria-label="Close" className="shrink-0">
                  <X className="h-5 w-5 text-neutral-400 hover:text-neutral-900" />
                </button>
              </div>
              {activeProject.description && (
                <p className="mt-5 text-neutral-700 leading-relaxed">{activeProject.description}</p>
              )}
              {activeProject.tools.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {activeProject.tools.map((t) => (
                    <span key={t} className="text-xs border px-2.5 py-1 rounded-full text-neutral-600">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {activeProject.galleryImages.length > 0 && (
                <div className="mt-6 grid sm:grid-cols-2 gap-3">
                  {activeProject.galleryImages.map((img, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={img} alt={`${activeProject.title} ${i + 1}`} loading="lazy" className="w-full aspect-video object-cover" />
                  ))}
                </div>
              )}
              {activeProject.projectUrl && (
                <a
                  href={activeProject.projectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold border-b border-neutral-900 pb-0.5"
                >
                  Visit project <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
