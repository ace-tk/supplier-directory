"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { createSession, destroySession } from "@/lib/session";
import { loginSchema, signupSchema } from "@/lib/validations/auth";
import type { LoginFormValues, SignupFormValues } from "@/lib/validations/auth";
import { ensureDemoUsersSeeded } from "@/lib/seed";

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
