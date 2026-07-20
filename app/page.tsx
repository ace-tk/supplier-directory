"use client";

import { motion } from "framer-motion";
import {
  Building2,
  Users,
  ShoppingCart,
  BarChart3,
  ArrowRight,
  Shield,
  Zap,
  Globe,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { StatCard } from "@/components/cards/stat-card";
import { AnimatedCard } from "@/components/cards/animated-card";

const features = [
  {
    icon: Building2,
    title: "Supplier Directory",
    description:
      "Discover, evaluate, and onboard verified suppliers from a curated global network.",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: Users,
    title: "CRM",
    description:
      "Manage contacts, track relationships, and streamline your B2B sales pipeline.",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    icon: ShoppingCart,
    title: "Wholesale Shop",
    description:
      "Place bulk orders, manage procurement workflows, and track shipments in real-time.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description:
      "Deep insights into supplier performance, order trends, and revenue analytics.",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
];

const trustPoints = [
  "SOC 2 Type II Certified",
  "GDPR Compliant",
  "99.9% Uptime SLA",
  "Enterprise Support",
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
              <span className="text-primary-foreground font-bold text-sm">S</span>
            </div>
            <span className="font-semibold text-foreground tracking-tight">
              SupplyBase
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" render={<Link href="/auth/login" />} nativeButton={false}>
              Sign in
            </Button>
            <Button size="sm" render={<Link href="/auth/register" />} nativeButton={false}>
              Get started
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background pointer-events-none" />

          <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-20 text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge
                variant="secondary"
                className="mb-6 px-3 py-1 text-xs font-medium gap-1.5 bg-primary/10 text-primary border-primary/20"
              >
                <Zap className="h-3 w-3" />
                Now in public beta · Free to start
              </Badge>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-foreground mb-6 leading-[1.1]">
                The operating system for{" "}
                <span className="gradient-text">B2B wholesale</span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
                SupplyBase brings supplier discovery, CRM, procurement, and
                analytics into one elegant platform — built for modern wholesale
                businesses.
              </p>

              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Button
                  size="lg"
                  className="h-11 px-6 gap-2 shadow-lg shadow-primary/25"
                  render={<Link href="/dashboard" />} nativeButton={false}
                >
                  Start for free
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="lg" className="h-11 px-6" render={<Link href="/demo" />} nativeButton={false}>
                  Watch demo
                </Button>
              </div>

              <div className="flex items-center justify-center gap-6 mt-10 flex-wrap">
                {trustPoints.map((point) => (
                  <div
                    key={point}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--success)] shrink-0" />
                    {point}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Stats */}
        <section className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Active Suppliers"
              value="12,400+"
              change={18}
              delay={0.0}
              icon={Building2}
              iconColor="text-blue-500"
            />
            <StatCard
              title="B2B Transactions"
              value="$2.4B+"
              change={32}
              delay={0.05}
              icon={ShoppingCart}
              iconColor="text-emerald-500"
            />
            <StatCard
              title="Platform Users"
              value="8,200+"
              change={24}
              delay={0.1}
              icon={Users}
              iconColor="text-violet-500"
            />
            <StatCard
              title="Countries"
              value="60+"
              delay={0.15}
              icon={Globe}
              iconColor="text-orange-500"
            />
          </div>
        </section>

        {/* Features */}
        <section className="max-w-7xl mx-auto px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-4">
              Everything you need to run wholesale operations
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              From supplier onboarding to order fulfillment — manage your entire
              supply chain in one unified workspace.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-4">
            {features.map((feature, i) => (
              <AnimatedCard
                key={feature.title}
                delay={i * 0.06}
                className="p-6 group cursor-pointer"
              >
                <div
                  className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${feature.bg} ${feature.color} mb-4`}
                >
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
                <div className="flex items-center gap-1 mt-4 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Learn more <ArrowRight className="h-3 w-3" />
                </div>
              </AnimatedCard>
            ))}
          </div>
        </section>

        {/* Security section */}
        <section className="max-w-7xl mx-auto px-6 py-16">
          <AnimatedCard className="p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary shrink-0">
              <Shield className="h-8 w-8" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Enterprise-grade security
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
                Your data is encrypted in transit and at rest. We undergo regular
                third-party security audits and maintain SOC 2 Type II compliance.
                Role-based access control is built in from day one.
              </p>
            </div>
            <Button variant="outline" size="sm" className="shrink-0">
              Security overview
            </Button>
          </AnimatedCard>
        </section>

        {/* CTA */}
        <section className="max-w-7xl mx-auto px-6 py-20">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-4">
              Ready to modernize your supply chain?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Join thousands of wholesale businesses already using SupplyBase.
            </p>
            <Button
              size="lg"
              className="h-11 px-8 gap-2 shadow-lg shadow-primary/25"
              render={<Link href="/auth/register" />} nativeButton={false}
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded bg-primary">
              <span className="text-primary-foreground font-bold text-xs">S</span>
            </div>
            <span className="text-sm font-medium text-foreground">SupplyBase</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © 2026 SupplyBase. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
