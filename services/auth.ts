"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { createSession, destroySession } from "@/lib/session";
import { loginSchema, signupSchema, forgotPasswordSchema, resetPasswordSchema } from "@/lib/validations/auth";
import type { LoginFormValues, SignupFormValues, ForgotPasswordFormValues, ResetPasswordFormValues } from "@/lib/validations/auth";
import { ensureDemoUsersSeeded } from "@/lib/seed";
import { createPasswordResetToken, consumePasswordResetToken, markPasswordResetTokenUsed } from "@/lib/password-reset";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function loginAction(
  values: LoginFormValues
): Promise<ActionResult<{ role: string }>> {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { email, password, rememberMe } = parsed.data;

  try {
    await ensureDemoUsersSeeded();

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return { success: false, error: "Invalid email or password" };
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return { success: false, error: "Invalid email or password" };
    }

    await createSession(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      rememberMe
    );

    return { success: true, data: { role: user.role } };
  } catch (err) {
    console.error("[loginAction]", err);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function signupAction(
  values: SignupFormValues
): Promise<ActionResult<void>> {
  const parsed = signupSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { name, email, password, role, companyName } = parsed.data;

  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return { success: false, error: "An account with this email already exists" };
    }

    const hashed = await hashPassword(password);

    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashed,
        role,
        ...(role === "SUPPLIER" && companyName
          ? {
              supplier: {
                create: { companyName },
              },
            }
          : {}),
        ...(role === "BUYER"
          ? {
              buyer: {
                create: { companyName: companyName ?? name },
              },
            }
          : {}),
        ...(role === "FREELANCER"
          ? {
              freelancer: {
                create: {},
              },
            }
          : {}),
      },
    });

    await createSession({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    return { success: true, data: undefined };
  } catch (err) {
    console.error("[signupAction]", err);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/**
 * Real token creation — no longer a UI-only mock. Always returns success
 * regardless of whether the email exists (standard account-enumeration
 * prevention). This codebase has no email provider, so nothing is actually
 * dispatched; the caller must be told that honestly rather than shown a
 * fake "email sent" confirmation (see the forgot-password page's copy).
 */
export async function requestPasswordResetAction(
  values: ForgotPasswordFormValues
): Promise<ActionResult<void>> {
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (user) {
    await createPasswordResetToken(user.id);
  }

  return { success: true, data: undefined };
}

export async function resetPasswordAction(
  token: string,
  values: ResetPasswordFormValues
): Promise<ActionResult<void>> {
  if (!token) return { success: false, error: "This reset link is missing a token." };

  const parsed = resetPasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await consumePasswordResetToken(token);
  if ("error" in result) return { success: false, error: result.error };

  const hashed = await hashPassword(parsed.data.password);
  await db.user.update({ where: { id: result.userId }, data: { password: hashed } });
  await markPasswordResetTokenUsed(token);

  return { success: true, data: undefined };
}
