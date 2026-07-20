"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import Link from "next/link";
import { Loader2, ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { toast } from "sonner";

import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  async function onSubmit(_values: ForgotPasswordFormValues) {
    // UI-only placeholder — no backend implementation yet
    await new Promise((r) => setTimeout(r, 1200));
    toast.success("If that email exists, a reset link has been sent.");
    setSubmitted(true);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="flex items-center justify-between mb-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
            <span className="text-primary-foreground font-bold text-sm">S</span>
          </div>
          <span className="font-semibold text-foreground tracking-tight">SupplyBase</span>
        </Link>
        <ThemeToggle />
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-card p-6">
        {submitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-4 space-y-3"
          >
            <div className="flex justify-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10">
                <CheckCircle2 className="h-7 w-7 text-primary" />
              </div>
            </div>
            <h2 className="text-base font-semibold text-foreground">Check your email</h2>
            <p className="text-sm text-muted-foreground">
              We sent a password reset link to{" "}
              <span className="font-medium text-foreground">{getValues("email")}</span>
            </p>
            <Link href="/login">
              <Button variant="outline" className="mt-4 w-full gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Button>
            </Link>
          </motion.div>
        ) : (
          <>
            <div className="mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted mb-4">
                <Mail className="h-5 w-5 text-muted-foreground" />
              </div>
              <h1 className="text-xl font-semibold text-foreground tracking-tight">
                Forgot your password?
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your email and we&apos;ll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-destructive"
                  >
                    {errors.email.message}
                  </motion.p>
                )}
              </div>

              <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Send reset link"
                )}
              </Button>
            </form>

            <div className="mt-5 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
