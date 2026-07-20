"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, ArrowRight, Building2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { signupSchema, type SignupFormValues } from "@/lib/validations/auth";
import { signupAction } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { cn } from "@/lib/utils";

const ROLES = [
  {
    value: "BUYER" as const,
    label: "Buyer",
    description: "Source products from suppliers",
    icon: ShoppingCart,
  },
  {
    value: "SUPPLIER" as const,
    label: "Supplier",
    description: "List and sell your products",
    icon: Building2,
  },
];

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"BUYER" | "SUPPLIER">("BUYER");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- zodResolver type diverges from RHF Resolver generic
    resolver: zodResolver(signupSchema) as any,
    defaultValues: { role: "BUYER" },
  });

  const watchedRole = watch("role");

  function selectRole(role: "BUYER" | "SUPPLIER") {
    setSelectedRole(role);
    setValue("role", role, { shouldValidate: true });
  }

  async function onSubmit(values: SignupFormValues) {
    const result = await signupAction(values);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Account created! Welcome to SupplyBase.");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Header */}
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
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Create your account
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Join thousands of B2B businesses on SupplyBase
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Role selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">I am a</Label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((role) => {
                const isSelected = watchedRole === role.value;
                return (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => selectRole(role.value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all duration-150",
                      isSelected
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-muted/30 text-muted-foreground hover:border-border/80 hover:bg-muted/50"
                    )}
                  >
                    <role.icon
                      className={cn(
                        "h-4 w-4",
                        isSelected ? "text-primary" : "text-current"
                      )}
                    />
                    <span className="text-xs font-medium">{role.label}</span>
                    <span className="text-[10px] leading-tight opacity-75">
                      {role.description}
                    </span>
                  </button>
                );
              })}
            </div>
            <input type="hidden" {...register("role")} />
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-medium">Full name</Label>
            <Input
              id="name"
              placeholder="Alex Johnson"
              autoComplete="name"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            {errors.name && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="text-xs text-destructive">{errors.name.message}</motion.p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium">Work email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="text-xs text-destructive">{errors.email.message}</motion.p>
            )}
          </div>

          {/* Company (conditionally shown) */}
          <AnimatePresence>
            {(selectedRole === "SUPPLIER" || selectedRole === "BUYER") && (
              <motion.div
                key="company"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-1.5 overflow-hidden"
              >
                <Label htmlFor="companyName" className="text-xs font-medium">
                  Company name{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="companyName"
                  placeholder="Acme Corp"
                  {...register("companyName")}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 8 chars, 1 uppercase, 1 number"
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                className="pr-10"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="text-xs text-destructive">{errors.password.message}</motion.p>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-xs font-medium">
              Confirm password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="text-xs text-destructive">{errors.confirmPassword.message}</motion.p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full gap-2 mt-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Create account
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-foreground font-medium hover:underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
